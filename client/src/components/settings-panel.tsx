import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { X, LifeBuoy, Key, ExternalLink, Bug } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserSettings, useSettings } from '@/hooks/use-settings';
import { useIsMobile } from '@/hooks/use-mobile';
import { ApiKeyPanel } from './api-key-panel';
import { VoiceSelection, OpenAIVoice } from './voice-selection';
import { Link } from 'wouter';

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { userSettings, updateUserSettings } = useSettings();
  const isMobile = useIsMobile();
  const [location, setLocation] = useState('');
  const [temperatureUnit, setTemperatureUnit] = useState<'F' | 'C'>('F');
  const [voiceId, setVoiceId] = useState<OpenAIVoice>('alloy');
  const [verboseLogging, setVerboseLogging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    if (userSettings) {
      setLocation(userSettings.location || '');
      setTemperatureUnit(userSettings.temperatureUnit || 'F');
      setVoiceId(userSettings.voiceId || 'alloy');
      setVerboseLogging(userSettings.verboseLogging || false);
    }
  }, [userSettings]);

  const handleSave = async () => {
    if (!location.trim()) {
      setError('Please enter a location');
      return;
    }

    setIsSaving(true);
    setError(null);
    
    try {
      await updateUserSettings({ location, temperatureUnit, voiceId, verboseLogging });
      setSaveSuccess(true);
      
      // Close panel after successful save
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (err) {
      console.error('Failed to save settings:', err);
      setError('Failed to save settings. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-2 sm:p-4">
      <div className={`bg-card rounded-lg shadow-lg w-full ${isMobile ? 'max-w-full h-full flex flex-col' : 'max-w-md'} p-4 sm:p-6 relative`}>
        <button 
          onClick={onClose}
          className="absolute top-3 sm:top-4 right-3 sm:right-4 text-muted-foreground hover:text-foreground z-10"
        >
          <X size={isMobile ? 18 : 20} />
        </button>
        
        <h2 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6">Settings</h2>
        
        <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className={`w-full ${isMobile ? 'flex-1 flex flex-col' : ''}`}>
          <TabsList className={`grid w-full ${isMobile ? 'grid-cols-2' : 'grid-cols-4'} mb-4 sm:mb-6`}>
            <TabsTrigger value="general" className="text-xs sm:text-sm">General</TabsTrigger>
            <TabsTrigger value="voice" className="text-xs sm:text-sm">Voice</TabsTrigger>
            {!isMobile && <TabsTrigger value="apikeys" className="text-xs sm:text-sm">API Keys</TabsTrigger>}
            <TabsTrigger value="advanced" className="text-xs sm:text-sm">Advanced</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className={`space-y-3 sm:space-y-4 ${isMobile ? 'flex-1 overflow-y-auto' : ''}`}>
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1">
                Location
              </label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Enter city, country"
                className="w-full text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Example: New York, US or London, UK
              </p>
            </div>
            
            <div>
              <label className="block text-xs sm:text-sm font-medium mb-1">
                Temperature Unit
              </label>
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant={temperatureUnit === 'F' ? 'default' : 'outline'}
                  onClick={() => setTemperatureUnit('F')}
                  className="flex-1 text-xs sm:text-sm"
                  size={isMobile ? 'sm' : 'default'}
                >
                  {isMobile ? '°F' : 'Fahrenheit (°F)'}
                </Button>
                <Button
                  type="button"
                  variant={temperatureUnit === 'C' ? 'default' : 'outline'}
                  onClick={() => setTemperatureUnit('C')}
                  className="flex-1 text-xs sm:text-sm"
                  size={isMobile ? 'sm' : 'default'}
                >
                  {isMobile ? '°C' : 'Celsius (°C)'}
                </Button>
              </div>
            </div>
            
            {error && (
              <div className="text-red-500 text-sm">{error}</div>
            )}
            
            {saveSuccess && (
              <div className="text-green-500 text-sm">Settings saved successfully!</div>
            )}
            
            <Button 
              onClick={handleSave}
              disabled={isSaving || !location.trim()}
              className="w-full text-sm"
              size={isMobile ? 'sm' : 'default'}
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </TabsContent>
          
          <TabsContent value="voice" className={`${isMobile ? 'flex-1 overflow-y-auto' : ''}`}>
            <VoiceSelection 
              currentVoice={voiceId}
              onVoiceChange={setVoiceId}
              showPreview={!isMobile}
            />
          </TabsContent>
          
          {!isMobile && (
            <TabsContent value="apikeys">
              <ApiKeyPanel />
            </TabsContent>
          )}
          
          <TabsContent value="advanced" className={`${isMobile ? 'flex-1 overflow-y-auto' : ''}`}>
            <div className="space-y-4 sm:space-y-6">
              <h3 className="text-base sm:text-lg font-medium mb-3 sm:mb-4">Advanced Settings</h3>
              
              <div className="space-y-3 sm:space-y-4">
                <div className="p-3 sm:p-4 rounded-lg border border-border/60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 sm:space-x-3">
                      <div className="p-1.5 sm:p-2 bg-background/50 rounded-full">
                        <Bug className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
                      </div>
                      <div>
                        <h4 className="font-medium text-foreground text-sm sm:text-base">Verbose Logging</h4>
                        <p className="text-xs sm:text-sm text-muted-foreground">Enable detailed console logs for debugging</p>
                      </div>
                    </div>
                    <Switch
                      checked={verboseLogging}
                      onCheckedChange={setVerboseLogging}
                    />
                  </div>
                </div>
                
                <div className="p-3 sm:p-4 rounded-lg border border-border/60 hover:border-border/80 transition-colors">
                  <Link href="/api-keys">
                    <a className="flex items-center justify-between group">
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="p-1.5 sm:p-2 bg-background/50 rounded-full">
                          <Key className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground text-sm sm:text-base">API Key Management</h4>
                          <p className="text-xs sm:text-sm text-muted-foreground">Configure API keys for services</p>
                        </div>
                      </div>
                      <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </a>
                  </Link>
                </div>
                
                <div className="p-3 sm:p-4 rounded-lg border border-border/60 hover:border-border/80 transition-colors">
                  <Link href="/diagnosis">
                    <a className="flex items-center justify-between group">
                      <div className="flex items-center space-x-2 sm:space-x-3">
                        <div className="p-1.5 sm:p-2 bg-background/50 rounded-full">
                          <LifeBuoy className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground text-sm sm:text-base">Styling Diagnosis</h4>
                          <p className="text-xs sm:text-sm text-muted-foreground">Troubleshoot UI styling issues</p>
                        </div>
                      </div>
                      <ExternalLink className="h-3 w-3 sm:h-4 sm:w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </a>
                  </Link>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground text-center mt-3 sm:mt-4">
                Advanced settings are for troubleshooting and configuration purposes.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 