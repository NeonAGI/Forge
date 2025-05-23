import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';
import { isPlaceholderKey } from './env-helpers';

// Get ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Load environment variables from different possible .env locations
 */
export function loadEnvFromPossibleLocations(): boolean {
  // Array of possible .env file locations relative to current file
  const possibleEnvPaths = [
    path.resolve(__dirname, '../../.env'),          // server/utils level (../../)
    path.resolve(__dirname, '../../../.env'),       // project root level (../../../)
    path.resolve(__dirname, '../../../../.env'),    // One level up from project root
    path.resolve(__dirname, '../.env'),             // In server directory directly
    path.resolve(process.cwd(), '.env')             // Current working directory
  ];
  
  // Try each path until one works
  for (const envPath of possibleEnvPaths) {
    console.log(`Trying to load .env from: ${envPath}`);
    
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      console.log(`Successfully loaded .env from: ${envPath}`);
      // Log all available environment variables (for debugging)
      console.log('Environment variables:');
      console.log('WEATHER_API_KEY available:', !!process.env.WEATHER_API_KEY);
      console.log('OPENAI_API_KEY available:', !!process.env.OPENAI_API_KEY);
      console.log('NODE_ENV:', process.env.NODE_ENV);
      return true;
    }
  }
  
  // If we got here, none of the paths worked
  console.warn('Failed to load .env file from any location. Using environment variables directly.');
  return false;
}

/**
 * Test API connections on startup
 */
export async function testApiConnections(): Promise<void> {
  console.log('Testing API connections on startup...');
  
  // Test OpenAI API
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (openaiApiKey && !isPlaceholderKey(openaiApiKey)) {
    try {
      console.log('Testing OpenAI API connection...');
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        console.log('✅ OpenAI API connection successful!');
      } else {
        console.error('❌ OpenAI API connection failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Error testing OpenAI API:', error);
    }
  } else {
    console.warn('⚠️ OpenAI API key not set or using placeholder value. Skipping connection test.');
  }
  
  // Test Weather API
  const weatherApiKey = process.env.WEATHER_API_KEY;
  if (weatherApiKey && !isPlaceholderKey(weatherApiKey)) {
    try {
      console.log('Testing Weather API connection...');
      const response = await fetch(`https://api.weatherapi.com/v1/current.json?key=${weatherApiKey}&q=London&aqi=no`);
      
      if (response.ok) {
        console.log('✅ Weather API connection successful!');
      } else {
        console.error('❌ Weather API connection failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Error testing Weather API:', error);
    }
  } else {
    console.warn('⚠️ Weather API key not set or using placeholder value. Skipping connection test.');
  }
  
  console.log('API connection tests completed.');
}