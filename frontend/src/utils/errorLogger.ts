/**
 * Client-Side Error Logger
 * 
 * This utility automatically captures and logs client-side errors
 * to the backend for monitoring and analysis.
 * 
 * Features:
 * - Automatic error capture
 * - Manual error logging
 * - Error deduplication
 * - Batch error sending
 * - Offline error queuing
 */

interface ErrorLogData {
  message: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  timestamp?: string;
  severity?: 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO';
  metadata?: Record<string, any>;
}

interface QueuedError extends ErrorLogData {
  id: string;
  attempts: number;
  maxAttempts: number;
}

class ErrorLogger {
  private apiUrl: string;
  private token: string | null = null;
  private errorQueue: QueuedError[] = [];
  private isOnline: boolean = navigator.onLine;
  private maxQueueSize: number = 100;
  private batchSize: number = 10;
  private flushInterval: number = 30000; // 30 seconds
  private retryDelay: number = 5000; // 5 seconds
  private errorCache: Set<string> = new Set();
  private cacheExpiry: number = 300000; // 5 minutes

  constructor() {
    this.apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
    this.setupEventListeners();
    this.startPeriodicFlush();
    this.loadQueueFromStorage();
  }

  /**
   * Set authentication token
   */
  setToken(token: string | null) {
    this.token = token;
  }

