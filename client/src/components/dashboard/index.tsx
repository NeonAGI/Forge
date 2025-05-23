import React, { useState, useEffect, useRef } from "react";
import { Clock } from "./clock-widget";
import { UnifiedWeatherWidget } from "./unified-weather-widget";
import { WorldMap } from "./world-map";
import { Settings, Search, RefreshCw, AlertTriangle, MapPin, Save, X, LifeBuoy, User, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useWeather } from "@/hooks/use-weather";
import { useClock } from "@/hooks/use-clock";
import { useWeatherBackground } from "@/hooks/use-weather-background";
import { useSettings } from "@/hooks/use-settings";
import { SettingsPanel } from "@/components/settings-panel";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// We'll use a fallback color if images don't load
// Import can be enabled when assets are properly added
// import darkCloudyEveningBg from "../../assets/dark_cloudy_evening.png";
// import warmSunriseBg from "../../assets/warm_sunrise.png";
// import warmSunsetBg from "../../assets/warm_sunset.png";

export const Dashboard: React.FC = () => {
  const { currentWeather, isLoading, location, refreshWeather } = useWeather();
  const { time, date } = useClock();
  const { 
    generateBackground, 
    forceRefreshBackground,
    backgroundImage,
    preloadedImage,
    isTransitioning,
    colorPalette,
    isGenerating, 
    error: backgroundError
  } = useWeatherBackground();
  const { user, logout } = useAuth();
  const { userSettings } = useSettings();
  
  const [backgroundStyle, setBackgroundStyle] = useState({
    backgroundColor: '#0f172a', // Dark blue fallback
    backgroundImage: 'none'
  });
  
  const [preloadStyle, setPreloadStyle] = useState({
    backgroundColor: '#0f172a',
    backgroundImage: 'none'
  });
  
  // State to show/hide error toast and settings panel
  const [showErrorToast, setShowErrorToast] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Ref to track if we've already manually triggered background generation
  const hasManuallyTriggeredBg = useRef(false);
  
  // Helper function to get current time quarter (consistent with background hook)
  const getCurrentTimeQuarter = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon'; 
    if (hour >= 18 && hour <= 23) return 'evening';
    return 'night'; // 0-5 hours
  };

  // Handle generating a new background image
  const handleRefreshBackground = async () => {
    if (!isLoading && currentWeather && location) {
      console.log("Refreshing background image for:", location);
      
      // Use consistent time quarter logic
      const timeOfDay = getCurrentTimeQuarter();
      const weatherCondition = getWeatherCondition(currentWeather.weatherCode);
      
      // Always use user's settings location for background generation, never the weather API response location
      const userLocation = userSettings?.location || 'Fort Smith, AR'; // Fallback to user's preferred location
      console.log(`Generating background with: user_location=${userLocation}, api_location=${location}, weather=${weatherCondition}, time=${timeOfDay}`);
      
      try {
        // Force refresh the background using user's actual location
        await forceRefreshBackground(userLocation);
        
        // Log background status and force repaint if needed
        console.log("Background generation completed. Image loaded:", backgroundImage ? "Yes" : "No");
        
        if (!backgroundImage) {
          // If backgroundImage isn't set immediately, try refreshing after a short delay
          setTimeout(() => {
            console.log("Checking background image after delay:", backgroundImage ? "Image loaded" : "Still no image");
            // Force a re-render by updating a state variable
            setShowErrorToast(prev => {
              setTimeout(() => setShowErrorToast(false), 100);
              return true;
            });
          }, 1000);
        }
      } catch (error) {
        console.error("Error refreshing background:", error);
        setShowErrorToast(true);
        setTimeout(() => setShowErrorToast(false), 5000);
      }
    } else {
      console.warn("Cannot refresh background: weather data not loaded or location missing");
    }
  };
  
  // Show error toast when background error occurs
  useEffect(() => {
    if (backgroundError) {
      setShowErrorToast(true);
      const timer = setTimeout(() => setShowErrorToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [backgroundError]);
  
  // Ensure background is generated as soon as weather data is available
  useEffect(() => {
    if (!isLoading && currentWeather && location && !backgroundImage && !isGenerating && !hasManuallyTriggeredBg.current) {
      console.log("Manually triggering background generation since weather data is now available");
      hasManuallyTriggeredBg.current = true;
      handleRefreshBackground();
    }
  }, [isLoading, currentWeather, location]);
  
  // Helper function to determine weather condition from code
  function getWeatherCondition(weatherCode: string) {
    const weatherCodeNum = parseInt(weatherCode.replace(/\D/g, ''));
    
    if ([0, 1].includes(weatherCodeNum)) {
      return 'clear skies';
    } else if ([2, 3].includes(weatherCodeNum)) {
      return 'partly cloudy';
    } else if ([51, 53, 55, 61, 63, 65].includes(weatherCodeNum)) {
      return 'rainy conditions';
    } else if ([71, 73, 75].includes(weatherCodeNum)) {
      return 'light snow';
    } else if ([95, 96, 99].includes(weatherCodeNum)) {
      return 'thunderstorms';
    }
    
    return 'partly cloudy'; // Default
  }
  
  // Handle preloaded image for smooth transitions
  useEffect(() => {
    if (preloadedImage) {
      console.log("Setting preloaded background image");
      setPreloadStyle({
        backgroundColor: '#0f172a',
        backgroundImage: `url("${preloadedImage}")`,
      });
    }
  }, [preloadedImage]);

  // Determine background style based on weather and time
  useEffect(() => {
    if (backgroundImage) {
      // If we have a generated or cached background image, use it
      console.log("Using cached or generated background image");
      setBackgroundStyle({
        backgroundColor: '#0f172a', // Dark blue fallback
        backgroundImage: `url("${backgroundImage}")`,
      });
      return;
    } else {
      console.log("No background image available (backgroundImage is null or undefined)");
    }
    
    if (!isLoading && currentWeather) {
      console.log("Using fallback gradients based on weather:", currentWeather.weatherCode);
      const weatherCode = currentWeather.weatherCode;
      const weatherCodeNum = parseInt(weatherCode.replace(/\D/g, ''));
      const currentHour = new Date().getHours();
      
      const isDay = currentHour >= 6 && currentHour < 18;
      const isEvening = currentHour >= 18 && currentHour < 21;
      const isNight = currentHour >= 21 || currentHour < 6;
      
      // Otherwise use gradient fallbacks based on weather and time
      // Clear weather
      if ([0, 1].includes(weatherCodeNum)) {
        if (isDay) {
          setBackgroundStyle({
            backgroundColor: '#4a80b8', // Bright blue sky
            backgroundImage: 'linear-gradient(to bottom, #3490dc, #7cb8d9)'
          });
          // When you have the actual images, you'd use:
          // setBackgroundStyle({ backgroundImage: `url(${warmSunriseBg})` });
        }
        else if (isEvening) {
          setBackgroundStyle({
            backgroundColor: '#f97316', // Orange sunset
            backgroundImage: 'linear-gradient(to bottom, #f97316, #7e22ce)'
          });
          // setBackgroundStyle({ backgroundImage: `url(${warmSunsetBg})` });
        }
        else {
          // Night
          setBackgroundStyle({
            backgroundColor: '#0f172a', // Dark blue night
            backgroundImage: 'linear-gradient(to bottom, #0f172a, #1e293b)'
          });
          // setBackgroundStyle({ backgroundImage: `url(${clearNightBg})` });
        }
      }
      // Cloudy/stormy weather
      else if ([2, 3].includes(weatherCodeNum)) {
        // Cloudy
        setBackgroundStyle({
          backgroundColor: '#334155', // Slate
          backgroundImage: 'linear-gradient(to bottom, #334155, #64748b)'
        });
        // setBackgroundStyle({ backgroundImage: `url(${cloudyBg})` });
      }
      else if ([51, 53, 55, 61, 63, 65].includes(weatherCodeNum)) {
        // Rainy
        setBackgroundStyle({
          backgroundColor: '#0c4a6e', // Dark blue
          backgroundImage: 'linear-gradient(to bottom, #0c4a6e, #164e63)'
        });
        // setBackgroundStyle({ backgroundImage: `url(${rainyBg})` });
      }
      else if ([95, 96, 99].includes(weatherCodeNum)) {
        // Stormy
        setBackgroundStyle({
          backgroundColor: '#1e293b', // Darker slate
          backgroundImage: 'linear-gradient(to bottom, #1e293b, #0f172a)'
        });
        // setBackgroundStyle({ backgroundImage: `url(${stormyBg})` });
      }
      else {
        // Default fallback
        setBackgroundStyle({
          backgroundColor: '#0f172a', // Dark blue fallback
          backgroundImage: 'linear-gradient(to bottom, #0f172a, #1e293b)'
        });
        // setBackgroundStyle({ backgroundImage: `url(${darkCloudyEveningBg})` });
      }
    }
  }, [currentWeather, isLoading, backgroundImage]);

  // Toggle settings panel
  const toggleSettings = () => {
    setShowSettings(prev => !prev);
  };
  
  // Handle settings panel close
  const handleSettingsClose = () => {
    setShowSettings(false);
    // Refresh weather data when settings are closed
    // (in case the location was changed)
    refreshWeather();
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      {/* Primary background layer */}
      <div 
        className="absolute inset-0 w-full h-full bg-cover bg-center transition-all duration-1000 ease-in-out"
        style={backgroundStyle}
      ></div>
      
      {/* Preloaded background layer for smooth transitions */}
      {preloadedImage && (
        <div 
          className={`absolute inset-0 w-full h-full bg-cover bg-center transition-opacity duration-600 ease-in-out ${
            isTransitioning ? 'opacity-100' : 'opacity-0'
          }`}
          style={preloadStyle}
        ></div>
      )}
      
      {/* Dark overlay for better text readability */}
      <div className="absolute inset-0 bg-black/30"></div>
      
      {/* Content overlay */}
      <div className="relative z-10 container mx-auto px-6 py-6 flex flex-col h-screen">
        {/* Header with location, time and controls */}
        <header className="flex justify-between items-center">
          <div className="flex flex-col">
            <div className="text-sm text-white/80 flex items-center">
              <span>{location || "Brooklyn, New York, USA"}</span>
              <span className="mx-2">•</span>
              <Clock />
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            {/* Add refresh background button with dynamic theming */}
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white/80 hover:text-white rounded-full"
              style={{
                backgroundColor: colorPalette ? colorPalette.primaryRgba(0.1) : 'rgba(255, 255, 255, 0.1)',
                borderColor: colorPalette ? colorPalette.primaryRgba(0.2) : 'rgba(255, 255, 255, 0.2)'
              }}
              onClick={handleRefreshBackground}
              disabled={isGenerating || isLoading}
            >
              <RefreshCw className={`h-5 w-5 ${isGenerating ? 'animate-spin' : ''}`} />
            </Button>
            
            {/* User Profile */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="text-white/80 hover:text-white hover:bg-white/10 rounded-full"
                  title="User Profile"
                >
                  <User className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent 
                className="w-56 bg-black/80 backdrop-blur-md border-white/20 text-white" 
                align="end"
              >
                <DropdownMenuLabel className="text-white/90">
                  {user?.displayName || user?.username || 'User'}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-white/20" />
                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    <Link href="/api-keys" className="w-full cursor-pointer">
                      <Settings className="mr-2 h-4 w-4" />
                      <span>API Keys</span>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>
                <DropdownMenuSeparator className="bg-white/20" />
                <DropdownMenuItem 
                  onClick={() => logout()}
                  className="text-red-300 hover:text-red-200 hover:bg-red-500/20 cursor-pointer"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Logout</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            
            <Button variant="ghost" size="icon" className="text-white/80 hover:text-white hover:bg-white/10 rounded-full">
              <Search className="h-5 w-5" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white/80 hover:text-white rounded-full"
              style={{
                backgroundColor: colorPalette ? colorPalette.primaryRgba(0.1) : 'rgba(255, 255, 255, 0.1)',
                borderColor: colorPalette ? colorPalette.primaryRgba(0.2) : 'rgba(255, 255, 255, 0.2)'
              }}
              onClick={toggleSettings}
            >
              <Settings className="h-5 w-5" />
            </Button>
          </div>
        </header>
        
        {/* Error toast notification */}
        {showErrorToast && backgroundError && (
          <div className="absolute top-20 right-6 z-50 bg-red-500/80 text-white px-4 py-3 rounded-lg shadow-lg backdrop-blur-sm border border-red-400/50 transition-all duration-300 animate-in fade-in max-w-sm">
            <div className="flex items-start">
              <AlertTriangle className="h-5 w-5 mr-2 mt-0.5 flex-shrink-0" />
              <div className="flex-1">
                <p className="font-medium">Background generation failed</p>
                <p className="text-sm opacity-90 mt-1">{backgroundError}</p>
                {backgroundError?.includes('API key') && (
                  <Link href="/api-keys" className="inline-block mt-2 text-sm underline hover:no-underline text-white">
                    Configure API Keys →
                  </Link>
                )}
              </div>
              <button 
                onClick={() => setShowErrorToast(false)}
                className="ml-2 text-white/70 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
        
        {/* Settings panel */}
        {showSettings && (
          <SettingsPanel onClose={handleSettingsClose} />
        )}
        
        {/* Main content - unified weather widget and visualization */}
        <div className="flex-1 flex flex-col md:flex-row justify-between items-start md:items-center pt-6 md:pt-0">
          {/* Unified weather widget */}
          <div className="w-full md:w-3/5 mb-8 md:mb-0">
            <UnifiedWeatherWidget />
          </div>
          
          {/* World visualization */}
          <div className="w-full md:w-2/5 flex justify-center items-start md:items-center relative mt-8 md:mt-0">
            <div className="absolute right-0 top-0 md:relative md:right-auto md:top-auto">
              <WorldMap />
            </div>
          </div>
        </div>
      </div>
      
      {/* Include the VoiceOrb for voice control */}
      {/* The VoiceOrb is added in App.tsx so we don't need to repeat it here */}
    </div>
  );
};

export default Dashboard;
