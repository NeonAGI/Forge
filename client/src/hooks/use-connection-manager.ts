import { useState, useRef, useCallback } from 'react';
import { useEvent } from '@/contexts/event-context';

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'failed';
export type ConnectionError = {
  type: 'network' | 'auth' | 'server' | 'audio' | 'unknown';
  message: string;
  timestamp: number;
  recoverable: boolean;
};

interface ConnectionStats {
  connectionAttempts: number;
  successfulConnections: number;
  failedConnections: number;
  lastConnectionTime: number | null;
  totalUptime: number;
  averageConnectionTime: number;
}

interface ConnectionManagerConfig {
  maxRetryAttempts?: number;
  retryDelayMs?: number;
  exponentialBackoff?: boolean;
  healthCheckIntervalMs?: number;
  connectionTimeoutMs?: number;
}

const DEFAULT_CONFIG: Required<ConnectionManagerConfig> = {
  maxRetryAttempts: 3,
  retryDelayMs: 1000,
  exponentialBackoff: true,
  healthCheckIntervalMs: 30000,
  connectionTimeoutMs: 15000,
};

export interface ConnectionManager {
  state: ConnectionState;
  error: ConnectionError | null;
  stats: ConnectionStats;
  config: Required<ConnectionManagerConfig>;
  
  // Connection management
  connect: () => Promise<void>;
  disconnect: () => void;
  retry: () => Promise<void>;
  
  // Health monitoring
  isHealthy: () => boolean;
  getConnectionQuality: () => 'excellent' | 'good' | 'poor' | 'unknown';
  
  // Error handling
  clearError: () => void;
  canRetry: () => boolean;
  
  // Configuration
  updateConfig: (newConfig: Partial<ConnectionManagerConfig>) => void;
}

