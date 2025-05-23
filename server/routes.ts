import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage, type ImageMetadata } from "./storage";
import openai from "./openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import express from 'express';
import cors from 'cors';
import fetch from 'node-fetch';
import { generateImage } from './openai';
import { isPlaceholderKey } from './utils/env-helpers';
import { requireAuth, optionalAuth, getUserApiKey } from './auth-routes';
import { databaseImageStorage } from './database-image-storage';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { aiMemories, conversations, messages, userSettings } from '../shared/schema';
import { eq, desc, and, or, like, gt } from 'drizzle-orm';

// Database connection for memory management
const connectionString = process.env.DATABASE_URL || 'postgresql://forge:forge_password@localhost:5432/forge';
const client = postgres(connectionString);
const db = drizzle(client);

// Get directory path in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Helper function to generate random strings for ICE parameters  
const generateRandomString = (length: number): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

const router = express.Router();

// Apply CORS middleware
router.use(cors());

// Middleware to log all requests 
router.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Weather API endpoint
router.get('/weather', async (req: Request, res: Response) => {
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
  const cacheKey = `${req.user?.id || 'anon'}|${location}|${weatherCondition}|${time}|${currentSeason}`;
  const requestId = Math.random().toString(36).substring(2, 10);
  
  console.log(`[BACKGROUND API] Request ${requestId}: ${cacheKey} (forceRefresh: ${forceRefresh})`);
  
  // Rate limiting check (except for forced refresh)
  if (!forceRefresh && req.user?.id) {
    const userId = req.user.id.toString();
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
    if (!forceRefresh && req.user?.id) {
      try {
        console.log(`[BACKGROUND API] Checking database for existing image: location="${location}", weather="${weatherCondition}", time="${time}", season="${currentSeason}"`);
        
        // Log all available images for this user
        console.log(`[BACKGROUND API] Fetching all cached images for user ${req.user.id}...`);
        try {
          const allUserImages = await databaseImageStorage.getAllUserImages(req.user.id);
          console.log(`[BACKGROUND API] Available cached images for user ${req.user.id} (total: ${allUserImages.length}):`);
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
          req.user.id,
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
          await databaseImageStorage.updateImageUsage(req.user.id, cachedImage.imageId);
          
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
              await databaseImageStorage.deleteImage(req.user.id, cachedImage.imageId);
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
    if (req.user?.id) {
      userLastGeneration.set(req.user.id.toString(), Date.now());
    }
    
    const imageResult = await generateImage(prompt, openaiApiKey);
    
    // Generate a unique ID for the image
    let imageId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    // Save the image to database storage for future retrieval
    try {
      console.log(`[BACKGROUND API] Preparing to save image to database storage`);
      
      if (imageResult.imageBase64 && req.user?.id) {
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
          req.user.id,
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
router.post('/weather/background', requireAuth, async (req: Request, res: Response) => {
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

// Get image by ID endpoint
router.get('/images/:imageId', requireAuth, async (req: Request, res: Response) => {
  try {
    const { imageId } = req.params;
    const user = (req as any).user;
    
    console.log(`[IMAGES API] Retrieving image ${imageId} for user ${user.id}`);
    
    // Get image from database storage
    const image = await databaseImageStorage.getImageById(user.id, imageId);
    
    if (!image) {
      console.log(`[IMAGES API] Image ${imageId} not found for user ${user.id}`);
      return res.status(404).json({ error: 'Image not found' });
    }
    
    // Get image data from filesystem
    try {
      const imageData = databaseImageStorage.getImageData(image.filePath);
      
      // Update usage count
      await databaseImageStorage.updateImageUsage(user.id, imageId);
      
      console.log(`[IMAGES API] Successfully retrieved image ${imageId}`);
      
      res.json({
        imageBase64: imageData,
        imageDataUrl: `data:image/png;base64,${imageData}`,
        imageId: image.imageId,
        metadata: {
          location: image.location,
          weatherCondition: image.weatherCondition,
          timeOfDay: image.timeOfDay,
          temperature: image.temperature,
          prompt: image.prompt,
          createdAt: image.createdAt,
          useCount: image.useCount
        }
      });
    } catch (fileError) {
      console.error(`[IMAGES API] Error reading image file for ${imageId}:`, fileError);
      return res.status(410).json({ error: 'Image file not available' });
    }
  } catch (error) {
    console.error('[IMAGES API] Error retrieving image:', error);
    res.status(500).json({ error: 'Failed to retrieve image' });
  }
});

// Manual cleanup endpoint for debugging
router.post('/images/cleanup', requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    console.log(`[CLEANUP API] Manual cleanup requested for user ${user.id}`);
    
    const cleanedCount = await databaseImageStorage.cleanupAllOrphanedEntries(user.id);
    
    // Also get current stats after cleanup
    const stats = await databaseImageStorage.getUserImageStats(user.id);
    const allImages = await databaseImageStorage.getAllUserImages(user.id);
    
    console.log(`[CLEANUP API] Cleanup completed: removed ${cleanedCount} orphaned entries`);
    
    res.json({
      cleanedCount,
      remainingImages: allImages.length,
      stats,
      message: `Successfully cleaned up ${cleanedCount} orphaned database entries`
    });
  } catch (error) {
    console.error('[CLEANUP API] Error during manual cleanup:', error);
    res.status(500).json({ error: 'Failed to cleanup orphaned entries', details: error.message });
  }
});

// AI Memory Management API endpoints
router.get("/memories", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { type, limit = 20, importance_min = 1 } = req.query;
    
    let query = db.select().from(aiMemories).where(eq(aiMemories.userId, user.id));
    
    if (type) {
      query = query.where(eq(aiMemories.memoryType, type as string));
    }
    
    if (importance_min) {
      query = query.where(gt(aiMemories.importance, parseInt(importance_min as string)));
    }
    
    const memories = await query
      .orderBy(desc(aiMemories.importance), desc(aiMemories.createdAt))
      .limit(parseInt(limit as string));
    
    res.json({ memories });
  } catch (error: any) {
    console.error('Error fetching AI memories:', error);
    res.status(500).json({ error: 'Failed to fetch memories', details: error.message });
  }
});

router.post("/memories", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { memoryType, content, importance = 5, tags = [], expiresAt } = req.body;
    
    if (!memoryType || !content) {
      return res.status(400).json({ error: 'memoryType and content are required' });
    }
    
    const memoryData = {
      userId: user.id,
      memoryType,
      content,
      importance: Math.max(1, Math.min(10, importance)), // Clamp between 1-10
      tags,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    };
    
    const [newMemory] = await db.insert(aiMemories).values(memoryData).returning();
    
    console.log(`Created new AI memory for user ${user.id}: ${memoryType} - ${content.substring(0, 50)}...`);
    
    res.json({ memory: newMemory });
  } catch (error: any) {
    console.error('Error creating AI memory:', error);
    res.status(500).json({ error: 'Failed to create memory', details: error.message });
  }
});

router.delete("/memories/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    
    const [deletedMemory] = await db
      .delete(aiMemories)
      .where(and(eq(aiMemories.id, parseInt(id)), eq(aiMemories.userId, user.id)))
      .returning();
    
    if (!deletedMemory) {
      return res.status(404).json({ error: 'Memory not found' });
    }
    
    res.json({ message: 'Memory deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting AI memory:', error);
    res.status(500).json({ error: 'Failed to delete memory', details: error.message });
  }
});

// Get relevant memories for AI context
router.post("/memories/relevant", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { query, limit = 5 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    // Simple relevance search - in production, you might use vector search
    const relevantMemories = await db
      .select()
      .from(aiMemories)
      .where(
        and(
          eq(aiMemories.userId, user.id),
          or(
            like(aiMemories.content, `%${query}%`),
            like(aiMemories.memoryType, `%${query}%`)
          )
        )
      )
      .orderBy(desc(aiMemories.importance), desc(aiMemories.createdAt))
      .limit(limit);
    
    res.json({ memories: relevantMemories });
  } catch (error: any) {
    console.error('Error searching relevant memories:', error);
    res.status(500).json({ error: 'Failed to search memories', details: error.message });
  }
});

// Get user context for AI (memories summary)
router.get("/user-context", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    // Get recent high-importance memories
    const recentMemories = await db
      .select()
      .from(aiMemories)
      .where(and(
        eq(aiMemories.userId, user.id),
        gt(aiMemories.importance, 5)
      ))
      .orderBy(desc(aiMemories.importance), desc(aiMemories.createdAt))
      .limit(10);
    
    // Format memories for AI context
    const memoryContext = recentMemories.map(memory => 
      `[${memory.memoryType}] ${memory.content}`
    ).join('\n');
    
    res.json({ 
      memoryContext,
      memoryCount: recentMemories.length,
      memories: recentMemories
    });
    
  } catch (error: any) {
    console.error('Error fetching user context:', error);
    res.status(500).json({ error: 'Failed to fetch user context', details: error.message });
  }
});

