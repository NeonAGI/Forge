import { Router, Request, Response } from "express";
import { requireAuth, getUserApiKey } from '../auth-routes';
import { isPlaceholderKey } from '../utils/env-helpers';
import { generateImage } from '../openai';
import { databaseImageStorage } from '../database-image-storage';

const router = Router();

// Create an in-memory cache for recent image generation requests to prevent duplicates
interface ImageCacheEntry {
  result: any;
  timestamp: number;
  requestId: string;
}

// Generation lock to prevent concurrent duplicate requests
interface GenerationLock {
  promise: Promise<any>;
  timestamp: number;
  requestId: string;
}

// Cache with location+weather+time+season as key
const recentImageRequests: Map<string, ImageCacheEntry> = new Map();
// Active generation locks
const activeGenerations: Map<string, GenerationLock> = new Map();
// Cache TTL in milliseconds (5 minutes)
const IMAGE_CACHE_TTL = 5 * 60 * 1000;
// Lock TTL in milliseconds (5 minutes)
const GENERATION_LOCK_TTL = 5 * 60 * 1000;
// Rate limiting: minimum time between image generations per user (2 minutes)
const MIN_GENERATION_INTERVAL = 2 * 60 * 1000;
// Track last generation time per user
const userLastGeneration: Map<string, number> = new Map();

// Helper to clean old cache entries and stale locks
function cleanupImageCache() {
  const now = Date.now();
  let expiredCount = 0;
  let expiredLocks = 0;
  
  // Clean up expired cache entries
  for (const [key, entry] of Array.from(recentImageRequests.entries())) {
    if (now - entry.timestamp > IMAGE_CACHE_TTL) {
      recentImageRequests.delete(key);
      expiredCount++;
    }
  }
  
  // Clean up stale generation locks
  for (const [key, lock] of Array.from(activeGenerations.entries())) {
    if (now - lock.timestamp > GENERATION_LOCK_TTL) {
      activeGenerations.delete(key);
      expiredLocks++;
      console.warn(`Cleaned up stale generation lock: ${key} (${lock.requestId})`);
    }
  }
  
  if (expiredCount > 0) {
    console.log(`Cleaned up ${expiredCount} expired image cache entries`);
  }
  if (expiredLocks > 0) {
    console.log(`Cleaned up ${expiredLocks} stale generation locks`);
  }
}

// Clean up the cache periodically
setInterval(cleanupImageCache, 60 * 1000);

