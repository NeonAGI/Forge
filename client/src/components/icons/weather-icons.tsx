import React from "react";
import { 
  SunIcon, 
  CloudIcon, 
  CloudRainIcon, 
  CloudSnowIcon, 
  CloudLightningIcon, 
  CloudFogIcon, 
  MoonIcon, 
  CloudMoonIcon 
} from "lucide-react";
import { cn } from "@/lib/utils";

// Weather code mappings based on OpenWeather API codes
// https://openweathermap.org/weather-conditions
const weatherIconMap: Record<string, React.ElementType> = {
  "01d": SunIcon,           // clear sky (day)
  "01n": MoonIcon,          // clear sky (night)
  "02d": CloudIcon,         // few clouds (day)
  "02n": CloudMoonIcon,     // few clouds (night)
  "03d": CloudIcon,         // scattered clouds
  "03n": CloudIcon,
  "04d": CloudIcon,         // broken clouds
  "04n": CloudIcon,
  "09d": CloudRainIcon,     // shower rain
  "09n": CloudRainIcon,
  "10d": CloudRainIcon,     // rain
  "10n": CloudRainIcon,
  "11d": CloudLightningIcon, // thunderstorm
  "11n": CloudLightningIcon,
  "13d": CloudSnowIcon,     // snow
  "13n": CloudSnowIcon,
  "50d": CloudFogIcon,      // mist
  "50n": CloudFogIcon
};

// Helper function to map WeatherAPI condition codes to appropriate icon
// WeatherAPI condition codes: https://www.weatherapi.com/docs/weather_conditions.json
const getWeatherIconByCode = (code: string | number, isDay: boolean = true): React.ElementType => {
  const codeNum = typeof code === 'string' ? parseInt(code) : code;
  
  // Clear conditions (1000)
  if (codeNum === 1000) {
    return isDay ? SunIcon : MoonIcon;
  }
  
  // Partly cloudy (1003)
  if (codeNum === 1003) {
    return isDay ? CloudIcon : CloudMoonIcon;
  }
  
  // Cloudy conditions (1006, 1009)
  if (codeNum === 1006 || codeNum === 1009) {
    return CloudIcon;
  }
  
  // Mist, fog conditions (1030, 1135, 1147)
  if (codeNum === 1030 || codeNum === 1135 || codeNum === 1147) {
    return CloudFogIcon;
  }
  
  // Rain conditions (1063, 1150, 1153, 1180, 1183, 1186, 1189, 1192, 1195, 1240, 1243, 1246)
  if ([1063, 1150, 1153, 1180, 1183, 1186, 1189, 1192, 1195, 1240, 1243, 1246].includes(codeNum)) {
    return CloudRainIcon;
  }
  
  // Snow conditions (1066, 1114, 1117, 1210, 1213, 1216, 1219, 1222, 1225, 1255, 1258)
  if ([1066, 1114, 1117, 1210, 1213, 1216, 1219, 1222, 1225, 1255, 1258].includes(codeNum)) {
    return CloudSnowIcon;
  }
  
  // Thunderstorm conditions (1087, 1273, 1276, 1279, 1282)
  if ([1087, 1273, 1276, 1279, 1282].includes(codeNum)) {
    return CloudLightningIcon;
  }
  
  // Default to cloud icon if unrecognized
  return CloudIcon;
};

interface WeatherIconProps {
  weatherCode: string;
  className?: string;
  isDay?: boolean;
}

// Determine color class based on weather type
const getColorClass = (code: string) => {
  if (code.startsWith('01') || code.startsWith('02')) return 'text-yellow-500'; // Clear or few clouds
  if (code.startsWith('03') || code.startsWith('04')) return 'text-gray-500'; // Clouds
  if (code.startsWith('09') || code.startsWith('10')) return 'text-blue-500'; // Rain
  if (code.startsWith('11')) return 'text-purple-500'; // Thunderstorm
  if (code.startsWith('13')) return 'text-blue-200'; // Snow
  return 'text-gray-400'; // Default for mist and others
};

export const WeatherIcon: React.FC<WeatherIconProps> = ({ weatherCode, className, isDay = true }) => {
  // If it's an OpenWeather API icon code (e.g. "01d"), use the icon map
  if (typeof weatherCode === 'string' && weatherCode.length === 3) {
    const IconComponent = weatherIconMap[weatherCode] || SunIcon;
    return <IconComponent className={cn(getColorClass(weatherCode), className)} />;
  }
  
  // Otherwise, treat it as a WeatherAPI condition code
  const IconComponent = getWeatherIconByCode(weatherCode, isDay);
  
  return (
    <IconComponent className={cn(className)} />
  );
};
