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

interface WeatherIconProps {
  weatherCode: string;
  className?: string;
}

export const WeatherIcon: React.FC<WeatherIconProps> = ({ weatherCode, className }) => {
  // Default to sun if weather code is not found
  const IconComponent = weatherIconMap[weatherCode] || SunIcon;
  
  // Determine color class based on weather type
  const getColorClass = (code: string) => {
    if (code.startsWith('01') || code.startsWith('02')) return 'text-yellow-500'; // Clear or few clouds
    if (code.startsWith('03') || code.startsWith('04')) return 'text-gray-500'; // Clouds
    if (code.startsWith('09') || code.startsWith('10')) return 'text-blue-500'; // Rain
    if (code.startsWith('11')) return 'text-purple-500'; // Thunderstorm
    if (code.startsWith('13')) return 'text-blue-200'; // Snow
    return 'text-gray-400'; // Default for mist and others
  };
  
  return (
    <IconComponent className={cn(getColorClass(weatherCode), className)} />
  );
};
