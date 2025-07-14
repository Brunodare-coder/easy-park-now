/**
 * Authentication Provider
 * 
 * This provider manages user authentication state throughout the application.
 * It handles login, logout, token management, and user session persistence.
 * 
 * Features:
 * - JWT token management
 * - Automatic token refresh
 * - User session persistence
 * - Authentication state management
 * - Protected route handling
 */

'use client';

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

// Types
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'DRIVER' | 'HOST' | 'ADMIN';
  isEmailVerified: boolean;
  profileImage?: string;
  phone?: string;
  createdAt: string;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => void;
  updateUser: (userData: Partial<User>) => void;
  refreshToken: () => Promise<void>;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  role?: 'DRIVER' | 'HOST';
}

interface AuthProviderProps {
  children: ReactNode;
}

// Create context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// API base URL
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

/**
 * Authentication Provider Component
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Check if user is authenticated
  const isAuthenticated = !!user && !!token;

  /**
   * Initialize authentication state from localStorage
   */
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const storedToken = localStorage.getItem('auth_token');
        const storedUser = localStorage.getItem('auth_user');

        if (storedToken && storedUser) {
          setToken(storedToken);
          setUser(JSON.parse(storedUser));
          
          // Verify token is still valid
          await verifyToken(storedToken);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        // Clear invalid auth data
        localStorage.removeItem('auth_token');
        localStorage.removeItem('auth_user');
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  /**
   * Verify token validity with backend
   */
  const verifyToken = async (authToken: string): Promise<void> => {
    try {
      const response = await fetch(`${API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Token verification failed');
      }

      const data = await response.json();
      if (data.success && data.data.user) {
        setUser(data.data.user);
      } else {
        throw new Error('Invalid user data');
      }
    } catch (error) {
      console.error('Token verification error:', error);
      // Clear invalid auth data
      setToken(null);
      setUser(null);
      localStorage.removeItem('auth_token');
      localStorage.removeItem('auth_user');
      throw error;
    }
  };

  /**
   * Login function
   */
  const login = async (email: string, password: string): Promise<void> => {
    try {
      setIsLoading(true);
      
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Login failed');
      }

      if (data.success && data.data.user && data.data.token) {
        const { user: userData, token: authToken } = data.data;
        
        // Update state
        setUser(userData);
        setToken(authToken);
        
        // Persist to localStorage
        localStorage.setItem('auth_token', authToken);
        localStorage.setItem('auth_user', JSON.stringify(userData));
        
        // Redirect based on user role
        const redirectPath = userData.role === 'ADMIN' ? '/admin' : '/dashboard';
        router.push(redirectPath);
      } else {
        throw new Error('Invalid response data');
      }
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Register function
   */
  const register = async (userData: RegisterData): Promise<void> => {
    try {
      setIsLoading(true);
      
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Registration failed');
      }

      if (data.success && data.data.user && data.data.token) {
        const { user: newUser, token: authToken } = data.data;
        
        // Update state
        setUser(newUser);
        setToken(authToken);
        
        // Persist to localStorage
        localStorage.setItem('auth_token', authToken);
        localStorage.setItem('auth_user', JSON.stringify(newUser));
        
        // Redirect to dashboard
        router.push('/dashboard');
      } else {
        throw new Error('Invalid response data');
      }
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Logout function
   */
  const logout = (): void => {
    // Clear state
    setUser(null);
    setToken(null);
    
    // Clear localStorage
    localStorage.removeItem('auth_token');
    localStorage.removeItem('auth_user');
    
    // Redirect to home
    router.push('/');
  };

  /**
   * Update user data
   */
  const updateUser = (userData: Partial<User>): void => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem('auth_user', JSON.stringify(updatedUser));
    }
  };

  /**
   * Refresh authentication token
   */
  const refreshToken = async (): Promise<void> => {
    try {
      if (!token) {
        throw new Error('No token available');
      }

      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Token refresh failed');
      }

      if (data.success && data.data.token) {
        const newToken = data.data.token;
        setToken(newToken);
        localStorage.setItem('auth_token', newToken);
      } else {
        throw new Error('Invalid refresh response');
      }
    } catch (error) {
      console.error('Token refresh error:', error);
      // If refresh fails, logout user
      logout();
      throw error;
    }
  };

  /**
   * Auto-refresh token before expiration
   */
  useEffect(() => {
    if (!token) return;

    // Decode JWT to get expiration time
    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expirationTime = payload.exp * 1000; // Convert to milliseconds
      const currentTime = Date.now();
      const timeUntilExpiration = expirationTime - currentTime;
      
      // Refresh token 5 minutes before expiration
      const refreshTime = timeUntilExpiration - (5 * 60 * 1000);
      
      if (refreshTime > 0) {
        const refreshTimeout = setTimeout(() => {
          refreshToken().catch(console.error);
        }, refreshTime);
        
        return () => clearTimeout(refreshTimeout);
      } else {
        // Token is already expired or will expire soon
        logout();
      }
    } catch (error) {
      console.error('Token parsing error:', error);
      logout();
    }
  }, [token]);

  // Context value
  const contextValue: AuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    updateUser,
    refreshToken,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

/**
 * Higher-order component for protecting routes
 */
export const withAuth = <P extends object>(
  WrappedComponent: React.ComponentType<P>,
  requiredRole?: 'DRIVER' | 'HOST' | 'ADMIN'
) => {
  const AuthenticatedComponent: React.FC<P> = (props) => {
    const { isAuthenticated, user, isLoading } = useAuth();
    const router = useRouter();

    useEffect(() => {
      if (!isLoading) {
        if (!isAuthenticated) {
          router.push('/login');
          return;
        }

        if (requiredRole && user?.role !== requiredRole) {
          router.push('/unauthorized');
          return;
        }
      }
    }, [isAuthenticated, user, isLoading, router]);

    if (isLoading) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="spinner w-8 h-8"></div>
        </div>
      );
    }

    if (!isAuthenticated || (requiredRole && user?.role !== requiredRole)) {
      return null;
    }

    return <WrappedComponent {...props} />;
  };

  AuthenticatedComponent.displayName = `withAuth(${WrappedComponent.displayName || WrappedComponent.name})`;
  
  return AuthenticatedComponent;
};
