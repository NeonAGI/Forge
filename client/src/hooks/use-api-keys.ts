import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';

interface ApiKeyStatus {
  isSet: boolean;
  preview?: string;
  status: 'unknown' | 'working' | 'error';
}

interface ApiKeyStatuses {
  openaiApiKey: ApiKeyStatus;
  weatherApiKey: ApiKeyStatus;
}

interface UpdateApiKeysParams {
  openaiApiKey?: string;
  weatherApiKey?: string;
}

interface UseApiKeysReturn {
  apiKeyStatuses: ApiKeyStatuses | null;
  isLoading: boolean;
  error: string | null;
  updateApiKeys: (params: UpdateApiKeysParams) => Promise<ApiKeyStatuses>;
  testApiConnections: () => Promise<any>;
  fetchApiKeyStatuses: () => Promise<void>;
}

export function useApiKeys(): UseApiKeysReturn {
  const [apiKeyStatuses, setApiKeyStatuses] = useState<ApiKeyStatuses | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchApiKeyStatuses();
  }, []);

  const fetchApiKeyStatuses = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Use the authenticated API keys endpoint
      const response = await apiRequest('GET', '/api/auth/api-keys');
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || `Failed to fetch API key statuses: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Transform the database response to match the expected format
      const transformedData: ApiKeyStatuses = {
        openaiApiKey: {
          isSet: data.apiKeys.some((key: any) => key.provider === 'openai' && key.isActive),
          preview: data.apiKeys.find((key: any) => key.provider === 'openai')?.keyName || 'OpenAI Key',
          status: 'unknown' as const
        },
        weatherApiKey: {
          isSet: data.apiKeys.some((key: any) => key.provider === 'weather' && key.isActive),
          preview: data.apiKeys.find((key: any) => key.provider === 'weather')?.keyName || 'Weather Key',
          status: 'unknown' as const
        }
      };
      
      setApiKeyStatuses(transformedData);
    } catch (err: any) {
      console.error('Error fetching API key statuses:', err);
      setError(err.message || 'Failed to fetch API key statuses');
    } finally {
      setIsLoading(false);
    }
  };

  const updateApiKeys = async (params: UpdateApiKeysParams): Promise<ApiKeyStatuses> => {
    setError(null);

    try {
      // Update API keys one by one using the authenticated API
      if (params.openaiApiKey) {
        console.log('[USE-API-KEYS] Updating OpenAI API key...');
        const openaiResponse = await apiRequest('POST', '/api/auth/api-keys', {
          provider: 'openai',
          apiKey: params.openaiApiKey,
          keyName: 'OpenAI API Key'
        });
        
        console.log('[USE-API-KEYS] OpenAI API response status:', openaiResponse.status);
        
        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text();
          console.error('[USE-API-KEYS] OpenAI API error:', errorText);
          throw new Error(`Failed to update OpenAI API key: ${errorText}`);
        } else {
          console.log('[USE-API-KEYS] OpenAI API key updated successfully');
        }
      }
      
      if (params.weatherApiKey) {
        const weatherResponse = await apiRequest('POST', '/api/auth/api-keys', {
          provider: 'weather',
          apiKey: params.weatherApiKey,
          keyName: 'Weather API Key'
        });
        
        if (!weatherResponse.ok) {
          const errorText = await weatherResponse.text();
          throw new Error(`Failed to update Weather API key: ${errorText}`);
        }
      }
      
      // Refresh the statuses after updating
      await fetchApiKeyStatuses();
      
      // Return the updated statuses
      return apiKeyStatuses!;
    } catch (err: any) {
      console.error('Error updating API keys:', err);
      throw err;
    }
  };

  const testApiConnections = async () => {
    setError(null);

    try {
      // For user-specific API keys, we'll just refresh the status
      // since we can't test individual keys without exposing them
      await fetchApiKeyStatuses();
      
      return { message: 'API key status refreshed successfully' };
    } catch (err: any) {
      console.error('Error refreshing API key status:', err);
      throw err;
    }
  };

  return {
    apiKeyStatuses,
    isLoading,
    error,
    updateApiKeys,
    testApiConnections,
    fetchApiKeyStatuses,
  };
} 