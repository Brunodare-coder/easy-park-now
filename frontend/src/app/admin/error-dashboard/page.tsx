/**
 * AI-Powered Error Dashboard
 * 
 * This admin dashboard provides comprehensive error monitoring and analysis
 * with AI-powered insights for the EasyParkNow platform.
 * 
 * Features:
 * - Real-time error statistics
 * - Error log filtering and search
 * - AI-powered error summarization
 * - Error resolution tracking
 * - Customizable system prompts
 */

'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/providers/AuthProvider';
import { useToast } from '@/providers/ToastProvider';
import { useLoading } from '@/providers/LoadingProvider';

// Types
interface ErrorLog {
  id: string;
  message: string;
  stack?: string;
  url?: string;
  userAgent?: string;
  severity: 'CRITICAL' | 'ERROR' | 'WARNING' | 'INFO';
  metadata: any;
  resolved: boolean;
  timestamp: string;
  resolvedAt?: string;
  resolvedBy?: string;
  resolutionNotes?: string;
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

interface ErrorStats {
  totalErrors: number;
  resolvedCount: number;
  unresolvedCount: number;
  errorsBySeverity: Record<string, number>;
  errorsByDay: Array<{ date: string; count: number }>;
  topErrors: Array<{ message: string; count: number }>;
  period: string;
}

interface AISummary {
  summary: string;
  criticalIssues: string[];
  commonPatterns: string[];
  recommendations: string[];
  errorCategories: Record<string, number>;
  severityBreakdown: Record<string, number>;
  errorCount: number;
  period: string;
  generatedAt: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

export default function ErrorDashboard() {
  const { user, token } = useAuth();
  const { success, error: showError } = useToast();
  const { showLoading, hideLoading } = useLoading();

  // State
  const [errorLogs, setErrorLogs] = useState<ErrorLog[]>([]);
  const [errorStats, setErrorStats] = useState<ErrorStats | null>(null);
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null);
  const [filters, setFilters] = useState({
    page: 1,
    limit: 50,
    severity: '',
    resolved: '',
    search: '',
    days: 7
  });
  const [systemPrompt, setSystemPrompt] = useState(`You are an expert software engineer analyzing error logs for a parking booking platform called EasyParkNow. 

Your task is to:
1. Analyze the provided error logs
2. Identify patterns and common issues
3. Categorize errors by severity and type
4. Provide actionable recommendations for fixes
5. Highlight any critical issues that need immediate attention

Please provide a comprehensive summary with insights and recommendations.`);
  const [showPromptEditor, setShowPromptEditor] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);

  // Check if user is admin
  useEffect(() => {
    if (user && user.role !== 'ADMIN') {
      showError('Access Denied', 'You must be an admin to access this page');
      return;
    }
  }, [user]);

