import { useState, useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';

export interface UserSettings {
  location: string;
  temperatureUnit: 'F' | 'C';  // F for Fahrenheit, C for Celsius
  lastUpdated?: string;
}

interface UseSettingsReturn {
  userSettings: UserSettings | null;
  isLoading: boolean;
  error: string | null;
  updateUserSettings: (settings: Partial<UserSettings>) => Promise<UserSettings>;
  resetSettings: () => Promise<void>;
}

// Default settings - only used as last resort
const DEFAULT_SETTINGS: UserSettings = {
  location: '', // Intentionally left blank to force geolocation
  temperatureUnit: 'F'  // Default to Fahrenheit
};

export function useSettings(): UseSettingsReturn {
  const [userSettings, setUserSettings] = useState<UserSettings | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Load settings on mount
  useEffect(() => {
    async function loadSettings() {
      setIsLoading(true);
      setError(null);

      // First check localStorage - fastest source and most recent user preference
      let settingsFound = false;
      
      try {
        console.log('First checking localStorage for cached settings...');
        const savedSettings = localStorage.getItem('userSettings');
        
        if (savedSettings) {
          try {
            const parsedSettings = JSON.parse(savedSettings);
            console.log('Found settings in localStorage:', parsedSettings);
            
            // Validate that we have at least one needed field
            if (parsedSettings.location || parsedSettings.temperatureUnit) {
              setUserSettings(parsedSettings);
              settingsFound = true;
              console.log('Using cached settings from localStorage');
            }
          } catch (parseErr) {
            console.warn('Failed to parse localStorage settings, will try server', parseErr);
          }
        }
      } catch (storageErr) {
        console.warn('Could not access localStorage, will try server', storageErr);
      }
      
      // Then try to get settings from the server
      if (!settingsFound) {
        try {
          console.log('Attempting to load settings from server...');
          const response = await apiRequest('GET', '/api/settings');
          
          // Check if the response is OK before trying to parse JSON
          if (!response.ok) {
            console.warn(`Settings API returned status ${response.status}`);
            throw new Error(`Settings API returned status ${response.status}`);
          }
          
          const contentType = response.headers.get('content-type');
          if (!contentType || !contentType.includes('application/json')) {
            console.warn(`Settings API returned non-JSON content: ${contentType}`);
            throw new Error('Settings API returned non-JSON content');
          }
          
          const data = await response.json();
          console.log('Successfully loaded settings from server:', data);
          
          if (data.error) {
            throw new Error(data.error);
          }
          
          // Save to local storage for next time
          try {
            localStorage.setItem('userSettings', JSON.stringify(data));
          } catch (e) {
            console.warn('Failed to cache settings in localStorage:', e);
          }
          
          setUserSettings(data);
          settingsFound = true;
        } catch (err) {
          console.error('Failed to load settings from server:', err);
        }
      }
      
      // If we still have no settings, use the defaults
      if (!settingsFound) {
        console.log('No settings found in localStorage or server, using defaults');
        setUserSettings(DEFAULT_SETTINGS);
        
        // Try to cache these defaults
        try {
          localStorage.setItem('userSettings', JSON.stringify(DEFAULT_SETTINGS));
        } catch (e) {
          console.warn('Failed to save default settings to localStorage:', e);
        }
      }
      
      setIsLoading(false);
    }

    loadSettings();
  }, []);

  // Update settings function
  const updateUserSettings = async (settings: Partial<UserSettings>): Promise<UserSettings> => {
    setError(null);
    
    if (!userSettings) {
      throw new Error('Settings not initialized');
    }

    // Merge with existing settings
    const updatedSettings: UserSettings = {
      ...userSettings,
      ...settings,
      lastUpdated: new Date().toISOString()
    };
    
    console.log('Updating settings to:', updatedSettings);

    // First immediately update local state so UI is responsive
    setUserSettings(updatedSettings);
    
    // Also save to local storage for persistence
    try {
      localStorage.setItem('userSettings', JSON.stringify(updatedSettings));
      console.log('Saved updated settings to localStorage');
    } catch (e) {
      console.warn('Failed to save settings to localStorage:', e);
    }

    try {
      // Try to save to server
      console.log('Saving settings to server...');
      const response = await apiRequest('POST', '/api/settings', updatedSettings);
      
      if (!response.ok) {
        console.warn(`Server returned status ${response.status} when saving settings`);
        throw new Error(`Failed to save settings to server: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      console.log('Successfully saved settings to server:', data);
      
      // Update local state with server response
      setUserSettings(data);
      
      // Also update local storage with server response
      try {
        localStorage.setItem('userSettings', JSON.stringify(data));
      } catch (e) {
        console.warn('Failed to update localStorage with server response:', e);
      }
      
      return data;
    } catch (err) {
      console.error('Failed to save settings to server:', err);
      // We already updated local state and localStorage, so just return what we have
      return updatedSettings;
    }
  };
  
  // Reset settings function
  const resetSettings = async (): Promise<void> => {
    try {
      // Clear local storage
      localStorage.removeItem('userSettings');
      
      // Set back to defaults
      setUserSettings(DEFAULT_SETTINGS);
      
      // Try to clear on server too
      await apiRequest('POST', '/api/settings', DEFAULT_SETTINGS);
      
      console.log('Settings have been reset to defaults');
    } catch (err) {
      console.error('Error while resetting settings:', err);
      setError('Failed to reset settings');
    }
  };

  return {
    userSettings,
    isLoading,
    error,
    updateUserSettings,
    resetSettings
  };
} 