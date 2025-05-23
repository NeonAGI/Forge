import React from 'react';
import { useWeather } from '@/hooks/use-weather';
import { Cloud, CloudRain, Sun, Snowflake, CloudLightning, Moon, CloudFog, CloudMoon } from 'lucide-react';

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

// Define the day forecast item
interface DayForecastProps {
  day: string;
  temperature: string;
  weatherCode: number | string;
  isActive?: boolean;
  isToday?: boolean;
}

const DayForecast: React.FC<DayForecastProps> = ({ day, temperature, weatherCode, isActive = false, isToday = false }) => {
  return (
    <div className={`flex flex-col items-center py-2 px-2 flex-1 min-w-[14%] ${isActive ? 'border-b-2 border-white' : 'border-b-2 border-transparent'}`}>
      <div className="text-lg font-medium text-white mb-3 truncate">
        {isToday ? 'Today' : day}
      </div>
      <WeatherIcon weatherCode={weatherCode} className="h-8 w-8 mb-3 text-white" />
      <div className="text-xl font-light text-white">{temperature}°</div>
    </div>
  );
};

export const ForecastRow: React.FC = () => {
  const { dailyForecast, isLoading, currentWeather } = useWeather();
  
  if (isLoading) {
    return (
      <div className="flex justify-between animate-pulse overflow-x-auto">
        {[...Array(7)].map((_, i) => (
          <div key={i} className="flex flex-col items-center px-4 min-w-[14%]">
            <div className="h-5 w-16 bg-white/10 rounded-md mb-3"></div>
            <div className="h-8 w-8 bg-white/10 rounded-full mb-3"></div>
            <div className="h-6 w-8 bg-white/10 rounded-md"></div>
          </div>
        ))}
      </div>
    );
  }
  
  // Get current day of week
  const today = new Date().getDay();
  
  return (
    <div className="bg-black/30 backdrop-blur-sm rounded-xl p-1 w-full">
      <div className="flex overflow-x-auto md:overflow-x-hidden md:justify-between w-full">
        {dailyForecast.slice(0, 7).map((day, index) => (
          <DayForecast
            key={index}
            day={day.day}
            temperature={day.temperature}
            weatherCode={day.weatherCode}
            isActive={index === 0} // Today is always active
            isToday={index === 0} // First item is today
          />
        ))}
      </div>
    </div>
  );
}; 