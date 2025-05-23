import { Router, Request, Response } from "express";
import { requireAuth, getUserApiKey } from '../auth-routes';
import { isPlaceholderKey } from '../utils/env-helpers';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { aiMemories, userSettings } from '../../shared/schema';
import { eq, desc, and, gt } from 'drizzle-orm';

const router = Router();

// Database connection for user settings and memories
const connectionString = process.env.DATABASE_URL || 'postgresql://forge:forge_password@localhost:5432/forge';
const client = postgres(connectionString);
const db = drizzle(client);

// Create ephemeral session endpoint for realtime WebRTC (both /session and / paths)
router.post("/session", requireAuth, async (req: Request, res: Response) => {
  console.log('Received request to create ephemeral realtime session');
  console.log('📨 REQUEST BODY:', req.body);
  
  const user = (req as any).user;
  const { voice = 'alloy', model = 'gpt-4o-realtime-preview-2024-12-17' } = req.body;
  console.log('📝 EXTRACTED VOICE:', voice, 'FROM REQUEST');
  
  // Get user's OpenAI API key from database
  const apiKey = await getUserApiKey(user.id, 'openai');
  if (!apiKey) {
    console.error('User does not have OpenAI API key configured');
    return res.status(400).json({ 
      error: 'OpenAI API key is not configured for this user. Please add your API key in settings.' 
    });
  }
  
  if (isPlaceholderKey(apiKey)) {
    console.error('User OpenAI API key appears to be a placeholder');
    return res.status(400).json({ 
      error: 'OpenAI API key appears to be a placeholder. Please set your actual API key in settings.' 
    });
  }
  
  try {
    console.log(`Creating ephemeral realtime session with voice: ${voice}, model: ${model}`);
    
    // Get user settings for location context
    let userSettingsContext = '';
    let currentWeatherContext = '';
    try {
      const settingsRecords = await db
        .select()
        .from(userSettings)
        .where(eq(userSettings.userId, user.id))
        .limit(1);
      
      if (settingsRecords.length > 0) {
        const settings = settingsRecords[0];
        console.log('🔍 Retrieved user settings for AI context:', settings);
        
        if (settings.location) {
          const tempUnit = settings.temperatureUnit === 'celsius' ? 'Celsius' : 'Fahrenheit';
          const unit = settings.temperatureUnit === 'celsius' ? 'C' : 'F';
          userSettingsContext = `\n\nUser Settings:\n- Current Location: ${settings.location}\n- Temperature Preference: ${tempUnit}`;
          
          // Fetch current weather data for context
          try {
            const weatherResponse = await fetch(`${process.env.NODE_ENV === 'production' ? 'https://your-domain.com' : 'http://localhost:3001'}/api/weather?location=${encodeURIComponent(settings.location)}&unit=${unit}`, {
              headers: {
                'Authorization': req.headers.authorization || ''
              }
            });
            
            if (weatherResponse.ok) {
              const weatherData = await weatherResponse.json();
              currentWeatherContext = `\n\nCurrent Weather at ${weatherData.location}:\n- Temperature: ${weatherData.currentWeather.temperature}${weatherData.currentWeather.unit} (feels like ${weatherData.currentWeather.feelsLike}${weatherData.currentWeather.unit})\n- Conditions: ${weatherData.currentWeather.description}\n- Humidity: ${weatherData.currentWeather.humidity}\n- Wind: ${weatherData.currentWeather.windSpeed}\n\nToday's Forecast:\n${weatherData.forecast.slice(0, 4).map(f => `- ${f.time}: ${f.temperature}°${unit}`).join('\n')}\n\nUpcoming Days:\n${weatherData.dailyForecast.slice(0, 3).map(d => `- ${d.day}: ${d.temperature}°${unit}`).join('\n')}`;
            }
          } catch (weatherError) {
            console.warn('Could not fetch current weather for AI context:', weatherError);
          }
        }
      } else {
        console.log('🔍 No user settings found in database');
      }
    } catch (settingsError) {
      console.warn('Could not fetch user settings for AI context:', settingsError);
    }
    
    // Get user memories for context
    let userMemoryContext = '';
    let recentMemories: any[] = [];
    try {
      recentMemories = await db
        .select()
        .from(aiMemories)
        .where(and(
          eq(aiMemories.userId, user.id),
          gt(aiMemories.importance, 5)
        ))
        .orderBy(desc(aiMemories.importance), desc(aiMemories.createdAt))
        .limit(8);
      
      if (recentMemories.length > 0) {
        userMemoryContext = '\n\nUser Memory Context:\n' + 
          recentMemories.map(memory => 
            `- [${memory.memoryType}] ${memory.content}`
          ).join('\n');
      }
    } catch (memoryError) {
      console.warn('Could not fetch user memories:', memoryError);
    }
    
    // Log the context being sent to the realtime agent
    console.log('🤖 CREATING REALTIME SESSION WITH AGENT CONTEXT:', {
      model: model,
      voice: voice.toLowerCase(),
      userLocation: userSettingsContext ? 'included' : 'none',
      weatherContext: currentWeatherContext ? 'included' : 'none',
      memoryContext: userMemoryContext ? `${recentMemories?.length || 0} memories` : 'none',
      availableTools: ['web_search', 'remember_user_info', 'get_weather', 'get_time'],
      timestamp: new Date().toISOString()
    });
    
    // Create ephemeral session with OpenAI API using user's permanent key
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'realtime'
      },
      body: JSON.stringify({
        model,
        voice: voice.toLowerCase(),
        modalities: ['text', 'audio'],
        instructions: `You are a helpful, friendly AI assistant with memory capabilities. Be concise and clear in your responses. You can help with weather information, web search, calendar events, and general questions. When users ask about current events, news, or information you might not have, use the web search function to get up-to-date information.\n\nImportant: When users share personal information, preferences, interests, goals, or important facts about themselves, use the remember_user_info function to store this information for future conversations. This helps you provide personalized assistance.${userSettingsContext}${currentWeatherContext}${userMemoryContext}`,
        tools: [
          {
            type: 'function',
            name: 'web_search',
            description: 'Search the web for current information, news, facts, or any topic',
            parameters: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'The search query' },
                num_results: { type: 'number', description: 'Number of results (1-5)', minimum: 1, maximum: 5 }
              },
              required: ['query']
            }
          },
          {
            type: 'function',
            name: 'remember_user_info',
            description: 'Remember important information about the user for future conversations',
            parameters: {
              type: 'object',
              properties: {
                memory_type: { 
                  type: 'string', 
                  description: 'Type of memory (e.g., "preference", "personal_info", "interest", "goal", "context")',
                  enum: ['preference', 'personal_info', 'interest', 'goal', 'context', 'important_fact']
                },
                content: { type: 'string', description: 'The information to remember about the user' },
                importance: { type: 'number', description: 'Importance level 1-10', minimum: 1, maximum: 10 }
              },
              required: ['memory_type', 'content']
            }
          },
          {
            type: 'function',
            name: 'get_weather',
            description: 'Get current weather conditions and forecast for any location worldwide',
            parameters: {
              type: 'object',
              properties: {
                location: { 
                  type: 'string', 
                  description: 'City name, address, or coordinates (e.g., "New York", "Paris, France", "40.7128,-74.0060")'
                },
                include_forecast: { 
                  type: 'boolean', 
                  description: 'Include hourly and daily forecast data',
                  default: false
                }
              },
              required: ['location']
            }
          }
        ],
        turn_detection: {
          type: 'server_vad',
          threshold: 0.5,
          silence_duration_ms: 500,
          prefix_padding_ms: 300,
          create_response: true,
          interrupt_response: true
        }
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const sessionData = await response.json();
    console.log('Ephemeral session created successfully:', sessionData.id);
    
    // Return the session data with ephemeral token - this is the secure pattern
    // The client will use the ephemeral token instead of the permanent API key
    res.json({
      sessionId: sessionData.id,
      ephemeralToken: sessionData.client_secret?.value || sessionData.client_secret,
      sessionDetails: {
        voice,
        model,
        expires_at: sessionData.expires_at
      }
    });
    
  } catch (error: any) {
    console.error('Error creating ephemeral realtime session:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to create ephemeral realtime session' 
    });
  }
});

