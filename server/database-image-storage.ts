import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and, desc } from 'drizzle-orm';
import postgres from 'postgres';
import { generatedImages, type GeneratedImage, type InsertGeneratedImage } from '@shared/schema';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

// Get directory path in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database connection - check if DATABASE_URL is available
if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL not found in environment variables');
}

const connectionString = process.env.DATABASE_URL || 'postgresql://forge:forge_password@localhost:5432/forge';
console.log('Image storage connecting to database:', connectionString.replace(/:[^:@]*@/, ':***@')); // Hide password in logs

const client = postgres(connectionString);
const db = drizzle(client);

// Image storage configuration
const IMAGES_BASE_DIR = path.join(__dirname, '..', 'data', 'images');
const MAX_IMAGES_PER_USER = 50;

// Ensure directories exist
export function ensureImageDirectories(userId: number) {
  const userImageDir = path.join(IMAGES_BASE_DIR, 'users', userId.toString());
  
  if (!fs.existsSync(userImageDir)) {
    console.log(`[DB-STORAGE] Creating user image directory: ${userImageDir}`);
    fs.mkdirSync(userImageDir, { recursive: true });
  }
  
  return userImageDir;
}

// Generate hash key for caching
export function generateHashKey(location: string, weatherCondition: string, timeOfDay: string, season?: string, temperature?: number): string {
  const input = `${location.toLowerCase()}|${weatherCondition.toLowerCase()}|${timeOfDay.toLowerCase()}|${season?.toLowerCase() || ''}|${temperature || ''}`;
  return crypto.createHash('md5').update(input).digest('hex');
}

// Save image to filesystem
export function saveImageToFile(userId: number, imageId: string, base64Data: string): { filePath: string; fileName: string; fileSize: number } {
  const userImageDir = ensureImageDirectories(userId);
  
  // Remove data URL prefix if present
  const base64Image = base64Data.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
  
  // Generate filename
  const fileName = `${imageId}.png`;
  const filePath = path.join(userImageDir, fileName);
  
  // Save image file
  const buffer = Buffer.from(base64Image, 'base64');
  fs.writeFileSync(filePath, buffer);
  
  return {
    filePath,
    fileName,
    fileSize: buffer.length
  };
}

// Find cached image by criteria
export async function findCachedImage(
  userId: number,
  location: string,
  weatherCondition: string,
  timeOfDay: string,
  season?: string,
  temperature?: number
): Promise<GeneratedImage | null> {
  try {
    console.log(`[DB-STORAGE] Searching for cached image: user=${userId}, location="${location}", weather="${weatherCondition}", time="${timeOfDay}", season="${season || 'any'}"`);
    
    const hashKey = generateHashKey(location, weatherCondition, timeOfDay, season, temperature);
    
    // First try exact hash match
    let image = await db
      .select()
      .from(generatedImages)
      .where(and(
        eq(generatedImages.userId, userId),
        eq(generatedImages.hashKey, hashKey)
      ))
      .orderBy(desc(generatedImages.createdAt))
      .limit(1);

    if (image.length > 0) {
      console.log(`[DB-STORAGE] Found cached image with hash key: ${hashKey}`);
      return image[0];
    }

    // Fallback to manual matching (for backward compatibility)
    // Build conditions array dynamically
    const conditions = [
      eq(generatedImages.userId, userId),
      eq(generatedImages.location, location),
      eq(generatedImages.weatherCondition, weatherCondition),
      eq(generatedImages.timeOfDay, timeOfDay)
    ];
    
    // Add season condition if provided
    if (season) {
      conditions.push(eq(generatedImages.season, season));
    }
    
    image = await db
      .select()
      .from(generatedImages)
      .where(and(...conditions))
      .orderBy(desc(generatedImages.createdAt))
      .limit(1);

    if (image.length > 0) {
      console.log(`[DB-STORAGE] Found cached image with manual matching`);
      return image[0];
    }

    console.log(`[DB-STORAGE] No cached image found`);
    return null;
  } catch (error) {
    console.error('[DB-STORAGE] Error finding cached image:', error);
    return null;
  }
}