// Web search API endpoint with OpenAI native search as primary
router.post("/search", requireAuth, async (req: Request, res: Response) => {
  try {
    const { query, num_results = 5 } = req.body;
    
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query parameter is required and must be a string' });
    }
    
    console.log('🔍 WEB SEARCH API CALLED BY AGENT:', {
      query: query,
      numResults: num_results,
      timestamp: new Date().toISOString(),
      userAgent: req.headers['user-agent'] || 'unknown'
    });
    
    let results: any[] = [];
    let searchMethod = 'unknown';
    
    // Get user's OpenAI API key for native search
    let openaiApiKey: string | null = null;
    if (req.user?.id) {
      try {
        openaiApiKey = await getUserApiKey(req.user.id, 'openai');
      } catch (error) {
        console.log('[SEARCH API] No user OpenAI API key found');
      }
    }
    
    // Try OpenAI native web search first (primary method)
    if (openaiApiKey && !isPlaceholderKey(openaiApiKey)) {
      try {
        console.log('[SEARCH API] Using OpenAI native web search as primary method');
        
        // Get user location for geographic relevance
        let userLocation = null;
        try {
          const settingsRecords = await db
            .select()
            .from(userSettings)
            .where(eq(userSettings.userId, req.user.id))
            .limit(1);
          
          if (settingsRecords.length > 0 && settingsRecords[0].location) {
            userLocation = settingsRecords[0].location;
          }
        } catch (settingsError) {
          console.log('[SEARCH API] Could not get user location for search context');
        }
        
        // Prepare OpenAI web search request
        const searchTools = [{
          type: "web_search_preview",
          search_context_size: "medium" // Balance quality, cost, and latency
        }];
        
        // Add user location if available
        if (userLocation) {
          try {
            // Parse location to extract components
            const locationParts = userLocation.split(',').map(part => part.trim());
            if (locationParts.length >= 2) {
              const city = locationParts[0];
              const region = locationParts[1];
              
              searchTools[0].user_location = {
                type: "approximate",
                city: city,
                region: region
              };
              
              // Try to determine country code from region
              const regionLower = region.toLowerCase();
              if (regionLower.includes('us') || regionLower.includes('usa') || regionLower.includes('united states')) {
                searchTools[0].user_location.country = "US";
              } else if (regionLower.includes('uk') || regionLower.includes('united kingdom') || regionLower.includes('england')) {
                searchTools[0].user_location.country = "GB";
              } else if (regionLower.includes('canada')) {
                searchTools[0].user_location.country = "CA";
              }
            }
          } catch (locationParseError) {
            console.log('[SEARCH API] Could not parse user location for geographic search');
          }
        }
        
        const openaiResponse = await fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiApiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: "gpt-4.1",
            tools: searchTools,
            input: query,
            tool_choice: { type: "web_search_preview" } // Force web search for lower latency
          }),
          signal: AbortSignal.timeout(15000) // 15 second timeout for OpenAI search
        });
        
        if (openaiResponse.ok) {
          const openaiData = await openaiResponse.json();
          
          // Debug: Log the full OpenAI response structure
          console.log('[SEARCH API] OpenAI response structure:', JSON.stringify(openaiData, null, 2));
          
          // Extract search results and citations from OpenAI response
          if (openaiData.output && openaiData.output.length > 0) {
            let searchText = '';
            let citations: any[] = [];
            
            console.log(`[SEARCH API] Processing ${openaiData.output.length} output items`);
            
            // Find the message content with text and annotations
            for (const item of openaiData.output) {
              console.log(`[SEARCH API] Processing item type: ${item.type}`);
              
              if (item.type === 'message' && item.content && item.content.length > 0) {
                console.log(`[SEARCH API] Found message with ${item.content.length} content items`);
                
                const textContent = item.content.find(c => c.type === 'output_text');
                if (textContent) {
                  searchText = textContent.text || '';
                  citations = textContent.annotations || [];
                  console.log(`[SEARCH API] Extracted text length: ${searchText.length}, citations: ${citations.length}`);
                  break;
                }
              }
              
              // Also check for direct text in content array
              if (item.content && Array.isArray(item.content)) {
                for (const contentItem of item.content) {
                  if (contentItem.type === 'text' && contentItem.text) {
                    searchText = contentItem.text;
                    citations = contentItem.annotations || [];
                    console.log(`[SEARCH API] Found direct text content: ${searchText.length} chars, ${citations.length} annotations`);
                    break;
                  }
                }
              }
            }
            
            // Also check the top-level output_text field (alternative response format)
            if (!searchText && openaiData.output_text) {
              searchText = openaiData.output_text;
              console.log(`[SEARCH API] Using top-level output_text: ${searchText.length} chars`);
            }
            
            console.log(`[SEARCH API] Final extracted: text=${searchText.length} chars, citations=${citations.length}`);
            
            // Format results from citations
            if (citations.length > 0) {
              results = citations
                .filter(citation => citation.type === 'url_citation' && citation.url && citation.title)
                .slice(0, num_results)
                .map((citation, index) => ({
                  title: citation.title,
                  url: citation.url,
                  snippet: searchText.substring(citation.start_index || 0, citation.end_index || (citation.start_index || 0) + 200),
                  source: new URL(citation.url).hostname,
                  citation_index: index + 1
                }));
              
              console.log(`[SEARCH API] Formatted ${results.length} results from citations`);
            }
            
            // If we have text but no citations, create a single result with the AI response
            if (searchText.length > 50 && results.length === 0) {
              results = [{
                title: `AI Answer for "${query}"`,
                url: `https://openai.com/search`,
                snippet: searchText.length > 400 ? searchText.substring(0, 400) + '...' : searchText,
                source: 'OpenAI Web Search',
                is_ai_answer: true
              }];
              console.log(`[SEARCH API] Created AI answer result from text response`);
            }
            
            // If we got good results, add a summary at the beginning
            if (results.length > 0 && searchText.length > 100 && !results.some(r => r.is_ai_answer)) {
              results.unshift({
                title: `AI Summary for "${query}"`,
                url: `https://openai.com/search`,
                snippet: searchText.length > 300 ? searchText.substring(0, 300) + '...' : searchText,
                source: 'OpenAI Web Search',
                is_summary: true
              });
            }
            
            if (results.length > 0) {
              searchMethod = 'openai';
              console.log(`[SEARCH API] OpenAI native search returned ${results.length} results`);
            } else {
              console.log(`[SEARCH API] OpenAI native search returned 0 results - no usable content found`);
            }
          } else {
            console.log(`[SEARCH API] OpenAI response has no output array or empty output`);
          }
        } else {
          const errorText = await openaiResponse.text();
          console.error(`[SEARCH API] OpenAI web search API error: ${openaiResponse.status} ${openaiResponse.statusText} - ${errorText}`);
        }
      } catch (openaiError) {
        console.error('[SEARCH API] OpenAI native search failed:', openaiError);
      }
    }
    
    // Fallback to Brave Search if OpenAI didn't work
    if (results.length === 0) {
      let braveApiKey: string | null = null;
      
      if (req.user?.id) {
        try {
          braveApiKey = await getUserApiKey(req.user.id, 'brave');
        } catch (error) {
          console.log('[SEARCH API] No user Brave API key found');
        }
      }
      
      // Fallback to environment variable if no user key
      if (!braveApiKey) {
        braveApiKey = process.env.BRAVE_SEARCH_API_KEY || null;
      }
      
      if (braveApiKey) {
        try {
          console.log('[SEARCH API] Falling back to Brave Search');
          const braveUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(query)}&count=${num_results}`;
          const braveResponse = await fetch(braveUrl, {
            headers: {
              'X-Subscription-Token': braveApiKey,
              'Accept': 'application/json'
            },
            signal: AbortSignal.timeout(8000) // 8 second timeout
          });
          
          if (braveResponse.ok) {
            const braveData = await braveResponse.json();
            
            if (braveData.web && braveData.web.results) {
              results = braveData.web.results.slice(0, num_results).map((result: any) => ({
                title: result.title,
                url: result.url,
                snippet: result.description,
                source: new URL(result.url).hostname
              }));
              
              searchMethod = 'brave';
              console.log(`[SEARCH API] Brave Search returned ${results.length} results`);
            }
          } else {
            console.error(`[SEARCH API] Brave Search API error: ${braveResponse.status} ${braveResponse.statusText}`);
          }
        } catch (braveError) {
          console.error('[SEARCH API] Brave Search failed:', braveError);
        }
      }
    }
    
    // Final fallback to DuckDuckGo if both OpenAI and Brave failed
    if (results.length === 0) {
      try {
        console.log('[SEARCH API] Falling back to DuckDuckGo search');
        // Use DuckDuckGo Instant Answer API (free, no API key needed) with timeout
        const duckduckgoUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
        const ddgResponse = await fetch(duckduckgoUrl, {
          signal: AbortSignal.timeout(5000) // 5 second timeout
        });
        const ddgData = await ddgResponse.json();
        
        // Extract results from DuckDuckGo RelatedTopics
        if (ddgData.RelatedTopics && ddgData.RelatedTopics.length > 0) {
          results = ddgData.RelatedTopics
            .filter((topic: any) => topic.FirstURL && topic.Text)
            .slice(0, num_results)
            .map((topic: any) => ({
              title: topic.Text.split(' - ')[0] || topic.Text.split('.')[0] || topic.Text.substring(0, 100),
              url: topic.FirstURL,
              snippet: topic.Text,
              source: new URL(topic.FirstURL).hostname || 'duckduckgo.com'
            }));
        }
        
        // If DuckDuckGo doesn't have enough results, try the Abstract field
        if (results.length === 0 && ddgData.Abstract) {
          results.push({
            title: ddgData.Heading || query,
            url: ddgData.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
            snippet: ddgData.Abstract,
            source: ddgData.AbstractSource || 'duckduckgo.com'
          });
        }
        
        // If still no results, try the Answer field
        if (results.length === 0 && ddgData.Answer) {
          results.push({
            title: `Answer for "${query}"`,
            url: ddgData.AnswerURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
            snippet: ddgData.Answer,
            source: ddgData.AnswerType || 'duckduckgo.com'
          });
        }
        
        searchMethod = 'duckduckgo';
        console.log(`[SEARCH API] DuckDuckGo returned ${results.length} results`);
        
      } catch (ddgError) {
        console.error('[SEARCH API] DuckDuckGo search failed:', ddgError);
      }
    }
    
    // If no real results, provide helpful fallback
    if (results.length === 0) {
      results = [
        {
          title: `Search for "${query}" on DuckDuckGo`,
          url: `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
          snippet: `I wasn't able to find specific results for "${query}" through any search API, but you can search for it directly on DuckDuckGo.`,
          source: "duckduckgo.com"
        }
      ];
      searchMethod = 'fallback';
    }
    
    console.log('✅ SEARCH RESULTS RETURNED TO AGENT:', {
      query: query,
      searchMethod: searchMethod,
      resultCount: results.length,
      resultTitles: results.slice(0, 3).map(r => r.title),
      timestamp: new Date().toISOString()
    });
    
    res.json({
      query,
      results,
      search_method: searchMethod,
      timestamp: new Date().toISOString(),
      total_results: results.length
    });
    
  } catch (error: any) {
    console.error('Web search error:', error);
    res.status(500).json({ 
      error: 'Failed to perform web search', 
      details: error.message 
    });
  }
});

