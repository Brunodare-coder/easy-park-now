/**
 * Loading Provider
 * 
 * This provider manages global loading states throughout the application.
 * It provides a simple API for showing and hiding loading indicators.
 */

'use client';

import React, { createContext, useContext, useState, ReactNode } from 'react';

// Types
interface LoadingContextType {
  isLoading: boolean;
  loadingMessage: string;
  setLoading: (loading: boolean, message?: string) => void;
  showLoading: (message?: string) => void;
  hideLoading: () => void;
}

interface LoadingProviderProps {
  children: ReactNode;
}

// Create context
const LoadingContext = createContext<LoadingContextType | undefined>(undefined);

// Custom hook to use loading context
export const useLoading = (): LoadingContextType => {
  const context = useContext(LoadingContext);
  if (context === undefined) {
    throw new Error('useLoading must be used within a LoadingProvider');
  }
  return context;
};

/**
 * Loading Provider Component
 */
export const LoadingProvider: React.FC<LoadingProviderProps> = ({ children }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('Loading...');

  const setLoading = (loading: boolean, message = 'Loading...') => {
    setIsLoading(loading);
    setLoadingMessage(message);
  };

  const showLoading = (message = 'Loading...') => {
    setLoading(true, message);
  };

  const hideLoading = () => {
    setLoading(false);
  };

  const contextValue: LoadingContextType = {
    isLoading,
    loadingMessage,
    setLoading,
    showLoading,
    hideLoading,
  };

  return (
    <LoadingContext.Provider value={contextValue}>
      {children}
      {isLoading && <LoadingOverlay message={loadingMessage} />}
    </LoadingContext.Provider>
  );
};

/**
 * Loading Overlay Component
 */
const LoadingOverlay: React.FC<{ message: string }> = ({ message }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 shadow-xl">
        <div className="flex items-center space-x-4">
          <div className="spinner w-6 h-6"></div>
          <span className="text-gray-700 font-medium">{message}</span>
        </div>
      </div>
    </div>
  );
};