// Weather API endpoint
router.get('/', async (req: Request, res: Response) => {
  try {
    console.log('🌤️  WEATHER API CALLED BY AGENT:', {
      params: req.query,
      timestamp: new Date().toISOString(),
      userAgent: req.headers['user-agent'] || 'unknown'
    });
    
    // Check if the API key is available
    const apiKey = process.env.WEATHER_API_KEY;
    console.log(`WEATHER_API_KEY availability: ${apiKey ? 'Available' : 'Not available'}, length: ${apiKey?.length || 0}`);
    
    if (!apiKey) {
      return res.status(500).json({ error: 'Weather API key not found in environment variables' });
    }

    // Use query parameters for location and unit
    let location = req.query.location as string;
    let lat = req.query.lat as string;
    let lng = req.query.lng as string;
    let unit = (req.query.unit as string) || 'F';

    console.log(`Request details - Location: ${location || 'Not provided'}, Lat: ${lat || 'Not provided'}, Lng: ${lng || 'Not provided'}, Unit: ${unit}`);

    // NEVER default to San Francisco - require explicit location
    if (!location && (!lat || !lng)) {
      console.error('❌ ERROR: No location or coordinates provided. Request rejected.');
      return res.status(400).json({ 
        error: 'Location required', 
        message: 'Please provide either a location parameter or lat/lng coordinates. No default location will be used.' 
      });
    }

    // Construct the API URL based on available parameters
    let apiUrl: string;
    
    if (location) {
      apiUrl = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${encodeURIComponent(location)}&days=5&aqi=yes&alerts=yes`;
      console.log(`Using location parameter: ${location}`);
    } else if (lat && lng) {
      apiUrl = `https://api.weatherapi.com/v1/forecast.json?key=${apiKey}&q=${lat},${lng}&days=5&aqi=yes&alerts=yes`;
      console.log(`Using coordinates: ${lat},${lng}`);
    } else {
      return res.status(400).json({ error: 'Invalid request. Please provide a location or coordinates.' });
    }

    const response = await fetch(apiUrl);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Weather API error:', errorText);
      return res.status(response.status).json({ error: `Weather API error: ${response.statusText}`, details: errorText });
    }
    
    const data = await response.json();
    
    // Transform the raw Weather API data into the format expected by the client
    const formattedData = {
      currentWeather: {
        temperature: unit === 'F' 
          ? Math.round(data.current.temp_f).toString() 
          : Math.round(data.current.temp_c).toString(),
        unit: unit === 'F' ? '°F' : '°C',
        weatherCode: data.current.condition.code.toString(),
        description: data.current.condition.text,
        feelsLike: unit === 'F'
          ? Math.round(data.current.feelslike_f).toString()
          : Math.round(data.current.feelslike_c).toString(),
        humidity: data.current.humidity.toString(),
        windSpeed: unit === 'F'
          ? Math.round(data.current.wind_mph).toString() + ' mph'
          : Math.round(data.current.wind_kph).toString() + ' kph',
        windDirection: data.current.wind_degree
      },
      forecast: data.forecast.forecastday[0].hour
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
      dailyForecast: data.forecast.forecastday.map((day: any) => {
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
      location: `${data.location.name}${data.location.region ? ', ' + data.location.region : ''}, ${data.location.country}`
    };
    
    console.log('✅ WEATHER DATA RETURNED TO AGENT:', {
      location: formattedData.location,
      temperature: formattedData.currentWeather.temperature + formattedData.currentWeather.unit,
      condition: formattedData.currentWeather.description,
      forecastDays: formattedData.dailyForecast.length,
      timestamp: new Date().toISOString()
    });
    res.json(formattedData);
  } catch (error: any) {
    console.error('Error in weather API:', error);
    res.status(500).json({ error: 'Failed to fetch weather data', details: error.message });
  }
});

// Create a shared function for generating weather background images
async function generateWeatherBackground(req: Request, location: string, weatherCondition: string, time: string, res: Response, userApiKey?: string, forceRefresh = false) {
  // Get current season
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth();
  let currentSeason = "";
  
  if (currentMonth >= 2 && currentMonth <= 4) {
    currentSeason = "spring";
  } else if (currentMonth >= 5 && currentMonth <= 7) {
    currentSeason = "summer";
  } else if (currentMonth >= 8 && currentMonth <= 10) {
    currentSeason = "autumn";
  } else {
    currentSeason = "winter";
  }

  // Generate cache key including season and user ID for proper isolation
  const cacheKey = `${(req as any).user?.id || 'anon'}|${location}|${weatherCondition}|${time}|${currentSeason}`;
  const requestId = Math.random().toString(36).substring(2, 10);
  
  console.log(`[BACKGROUND API] Request ${requestId}: ${cacheKey} (forceRefresh: ${forceRefresh})`);
  
  // Rate limiting check (except for forced refresh)
  if (!forceRefresh && (req as any).user?.id) {
    const userId = (req as any).user.id.toString();
    const lastGenTime = userLastGeneration.get(userId);
    const now = Date.now();
    
    if (lastGenTime && (now - lastGenTime) < MIN_GENERATION_INTERVAL) {
      const waitTime = Math.ceil((MIN_GENERATION_INTERVAL - (now - lastGenTime)) / 1000);
      console.log(`[BACKGROUND API] Request ${requestId}: Rate limited - user ${userId} must wait ${waitTime}s`);
      return res.status(429).json({
        error: 'rate_limited',
        message: `Please wait ${waitTime} seconds before generating a new image`,
        waitTime,
        cached: false
      });
    }
  }
  
  // Check for active generation lock (prevent concurrent requests)
  if (!forceRefresh && activeGenerations.has(cacheKey)) {
    const existingLock = activeGenerations.get(cacheKey)!;
    console.log(`[BACKGROUND API] Request ${requestId}: Waiting for existing generation ${existingLock.requestId}`);
    
    try {
      const result = await existingLock.promise;
      console.log(`[BACKGROUND API] Request ${requestId}: Using result from ${existingLock.requestId}`);
      return res.json({
        ...result,
        cached: true,
        waitedForGeneration: true,
        originalRequestId: existingLock.requestId
      });
    } catch (error) {
      console.error(`[BACKGROUND API] Request ${requestId}: Failed to wait for existing generation:`, error);
      activeGenerations.delete(cacheKey);
      // Fall through to generate new image
    }
  }

  // Create generation promise and lock
  const generationPromise = (async () => {
    // First check database for existing image (unless forced refresh)
    if (!forceRefresh && (req as any).user?.id) {
      try {
        console.log(`[BACKGROUND API] Checking database for existing image: location="${location}", weather="${weatherCondition}", time="${time}", season="${currentSeason}"`);
        
        // Log all available images for this user
        console.log(`[BACKGROUND API] Fetching all cached images for user ${(req as any).user.id}...`);
        try {
          const allUserImages = await databaseImageStorage.getAllUserImages((req as any).user.id);
          console.log(`[BACKGROUND API] Available cached images for user ${(req as any).user.id} (total: ${allUserImages.length}):`);
          if (allUserImages.length === 0) {
            console.log(`[BACKGROUND API] - No cached images found`);
          } else {
            allUserImages.forEach((img, index) => {
              console.log(`[BACKGROUND API] - ${index + 1}. ${img.imageId}: location="${img.location}", weather="${img.weatherCondition}", time="${img.timeOfDay}", season="${img.season || 'unknown'}" (used ${img.usageCount || 0} times)`);
            });
          }
        } catch (fetchError) {
          console.error(`[BACKGROUND API] Error fetching user images:`, fetchError);
        }
        
        const cachedImage = await databaseImageStorage.findCachedImage(
          (req as any).user.id,
          location,
          weatherCondition,
          time,
          currentSeason
        );
        
        if (cachedImage) {
          console.log(`[BACKGROUND API] Found existing image in database: ${cachedImage.imageId}`);
          
          try {
            // Get image data from filesystem
            const imageData = databaseImageStorage.getImageData(cachedImage.filePath);
          
          // Update usage count
          await databaseImageStorage.updateImageUsage((req as any).user.id, cachedImage.imageId);
          
            console.log(`[BACKGROUND API] Returning cached image from database`);
            return {
              imageBase64: imageData,
              imageDataUrl: `data:image/png;base64,${imageData}`,
              imageId: cachedImage.imageId,
              prompt: cachedImage.prompt,
              revisedPrompt: cachedImage.revisedPrompt,
              cached: true,
              fromDatabase: true,
              requestId
            };
          } catch (fileError) {
            console.error(`[BACKGROUND API] File system error for cached image ${cachedImage.imageId}:`, fileError);
            console.log(`[BACKGROUND API] Cleaning up orphaned database entry: ${cachedImage.imageId}`);
            
            // Clean up orphaned database entry
            try {
              await databaseImageStorage.deleteImage((req as any).user.id, cachedImage.imageId);
              console.log(`[BACKGROUND API] Successfully cleaned up orphaned entry: ${cachedImage.imageId}`);
            } catch (cleanupError) {
              console.error(`[BACKGROUND API] Failed to cleanup orphaned entry:`, cleanupError);
            }
            
            // Continue to generation since cached file is missing
            console.log(`[BACKGROUND API] Will generate new image due to missing file`);
          }
        } else {
          console.log(`[BACKGROUND API] No existing image found in database, will generate new one`);
        }
      } catch (dbError) {
        console.error('[BACKGROUND API] Error checking database for cached image:', dbError);
        // Continue to generation if database check fails
      }
    }
    
    // Check if we have a recent cached result for this exact request (memory cache)
    const cachedEntry = recentImageRequests.get(cacheKey);
    if (!forceRefresh && cachedEntry && (Date.now() - cachedEntry.timestamp) < IMAGE_CACHE_TTL) {
      console.log(`Using memory cached image result for "${cacheKey}" (cached ${Math.round((Date.now() - cachedEntry.timestamp)/1000)}s ago, request ID: ${cachedEntry.requestId})`);
      return {
        ...cachedEntry.result,
        cached: true,
        cachedRequestId: cachedEntry.requestId
      };
    }

    // Use provided user API key or fall back to environment key
    const openaiApiKey = userApiKey || process.env.OPENAI_API_KEY;
    if (!openaiApiKey || isPlaceholderKey(openaiApiKey)) {
      throw new Error('missing_or_invalid_api_key');
    }

    // Random style seeds for variety
    const styleSeeds = [
      "in the style of a Studio Ghibli matte painting, dreamy and atmospheric",
      "National Geographic photo style, crisp and natural lighting", 
      "Retro postcard style, Kodak Ektachrome film aesthetic",
      "Cinematic landscape photography, golden hour lighting",
      "Fine art photography style, dramatic shadows and highlights",
      "Digital concept art style, vibrant colors and detailed environment",
      "Ansel Adams black and white photography style, converted to color",
      "Thomas Kinkade romantic realism style, warm and inviting"
    ];
    
    // Use the season context we already determined
    let seasonInfo = "";
    
    if (currentSeason === "spring") {
      seasonInfo = "spring season with blooming flowers and fresh greenery";
    } else if (currentSeason === "summer") {
      seasonInfo = "summer season with lush vegetation and warm atmosphere";
    } else if (currentSeason === "autumn") {
      seasonInfo = "autumn season with changing leaves and harvest colors";
    } else {
      seasonInfo = "winter season with crisp air and seasonal character";
    }
    
    // Select a random style seed
    const randomStyle = styleSeeds[Math.floor(Math.random() * styleSeeds.length)];
    
    // Enhanced prompt with style seasoning and seasonal context
    const prompt = `A beautiful weather scene showing ${weatherCondition} in ${location} during ${time}, ${seasonInfo}, ${randomStyle}. Ultra-high quality, professional composition, perfect lighting.`;
    
    console.log(`[BACKGROUND API] Generating new image for "${cacheKey}" (request ID: ${requestId}) with style: ${randomStyle}`);
    
    // Update last generation time for rate limiting
    if ((req as any).user?.id) {
      userLastGeneration.set((req as any).user.id.toString(), Date.now());
    }
    
    const imageResult = await generateImage(prompt, openaiApiKey);
    
    // Generate a unique ID for the image
    let imageId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    // Save the image to database storage for future retrieval
    try {
      console.log(`[BACKGROUND API] Preparing to save image to database storage`);
      
      if (imageResult.imageBase64 && (req as any).user?.id) {
        console.log(`[BACKGROUND API] Image data available, adding to database storage`);
        
        // If this is a forced refresh, existing images will be handled by upsert logic
        const metadataForStorage = {
          location,
          weatherCondition,
          timeOfDay: time,
          season: currentSeason,
          prompt,
          revisedPrompt: imageResult.revisedPrompt || prompt,
          model: 'dall-e-3',
          quality: 'standard'
        };
        
        console.log(`[BACKGROUND API] Image metadata prepared: location=${location}, weatherCondition=${weatherCondition}, timeOfDay=${time}, season=${currentSeason}`);
        
        // Store the image in the database storage
        const savedImage = await databaseImageStorage.addImageToStorage(
          (req as any).user.id,
          metadataForStorage,
          imageResult.imageBase64
        );
        
        imageId = savedImage.imageId; // Update imageId with the one generated by storage
        console.log(`[BACKGROUND API] Image saved to database storage with ID: ${imageId}, path: ${savedImage.filePath}`);
        
      } else {
        console.log(`[BACKGROUND API] No image data or user ID available to save`);
      }
    } catch (storageError) {
      console.error('[BACKGROUND API] Failed to save image to database storage:', storageError);
      // Continue even if storage fails - we'll still return the image directly
    }
    
    // Prepare the response
    const responseData = {
      imageBase64: imageResult.imageBase64,
      imageDataUrl: imageResult.imageBase64 ? `data:image/png;base64,${imageResult.imageBase64}` : null,
      imageId,
      prompt,
      revisedPrompt: imageResult.revisedPrompt,
      cached: false,
      requestId
    };
    
    // Cache the result for future identical requests (short-term memory cache)
    recentImageRequests.set(cacheKey, {
      result: responseData,
      timestamp: Date.now(),
      requestId
    });
    
    // Return the response data
    return responseData;
  })();
  
  // Store generation lock (unless forced refresh)
  if (!forceRefresh) {
    activeGenerations.set(cacheKey, {
      promise: generationPromise,
      timestamp: Date.now(),
      requestId
    });
  }
  
  try {
    const result = await generationPromise;
    return res.json(result);
  } catch (error) {
    console.error(`[BACKGROUND API] Request ${requestId}: Generation failed:`, error);
    
    if (error.message === 'missing_or_invalid_api_key') {
      return res.status(500).json({
        error: 'missing_or_invalid_api_key',
        message: userApiKey ? 'User OpenAI API key appears to be invalid.' : 'OpenAI API key is missing or appears to be a placeholder. Please set a valid key in your environment.'
      });
    }
    
    res.status(500).json({ error: 'Failed to generate weather background', details: error.message });
  } finally {
    // Clean up the lock
    if (!forceRefresh) {
      activeGenerations.delete(cacheKey);
    }
  }
}

// Weather Background Image Generation
router.post('/background', requireAuth, async (req: Request, res: Response) => {
  try {
    console.log('Weather background POST request received with body:', req.body);
    
    const { location, weatherCondition, time } = req.body;
    
    // Validate required parameters
    if (!location || !weatherCondition || !time) {
      const missingParams = [];
      if (!location) missingParams.push('location');
      if (!weatherCondition) missingParams.push('weatherCondition');
      if (!time) missingParams.push('time');
      
      return res.status(400).json({ 
        error: 'Missing required parameters', 
        missingParams,
        receivedParams: req.body
      });
    }

    // Get user's OpenAI API key from database
    const user = (req as any).user;
    const userApiKey = await getUserApiKey(user.id, 'openai');
    
    if (!userApiKey) {
      return res.status(400).json({
        error: 'missing_user_api_key',
        message: 'OpenAI API key is not configured for this user. Please add your API key in settings.'
      });
    }
    
    if (isPlaceholderKey(userApiKey)) {
      return res.status(400).json({
        error: 'invalid_user_api_key',
        message: 'OpenAI API key appears to be a placeholder. Please set your actual API key in settings.'
      });
    }

    // Check if this is a manual refresh request
    const forceRefresh = req.body.forceRefresh === true;

    // Run bulk cleanup of orphaned entries before searching for cached images
    if (!forceRefresh) {
      try {
        const cleanedCount = await databaseImageStorage.cleanupAllOrphanedEntries(user.id);
        if (cleanedCount > 0) {
          console.log(`[BACKGROUND API] Cleaned up ${cleanedCount} orphaned entries before searching for cached images`);
        }
      } catch (cleanupError) {
        console.warn(`[BACKGROUND API] Cleanup failed but continuing:`, cleanupError);
      }
    }

    // Generate the image using the shared function with user's API key
    return await generateWeatherBackground(req, location, weatherCondition, time, res, userApiKey, forceRefresh);
  } catch (error: any) {
    console.error('OpenAI image generation error:', error);
    res.status(500).json({ error: 'Failed to generate weather background', details: error.message });
  }
});

export default router;