// Get image by ID
export async function getImageById(userId: number, imageId: string): Promise<GeneratedImage | null> {
  try {
    const image = await db
      .select()
      .from(generatedImages)
      .where(and(
        eq(generatedImages.userId, userId),
        eq(generatedImages.imageId, imageId)
      ))
      .limit(1);

    return image.length > 0 ? image[0] : null;
  } catch (error) {
    console.error('[DB-STORAGE] Error getting image by ID:', error);
    return null;
  }
}

// Add new image to database storage
export async function addImageToStorage(
  userId: number,
  metadata: {
    location: string;
    weatherCondition: string;
    timeOfDay: string;
    temperature?: number;
    season?: string;
    prompt: string;
    revisedPrompt?: string;
    model?: string;
    style?: string;
    quality?: string;
    tags?: string[];
  },
  base64Data: string
): Promise<GeneratedImage> {
  try {
    console.log(`[DB-STORAGE] Adding new image for user ${userId}`);
    
    // Generate unique image ID
    const imageId = `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Save image to filesystem
    const fileInfo = saveImageToFile(userId, imageId, base64Data);
    
    // Generate hash key for caching
    const hashKey = generateHashKey(
      metadata.location,
      metadata.weatherCondition,
      metadata.timeOfDay,
      metadata.season,
      metadata.temperature
    );
    
    // Check for existing image with same conditions
    const existingImage = await db
      .select()
      .from(generatedImages)
      .where(and(
        eq(generatedImages.userId, userId),
        eq(generatedImages.location, metadata.location),
        eq(generatedImages.weatherCondition, metadata.weatherCondition),
        eq(generatedImages.timeOfDay, metadata.timeOfDay),
        eq(generatedImages.season, metadata.season || '')
      ))
      .limit(1);
    
    let newImage;
    
    if (existingImage.length > 0) {
      console.log(`[DB-STORAGE] Updating existing image: ${existingImage[0].imageId}`);
      
      // Delete old file if it exists
      try {
        if (existingImage[0].filePath && fs.existsSync(existingImage[0].filePath)) {
          fs.unlinkSync(existingImage[0].filePath);
          console.log(`[DB-STORAGE] Deleted old file: ${existingImage[0].filePath}`);
        }
      } catch (fileError) {
        console.warn(`[DB-STORAGE] Failed to delete old file: ${existingImage[0].filePath}`, fileError);
      }
      
      // Update existing record
      const updatedImages = await db
        .update(generatedImages)
        .set({
          imageId,
          prompt: metadata.prompt,
          revisedPrompt: metadata.revisedPrompt,
          model: metadata.model || 'dall-e-3',
          style: metadata.style,
          quality: metadata.quality || 'standard',
          filePath: fileInfo.filePath,
          fileName: fileInfo.fileName,
          fileSize: fileInfo.fileSize,
          hashKey,
          tags: metadata.tags || [],
          updatedAt: new Date(),
        })
        .where(eq(generatedImages.id, existingImage[0].id))
        .returning();
      
      newImage = updatedImages;
    } else {
      // Insert new record
      console.log(`[DB-STORAGE] Creating new image record`);
      newImage = await db
        .insert(generatedImages)
        .values({
          userId,
          imageId,
          location: metadata.location,
          weatherCondition: metadata.weatherCondition,
          timeOfDay: metadata.timeOfDay,
          temperature: metadata.temperature,
          season: metadata.season || 'unknown',
          prompt: metadata.prompt,
          revisedPrompt: metadata.revisedPrompt,
          model: metadata.model || 'dall-e-3',
          style: metadata.style,
          quality: metadata.quality || 'standard',
          filePath: fileInfo.filePath,
          fileName: fileInfo.fileName,
          fileSize: fileInfo.fileSize,
          hashKey,
          tags: metadata.tags || [],
        })
        .returning();
    }

    console.log(`[DB-STORAGE] Image saved with ID: ${imageId}`);

    // Clean up old images if user has too many
    await cleanupOldImages(userId);

    return newImage[0];
  } catch (error) {
    console.error('[DB-STORAGE] Error adding image to storage:', error);
    throw error;
  }
}

// Clean up old images when user exceeds limit
async function cleanupOldImages(userId: number): Promise<void> {
  try {
    // Get all user images ordered by creation date
    const userImages = await db
      .select()
      .from(generatedImages)
      .where(eq(generatedImages.userId, userId))
      .orderBy(desc(generatedImages.createdAt));

    if (userImages.length > MAX_IMAGES_PER_USER) {
      const imagesToDelete = userImages.slice(MAX_IMAGES_PER_USER);
      
      console.log(`[DB-STORAGE] User ${userId} has ${userImages.length} images, removing ${imagesToDelete.length} old ones`);
      
      for (const image of imagesToDelete) {
        // Delete file from filesystem
        try {
          if (fs.existsSync(image.filePath)) {
            fs.unlinkSync(image.filePath);
            console.log(`[DB-STORAGE] Deleted file: ${image.filePath}`);
          }
        } catch (fileError) {
          console.error(`[DB-STORAGE] Error deleting file ${image.filePath}:`, fileError);
        }
        
        // Delete from database
        await db
          .delete(generatedImages)
          .where(eq(generatedImages.id, image.id));
      }
      
      console.log(`[DB-STORAGE] Cleanup completed for user ${userId}`);
    }
  } catch (error) {
    console.error('[DB-STORAGE] Error during cleanup:', error);
  }
}

// Get image data from filesystem
export function getImageData(filePath: string): string {
  try {
    console.log(`[DB-STORAGE] Reading image data from: ${filePath}`);
    const data = fs.readFileSync(filePath, 'base64');
    console.log(`[DB-STORAGE] Successfully read image data, size: ${data.length} characters`);
    return data;
  } catch (error) {
    console.error(`[DB-STORAGE] Error reading image file from ${filePath}:`, error);
    throw new Error('Failed to read image file');
  }
}

// Update image usage count
export async function updateImageUsage(userId: number, imageId: string): Promise<void> {
  try {
    await db
      .update(generatedImages)
      .set({
        useCount: generatedImages.useCount + 1,
        lastUsedAt: new Date(),
      })
      .where(and(
        eq(generatedImages.userId, userId),
        eq(generatedImages.imageId, imageId)
      ));
  } catch (error) {
    console.error('[DB-STORAGE] Error updating image usage:', error);
  }
}

// Get user's image statistics
export async function getUserImageStats(userId: number): Promise<{
  totalImages: number;
  totalSizeBytes: number;
  recentImages: GeneratedImage[];
}> {
  try {
    const userImages = await db
      .select()
      .from(generatedImages)
      .where(eq(generatedImages.userId, userId))
      .orderBy(desc(generatedImages.createdAt));

    const totalImages = userImages.length;
    const totalSizeBytes = userImages.reduce((sum, img) => sum + (img.fileSize || 0), 0);
    const recentImages = userImages.slice(0, 10);

    return {
      totalImages,
      totalSizeBytes,
      recentImages,
    };
  } catch (error) {
    console.error('[DB-STORAGE] Error getting user image stats:', error);
    return {
      totalImages: 0,
      totalSizeBytes: 0,
      recentImages: [],
    };
  }
}

// Clean up orphaned database records (files missing)
export async function cleanupOrphanedRecords(userId?: number): Promise<void> {
  try {
    console.log('[DB-STORAGE] Starting orphaned records cleanup');
    
    // Get all images for user (or all users if not specified)
    const whereClause = userId ? eq(generatedImages.userId, userId) : undefined;
    const allImages = await db
      .select()
      .from(generatedImages)
      .where(whereClause);
    
    let orphanedCount = 0;
    
    for (const image of allImages) {
      // Check if file exists
      if (!fs.existsSync(image.filePath)) {
        console.log(`[DB-STORAGE] Found orphaned record: ${image.imageId} (file missing: ${image.filePath})`);
        
        // Delete orphaned database record
        await db
          .delete(generatedImages)
          .where(eq(generatedImages.id, image.id));
        
        orphanedCount++;
      }
    }
    
    if (orphanedCount > 0) {
      console.log(`[DB-STORAGE] Cleaned up ${orphanedCount} orphaned records`);
    } else {
      console.log('[DB-STORAGE] No orphaned records found');
    }
  } catch (error) {
    console.error('[DB-STORAGE] Error during orphaned records cleanup:', error);
  }
}

export const databaseImageStorage = {
  findCachedImage,
  getImageById,
  addImageToStorage,
  getImageData,
  updateImageUsage,
  getUserImageStats,
  cleanupOrphanedRecords,
};