  // Fetch error logs
  const fetchErrorLogs = async () => {
    try {
      const queryParams = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value) queryParams.append(key, value.toString());
      });

      const response = await fetch(`${API_URL}/error-logs?${queryParams}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch error logs');
      }

      const data = await response.json();
      setErrorLogs(data.data.errorLogs);
    } catch (err) {
      showError('Error', 'Failed to fetch error logs');
      console.error('Error fetching logs:', err);
    }
  };

  // Fetch error statistics
  const fetchErrorStats = async () => {
    try {
      const response = await fetch(`${API_URL}/error-logs/stats?days=${filters.days}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch error stats');
      }

      const data = await response.json();
      setErrorStats(data.data);
    } catch (err) {
      showError('Error', 'Failed to fetch error statistics');
      console.error('Error fetching stats:', err);
    }
  };

  // Generate AI summary
  const generateAISummary = async () => {
    if (!apiKey) {
      setShowApiKeyInput(true);
      showError('API Key Required', 'Please provide your OpenRouter API key to use AI features');
      return;
    }

    try {
      showLoading('Generating AI summary...');

      const response = await fetch(`${API_URL}/error-logs/ai-summary`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-OpenRouter-API-Key': apiKey,
        },
        body: JSON.stringify({
          days: filters.days,
          limit: 100,
          systemPrompt
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to generate AI summary');
      }

      const data = await response.json();
      setAiSummary(data.data);
      success('AI Summary Generated', 'Error analysis completed successfully');
    } catch (err) {
      showError('AI Error', err instanceof Error ? err.message : 'Failed to generate AI summary');
      console.error('AI summary error:', err);
    } finally {
      hideLoading();
    }
  };

  // Mark error as resolved
  const markAsResolved = async (errorId: string, resolved: boolean) => {
    try {
      const response = await fetch(`${API_URL}/error-logs/${errorId}/resolve`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ resolved }),
      });

      if (!response.ok) {
        throw new Error('Failed to update error status');
      }

      success('Success', `Error ${resolved ? 'resolved' : 'reopened'}`);
      fetchErrorLogs();
      fetchErrorStats();
    } catch (err) {
      showError('Error', 'Failed to update error status');
      console.error('Error updating status:', err);
    }
  };

  // Initial data fetch
  useEffect(() => {
    if (user?.role === 'ADMIN' && token) {
      fetchErrorLogs();
      fetchErrorStats();
    }
  }, [user, token, filters]);

  // Render severity badge
  const renderSeverityBadge = (severity: string) => {
    const colors = {
      CRITICAL: 'badge-error',
      ERROR: 'badge-warning',
      WARNING: 'badge-secondary',
      INFO: 'badge-primary'
    };
    return <span className={`badge ${colors[severity as keyof typeof colors]}`}>{severity}</span>;
  };

  if (user?.role !== 'ADMIN') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
          <p className="text-gray-600">You must be an admin to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="container mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Error Dashboard</h1>
          <p className="text-gray-600">AI-powered error monitoring and analysis</p>
        </div>

        {/* API Key Input Modal */}
        {showApiKeyInput && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
              <h3 className="text-lg font-semibold mb-4">OpenRouter API Key Required</h3>
              <p className="text-gray-600 mb-4">
                To use AI-powered error analysis, please provide your OpenRouter API key:
              </p>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your OpenRouter API key"
                className="input w-full mb-4"
              />
              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    setShowApiKeyInput(false);
                    if (apiKey) generateAISummary();
                  }}
                  className="btn btn-primary flex-1"
                  disabled={!apiKey}
                >
                  Save & Generate
                </button>
                <button
                  onClick={() => setShowApiKeyInput(false)}
                  className="btn btn-outline flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Statistics Cards */}
        {errorStats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="card">
              <div className="card-content">
                <h3 className="text-sm font-medium text-gray-500">Total Errors</h3>
                <p className="text-2xl font-bold text-gray-900">{errorStats.totalErrors}</p>
                <p className="text-sm text-gray-600">Last {errorStats.period}</p>
              </div>
            </div>
            <div className="card">
              <div className="card-content">
                <h3 className="text-sm font-medium text-gray-500">Resolved</h3>
                <p className="text-2xl font-bold text-green-600">{errorStats.resolvedCount}</p>
                <p className="text-sm text-gray-600">
                  {errorStats.totalErrors > 0 
                    ? Math.round((errorStats.resolvedCount / errorStats.totalErrors) * 100)
                    : 0}% resolution rate
                </p>
              </div>
            </div>
            <div className="card">
              <div className="card-content">
                <h3 className="text-sm font-medium text-gray-500">Unresolved</h3>
                <p className="text-2xl font-bold text-red-600">{errorStats.unresolvedCount}</p>
                <p className="text-sm text-gray-600">Needs attention</p>
              </div>
            </div>
            <div className="card">
              <div className="card-content">
                <h3 className="text-sm font-medium text-gray-500">Critical Issues</h3>
                <p className="text-2xl font-bold text-red-600">
                  {errorStats.errorsBySeverity.CRITICAL || 0}
                </p>
                <p className="text-sm text-gray-600">High priority</p>
              </div>
            </div>
          </div>
        )}

        {/* AI Summary Section */}
        <div className="card mb-8">
          <div className="card-header">
            <div className="flex justify-between items-center">
              <div>
                <h2 className="card-title">AI-Powered Error Analysis</h2>
                <p className="card-description">
                  Get intelligent insights and recommendations for your error logs
                </p>
              </div>
              <div className="flex space-x-3">
                <button
                  onClick={() => setShowPromptEditor(!showPromptEditor)}
                  className="btn btn-outline btn-sm"
                >
                  {showPromptEditor ? 'Hide' : 'Edit'} Prompt
                </button>
                <button
                  onClick={generateAISummary}
                  className="btn btn-primary btn-sm"
                >
                  Generate AI Summary
                </button>
              </div>
            </div>
          </div>
          <div className="card-content">
            {/* System Prompt Editor */}
            {showPromptEditor && (
              <div className="mb-6 p-4 bg-gray-50 rounded-lg">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  System Prompt (Customize AI behavior)
                </label>
                <textarea
                  value={systemPrompt}
                  onChange={(e) => setSystemPrompt(e.target.value)}
                  rows={8}
                  className="input w-full font-mono text-sm"
                  placeholder="Enter your custom system prompt..."
                />
              </div>
            )}

            {/* AI Summary Display */}
            {aiSummary ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Summary</h3>
                  <p className="text-gray-700">{aiSummary.summary}</p>
                </div>

                {aiSummary.criticalIssues && aiSummary.criticalIssues.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2 text-red-600">Critical Issues</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {aiSummary.criticalIssues.map((issue, index) => (
                        <li key={index} className="text-gray-700">{issue}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {aiSummary.recommendations && aiSummary.recommendations.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2 text-blue-600">Recommendations</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {aiSummary.recommendations.map((rec, index) => (
                        <li key={index} className="text-gray-700">{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="text-sm text-gray-500">
                  Analysis generated on {new Date(aiSummary.generatedAt).toLocaleString()} 
                  • {aiSummary.errorCount} errors analyzed • {aiSummary.period}
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>Click "Generate AI Summary" to analyze your error logs with AI</p>
              </div>
            )}
          </div>
        </div>

        {/* Filters */}
        <div className="card mb-6">
          <div className="card-content">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Severity</label>
                <select
                  value={filters.severity}
                  onChange={(e) => setFilters({...filters, severity: e.target.value})}
                  className="input"
                >
                  <option value="">All Severities</option>
                  <option value="CRITICAL">Critical</option>
                  <option value="ERROR">Error</option>
                  <option value="WARNING">Warning</option>
                  <option value="INFO">Info</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                <select
                  value={filters.resolved}
                  onChange={(e) => setFilters({...filters, resolved: e.target.value})}
                  className="input"
                >
                  <option value="">All Status</option>
                  <option value="false">Unresolved</option>
                  <option value="true">Resolved</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Period</label>
                <select
                  value={filters.days}
                  onChange={(e) => setFilters({...filters, days: parseInt(e.target.value)})}
                  className="input"
                >
                  <option value={1}>Last 24 hours</option>
                  <option value={7}>Last 7 days</option>
                  <option value={30}>Last 30 days</option>
                  <option value={90}>Last 90 days</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({...filters, search: e.target.value})}
                  placeholder="Search errors..."
                  className="input"
                />
              </div>
              <div className="flex items-end">
                <button
                  onClick={() => {
                    fetchErrorLogs();
                    fetchErrorStats();
                  }}
                  className="btn btn-primary w-full"
                >
                  Apply Filters
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Error Logs Table */}
        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Error Logs</h2>
            <p className="card-description">Recent application errors and their details</p>
          </div>
          <div className="card-content">
            {errorLogs.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Timestamp</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Severity</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Message</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">User</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 font-medium text-gray-700">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {errorLogs.map((log) => (
                      <tr key={log.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {new Date(log.timestamp).toLocaleString()}
                        </td>
                        <td className="py-3 px-4">
                          {renderSeverityBadge(log.severity)}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900 max-w-md truncate">
                          {log.message}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">
                          {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'Anonymous'}
                        </td>
                        <td className="py-3 px-4">
                          <span className={`badge ${log.resolved ? 'badge-success' : 'badge-warning'}`}>
                            {log.resolved ? 'Resolved' : 'Open'}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <button
                            onClick={() => markAsResolved(log.id, !log.resolved)}
                            className={`btn btn-sm ${log.resolved ? 'btn-outline' : 'btn-success'}`}
                          >
                            {log.resolved ? 'Reopen' : 'Resolve'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No error logs found matching your criteria</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
