import React from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Thermometer, MapPin, RefreshCw, Cloud, CloudRain, Sun, Snowflake, CloudLightning, Moon, CloudFog, CloudMoon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useWeather } from "@/hooks/use-weather";
import { useSettings } from "@/hooks/use-settings";

// Simple component to display a weather icon based on the weather code
interface WeatherIconProps {
  weatherCode: number | string;
  isDay: boolean;
  className?: string;
}

const WeatherIcon: React.FC<WeatherIconProps> = ({ weatherCode, isDay, className }) => {
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
  
  // Process numeric weather codes from OpenWeather API
  // https://openweathermap.org/weather-conditions
  
  // Thunderstorm: 2xx
  if (code >= 200 && code < 300) {
    return <CloudLightning className={className} />;
  }
  
  // Drizzle: 3xx
  if (code >= 300 && code < 400) {
    return <CloudRain className={className} />;
  }
  
  // Rain: 5xx
  if (code >= 500 && code < 600) {
    return <CloudRain className={className} />;
  }
  
  // Snow: 6xx
  if (code >= 600 && code < 700) {
    return <Snowflake className={className} />;
  }
  
  // Atmosphere (fog, mist): 7xx
  if (code >= 700 && code < 800) {
    return <CloudFog className={className} />;
  }
  
  // Clear: 800
  if (code === 800) {
    return <Sun className={className} />;
  }
  
  // Clouds: 80x
  if (code > 800 && code < 900) {
    return <Cloud className={className} />;
  }
  
  // Handle legacy weather codes for backward compatibility
  switch (code) {
    case 0: // Clear sky
    case 1: // Mainly clear
      return <Sun className={className} />;
    case 2: // Partly cloudy
    case 3: // Overcast
      return <Cloud className={className} />;
    case 51: // Drizzle
    case 53:
    case 55:
    case 61: // Rain
    case 63:
    case 65:
      return <CloudRain className={className} />;
    case 71: // Snow
    case 73:
    case 75:
      return <Snowflake className={className} />;
    case 95: // Thunderstorm
    case 96:
    case 99:
      return <CloudLightning className={className} />;
    default:
      return <Cloud className={className} />;
  }
};