// Test Brave Search API endpoint
router.post("/search/test-brave", requireAuth, async (req: Request, res: Response) => {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get user's Brave API key
    let braveApiKey: string | null = null;
    
    try {
      braveApiKey = await getUserApiKey(req.user.id, 'brave');
    } catch (error) {
      return res.status(400).json({ 
        error: 'No Brave Search API key configured. Please add your API key in settings.' 
      });
    }

    if (!braveApiKey) {
      return res.status(400).json({ 
        error: 'No Brave Search API key configured. Please add your API key in settings.' 
      });
    }

    // Test the API key with a simple search
    const testQuery = 'weather forecast';
    const braveUrl = `https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(testQuery)}&count=1`;
    
    const braveResponse = await fetch(braveUrl, {
      headers: {
        'X-Subscription-Token': braveApiKey,
        'Accept': 'application/json'
      }
    });

    if (braveResponse.ok) {
      const braveData = await braveResponse.json();
      
      // Check if we got valid results
      if (braveData.web && braveData.web.results && braveData.web.results.length > 0) {
        res.json({
          status: 'working',
          message: 'Brave Search API key is working correctly',
          testQuery,
          resultCount: braveData.web.results.length
        });
      } else {
        res.json({
          status: 'error',
          message: 'Brave Search API returned no results',
          testQuery
        });
      }
    } else {
      const errorText = await braveResponse.text();
      res.status(400).json({
        status: 'error',
        message: `Brave Search API error: ${braveResponse.status} ${braveResponse.statusText}`,
        details: errorText
      });
    }

  } catch (error: any) {
    console.error('Brave Search API test error:', error);
    res.status(500).json({
      status: 'error',
      message: 'Failed to test Brave Search API',
      details: error.message
    });
  }
});

