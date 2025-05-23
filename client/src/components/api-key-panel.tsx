import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from '@/components/ui/tabs';
import { useApiKeys } from '@/hooks/use-api-keys';
import { Loader, Check, AlertTriangle, Key, RefreshCw, EyeIcon, EyeOffIcon, Zap } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface ApiKeyPanelProps {
  onClose?: () => void;
}

export function ApiKeyPanel({ onClose }: ApiKeyPanelProps) {
  const { apiKeyStatuses, isLoading, error: apiError, updateApiKeys, testApiConnections } = useApiKeys();
  
  const [activeTab, setActiveTab] = useState('openai');
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [weatherApiKey, setWeatherApiKey] = useState('');
  const [showKeys, setShowKeys] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(apiError);

  useEffect(() => {
    setError(apiError);
  }, [apiError]);

  // Validate OpenAI API key format
  const isValidOpenaiKey = (key: string) => {
    // OpenAI keys can be:
    // - Project keys: sk-proj-...
    // - User keys: sk-...
    // - Organization keys: sk-...
    // All should be at least 40+ characters
    return key.startsWith('sk-') && key.length >= 40;
  };

  // Validate Weather API key format - this may vary based on the specific API
  const isValidWeatherKey = (key: string) => {
    // Most API keys are at least 16 characters
    return key.length >= 16;
  };

  const handleTestConnections = async () => {
    setIsTesting(true);
    setError(null);
    setSuccess(null);
    
    try {
      await testApiConnections();
      setSuccess('API connections tested successfully');
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      console.error('Error testing API connections:', err);
      setError(err.message || 'Failed to test API connections');
    } finally {
      setIsTesting(false);
    }
  };

  const handleSubmit = async (type: 'openai' | 'weather' | 'both') => {
    setIsSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      console.log(`[API-KEY-PANEL] Attempting to save ${type} key(s)`);
      
      // Validate keys based on which ones are being submitted
      if ((type === 'openai' || type === 'both') && openaiApiKey && !isValidOpenaiKey(openaiApiKey)) {
        console.log(`[API-KEY-PANEL] OpenAI key validation failed: length=${openaiApiKey.length}, starts with sk-: ${openaiApiKey.startsWith('sk-')}`);
        throw new Error('Invalid OpenAI API key format. Keys must start with "sk-" and be at least 40 characters long.');
      }

      if ((type === 'weather' || type === 'both') && weatherApiKey && !isValidWeatherKey(weatherApiKey)) {
        throw new Error('Invalid Weather API key format');
      }

      // Prepare data to send based on which keys are being updated
      const keysToUpdate: { openaiApiKey?: string; weatherApiKey?: string } = {};
      
      if (type === 'openai' || type === 'both') {
        keysToUpdate.openaiApiKey = openaiApiKey;
      }
      
      if (type === 'weather' || type === 'both') {
        keysToUpdate.weatherApiKey = weatherApiKey;
      }

      // If we're not updating any keys, don't proceed
      if (Object.keys(keysToUpdate).length === 0) {
        throw new Error('No API keys provided');
      }

      // Send the update request
      console.log(`[API-KEY-PANEL] Sending update request with:`, { ...keysToUpdate, openaiApiKey: keysToUpdate.openaiApiKey ? `${keysToUpdate.openaiApiKey.substring(0,10)}...` : undefined });
      await updateApiKeys(keysToUpdate);
      
      // Clear inputs for security
      setOpenaiApiKey('');
      setWeatherApiKey('');
      setShowKeys(false);
      
      // Show success message
      setSuccess(`API ${type === 'both' ? 'keys' : 'key'} updated successfully`);
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (err: any) {
      console.error('Error updating API keys:', err);
      setError(err.message || 'Failed to update API keys');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper function to render connection status indicator
  const renderStatusIndicator = (status: 'unknown' | 'working' | 'error') => {
    let colorClass = 'bg-gray-400'; // Default for unknown
    let tooltipText = 'Connection status unknown';
    
    if (status === 'working') {
      colorClass = 'bg-green-500';
      tooltipText = 'Connection working';
    } else if (status === 'error') {
      colorClass = 'bg-red-500';
      tooltipText = 'Connection error';
    }
    
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`w-3 h-3 rounded-full ${colorClass} ring-2 ring-background inline-block mr-2`}></div>
          </TooltipTrigger>
          <TooltipContent>
            <p>{tooltipText}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  };

  return (
    <div className="bg-card glass-depth rounded-lg shadow-lg p-6 max-w-xl w-full mx-auto">
      <h2 className="text-2xl font-semibold mb-4 flex items-center">
        <Key className="mr-2" size={24} />
        API Key Settings
      </h2>
      
      {isLoading ? (
        <div className="flex justify-center items-center p-8">
          <Loader className="animate-spin h-8 w-8 text-accent" />
          <span className="ml-2">Loading API key status...</span>
        </div>
      ) : (
        <>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid grid-cols-2 mb-6">
              <TabsTrigger value="openai">OpenAI API</TabsTrigger>
              <TabsTrigger value="weather">Weather API</TabsTrigger>
            </TabsList>
            
            <TabsContent value="openai" className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-medium">OpenAI API Key</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  This key is used for AI image generation and other OpenAI features.
                </p>
                
                {apiKeyStatuses?.openaiApiKey.isSet && (
                  <div className="flex items-center p-2 bg-green-500/10 text-green-500 border border-green-300/20 rounded-md mb-4">
                    {renderStatusIndicator(apiKeyStatuses.openaiApiKey.status)}
                    <span className="text-sm">
                      OpenAI API key is set. Preview: {apiKeyStatuses.openaiApiKey.preview}
                    </span>
                  </div>
                )}
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="openai-key" className="text-sm font-medium">
                      {apiKeyStatuses?.openaiApiKey.isSet ? 'Enter New Key' : 'Enter Key'}
                    </label>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-muted-foreground">Show Input</span>
                      <Switch
                        checked={showKeys}
                        onCheckedChange={setShowKeys}
                        aria-label="Toggle key visibility"
                      />
                      {showKeys ? <EyeIcon className="h-3.5 w-3.5 ml-1 text-muted-foreground" /> : <EyeOffIcon className="h-3.5 w-3.5 ml-1 text-muted-foreground" />}
                    </div>
                  </div>
                  
                  <Input
                    id="openai-key"
                    placeholder="sk-..."
                    type={showKeys ? 'text' : 'password'}
                    value={openaiApiKey}
                    onChange={(e) => setOpenaiApiKey(e.target.value)}
                    className="w-full"
                  />
                  
                  {apiKeyStatuses?.openaiApiKey.isSet && (
                    <p className="text-xs text-amber-500/90 mt-1">
                      <AlertTriangle className="inline-block h-3 w-3 mr-1" />
                      For security reasons, existing keys cannot be viewed. Enter a new key to replace the current one.
                    </p>
                  )}
                  
                  <p className="text-xs text-muted-foreground mt-1">
                    Get your API key from the <a href="https://platform.openai.com/api-keys" className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">OpenAI dashboard</a>
                  </p>
                </div>
                
                <Button 
                  onClick={() => handleSubmit('openai')}
                  disabled={isSubmitting || !openaiApiKey}
                  className="w-full mt-4"
                  variant="default"
                >
                  {isSubmitting ? (
                    <>
                      <Loader className="animate-spin mr-2 h-4 w-4" />
                      Saving...
                    </>
                  ) : (
                    apiKeyStatuses?.openaiApiKey.isSet ? 'Update OpenAI API Key' : 'Save OpenAI API Key'
                  )}
                </Button>
              </div>
            </TabsContent>
            
            <TabsContent value="weather" className="space-y-4">
              <div className="space-y-2">
                <h3 className="text-lg font-medium">Weather API Key</h3>
                <p className="text-sm text-muted-foreground mb-2">
                  This key is used to fetch weather data for your dashboard.
                </p>
                
                {apiKeyStatuses?.weatherApiKey.isSet && (
                  <div className="flex items-center p-2 bg-green-500/10 text-green-500 border border-green-300/20 rounded-md mb-4">
                    {renderStatusIndicator(apiKeyStatuses.weatherApiKey.status)}
                    <span className="text-sm">
                      Weather API key is set. Preview: {apiKeyStatuses.weatherApiKey.preview}
                    </span>
                  </div>
                )}
                
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label htmlFor="weather-key" className="text-sm font-medium">
                      {apiKeyStatuses?.weatherApiKey.isSet ? 'Enter New Key' : 'Enter Key'}
                    </label>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-muted-foreground">Show Input</span>
                      <Switch
                        checked={showKeys}
                        onCheckedChange={setShowKeys}
                        aria-label="Toggle key visibility"
                      />
                      {showKeys ? <EyeIcon className="h-3.5 w-3.5 ml-1 text-muted-foreground" /> : <EyeOffIcon className="h-3.5 w-3.5 ml-1 text-muted-foreground" />}
                    </div>
                  </div>
                  
                  <Input
                    id="weather-key"
                    placeholder="Your Weather API key"
                    type={showKeys ? 'text' : 'password'}
                    value={weatherApiKey}
                    onChange={(e) => setWeatherApiKey(e.target.value)}
                    className="w-full"
                  />
                  
                  {apiKeyStatuses?.weatherApiKey.isSet && (
                    <p className="text-xs text-amber-500/90 mt-1">
                      <AlertTriangle className="inline-block h-3 w-3 mr-1" />
                      For security reasons, existing keys cannot be viewed. Enter a new key to replace the current one.
                    </p>
                  )}
                  
                  <p className="text-xs text-muted-foreground mt-1">
                    Get your API key from the <a href="https://www.weatherapi.com/my/" className="text-accent hover:underline" target="_blank" rel="noopener noreferrer">WeatherAPI.com dashboard</a>
                  </p>
                </div>
                
                <Button 
                  onClick={() => handleSubmit('weather')}
                  disabled={isSubmitting || !weatherApiKey}
                  className="w-full mt-4"
                  variant="default"
                >
                  {isSubmitting ? (
                    <>
                      <Loader className="animate-spin mr-2 h-4 w-4" />
                      Saving...
                    </>
                  ) : (
                    apiKeyStatuses?.weatherApiKey.isSet ? 'Update Weather API Key' : 'Save Weather API Key'
                  )}
                </Button>
              </div>
            </TabsContent>
          </Tabs>
          
          {/* Action buttons for all tabs */}
          <div className="mt-6 pt-4 border-t border-border/40">
            {/* Test connection button */}
            <Button
              onClick={handleTestConnections}
              disabled={isTesting || (!apiKeyStatuses?.openaiApiKey.isSet && !apiKeyStatuses?.weatherApiKey.isSet)}
              className="w-full mb-4"
              variant="outline"
            >
              {isTesting ? (
                <>
                  <Loader className="animate-spin mr-2 h-4 w-4" />
                  Testing Connections...
                </>
              ) : (
                <>
                  <Zap className="h-4 w-4 mr-2" />
                  Test API Connections
                </>
              )}
            </Button>

            {(openaiApiKey || weatherApiKey) && (
              <Button 
                onClick={() => handleSubmit('both')}
                disabled={isSubmitting || (!openaiApiKey && !weatherApiKey)}
                className="w-full mb-4"
                variant="default"
              >
                {isSubmitting ? (
                  <>
                    <Loader className="animate-spin mr-2 h-4 w-4" />
                    Saving All Keys...
                  </>
                ) : (
                  'Save All Keys'
                )}
              </Button>
            )}
            
            <Button
              onClick={() => window.location.reload()}
              variant="outline"
              className="w-full"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh Status
            </Button>
          </div>
          
          {/* Status messages */}
          {error && (
            <div className="mt-4 p-3 bg-red-500/10 border border-red-300/20 rounded-md text-red-500 flex items-start">
              <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              <span className="text-sm">{error}</span>
            </div>
          )}
          
          {success && (
            <div className="mt-4 p-3 bg-green-500/10 border border-green-300/20 rounded-md text-green-500 flex items-center">
              <Check className="h-5 w-5 mr-2" />
              <span className="text-sm">{success}</span>
            </div>
          )}
        </>
      )}
      
      {onClose && (
        <div className="mt-6 pt-4 border-t border-border/40">
          <Button 
            onClick={onClose}
            variant="ghost" 
            className="w-full"
          >
            Close
          </Button>
        </div>
      )}
    </div>
  );
} 