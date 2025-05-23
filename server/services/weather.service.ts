// Example service for weather-related business logic
// This demonstrates how to extract complex logic from route handlers

export interface WeatherData {
  location: string;
  temperature: string;
  unit: string;
  weatherCode: string;
  description: string;
  feelsLike: string;
  humidity: string;
  windSpeed: string;
  windDirection: number;
}

export interface ForecastData {
  time: string;
  temperature: string;
  weatherCode: string;
  isDay: boolean;
}

export interface DailyForecastData {
  date: string;
  day: string;
  temperature: string;
  weatherCode: number;
}

export class WeatherService {
  /**
   * Transform raw Weather API data into client format
   */
  static transformWeatherData(apiData: any, unit: string): {
    currentWeather: WeatherData;
    forecast: ForecastData[];
    dailyForecast: DailyForecastData[];
    location: string;
  } {
    return {
      currentWeather: {
        temperature: unit === 'F' 
          ? Math.round(apiData.current.temp_f).toString() 
          : Math.round(apiData.current.temp_c).toString(),
        unit: unit === 'F' ? '°F' : '°C',
        weatherCode: apiData.current.condition.code.toString(),
        description: apiData.current.condition.text,
        feelsLike: unit === 'F'
          ? Math.round(apiData.current.feelslike_f).toString()
          : Math.round(apiData.current.feelslike_c).toString(),
        humidity: apiData.current.humidity.toString(),
        windSpeed: unit === 'F'
          ? Math.round(apiData.current.wind_mph).toString() + ' mph'
          : Math.round(apiData.current.wind_kph).toString() + ' kph',
        windDirection: apiData.current.wind_degree
      },
      forecast: apiData.forecast.forecastday[0].hour
        .filter((_: any, index: number) => index % 3 === 0)
        .slice(0, 4)
        .map((hour: any) => ({
          time: new Date(hour.time).getHours() === new Date().getHours() ? 'Now' : 
                new Date(hour.time).getHours() + ':00',
          temperature: unit === 'F'
            ? Math.round(hour.temp_f).toString()
            : Math.round(hour.temp_c).toString(),
          weatherCode: hour.condition.code.toString(),
          isDay: hour.is_day === 1
        })),
      dailyForecast: apiData.forecast.forecastday.map((day: any) => {
        const date = new Date(day.date);
        const dayName = date.toLocaleDateString('en-US', { weekday: 'long' });
        return {
          date: day.date,
          day: dayName,
          temperature: unit === 'F'
            ? Math.round(day.day.avgtemp_f).toString()
            : Math.round(day.day.avgtemp_c).toString(),
          weatherCode: day.day.condition.code
        };
      }),
      location: `${apiData.location.name}${apiData.location.region ? ', ' + apiData.location.region : ''}, ${apiData.location.country}`
    };
  }

  /**
   * Validate weather API request parameters
   */
  static validateRequest(location?: string, lat?: string, lng?: string): { isValid: boolean; error?: string } {
    if (!location && (!lat || !lng)) {
      return {
        isValid: false,
        error: 'Location required. Please provide either a location parameter or lat/lng coordinates.'
      };
    }
    return { isValid: true };
  }

  /**
   * Build Weather API URL based on parameters
   */
  static buildApiUrl(apiKey: string, location?: string, lat?: string, lng?: string): string {
    if (location) {
      return `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${encodeURIComponent(location)}&days=5&aqi=yes&alerts=yes`;
    } else if (lat && lng) {
      return `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${lat},${lng}&days=5&aqi=yes&alerts=yes`;
    }
    throw new Error('Invalid parameters for API URL construction');
  }
}