  /**
   * Setup global error listeners
   */
  private setupEventListeners() {
    // Capture unhandled JavaScript errors
    window.addEventListener('error', (event) => {
      this.logError({
        message: event.message,
        stack: event.error?.stack,
        url: event.filename,
        severity: 'ERROR',
        metadata: {
          lineno: event.lineno,
          colno: event.colno,
          type: 'javascript_error'
        }
      });
    });

    // Capture unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      this.logError({
        message: `Unhandled Promise Rejection: ${event.reason}`,
        stack: event.reason?.stack,
        severity: 'ERROR',
        metadata: {
          type: 'promise_rejection',
          reason: event.reason
        }
      });
    });

    // Monitor online/offline status
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushQueue();
    });

    window.addEventListener('offline', () => {
      this.isOnline = false;
    });

    // Flush queue before page unload
    window.addEventListener('beforeunload', () => {
      this.saveQueueToStorage();
      if (this.errorQueue.length > 0) {
        // Use sendBeacon for reliable delivery during page unload
        this.sendBeacon();
      }
    });
  }

  /**
   * Log an error manually
   */
  logError(errorData: ErrorLogData) {
    const error: QueuedError = {
      id: this.generateId(),
      message: errorData.message,
      stack: errorData.stack,
      url: errorData.url || window.location.href,
      userAgent: navigator.userAgent,
      timestamp: errorData.timestamp || new Date().toISOString(),
      severity: errorData.severity || 'ERROR',
      metadata: {
        ...errorData.metadata,
        viewport: {
          width: window.innerWidth,
          height: window.innerHeight
        },
        screen: {
          width: screen.width,
          height: screen.height
        }
      },
      attempts: 0,
      maxAttempts: 3
    };

    // Check for duplicate errors (deduplication)
    const errorHash = this.hashError(error);
    if (this.errorCache.has(errorHash)) {
      return; // Skip duplicate error
    }

    // Add to cache with expiry
    this.errorCache.add(errorHash);
    setTimeout(() => {
      this.errorCache.delete(errorHash);
    }, this.cacheExpiry);

    // Add to queue
    this.addToQueue(error);

    // Try to send immediately if online
    if (this.isOnline) {
      this.flushQueue();
    }
  }

  /**
   * Log API errors
   */
  logApiError(response: Response, requestData?: any) {
    this.logError({
      message: `API Error: ${response.status} ${response.statusText}`,
      url: response.url,
      severity: response.status >= 500 ? 'ERROR' : 'WARNING',
      metadata: {
        type: 'api_error',
        status: response.status,
        statusText: response.statusText,
        requestData: requestData ? JSON.stringify(requestData).substring(0, 1000) : undefined
      }
    });
  }

  /**
   * Log network errors
   */
  logNetworkError(error: Error, url?: string) {
    this.logError({
      message: `Network Error: ${error.message}`,
      stack: error.stack,
      url: url,
      severity: 'ERROR',
      metadata: {
        type: 'network_error',
        name: error.name
      }
    });
  }

  /**
   * Log user action errors
   */
  logUserActionError(action: string, error: Error, context?: any) {
    this.logError({
      message: `User Action Error: ${action} - ${error.message}`,
      stack: error.stack,
      severity: 'WARNING',
      metadata: {
        type: 'user_action_error',
        action,
        context
      }
    });
  }

  /**
   * Add error to queue
   */
  private addToQueue(error: QueuedError) {
    // Remove oldest errors if queue is full
    if (this.errorQueue.length >= this.maxQueueSize) {
      this.errorQueue.shift();
    }

    this.errorQueue.push(error);
  }

  /**
   * Flush error queue to server
   */
  private async flushQueue() {
    if (!this.isOnline || this.errorQueue.length === 0 || !this.token) {
      return;
    }

    // Get batch of errors to send
    const batch = this.errorQueue.splice(0, this.batchSize);
    
    for (const error of batch) {
      try {
        await this.sendError(error);
      } catch (err) {
        // If sending fails, retry or discard
        error.attempts++;
        if (error.attempts < error.maxAttempts) {
          // Re-add to queue for retry
          this.errorQueue.unshift(error);
        } else {
          console.warn('Failed to send error after max attempts:', error.message);
        }
      }
    }
  }

  /**
   * Send individual error to server
   */
  private async sendError(error: QueuedError): Promise<void> {
    const response = await fetch(`${this.apiUrl}/error-logs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.token}`
      },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        url: error.url,
        userAgent: error.userAgent,
        timestamp: error.timestamp,
        severity: error.severity,
        metadata: error.metadata
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to send error: ${response.status}`);
    }
  }

  /**
   * Send errors using sendBeacon (for page unload)
   */
  private sendBeacon() {
    if (!this.token || this.errorQueue.length === 0) {
      return;
    }

    const data = JSON.stringify({
      errors: this.errorQueue.map(error => ({
        message: error.message,
        stack: error.stack,
        url: error.url,
        userAgent: error.userAgent,
        timestamp: error.timestamp,
        severity: error.severity,
        metadata: error.metadata
      }))
    });

    navigator.sendBeacon(`${this.apiUrl}/error-logs/batch`, data);
  }

  /**
   * Start periodic queue flushing
   */
  private startPeriodicFlush() {
    setInterval(() => {
      this.flushQueue();
    }, this.flushInterval);
  }

  /**
   * Generate unique ID for errors
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Create hash for error deduplication
   */
  private hashError(error: QueuedError): string {
    const key = `${error.message}-${error.url}-${error.stack?.split('\n')[0] || ''}`;
    return btoa(key).replace(/[^a-zA-Z0-9]/g, '').substring(0, 32);
  }

  /**
   * Save queue to localStorage
   */
  private saveQueueToStorage() {
    try {
      localStorage.setItem('errorQueue', JSON.stringify(this.errorQueue));
    } catch (err) {
      console.warn('Failed to save error queue to storage:', err);
    }
  }

  /**
   * Load queue from localStorage
   */
  private loadQueueFromStorage() {
    try {
      const stored = localStorage.getItem('errorQueue');
      if (stored) {
        this.errorQueue = JSON.parse(stored);
        localStorage.removeItem('errorQueue'); // Clear after loading
      }
    } catch (err) {
      console.warn('Failed to load error queue from storage:', err);
    }
  }

  /**
   * Clear error queue
   */
  clearQueue() {
    this.errorQueue = [];
    this.errorCache.clear();
    localStorage.removeItem('errorQueue');
  }

  /**
   * Get queue status
   */
  getQueueStatus() {
    return {
      queueLength: this.errorQueue.length,
      isOnline: this.isOnline,
      hasToken: !!this.token
    };
  }
}

// Create singleton instance
const errorLogger = new ErrorLogger();

// Export utility functions
export const logError = (errorData: ErrorLogData) => errorLogger.logError(errorData);
export const logApiError = (response: Response, requestData?: any) => errorLogger.logApiError(response, requestData);
export const logNetworkError = (error: Error, url?: string) => errorLogger.logNetworkError(error, url);
export const logUserActionError = (action: string, error: Error, context?: any) => errorLogger.logUserActionError(action, error, context);
export const setErrorLoggerToken = (token: string | null) => errorLogger.setToken(token);
export const clearErrorQueue = () => errorLogger.clearQueue();
export const getErrorQueueStatus = () => errorLogger.getQueueStatus();

export default errorLogger;
