import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";
import { useSettings } from "./use-settings";

export interface WeatherData {
  currentWeather: {
    temperature: string;
    unit: string;
    weatherCode: string;
    description: string;
    feelsLike?: string;
    humidity?: string;
    windSpeed?: string;
    windDirection?: number;
  };
  forecast: Array<{
    time: string;
    temperature: string;
    weatherCode: string;
    isDay: boolean;
  }>;
  dailyForecast: Array<{
    date: string;
    day: string;
    temperature: string;
    weatherCode: number;
  }>;
  location: string;
}

export function useWeather() {
  const { userSettings } = useSettings();
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  // Default to NOT using geolocation if settings exist
  const [useGeolocation, setUseGeolocation] = useState(false);

  // Initialize geolocation ONLY if no user location is set in settings
  // This effect runs once on component mount and whenever userSettings.location changes
  useEffect(() => {
    // Stop any geolocation use immediately if user has set a location
    if (userSettings?.location) {
      console.log("User has set a location in settings:", userSettings.location);
      setUseGeolocation(false);
      return; // Exit early, don't even try to get geolocation
    }
    
    // Only try to get geolocation if we don't have user settings
    if (!userSettings?.location && navigator.geolocation) {
      console.log("No location in settings, attempting to use geolocation as fallback");
      setUseGeolocation(true);
      
      navigator.geolocation.getCurrentPosition(
        (position) => {
          console.log("Got geolocation coordinates:", position.coords.latitude, position.coords.longitude);
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error("Error getting geolocation:", error);
          setUseGeolocation(false);
        }
      );
    } else if (!navigator.geolocation) {
      console.warn("Geolocation not supported by this browser");
      setUseGeolocation(false);
    }
  }, [userSettings?.location]);

  const fetchWeatherData = async (customLocation?: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      let url = "/api/weather";
      const params = new URLSearchParams();
      
      // STRICT PRIORITY ORDER:
      // 1. Custom location passed directly to this function
      // 2. User settings location from settings panel
      // 3. Geolocation coordinates (ONLY if no settings AND useGeolocation is true)
      
      if (customLocation) {
        console.log("USING CUSTOM LOCATION:", customLocation);
        params.append('location', customLocation);
      } else if (userSettings?.location) {
        console.log("USING USER SETTINGS LOCATION:", userSettings.location);
        params.append('location', userSettings.location);
      } else if (useGeolocation && userLocation) {
        console.log("USING GEOLOCATION:", userLocation.lat, userLocation.lng);
        params.append('lat', userLocation.lat.toString());
        params.append('lng', userLocation.lng.toString());
      } else {
        console.error("NO LOCATION SOURCE AVAILABLE - cannot fetch weather data");
        throw new Error("Location is required for weather data. Please set your location in settings.");
      }
      
      // ALWAYS use user's temperature unit preference if set
      if (userSettings?.temperatureUnit) {
        console.log("USING TEMPERATURE UNIT FROM SETTINGS:", userSettings.temperatureUnit);
        params.append('unit', userSettings.temperatureUnit);
      }
      
      // Append params to URL
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      console.log("WEATHER API REQUEST URL:", url);
      const response = await apiRequest("GET", url);
      
      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`);
      }
      
      const data = await response.json();
      
      // If we got data from the API but the user has specified settings,
      // make sure those settings are reflected in the response
      if (data && userSettings) {
        // Force temperature unit to match user setting
        if (userSettings.temperatureUnit && data.currentWeather) {
          data.currentWeather.unit = userSettings.temperatureUnit === 'C' ? '°C' : '°F';
        }
      }
      
      console.log("RECEIVED WEATHER DATA:", data ? "Yes" : "No", 
                 "Location:", data?.location || "None",
                 "Unit:", data?.currentWeather?.unit || "None");
                 
      setWeatherData(data);
    } catch (err) {
      console.error("Failed to fetch weather data:", err);
      setError("Failed to load weather data");
    } finally {
      setIsLoading(false);
    }
  };

  // Refresh function that can be called from outside
  const refreshWeather = () => {
    console.log("Manual refresh triggered");
    fetchWeatherData(userSettings?.location);
  };

  // Fetch weather data when settings change
  useEffect(() => {
    if (userSettings) {
      console.log("Settings changed, refreshing with settings:", 
                 "Location:", userSettings.location || "None", 
                 "Unit:", userSettings.temperatureUnit || "None");
      fetchWeatherData(userSettings.location);
    }
  }, [userSettings?.location, userSettings?.temperatureUnit]);

  // Initial fetch on component mount - separate from the settings effect
  // to ensure we always fetch data even if settings don't change
  useEffect(() => {
    console.log("Initial weather data fetch");
    fetchWeatherData(userSettings?.location);

    // Refresh weather data every 30 minutes
    const intervalId = setInterval(() => {
      console.log("Scheduled 30-min refresh");
      fetchWeatherData(userSettings?.location);
    }, 30 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Generate daily forecast from today
  const generateDailyForecast = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const today = new Date();
    const currentDay = today.getDay();
    
    // Ensure we always generate 7 days
    return Array.from({ length: 7 }, (_, i) => {
      const dayIndex = (currentDay + i) % 7;
      const date = new Date();
      date.setDate(today.getDate() + i);
      
      // If we have data from the API for this day, use it, otherwise use placeholder
      const dayForecast = weatherData?.dailyForecast?.[i];
      return {
        date: date.toISOString().split('T')[0],
        day: days[dayIndex],
        temperature: dayForecast?.temperature || "--",
        weatherCode: dayForecast?.weatherCode || 2
      };
    });
  };

  // Default data for initial rendering if needed
  const defaultData: WeatherData = {
    currentWeather: {
      temperature: "--",
      // ALWAYS use user's temperature unit or default to F
      unit: userSettings?.temperatureUnit === 'C' ? "°C" : "°F",
      weatherCode: "01d",
      description: "Unknown",
      feelsLike: "--",
      humidity: "--",
      windSpeed: "--",
      windDirection: 0
    },
    forecast: [
      { time: "Now", temperature: "--", weatherCode: "01d", isDay: true },
      { time: "2PM", temperature: "--", weatherCode: "01d", isDay: true },
      { time: "4PM", temperature: "--", weatherCode: "01d", isDay: true },
      { time: "6PM", temperature: "--", weatherCode: "01d", isDay: true }
    ],
    dailyForecast: [],
    // Make sure user's location shows up immediately while loading
    location: userSettings?.location || "Loading..."
  };

  // Dynamic daily forecast that starts from today
  const dailyForecast = weatherData?.dailyForecast || generateDailyForecast();

  return {
    currentWeather: weatherData?.currentWeather || defaultData.currentWeather,
    forecast: weatherData?.forecast || defaultData.forecast,
    dailyForecast,
    location: weatherData?.location || (userSettings?.location || defaultData.location),
    isLoading,
    error,
    refreshWeather
  };
}