export const WeatherWidget: React.FC = () => {
  const { currentWeather, forecast, location, isLoading, refreshWeather, error } = useWeather();
  const { userSettings } = useSettings();
  
  // Get temperature unit symbol
  const tempUnit = userSettings?.temperatureUnit || 'F';
  const tempUnitSymbol = tempUnit === 'C' ? '°C' : '°F';

  // Determine weather background class based on weather codes
  const getWeatherClass = () => {
    if (!currentWeather) return "weather-clear";
    
    const code = typeof currentWeather.weatherCode === 'string' ? 
      parseInt(currentWeather.weatherCode) : 
      currentWeather.weatherCode;
    
    // Using WeatherAPI codes
    // Clear (1000)
    if (code === 1000) return "weather-clear";
    
    // Cloudy (1003, 1006, 1009)
    if ([1003, 1006, 1009].includes(code)) return "weather-clouds";
    
    // Mist/Fog (1030, 1135, 1147)
    if ([1030, 1135, 1147].includes(code)) return "weather-fog";
    
    // Rain/Drizzle (1063, 1150, 1153, 1180, 1183, 1186, 1189, 1192, 1195, 1240, 1243, 1246)
    if ([1063, 1150, 1153, 1180, 1183, 1186, 1189, 1192, 1195, 1240, 1243, 1246].includes(code)) {
      return "weather-rain";
    }
    
    // Snow (1066, 1114, 1117, 1210, 1213, 1216, 1219, 1222, 1225, 1255, 1258)
    if ([1066, 1114, 1117, 1210, 1213, 1216, 1219, 1222, 1225, 1255, 1258].includes(code)) {
      return "weather-snow";
    }
    
    // Thunderstorm (1087, 1273, 1276, 1279, 1282)
    if ([1087, 1273, 1276, 1279, 1282].includes(code)) {
      return "weather-rain";
    }
    
    return "weather-clear"; // Default
  };
  
  const weatherClass = getWeatherClass();

  return (
    <GlassCard 
      className={`col-span-1 glass-glow-cyan overflow-hidden weather-card ${weatherClass} h-full card-transition`}
      animationDelay={0.1}
      headerContent={
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Thermometer className="h-4 w-4 text-accent-alt mr-2" />
            <span className="text-sm font-medium text-text-muted">Weather</span>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-accent-alt hover:bg-white/10"
            onClick={refreshWeather}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-10 w-24 mb-2 bg-white/10" />
              <Skeleton className="h-4 w-32 bg-white/10" />
            </div>
            <Skeleton className="h-14 w-14 rounded-full bg-white/10" />
          </div>
          <div className="grid grid-cols-4 gap-2 mt-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex flex-col items-center space-y-1">
                <Skeleton className="h-4 w-8 bg-white/10" />
                <Skeleton className="h-8 w-8 rounded-full bg-white/10" />
                <Skeleton className="h-4 w-8 bg-white/10" />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="text-5xl font-light text-text">
                {currentWeather.temperature}°<span className="text-text-muted ml-0.5 text-2xl">{tempUnit}</span>
              </div>
              <div className="flex items-center mt-2 text-text-muted">
                <MapPin className="h-3.5 w-3.5 mr-1 text-accent-alt/70" />
                <span className="text-sm">{location}</span>
              </div>
              <div className="text-xs text-text-muted mt-1">
                {currentWeather.description}
              </div>
            </div>
            
            {/* Enhanced weather icon with glow */}
            <div className="relative">
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-accent-alt/20 blur-md"></div>
              <WeatherIcon 
                weatherCode={currentWeather.weatherCode}
                isDay={true}
                className="h-14 w-14 text-accent-alt relative z-10"
              />
            </div>
          </div>
          
          {/* Weather details row */}
          <div className="grid grid-cols-3 gap-2 mb-6">
            <div className="flex flex-col items-center bg-primary/30 rounded-lg py-2 backdrop-blur-sm border border-border/10">
              <span className="text-xs text-text-muted mb-1">Feels Like</span>
              <span className="text-lg text-text font-medium">{currentWeather.feelsLike || ""}°</span>
            </div>
            <div className="flex flex-col items-center bg-primary/30 rounded-lg py-2 backdrop-blur-sm border border-border/10">
              <span className="text-xs text-text-muted mb-1">Humidity</span>
              <span className="text-lg text-text font-medium">{currentWeather.humidity || ""}%</span>
            </div>
            <div className="flex flex-col items-center bg-primary/30 rounded-lg py-2 backdrop-blur-sm border border-border/10">
              <span className="text-xs text-text-muted mb-1">Wind</span>
              <span className="text-lg text-text font-medium">{currentWeather.windSpeed || ""} mph</span>
            </div>
          </div>
          
          {/* Hourly forecast */}
          <div className="grid grid-cols-4 gap-2 text-center">
            {forecast.map((item, index) => (
              <div key={index} className="text-xs relative backdrop-blur-sm rounded-lg p-2 bg-primary/20 border border-border/10">
                <div className="text-text-muted font-medium">{item.time}</div>
                <div className="my-1 relative">
                  {/* Enhanced glow behind each icon */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-accent-alt/20 blur-sm"></div>
                  <WeatherIcon 
                    weatherCode={item.weatherCode}
                    isDay={item.isDay}
                    className={`h-7 w-7 mx-auto ${item.isDay ? 'text-accent-alt' : 'text-accent-alt/70'}`}
                  />
                </div>
                <div className="font-medium text-text">{item.temperature}°</div>
              </div>
            ))}
          </div>
        </>
      )}
    </GlassCard>
  );
};
