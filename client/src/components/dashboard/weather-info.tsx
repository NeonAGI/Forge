import React from 'react';
import { useWeather } from '@/hooks/use-weather';
import { useSettings } from '@/hooks/use-settings';
import { Cloud, CloudRain, Sun, Snowflake, CloudLightning, Moon, CloudFog, CloudMoon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface WeatherIconProps {
  weatherCode: number | string;
  className?: string;
}

const WeatherIcon: React.FC<WeatherIconProps> = ({ weatherCode, className }) => {
  // Convert string to number if needed
  const code = typeof weatherCode === 'string' ? parseInt(weatherCode) : weatherCode;
  
  // If weatherCode is an icon string from OpenWeather API (e.g. "01d")
  if (typeof weatherCode === 'string' && weatherCode.length === 3) {
    switch (weatherCode) {
      case '01d': return <Sun className={className} />; // Clear sky (day)
      case '01n': return <Moon className={className} />; // Clear sky (night)
      case '02d': return <Cloud className={className} />; // Few clouds (day)
      case '02n': return <CloudMoon className={className} />; // Few clouds (night)
      case '03d':
      case '03n':
      case '04d':
      case '04n': return <Cloud className={className} />; // Scattered/broken clouds
      case '09d':
      case '09n':
      case '10d':
      case '10n': return <CloudRain className={className} />; // Rain
      case '11d':
      case '11n': return <CloudLightning className={className} />; // Thunderstorm
      case '13d':
      case '13n': return <Snowflake className={className} />; // Snow
      case '50d':
      case '50n': return <CloudFog className={className} />; // Mist
      default: return <Cloud className={className} />;
    }
  }
  
  // Handle WeatherAPI condition codes
  // Clear (1000)
  if (code === 1000) {
    return <Sun className={className} />;
  }
  
  // Partly cloudy (1003)
  if (code === 1003) {
    return <Cloud className={className} />;
  }
  
  // Cloudy conditions (1006, 1009)
  if (code === 1006 || code === 1009) {
    return <Cloud className={className} />;
  }
  
  // Mist, fog conditions (1030, 1135, 1147)
  if (code === 1030 || code === 1135 || code === 1147) {
    return <CloudFog className={className} />;
  }
  
  // Rain conditions
  if ([1063, 1150, 1153, 1180, 1183, 1186, 1189, 1192, 1195, 1240, 1243, 1246].includes(code)) {
    return <CloudRain className={className} />;
  }
  
  // Snow conditions
  if ([1066, 1114, 1117, 1210, 1213, 1216, 1219, 1222, 1225, 1255, 1258].includes(code)) {
    return <Snowflake className={className} />;
  }
  
  // Thunderstorm conditions
  if ([1087, 1273, 1276, 1279, 1282].includes(code)) {
    return <CloudLightning className={className} />;
  }
  
  // Default
  return <Cloud className={className} />;
};

export const WeatherInfo: React.FC = () => {
  const { currentWeather, location, isLoading } = useWeather();
  const { userSettings } = useSettings();
  
  // Get temperature unit symbol
  const tempUnitSymbol = userSettings?.temperatureUnit === 'C' ? '°C' : '°F';
  
  // Get a readable description if none provided by API
  const getWeatherDescription = (code: string | number) => {
    // If the API already provides a description, use it
    if (currentWeather.description && 
        currentWeather.description !== "Unknown") {
      return currentWeather.description
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
    }
    
    // Convert string to number if needed
    const codeNum = typeof code === 'string' ? parseInt(code.replace(/\D/g, '')) : code;
    
    // WeatherAPI condition codes
    if (codeNum === 1000) return 'Clear Sky';
    if (codeNum === 1003) return 'Partly Cloudy';
    if ([1006, 1009].includes(codeNum)) return 'Cloudy';
    if ([1030, 1135, 1147].includes(codeNum)) return 'Mist or Fog';
    if ([1063, 1150, 1153, 1180, 1183, 1186, 1189, 1192, 1195, 1240, 1243, 1246].includes(codeNum)) {
      return 'Rain';
    }
    if ([1066, 1114, 1117, 1210, 1213, 1216, 1219, 1222, 1225, 1255, 1258].includes(codeNum)) {
      return 'Snow';
    }
    if ([1087, 1273, 1276, 1279, 1282].includes(codeNum)) {
      return 'Thunderstorm';
    }
    
    return 'Partly cloudy'; // Default
  };
  
  if (isLoading) {
    return (
      <div className="animate-pulse">
        <div className="h-24 w-48 bg-white/10 rounded-md mb-4"></div>
        <div className="h-8 w-64 bg-white/10 rounded-md"></div>
      </div>
    );
  }
  
  return (
    <div className="text-white">
      {/* Large temperature display */}
      <div className="text-[128px] font-light leading-none mb-2">
        {currentWeather.temperature}°
      </div>
      
      {/* Weather description */}
      <div className="text-3xl font-light mb-8 text-white/90">
        {getWeatherDescription(currentWeather.weatherCode)}
      </div>
      
      {/* Additional info row */}
      <div className="flex space-x-6 text-white/80">
        <div>
          <div className="text-sm opacity-70 mb-1">Feels like</div>
          <div className="text-2xl">{currentWeather.feelsLike || parseInt(currentWeather.temperature) - 2}{tempUnitSymbol}</div>
        </div>
        <div>
          <div className="text-sm opacity-70 mb-1">Humidity</div>
          <div className="text-2xl">{currentWeather.humidity || "67"}%</div>
        </div>
        <div>
          <div className="text-sm opacity-70 mb-1">Wind</div>
          <div className="text-2xl">{currentWeather.windSpeed || "12"} mph</div>
        </div>
      </div>
      

    </div>
  );
}; 