// Calendar API endpoint
router.get("/calendar", async (req: Request, res: Response) => {
  try {
    // Mock calendar data for demonstration
    const calendarEvents = [
      {
        id: "1",
        title: "Design Review Meeting",
        date: "01",
        month: "JUL",
        time: "2:00 PM - 3:30 PM",
        color: "blue"
      },
      {
        id: "2",
        title: "Team Brainstorm Session",
        date: "02",
        month: "JUL",
        time: "10:30 AM - 12:00 PM",
        color: "green"
      },
      {
        id: "3",
        title: "Quarterly Planning",
        date: "03",
        month: "JUL",
        time: "9:00 AM - 4:00 PM",
        color: "purple"
      }
    ];
    
    res.json(calendarEvents);
  } catch (err) {
    console.error("Error fetching calendar events:", err);
    res.status(500).json({ error: "Failed to fetch calendar data" });
  }
});

// OpenAI Assistant API
router.post("/assistant", async (req: Request, res: Response) => {
  try {
    const { message, conversationHistory } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    
    const response = await openai.chatCompletion(message, conversationHistory || []);
    res.json(response);
  } catch (err) {
    console.error("Error with OpenAI assistant:", err);
    res.status(500).json({ error: "Failed to generate assistant response" });
  }
});

// Create ephemeral session endpoint for realtime WebRTC
router.post("/realtime/session", requireAuth, async (req: Request, res: Response) => {
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
    try {
      const recentMemories = await db
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

// Memory storage endpoint for agent's remember_user_info function
router.post("/memory", requireAuth, async (req: Request, res: Response) => {
  try {
    const { memory_type, content, importance = 5 } = req.body;
    const user = (req as any).user;
    
    if (!memory_type || !content) {
      return res.status(400).json({ 
        error: 'memory_type and content are required'
      });
    }
    
    console.log('🧠 AGENT MEMORY STORAGE CALLED:', {
      memoryType: memory_type,
      content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
      importance: importance,
      userId: user.id,
      timestamp: new Date().toISOString()
    });
    
    // Store the memory in the database
    const [newMemory] = await db.insert(aiMemories).values({
      userId: user.id,
      memoryType: memory_type,
      content: content,
      importance: Math.min(Math.max(importance, 1), 10), // Clamp between 1-10
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    console.log('✅ MEMORY STORED SUCCESSFULLY:', {
      memoryId: newMemory.id,
      memoryType: memory_type,
      importance: newMemory.importance,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: 'Memory stored successfully',
      memory: {
        id: newMemory.id,
        type: newMemory.memoryType,
        importance: newMemory.importance,
        createdAt: newMemory.createdAt
      }
    });
    
  } catch (error: any) {
    console.error('❌ Error storing memory:', error);
    res.status(500).json({ 
      error: 'Failed to store memory', 
      details: error.message 
    });
  }
});

export default router;