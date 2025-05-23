import React, { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, LifeBuoy, Key, ExternalLink } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { UserSettings, useSettings } from '@/hooks/use-settings';
import { ApiKeyPanel } from './api-key-panel';
import { Link } from 'wouter';

interface SettingsPanelProps {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: SettingsPanelProps) {
  const { userSettings, updateUserSettings } = useSettings();
  const [location, setLocation] = useState('');
  const [temperatureUnit, setTemperatureUnit] = useState<'F' | 'C'>('F');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('general');

  useEffect(() => {
    if (userSettings) {
      setLocation(userSettings.location || '');
      setTemperatureUnit(userSettings.temperatureUnit || 'F');
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
      await updateUserSettings({ location, temperatureUnit });
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
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-card rounded-lg shadow-lg max-w-md w-full p-6 relative">
        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
        >
          <X size={20} />
        </button>
        
        <h2 className="text-2xl font-semibold mb-6">Settings</h2>
        
        <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6">
            <TabsTrigger value="general">General</TabsTrigger>
            <TabsTrigger value="apikeys">API Keys</TabsTrigger>
            <TabsTrigger value="advanced">Advanced</TabsTrigger>
          </TabsList>
          
          <TabsContent value="general" className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Location
              </label>
              <Input
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="Enter city, country"
                className="w-full"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Example: New York, US or London, UK
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium mb-1">
                Temperature Unit
              </label>
              <div className="flex space-x-2">
                <Button
                  type="button"
                  variant={temperatureUnit === 'F' ? 'default' : 'outline'}
                  onClick={() => setTemperatureUnit('F')}
                  className="flex-1"
                >
                  Fahrenheit (°F)
                </Button>
                <Button
                  type="button"
                  variant={temperatureUnit === 'C' ? 'default' : 'outline'}
                  onClick={() => setTemperatureUnit('C')}
                  className="flex-1"
                >
                  Celsius (°C)
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
              className="w-full"
            >
              {isSaving ? 'Saving...' : 'Save Settings'}
            </Button>
          </TabsContent>
          
          <TabsContent value="apikeys">
            <ApiKeyPanel />
          </TabsContent>
          
          <TabsContent value="advanced">
            <div className="space-y-6">
              <h3 className="text-lg font-medium mb-4">Advanced Settings</h3>
              
              <div className="space-y-4">
                <div className="p-4 rounded-lg border border-border/60 hover:border-border/80 transition-colors">
                  <Link href="/api-keys">
                    <a className="flex items-center justify-between group">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-background/50 rounded-full">
                          <Key className="h-5 w-5 text-accent" />
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">API Key Management</h4>
                          <p className="text-sm text-muted-foreground">Configure API keys for services</p>
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </a>
                  </Link>
                </div>
                
                <div className="p-4 rounded-lg border border-border/60 hover:border-border/80 transition-colors">
                  <Link href="/diagnosis">
                    <a className="flex items-center justify-between group">
                      <div className="flex items-center space-x-3">
                        <div className="p-2 bg-background/50 rounded-full">
                          <LifeBuoy className="h-5 w-5 text-accent" />
                        </div>
                        <div>
                          <h4 className="font-medium text-foreground">Styling Diagnosis</h4>
                          <p className="text-sm text-muted-foreground">Troubleshoot UI styling issues</p>
                        </div>
                      </div>
                      <ExternalLink className="h-4 w-4 opacity-50 group-hover:opacity-100 transition-opacity" />
                    </a>
                  </Link>
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground text-center mt-4">
                Advanced settings are for troubleshooting and configuration purposes.
              </p>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
} 