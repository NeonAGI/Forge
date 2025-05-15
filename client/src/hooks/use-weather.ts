import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

export interface WeatherData {
  currentWeather: {
    temperature: string;
    unit: string;
    weatherCode: string;
    description: string;
  };
  forecast: Array<{
    time: string;
    temperature: string;
    weatherCode: string;
    isDay: boolean;
  }>;
  location: string;
}

export function useWeather() {
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchWeatherData = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await apiRequest("GET", "/api/weather");
      const data = await response.json();
      setWeatherData(data);
    } catch (err) {
      console.error("Failed to fetch weather data:", err);
      setError("Failed to load weather data");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchWeatherData();

    // Refresh weather data every 30 minutes
    const intervalId = setInterval(fetchWeatherData, 30 * 60 * 1000);
    
    return () => clearInterval(intervalId);
  }, []);

  // Default data for initial rendering if needed
  const defaultData: WeatherData = {
    currentWeather: {
      temperature: "--",
      unit: "°F",
      weatherCode: "01d",
      description: "Unknown"
    },
    forecast: [
      { time: "Now", temperature: "--", weatherCode: "01d", isDay: true },
      { time: "2PM", temperature: "--", weatherCode: "01d", isDay: true },
      { time: "4PM", temperature: "--", weatherCode: "01d", isDay: true },
      { time: "6PM", temperature: "--", weatherCode: "01d", isDay: true }
    ],
    location: "Loading..."
  };

  return {
    currentWeather: weatherData?.currentWeather || defaultData.currentWeather,
    forecast: weatherData?.forecast || defaultData.forecast,
    location: weatherData?.location || defaultData.location,
    isLoading,
    error,
    refresh: fetchWeatherData
  };
}