// Legacy session endpoint for backward compatibility
router.get("/session", requireAuth, async (req: Request, res: Response) => {
  console.log('Received legacy request to create realtime session');
  
  const user = (req as any).user;
  
  // Get user's OpenAI API key from database
  const apiKey = await getUserApiKey(user.id, 'openai');
  if (!apiKey) {
    console.error('User does not have OpenAI API key configured');
    return res.status(400).json({ 
      error: 'OpenAI API key is not configured for this user. Please add your API key in settings.' 
    });
  }
  
  if (isPlaceholderKey(apiKey)) {
    console.error('User OpenAI API key appears to be a placeholder');
    return res.status(400).json({ 
      error: 'OpenAI API key appears to be a placeholder. Please set your actual API key in settings.' 
    });
  }
  
  try {
    console.log('Creating realtime session with OpenAI API...');
    const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-realtime-preview-2024-12-17',
        voice: 'alloy',
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`OpenAI API error: ${response.status} - ${errorText}`);
      throw new Error(`OpenAI API error: ${response.status}`);
    }
    
    const data = await response.json();
    console.log('OpenAI session created successfully');
    
    res.json(data);
    
  } catch (error: any) {
    console.error('Error creating realtime session:', error);
    return res.status(500).json({ 
      error: error.message || 'Failed to create realtime session' 
    });
  }
});

// Time/date endpoint for agent's get_time function
router.get("/time", async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const { timezone } = req.query;
    
    console.log('⏰ TIME API CALLED BY AGENT:', {
      requestedTimezone: timezone || 'server default',
      timestamp: now.toISOString()
    });
    
    let timeData;
    if (timezone && typeof timezone === 'string') {
      try {
        timeData = {
          current_time: now.toLocaleString('en-US', { timeZone: timezone }),
          timezone: timezone,
          utc_time: now.toISOString(),
          unix_timestamp: Math.floor(now.getTime() / 1000),
          day_of_week: now.toLocaleDateString('en-US', { weekday: 'long', timeZone: timezone }),
          date: now.toLocaleDateString('en-US', { timeZone: timezone })
        };
      } catch (timezoneError) {
        // Fallback to server time if timezone is invalid
        timeData = {
          current_time: now.toLocaleString(),
          timezone: 'server default (invalid timezone provided)',
          utc_time: now.toISOString(),
          unix_timestamp: Math.floor(now.getTime() / 1000),
          day_of_week: now.toLocaleDateString('en-US', { weekday: 'long' }),
          date: now.toLocaleDateString()
        };
      }
    } else {
      timeData = {
        current_time: now.toLocaleString(),
        timezone: 'server default',
        utc_time: now.toISOString(),
        unix_timestamp: Math.floor(now.getTime() / 1000),
        day_of_week: now.toLocaleDateString('en-US', { weekday: 'long' }),
        date: now.toLocaleDateString()
      };
    }
    
    console.log('✅ TIME DATA RETURNED TO AGENT:', {
      currentTime: timeData.current_time,
      timezone: timeData.timezone,
      timestamp: new Date().toISOString()
    });
    
    res.json(timeData);
    
  } catch (error: any) {
    console.error('❌ Error getting time:', error);
    res.status(500).json({ error: 'Failed to get time', details: error.message });
  }
});

export default router;