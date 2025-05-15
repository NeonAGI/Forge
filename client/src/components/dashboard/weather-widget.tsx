import React from "react";
import { useWeather } from "@/hooks/use-weather";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { WeatherIcon } from "@/components/icons/weather-icons";
import { RefreshCw } from "lucide-react";
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

  return (
    <GlassCard 
      title="Weather" 
      className="col-span-1"
      animationDelay={0.1}
      headerContent={
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-accent hover:text-text"
          onClick={refresh}
        >
          <RefreshCw className="h-5 w-5" />
        </Button>
      }
    >
      {isLoading ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Skeleton className="h-10 w-24 mb-2" />
              <Skeleton className="h-4 w-32" />
            </div>
            <Skeleton className="h-14 w-14 rounded-full" />
          </div>
          <div className="grid grid-cols-4 gap-2 mt-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="flex flex-col items-center space-y-1">
                <Skeleton className="h-4 w-8" />
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-8" />
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
            className="mt-2"
            onClick={refresh}
          >
            Try again
          </Button>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-baseline">
                <span className="text-4xl font-light">{currentWeather.temperature}</span>
                <span className="text-sm ml-1">{currentWeather.unit}</span>
              </div>
              <div className="text-sm text-accent mt-1">{location}</div>
            </div>
            
            <WeatherIcon 
              weatherCode={currentWeather.weatherCode} 
              className="h-14 w-14 text-blue-500" 
            />
          </div>
          
          <div className="mt-4 grid grid-cols-4 gap-2 text-center">
            {forecast.map((item, index) => (
              <div key={index} className="text-xs">
                <div>{item.time}</div>
                <div className="my-1">
                  <WeatherIcon 
                    weatherCode={item.weatherCode} 
                    className={`h-5 w-5 mx-auto ${item.isDay ? 'text-yellow-500' : 'text-gray-500'}`}
                  />
                </div>
                <div>{item.temperature}</div>
              </div>
            ))}
          </div>
        </>
      )}
    </GlassCard>
  );
};