export function useConnectionManager(
  connectFunction: () => Promise<void>,
  disconnectFunction: () => void,
  initialConfig?: ConnectionManagerConfig
): ConnectionManager {
  const { logClientEvent } = useEvent();
  const config = { ...DEFAULT_CONFIG, ...initialConfig };
  
  const [state, setState] = useState<ConnectionState>('disconnected');
  const [error, setError] = useState<ConnectionError | null>(null);
  const [stats, setStats] = useState<ConnectionStats>({
    connectionAttempts: 0,
    successfulConnections: 0,
    failedConnections: 0,
    lastConnectionTime: null,
    totalUptime: 0,
    averageConnectionTime: 0,
  });
  
  const retryCountRef = useRef(0);
  const connectionStartTimeRef = useRef<number | null>(null);
  const connectionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const healthCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastHealthCheckRef = useRef<number>(Date.now());
  
  const clearError = useCallback(() => {
    setError(null);
    logClientEvent({ type: 'connection_error_cleared' }, '', 'connection');
  }, [logClientEvent]);
  
  const updateStats = useCallback((connectionSuccess: boolean, connectionTime?: number) => {
    setStats(prev => {
      const newStats = {
        ...prev,
        connectionAttempts: prev.connectionAttempts + 1,
      };
      
      if (connectionSuccess) {
        newStats.successfulConnections = prev.successfulConnections + 1;
        newStats.lastConnectionTime = Date.now();
        
        if (connectionTime) {
          const totalTime = prev.averageConnectionTime * prev.successfulConnections + connectionTime;
          newStats.averageConnectionTime = totalTime / newStats.successfulConnections;
        }
      } else {
        newStats.failedConnections = prev.failedConnections + 1;
      }
      
      return newStats;
    });
  }, []);
  
  const setConnectionError = useCallback((errorType: ConnectionError['type'], message: string, recoverable = true) => {
    const connectionError: ConnectionError = {
      type: errorType,
      message,
      timestamp: Date.now(),
      recoverable,
    };
    
    setError(connectionError);
    logClientEvent({
      type: 'connection_error',
      errorType,
      message,
      recoverable,
    }, '', 'error');
  }, [logClientEvent]);
  
  const canRetry = useCallback(() => {
    return retryCountRef.current < config.maxRetryAttempts && 
           (error?.recoverable !== false) &&
           (state === 'failed' || state === 'disconnected');
  }, [config.maxRetryAttempts, error?.recoverable, state]);
  
  const calculateRetryDelay = useCallback(() => {
    if (!config.exponentialBackoff) {
      return config.retryDelayMs;
    }
    
    return Math.min(
      config.retryDelayMs * Math.pow(2, retryCountRef.current),
      30000 // Max 30 seconds
    );
  }, [config.exponentialBackoff, config.retryDelayMs]);
  
  const startHealthCheck = useCallback(() => {
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
    }
    
    healthCheckIntervalRef.current = setInterval(() => {
      lastHealthCheckRef.current = Date.now();
      
      if (state === 'connected') {
        logClientEvent({ type: 'health_check', status: 'ok' }, '', 'system');
      }
    }, config.healthCheckIntervalMs);
  }, [config.healthCheckIntervalMs, state, logClientEvent]);
  
  const stopHealthCheck = useCallback(() => {
    if (healthCheckIntervalRef.current) {
      clearInterval(healthCheckIntervalRef.current);
      healthCheckIntervalRef.current = null;
    }
  }, []);
  
  const connect = useCallback(async () => {
    if (state === 'connecting' || state === 'connected') {
      return;
    }
    
    setState('connecting');\n    connectionStartTimeRef.current = Date.now();\n    clearError();\n    \n    logClientEvent({\n      type: 'connection_attempt',\n      attempt: retryCountRef.current + 1,\n      maxAttempts: config.maxRetryAttempts,\n    }, '', 'connection');\n    \n    // Set connection timeout\n    connectionTimeoutRef.current = setTimeout(() => {\n      if (state === 'connecting') {\n        setConnectionError('network', 'Connection timeout', true);\n        setState('failed');\n        updateStats(false);\n      }\n    }, config.connectionTimeoutMs);\n    \n    try {\n      await connectFunction();\n      \n      // Clear timeout on success\n      if (connectionTimeoutRef.current) {\n        clearTimeout(connectionTimeoutRef.current);\n        connectionTimeoutRef.current = null;\n      }\n      \n      const connectionTime = connectionStartTimeRef.current \n        ? Date.now() - connectionStartTimeRef.current \n        : 0;\n      \n      setState('connected');\n      retryCountRef.current = 0;\n      updateStats(true, connectionTime);\n      startHealthCheck();\n      \n      logClientEvent({\n        type: 'connection_success',\n        connectionTime,\n        attempt: retryCountRef.current + 1,\n      }, '', 'connection');\n      \n    } catch (err: any) {\n      // Clear timeout on error\n      if (connectionTimeoutRef.current) {\n        clearTimeout(connectionTimeoutRef.current);\n        connectionTimeoutRef.current = null;\n      }\n      \n      const errorMessage = err.message || 'Unknown connection error';\n      let errorType: ConnectionError['type'] = 'unknown';\n      let recoverable = true;\n      \n      // Categorize errors\n      if (errorMessage.includes('API key') || errorMessage.includes('auth')) {\n        errorType = 'auth';\n        recoverable = false;\n      } else if (errorMessage.includes('network') || errorMessage.includes('timeout')) {\n        errorType = 'network';\n      } else if (errorMessage.includes('server') || errorMessage.includes('502') || errorMessage.includes('503')) {\n        errorType = 'server';\n      } else if (errorMessage.includes('microphone') || errorMessage.includes('audio')) {\n        errorType = 'audio';\n        recoverable = false;\n      }\n      \n      setConnectionError(errorType, errorMessage, recoverable);\n      setState('failed');\n      updateStats(false);\n      \n      // Auto-retry if possible\n      if (canRetry() && recoverable) {\n        retryCountRef.current++;\n        const delay = calculateRetryDelay();\n        \n        logClientEvent({\n          type: 'connection_retry_scheduled',\n          retryCount: retryCountRef.current,\n          delayMs: delay,\n        }, '', 'connection');\n        \n        setTimeout(() => {\n          if (state === 'failed') {\n            setState('reconnecting');\n            connect();\n          }\n        }, delay);\n      }\n    }\n  }, [state, config, connectFunction, clearError, logClientEvent, updateStats, canRetry, calculateRetryDelay, setConnectionError, startHealthCheck]);\n  \n  const disconnect = useCallback(() => {\n    setState('disconnected');\n    retryCountRef.current = 0;\n    connectionStartTimeRef.current = null;\n    \n    // Clear timeouts and intervals\n    if (connectionTimeoutRef.current) {\n      clearTimeout(connectionTimeoutRef.current);\n      connectionTimeoutRef.current = null;\n    }\n    \n    stopHealthCheck();\n    clearError();\n    \n    try {\n      disconnectFunction();\n      logClientEvent({ type: 'disconnection_success' }, '', 'connection');\n    } catch (err: any) {\n      logClientEvent({ \n        type: 'disconnection_error', \n        error: err.message \n      }, '', 'error');\n    }\n  }, [disconnectFunction, stopHealthCheck, clearError, logClientEvent]);\n  \n  const retry = useCallback(async () => {\n    if (!canRetry()) {\n      logClientEvent({ type: 'retry_not_allowed', reason: 'max_attempts_reached' }, '', 'connection');\n      return;\n    }\n    \n    retryCountRef.current++;\n    clearError();\n    await connect();\n  }, [canRetry, clearError, connect, logClientEvent]);\n  \n  const isHealthy = useCallback(() => {\n    if (state !== 'connected') return false;\n    \n    const timeSinceLastCheck = Date.now() - lastHealthCheckRef.current;\n    return timeSinceLastCheck < config.healthCheckIntervalMs * 2;\n  }, [state, config.healthCheckIntervalMs]);\n  \n  const getConnectionQuality = useCallback((): 'excellent' | 'good' | 'poor' | 'unknown' => {\n    if (state !== 'connected') return 'unknown';\n    \n    const successRate = stats.connectionAttempts > 0 \n      ? stats.successfulConnections / stats.connectionAttempts \n      : 0;\n    \n    if (successRate >= 0.9 && stats.averageConnectionTime < 5000) return 'excellent';\n    if (successRate >= 0.8 && stats.averageConnectionTime < 10000) return 'good';\n    if (successRate >= 0.6) return 'poor';\n    \n    return 'unknown';\n  }, [state, stats]);\n  \n  const updateConfig = useCallback((newConfig: Partial<ConnectionManagerConfig>) => {\n    Object.assign(config, newConfig);\n    logClientEvent({ type: 'config_updated', newConfig }, '', 'system');\n  }, [config, logClientEvent]);\n  \n  return {\n    state,\n    error,\n    stats,\n    config,\n    connect,\n    disconnect,\n    retry,\n    isHealthy,\n    getConnectionQuality,\n    clearError,\n    canRetry,\n    updateConfig,\n  };\n}