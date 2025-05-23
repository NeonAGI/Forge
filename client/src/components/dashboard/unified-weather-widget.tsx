import React, { useRef, useState, useEffect } from 'react';
import { useWeather } from '@/hooks/use-weather';
import { useSettings } from '@/hooks/use-settings';
import { Cloud, CloudRain, Sun, Snowflake, CloudLightning, Moon, CloudFog, CloudMoon, Navigation } from 'lucide-react';
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
    <div className={`flex flex-col items-center py-2 px-3 min-w-[80px] flex-shrink-0 transition-all duration-200 hover:bg-white/5 rounded-lg ${isActive ? 'bg-white/10' : ''}`}>
      <div className="text-xs font-medium text-white/90 mb-1 truncate">
        {isToday ? 'Today' : day.slice(0, 3)}
      </div>
      <WeatherIcon weatherCode={weatherCode} className="h-5 w-5 mb-1 text-white/90" />
      <div className="text-sm font-medium text-white">{temperature}°</div>
    </div>
  );
};

// New ForecastSection component with hover scrolling
interface ForecastSectionProps {
  dailyForecast: Array<{
    date: string;
    day: string;
    temperature: string;
    weatherCode: number;
  }> | undefined;
}

const ForecastSection: React.FC<ForecastSectionProps> = ({ dailyForecast }) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const scrollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check scroll position to update scroll indicators
  const checkScrollPosition = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 1);
    }
  };

  useEffect(() => {
    checkScrollPosition();
  }, [dailyForecast]);

  const startScrolling = (direction: 'left' | 'right') => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
    }

    scrollIntervalRef.current = setInterval(() => {
      if (scrollContainerRef.current) {
        const scrollAmount = direction === 'left' ? -2 : 2;
        scrollContainerRef.current.scrollLeft += scrollAmount;
        checkScrollPosition();
      }
    }, 16); // ~60fps
  };

  const stopScrolling = () => {
    if (scrollIntervalRef.current) {
      clearInterval(scrollIntervalRef.current);
      scrollIntervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      if (scrollIntervalRef.current) {
        clearInterval(scrollIntervalRef.current);
      }
    };
  }, []);

  return (
    <div className="border-t border-white/10 pt-6">
      <div className="text-lg font-medium text-white/90 mb-4">5-Day Forecast</div>
      <div className="relative">
        {/* Left hover zone */}
        {canScrollLeft && (
          <div
            className="absolute left-0 top-0 w-12 h-full z-10 cursor-pointer bg-gradient-to-r from-black/20 to-transparent"
            onMouseEnter={() => startScrolling('left')}
            onMouseLeave={stopScrolling}
          />
        )}
        
        {/* Right hover zone */}
        {canScrollRight && (
          <div
            className="absolute right-0 top-0 w-12 h-full z-10 cursor-pointer bg-gradient-to-l from-black/20 to-transparent"
            onMouseEnter={() => startScrolling('right')}
            onMouseLeave={stopScrolling}
          />
        )}

        {/* Scrollable forecast container */}
        <div
          ref={scrollContainerRef}
          className="flex overflow-x-hidden gap-2 scroll-smooth [&::-webkit-scrollbar]:hidden"
          onScroll={checkScrollPosition}
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {dailyForecast?.slice(0, 5).map((day, index) => (
            <DayForecast
              key={index}
              day={day.day}
              temperature={day.temperature}
              weatherCode={day.weatherCode}
              isActive={index === 0}
              isToday={index === 0}
            />
          )) || [...Array(5)].map((_, i) => (
            <div key={i} className="flex flex-col items-center px-3 min-w-[80px] flex-shrink-0 opacity-50">
              <div className="text-xs text-white/50 mb-1">--</div>
              <Cloud className="h-5 w-5 mb-1 text-white/50" />
              <div className="text-sm text-white/50">--°</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const UnifiedWeatherWidget: React.FC = () => {
  const { currentWeather, dailyForecast, location, isLoading } = useWeather();
  const { userSettings } = useSettings();
  
  // Get temperature unit symbol
  const tempUnitSymbol = userSettings?.temperatureUnit === 'C' ? '°C' : '°F';
  
  // Get a readable description if none provided by API
  const getWeatherDescription = (code: string | number) => {
    // If the API already provides a description, use it
    if (currentWeather?.description && 
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
      <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-white/10 max-w-md">
        <div className="text-white w-full">
          {/* Main weather info skeleton */}
          <div className="animate-pulse mb-8">
            <div className="h-24 w-40 bg-white/10 rounded-md mb-4"></div>
            <div className="h-6 w-48 bg-white/10 rounded-md mb-4"></div>
            <div className="grid grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="text-center">
                  <div className="h-3 w-12 bg-white/10 rounded-md mb-1 mx-auto"></div>
                  <div className="h-4 w-8 bg-white/10 rounded-md mx-auto"></div>
                </div>
              ))}
            </div>
          </div>
          
          {/* Forecast skeleton */}
          <div className="border-t border-white/10 pt-6">
            <div className="h-5 w-32 bg-white/10 rounded-md mb-4"></div>
            <div className="flex gap-2">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex flex-col items-center px-3 min-w-[80px] animate-pulse">
                  <div className="h-3 w-8 bg-white/10 rounded-md mb-1"></div>
                  <div className="h-5 w-5 bg-white/10 rounded-full mb-1"></div>
                  <div className="h-3 w-6 bg-white/10 rounded-md"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="bg-black/30 backdrop-blur-sm rounded-xl p-6 border border-white/10 shadow-2xl max-w-md">
      <div className="text-white w-full">
        {/* Main Weather Information */}
        <div className="mb-8">
          {/* Large temperature display */}
          <div className="text-[80px] md:text-[100px] font-light leading-none mb-2">
            {currentWeather?.temperature}°
          </div>
          
          {/* Weather description */}
          <div className="text-xl md:text-2xl font-light mb-4 text-white/90">
            {currentWeather ? getWeatherDescription(currentWeather.weatherCode) : 'Loading...'}
          </div>
          
          {/* Additional info row - more compact */}
          <div className="grid grid-cols-3 gap-4 text-white/80">
            <div className="text-center">
              <div className="text-xs opacity-70 mb-1">Feels like</div>
              <div className="text-sm font-medium">
                {currentWeather?.feelsLike || (currentWeather ? parseInt(currentWeather.temperature) - 2 : '--')}{tempUnitSymbol}
              </div>
            </div>
            <div className="text-center">
              <div className="text-xs opacity-70 mb-1">Humidity</div>
              <div className="text-sm font-medium">{currentWeather?.humidity || "67"}%</div>
            </div>
            <div className="text-center">
              <div className="text-xs opacity-70 mb-1">Wind</div>
              <div className="flex items-center justify-center gap-1">
                <Navigation 
                  className="h-3 w-3 opacity-70" 
                  style={{ 
                    transform: `rotate(${(currentWeather?.windDirection || 0) + 45}deg)` 
                  }} 
                />
                <div className="text-sm font-medium">{currentWeather?.windSpeed || "12"} mph</div>
              </div>
            </div>
          </div>
        </div>
        
        {/* 5-Day Forecast */}
        <ForecastSection dailyForecast={dailyForecast} />
      </div>
    </div>
  );
};