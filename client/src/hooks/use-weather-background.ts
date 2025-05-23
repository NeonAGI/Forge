import { useState, useEffect, useCallback, useRef } from 'react';
import { apiRequest } from "@/lib/queryClient";
import { useWeather } from "./use-weather";
import { useClock } from "./use-clock";
import { extractDominantColor, createColorPalette, type HSLColor } from "@/lib/color-utils";

export interface GenerateBackgroundOptions {
  location: string;
  weatherCondition: string;
  time: string;
}

// Local storage keys
const BACKGROUND_KEY = 'weather_app_background';
const BACKGROUND_META_KEY = 'weather_app_background_meta';
const BACKGROUND_REF_KEY = 'weather_app_background_ref';

export function useWeatherBackground() {
  const { currentWeather, location, isLoading } = useWeather();
  const { time } = useClock();
  const [isGenerating, setIsGenerating] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState<string | null>(null);
  const [preloadedImage, setPreloadedImage] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [dominantColor, setDominantColor] = useState<HSLColor | null>(null);
  const [colorPalette, setColorPalette] = useState<ReturnType<typeof createColorPalette> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasAutoLoaded, setHasAutoLoaded] = useState(false);
  const [isAutoLoading, setIsAutoLoading] = useState(false);
  // Add attempts counter to track if we should keep trying
  const autoLoadAttempts = useRef(0);
  const maxAttempts = 3; // Reduced from 5 to prevent excessive attempts
  const lastGenerationKey = useRef<string | null>(null);
  // Debouncing and request management
  const activeRequests = useRef<Map<string, Promise<any>>>(new Map());
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());
  // Track when we last generated to prevent rapid regeneration
  const lastGenerationTime = useRef<number>(0);
  const MIN_GENERATION_INTERVAL = 30000; // 30 seconds minimum between generations

  // Helper function to determine weather description
  const getWeatherDescription = (weatherCode: string) => {
    const weatherCodeNum = parseInt(weatherCode.replace(/\D/g, ''));
    
    if ([0, 1].includes(weatherCodeNum)) {
      return 'clear skies';
    } else if ([2, 3].includes(weatherCodeNum)) {
      return 'partly cloudy';
    } else if ([51, 53, 55, 61, 63, 65].includes(weatherCodeNum)) {
      return 'rainy conditions';
    } else if ([71, 73, 75].includes(weatherCodeNum)) {
      return 'light snow';
    } else if ([95, 96, 99].includes(weatherCodeNum)) {
      return 'thunderstorms';
    }
    
    return 'partly cloudy'; // Default
  };

  // Helper function to get current time quarter (only 4 times per day)
  const getCurrentTimeQuarter = () => {
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) return 'morning';
    if (hour >= 12 && hour < 18) return 'afternoon'; 
    if (hour >= 18 && hour <= 23) return 'evening';
    return 'night'; // 0-5 hours
  };

  // Helper function to get current season
  const getCurrentSeason = () => {
    const currentMonth = new Date().getMonth(); // 0-11
    if (currentMonth >= 2 && currentMonth <= 4) return 'spring';
    if (currentMonth >= 5 && currentMonth <= 7) return 'summer'; 
    if (currentMonth >= 8 && currentMonth <= 10) return 'autumn';
    return 'winter';
  };

  // Helper function to check if we should update the background
  const shouldUpdateBackground = (currentConditions: { location: string, weather: string, timeQuarter: string, season: string }) => {
    // Get stored reference
    try {
      const imageRefStr = localStorage.getItem(BACKGROUND_REF_KEY);
      if (!imageRefStr) return true; // No cached image, should update

      const imageRef = JSON.parse(imageRefStr);
      
      // Check if conditions match (including season)
      const conditionsMatch = 
        imageRef.location === currentConditions.location &&
        imageRef.weatherCondition === currentConditions.weather &&
        imageRef.time === currentConditions.timeQuarter &&
        imageRef.season === currentConditions.season; // Season must match exactly (missing season = no match, will update)

      // Check if image is recent (less than 6 hours old to allow time quarter changes)
      const timestamp = new Date(imageRef.timestamp);
      const now = new Date();
      const isRecent = (now.getTime() - timestamp.getTime()) < 6 * 60 * 60 * 1000; // 6 hours

      console.log(`[CLIENT] Condition check: match=${conditionsMatch}, recent=${isRecent}`);
      console.log(`[CLIENT] Cached: ${JSON.stringify(imageRef)}, Current: ${JSON.stringify(currentConditions)}`);

      // Only update if conditions changed OR image is too old
      return !conditionsMatch || !isRecent;
    } catch (err) {
      console.warn('Error checking background update conditions:', err);
      return true; // On error, allow update
    }
  };

  // Function to generate a new background
  const generateBackground = useCallback(async (options: GenerateBackgroundOptions, forceRefresh = false) => {
    const season = getCurrentSeason();
    const generationKey = `${options.location}|${options.weatherCondition}|${options.time}|${season}`;
    
    // Check if we already have an active request for this exact combination
    if (!forceRefresh && activeRequests.current.has(generationKey)) {
      console.log(`[CLIENT] Reusing active request for: ${generationKey}`);
      try {
        return await activeRequests.current.get(generationKey);
      } catch (error) {
        console.warn(`[CLIENT] Active request failed for: ${generationKey}`, error);
        // Continue to create new request
      }
    }
    
    // Clear any existing debounce timer for this key
    const existingTimer = debounceTimers.current.get(generationKey);
    if (existingTimer) {
      clearTimeout(existingTimer);
      debounceTimers.current.delete(generationKey);
    }
    
    // Create debounced request (unless forced refresh)
    if (!forceRefresh) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(async () => {
          debounceTimers.current.delete(generationKey);
          try {
            const result = await executeGeneration(options, forceRefresh, generationKey, season);
            resolve(result);
          } catch (error) {
            reject(error);
          }
        }, 150); // 150ms debounce
        
        debounceTimers.current.set(generationKey, timer);
      });
    } else {
      // Force refresh bypasses debouncing
      return executeGeneration(options, forceRefresh, generationKey, season);
    }
  }, []);
  
  // Stable generation execution with minimal dependencies
  const executeGeneration = useCallback(async (options: GenerateBackgroundOptions, forceRefresh: boolean, generationKey: string, season: string) => {
    console.log(`[CLIENT] Executing generation for: ${generationKey} (force: ${forceRefresh})`);
    
    // Prevent duplicate requests
    if (!forceRefresh && lastGenerationKey.current === generationKey && isGenerating) {
      console.log('Skipping duplicate generation request:', generationKey);
      return;
    }
    
    lastGenerationKey.current = generationKey;
    setIsGenerating(true);
    setError(null);
    
    // Create the request promise
    const requestPromise = (async () => {
    
    try {
      console.log(`${forceRefresh ? 'Force refreshing' : 'Generating'} background for ${options.location} with ${options.weatherCondition} at ${options.time}`);
      
      const requestBody = {
        ...options,
        forceRefresh
      };
      
      const response = await apiRequest('POST', '/api/weather/background', requestBody);
      
      if (!response.ok) {
        // Handle API errors
        const errorData = await response.json();
        
        if (errorData.error === 'missing_or_invalid_api_key') {
          setError('⚠️ OpenAI API key is missing or invalid. Background generation requires a valid API key. Go to API Keys settings to configure.');
        } else if (errorData.error === 'missing_api_key' || errorData.error === 'invalid_api_key') {
          setError('OpenAI API key is missing or not configured properly. Please check your settings.');
        } else {
          setError(`Error generating background: ${errorData.message || errorData.error || 'Unknown error'}`);
        }
        return;
      }
      
      const data = await response.json();
      console.log("Received background data:", 
        data.cached ? "Using cached image" : "New image generated",
        data.imageDataUrl ? "imageDataUrl provided" : "no imageDataUrl",
        data.imageBase64 ? `imageBase64 provided (length: ${data.imageBase64.length})` : "no imageBase64",
        data.imageId ? `Image ID: ${data.imageId}` : "no image ID"
      );
      
      // First try to use imageDataUrl if provided by the server
      if (data.imageDataUrl && data.imageDataUrl.startsWith('data:image')) {
        console.log("Using imageDataUrl provided by server");
        
        // Extract colors and update palette
        const updateImageAndColors = async (imageUrl: string) => {
          try {
            console.log("Extracting dominant color from new background");
            const dominantHsl = await extractDominantColor(imageUrl);
            const palette = createColorPalette(dominantHsl);
            
            setDominantColor(dominantHsl);
            setColorPalette(palette);
            console.log("Color palette updated:", palette);
          } catch (colorError) {
            console.warn("Failed to extract colors from image:", colorError);
          }
        };
        
        // If we have an existing background, preload the new one for smooth transition
        if (backgroundImage && !forceRefresh) {
          console.log("Preloading new background for smooth transition");
          setPreloadedImage(data.imageDataUrl);
          
          // Extract colors from new image
          await updateImageAndColors(data.imageDataUrl);
          
          // Start transition after preload
          setTimeout(() => {
            setIsTransitioning(true);
            setTimeout(() => {
              setBackgroundImage(data.imageDataUrl);
              setPreloadedImage(null);
              setTimeout(() => setIsTransitioning(false), 600); // Match CSS transition
            }, 50);
          }, 100);
        } else {
          // Set the image immediately if no existing background
          setBackgroundImage(data.imageDataUrl);
          await updateImageAndColors(data.imageDataUrl);
        }
        
        // Store image reference rather than full image data
        if (data.imageId) {
          try {
            // Store reference to image instead of full data
            const imageRef = {
              id: data.imageId,
              location: options.location,
              weatherCondition: options.weatherCondition,
              time: options.time,
              season: getCurrentSeason(),
              timestamp: new Date().toISOString()
            };
            
            localStorage.setItem(BACKGROUND_REF_KEY, JSON.stringify(imageRef));
            console.log("Stored image reference in localStorage:", data.imageId);
          } catch (storageError) {
            console.warn('Failed to store image reference in localStorage:', storageError);
          }
        } else {
          console.warn('No image ID provided by server, cannot store reference');
        }
      }
      // Otherwise fallback to imageBase64 if provided
      else if (data.imageBase64) {
        console.log("Creating data URL from imageBase64");
        // Create a data URL for the image
        const imageDataUrl = `data:image/png;base64,${data.imageBase64}`;
        
        // Extract colors and update palette
        const updateImageAndColors = async (imageUrl: string) => {
          try {
            console.log("Extracting dominant color from new background");
            const dominantHsl = await extractDominantColor(imageUrl);
            const palette = createColorPalette(dominantHsl);
            
            setDominantColor(dominantHsl);
            setColorPalette(palette);
            console.log("Color palette updated:", palette);
          } catch (colorError) {
            console.warn("Failed to extract colors from image:", colorError);
          }
        };
        
        // If we have an existing background, preload the new one for smooth transition
        if (backgroundImage && !forceRefresh) {
          console.log("Preloading new background for smooth transition");
          setPreloadedImage(imageDataUrl);
          
          // Extract colors from new image
          await updateImageAndColors(imageDataUrl);
          
          // Start transition after preload
          setTimeout(() => {
            setIsTransitioning(true);
            setTimeout(() => {
              setBackgroundImage(imageDataUrl);
              setPreloadedImage(null);
              setTimeout(() => setIsTransitioning(false), 600); // Match CSS transition
            }, 50);
          }, 100);
        } else {
          // Set the image immediately if no existing background
          setBackgroundImage(imageDataUrl);
          await updateImageAndColors(imageDataUrl);
        }
        
        // Store image reference if available
        if (data.imageId) {
          try {
            // Store reference to image instead of full data
            const imageRef = {
              id: data.imageId,
              location: options.location,
              weatherCondition: options.weatherCondition,
              time: options.time,
              season: getCurrentSeason(),
              timestamp: new Date().toISOString()
            };
            
            localStorage.setItem(BACKGROUND_REF_KEY, JSON.stringify(imageRef));
            console.log("Stored image reference in localStorage:", data.imageId);
          } catch (storageError) {
            console.warn('Failed to store image reference in localStorage:', storageError);
          }
        }
      } else {
        setError('No image data received from server');
      }
      
    } catch (err) {
      console.error('Background generation error:', err);
      setError('Failed to communicate with the server. Please try again later.');
    } finally {
      setIsGenerating(false);
      // Clean up active request
      activeRequests.current.delete(generationKey);
    }
    })();
    
    // Store active request to prevent duplicates
    if (!forceRefresh) {
      activeRequests.current.set(generationKey, requestPromise);
    }
    
    return requestPromise;
  }, []); // Minimal dependencies - only recreate if absolutely necessary
  
  // Function to force refresh the current background
  const forceRefreshBackground = useCallback(async (customLocation?: string) => {
    if (!currentWeather || (!location && !customLocation)) {
      console.warn("Cannot force refresh: weather data or location not available");
      return;
    }
    
    // Get current time quarter (consistent with auto-load logic)
    const timeOfDay = getCurrentTimeQuarter();
    
    // Get weather condition
    const weatherCondition = getWeatherDescription(currentWeather.weatherCode);
    
    // Use custom location if provided, otherwise use the hook's location
    const targetLocation = customLocation || location;
    
    console.log(`Force refreshing background: ${targetLocation}, ${weatherCondition}, ${timeOfDay}`);
    
    // Force generate new background
    await generateBackground({
      location: targetLocation,
      weatherCondition,
      time: timeOfDay
    }, true); // true = forceRefresh
  }, [currentWeather, location, generateBackground]);
  
  // Function to clear background
  const clearBackground = useCallback(() => {
    setBackgroundImage(null);
    
    // Clear from localStorage
    localStorage.removeItem(BACKGROUND_REF_KEY);
  }, []);
  
  // Stable auto-load effect with proper conditions
  useEffect(() => {
    // Only attempt auto-loading if we haven't done it successfully yet, and if we haven't exceeded max attempts
    if (hasAutoLoaded || autoLoadAttempts.current >= maxAttempts) return;
    
    // Only auto-load if we don't already have a background image
    if (backgroundImage) {
      console.log('[CLIENT] Already have background image, marking auto-load as complete');
      setHasAutoLoaded(true);
      return;
    }
    
    const loadBackgroundImage = async () => {
      // Prevent multiple simultaneous auto-loads
      if (isAutoLoading) {
        console.log('[CLIENT] Auto-load already in progress, skipping');
        return;
      }
      
      setIsAutoLoading(true);
      console.log(`[CLIENT] Auto-load attempt ${autoLoadAttempts.current + 1}/${maxAttempts}, weather data loaded: ${!isLoading}`);
      
      // Increment attempt counter
      autoLoadAttempts.current += 1;
      
      // Check if we have weather data
      if (isLoading || !currentWeather || !location) {
        console.log("Weather data not loaded yet, can't auto-load background image");
        
        // Only set auto-loaded to true if we've exceeded max attempts
        if (autoLoadAttempts.current >= maxAttempts) {
          console.warn(`Exceeded maximum auto-load attempts (${maxAttempts}). Giving up.`);
          setHasAutoLoaded(true);
        } else {
          // Schedule another attempt if weather data isn't loaded yet
          setTimeout(() => {
            autoLoadAttempts.current -= 1; 
          }, 2000); // Retry after 2 seconds
        }
        setIsAutoLoading(false);
        return;
      }
      
      // Get current conditions
      const currentTimeQuarter = getCurrentTimeQuarter();
      const weatherCondition = getWeatherDescription(currentWeather.weatherCode);
      const currentSeason = getCurrentSeason();
      const currentConditions = {
        location,
        weather: weatherCondition,
        timeQuarter: currentTimeQuarter,
        season: currentSeason
      };
      
      console.log(`[CLIENT] Current conditions: ${JSON.stringify(currentConditions)}`);
      
      // Check if we should update based on time gating
      if (!shouldUpdateBackground(currentConditions)) {
        console.log(`[CLIENT] Background update not needed - conditions match and image is recent`);
        setHasAutoLoaded(true);
        setIsAutoLoading(false);
        return;
      }
      
      // Additional check: if we already have a background image, don't auto-generate unless conditions changed
      if (backgroundImage && !shouldUpdateBackground(currentConditions)) {
        console.log(`[CLIENT] Already have background image, skipping auto-generation`);
        setHasAutoLoaded(true);
        setIsAutoLoading(false);
        return;
      }
      
      // Try to load from localStorage reference
      try {
        const imageRefStr = localStorage.getItem(BACKGROUND_REF_KEY);
        
        if (imageRefStr) {
          const imageRef = JSON.parse(imageRefStr);
          console.log("[CLIENT] Found image reference in localStorage:", imageRef);
          
          // Check if the cached image is recent (less than 24 hours old)
          const timestamp = new Date(imageRef.timestamp);
          const now = new Date();
          const isRecent = (now.getTime() - timestamp.getTime()) < 24 * 60 * 60 * 1000;
          const age = Math.round((now.getTime() - timestamp.getTime()) / (60 * 60 * 1000) * 10) / 10;
          
          console.log(`[CLIENT] Image reference age: ${age} hours, isRecent: ${isRecent}`);
          
          if (isRecent && imageRef.id) {
            // Skip mock image IDs
            if (imageRef.id === 'mock-image-id' || !imageRef.id.startsWith('img_')) {
              console.log(`[CLIENT] Skipping invalid image ID: ${imageRef.id}`);
              localStorage.removeItem(BACKGROUND_REF_KEY);
            } else {
              console.log("[CLIENT] Loading image by ID from server:", imageRef.id);
            
              // Fetch the image by ID
              try {
                const apiUrl = `/api/images/${encodeURIComponent(imageRef.id)}`;
                console.log(`[CLIENT] Requesting image from: ${apiUrl}`);
                
                const response = await fetch(apiUrl);
                console.log(`[CLIENT] Image fetch response status: ${response.status}`);
                
                if (response.ok) {
                  const data = await response.json();
                  console.log("[CLIENT] Image fetch successful, received data:", 
                    data.imageDataUrl ? "imageDataUrl provided" : "no imageDataUrl", 
                    data.metadata ? `metadata included for: ${data.metadata.location}` : "no metadata"
                  );
                  
                  if (data.imageDataUrl && data.imageDataUrl.startsWith('data:image')) {
                    console.log("[CLIENT] Successfully loaded image from server by ID");
                    setBackgroundImage(data.imageDataUrl);
                    
                    // Extract colors from loaded image
                    try {
                      const dominantHsl = await extractDominantColor(data.imageDataUrl);
                      const palette = createColorPalette(dominantHsl);
                      setDominantColor(dominantHsl);
                      setColorPalette(palette);
                    } catch (colorError) {
                      console.warn("Failed to extract colors from loaded image:", colorError);
                    }
                    
                    setHasAutoLoaded(true);
                    return;
                  } else {
                    console.warn("[CLIENT] Server response missing valid imageDataUrl");
                  }
                } else {
                  const errorText = await response.text();
                  console.warn(`[CLIENT] Failed to load image by ID, server responded: ${response.status} - ${errorText}`);
                  
                  // If image not found (404) or gone (410), remove the bad reference from localStorage
                  if (response.status === 404 || response.status === 410) {
                    console.warn(`[CLIENT] Image ID ${imageRef.id} not found or gone (${response.status}), removing from localStorage to stop polling`);
                    localStorage.removeItem(BACKGROUND_REF_KEY);
                  }
                }
              } catch (err) {
                console.warn("[CLIENT] Error loading image by ID:", err);
              }
            }
          } else {
            if (!isRecent) {
              console.log("[CLIENT] Image reference is too old, will generate new image");
            } else if (!imageRef.id) {
              console.log("[CLIENT] Image reference missing ID, will generate new image");
            }
          }
        } else {
          console.log("[CLIENT] No image reference found in localStorage");
        }
      } catch (err) {
        console.warn('[CLIENT] Failed to load background from localStorage reference:', err);
      }
      
      // No valid cached image found, try to generate/load a new one
      console.log("No valid image reference or conditions changed, will try to load/generate a new image...");
      
      // Try to generate/load a background image
      try {
        console.log(`Auto-loading background for ${location} with ${weatherCondition} at ${currentTimeQuarter}`);
        await generateBackground({
          location,
          weatherCondition,
          time: currentTimeQuarter
        });
        // Mark as auto-loaded only after successful generation
        setHasAutoLoaded(true);
      } catch (error) {
        console.error("Error auto-loading background:", error);
        // Don't mark as auto-loaded on error so we can retry
      } finally {
        setIsAutoLoading(false);
      }
    };
    
    loadBackgroundImage();
  }, [hasAutoLoaded, isAutoLoading, isLoading]); // Removed currentWeather, location to prevent excessive regeneration
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Clear all debounce timers
      debounceTimers.current.forEach(timer => clearTimeout(timer));
      debounceTimers.current.clear();
      
      // Clear active requests
      activeRequests.current.clear();
    };
  }, []);

  return {
    generateBackground,
    forceRefreshBackground,
    clearBackground,
    backgroundImage,
    preloadedImage,
    isTransitioning,
    dominantColor,
    colorPalette,
    isGenerating,
    error
  };
} 