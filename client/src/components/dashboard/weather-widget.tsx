import React from "react";
import { useWeather } from "@/hooks/use-weather";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { WeatherIcon } from "@/components/icons/weather-icons";
import { RefreshCw, MapPin, Thermometer } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export const WeatherWidget: React.FC = () => {
  const { 
    currentWeather, 
    forecast, 
    location, 
    isLoading, 
    error, 
    refresh 
  } = useWeather();

  // Determine weather background pattern based on weather code
  const getWeatherClass = (code: string) => {
    if (code.startsWith('01') || code.startsWith('02')) return 'weather-clear';
    if (code.startsWith('03') || code.startsWith('04')) return 'weather-clouds';
    if (code.startsWith('09') || code.startsWith('10') || code.startsWith('11')) return 'weather-rain';
    return 'weather-clear'; // Default
  };

  const weatherClass = !isLoading && !error ? getWeatherClass(currentWeather.weatherCode) : 'weather-clear';

  return (
    <GlassCard 
      className={`col-span-1 glass-glow-cyan overflow-hidden weather-card ${weatherClass}`}
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
            onClick={refresh}
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
      ) : error ? (
        <div className="text-center py-4 text-destructive">
          <p>Could not load weather data</p>
          <Button 
            variant="outline" 
            size="sm" 
            className="mt-2 border-accent-alt/50 text-accent-alt hover:bg-accent-alt/20"
            onClick={refresh}
          >
            Try again
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="relative">
              <div className="flex items-baseline">
                <span className="text-5xl font-light bg-clip-text text-transparent bg-gradient-to-b from-[#f1f5fa] to-[#a0aec0]">
                  {currentWeather.temperature}
                </span>
                <span className="text-sm ml-1 text-text-muted">{currentWeather.unit}</span>
              </div>
              <div className="text-sm text-accent-alt flex items-center mt-1">
                <MapPin className="h-3 w-3 mr-1 inline-block" />
                {location}
              </div>
              <div className="mt-1 text-xs text-text-muted">
                {currentWeather.description}
              </div>
            </div>
            
            <div className="relative">
              {/* Glow effect behind the icon */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-accent-alt/10 blur-xl"></div>
              <WeatherIcon 
                weatherCode={currentWeather.weatherCode} 
                className="h-16 w-16 relative" 
              />
            </div>
          </div>
          
          {/* Separator with gradient */}
          <div className="w-full h-px bg-gradient-to-r from-transparent via-accent-alt/30 to-transparent mb-4"></div>
          
          <div className="grid grid-cols-4 gap-2 text-center">
            {forecast.map((item, index) => (
              <div key={index} className="text-xs relative backdrop-blur-sm rounded-lg p-1">
                <div className="text-text-muted font-medium">{item.time}</div>
                <div className="my-1 relative">
                  {/* Tiny glow behind each icon */}
                  <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-accent-alt/5 blur-sm"></div>
                  <WeatherIcon 
                    weatherCode={item.weatherCode} 
                    className={`h-6 w-6 mx-auto ${item.isDay ? 'text-accent-alt' : 'text-accent-alt/70'}`}
                  />
                </div>
                <div className="font-medium text-text">{item.temperature}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </GlassCard>
  );
};
