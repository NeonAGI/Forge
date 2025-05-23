import { users, type User, type InsertUser } from "@shared/schema";
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

// Get directory path in ESM context
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Storage structure
export interface ImageMetadata {
  id: string;
  location: string;
  weatherCondition: string;
  time: string;
  date: string;
  createdAt: string;
  filePath: string;
  prompt: string;
  revisedPrompt?: string;
}

export interface UserSettings {
  location: string;
  lastUpdated?: string;
}

interface StorageData {
  images: ImageMetadata[];
  userSettings: UserSettings;
}

// Define paths
const dataDir = path.join(__dirname, '..', 'data');
const imagesDir = path.join(dataDir, 'images');
const storageFile = path.join(dataDir, 'storage.json');

// Default storage structure
const defaultStorage: StorageData = {
  images: [],
  userSettings: {
    location: 'San Francisco, CA',
    lastUpdated: new Date().toISOString()
  }
};

// Ensure directories exist
function ensureDirectories() {
  console.log(`[STORAGE] Ensuring directories exist - data: ${dataDir}, images: ${imagesDir}`);
  
  try {
    if (!fs.existsSync(dataDir)) {
      console.log(`[STORAGE] Creating data directory: ${dataDir}`);
      fs.mkdirSync(dataDir, { recursive: true });
    }
    
    if (!fs.existsSync(imagesDir)) {
      console.log(`[STORAGE] Creating images directory: ${imagesDir}`);
      fs.mkdirSync(imagesDir, { recursive: true });
    }
    
    // Verify write permissions by creating a test file
    const testFilePath = path.join(dataDir, '.test-write-permissions');
    fs.writeFileSync(testFilePath, 'test', 'utf8');
    
    // If successful, clean up the test file
    if (fs.existsSync(testFilePath)) {
      fs.unlinkSync(testFilePath);
      console.log(`[STORAGE] Successfully verified write permissions for data directory`);
    }
  } catch (error) {
    console.error(`[STORAGE] ERROR: Failed to create or access storage directories:`, error);
    console.error(`[STORAGE] Current working directory: ${process.cwd()}`);
    console.error(`[STORAGE] This may be a permissions issue or path problem.`);
    
    // Try to list some alternative directories that might be writable
    try {
      const tempDir = os.tmpdir();
      console.log(`[STORAGE] Alternative storage option - system temp directory: ${tempDir}`);
    } catch (e) {
      // Ignore errors here
    }
  }
}

// Load storage data
function loadStorage(): StorageData {
  ensureDirectories();
  
  console.log(`[STORAGE] Loading storage data from: ${storageFile}`);
  
  try {
    if (fs.existsSync(storageFile)) {
      const data = fs.readFileSync(storageFile, 'utf8');
      const parsed = JSON.parse(data);
      console.log(`[STORAGE] Successfully loaded storage data with ${parsed.images?.length || 0} images`);
      return parsed;
    } else {
      console.log(`[STORAGE] Storage file does not exist, returning default storage`);
    }
  } catch (error) {
    console.error('[STORAGE] Error loading storage:', error);
  }
  
  // If loading fails or file doesn't exist, return default and create file
  console.log(`[STORAGE] Using default storage data`);
  saveStorage(defaultStorage);
  return defaultStorage;
}

// Save storage data
function saveStorage(data: StorageData) {
  ensureDirectories();
  
  try {
    console.log(`[STORAGE] Saving storage data with ${data.images.length} images to: ${storageFile}`);
    fs.writeFileSync(storageFile, JSON.stringify(data, null, 2), 'utf8');
    console.log(`[STORAGE] Storage data saved successfully`);
  } catch (error) {
    console.error('[STORAGE] Error saving storage:', error);
  }
}

// Save image to disk
function saveImage(imageId: string, base64Data: string | undefined): string {
  ensureDirectories();
  
  if (!base64Data) {
    throw new Error("Cannot save image: base64Data is undefined");
  }
  
  // Remove data URL prefix if present
  const base64Image = base64Data.replace(/^data:image\/(png|jpeg|jpg);base64,/, '');
  
  // Define file path
  const filePath = path.join(imagesDir, `${imageId}.png`);
  
  // Save image file
  fs.writeFileSync(filePath, base64Image, 'base64');
  
  return filePath;
}

// Find cached image by criteria
function findCachedImage(location: string, weatherCondition: string, time: string): ImageMetadata | null {
  const storage = loadStorage();
  
  console.log(`[STORAGE] Searching for cached image with: location="${location}", weatherCondition="${weatherCondition}", time="${time}"`);
  console.log(`[STORAGE] Number of images in storage: ${storage.images.length}`);
  
  // Find an image matching the criteria
  const cachedImage = storage.images.find(img => 
    img.location.toLowerCase() === location.toLowerCase() &&
    img.weatherCondition.toLowerCase() === weatherCondition.toLowerCase() &&
    img.time.toLowerCase() === time.toLowerCase()
  );
  
  if (cachedImage) {
    console.log(`[STORAGE] Found matching image with ID: ${cachedImage.id}, path: ${cachedImage.filePath}`);
    
    if (fs.existsSync(cachedImage.filePath)) {
      console.log(`[STORAGE] Image file exists at path: ${cachedImage.filePath}`);
      return cachedImage;
    } else {
      console.log(`[STORAGE] WARNING: Image file does not exist at path: ${cachedImage.filePath}`);
    }
  } else {
    console.log(`[STORAGE] No matching image found for the criteria`);
  }
  
  return null;
}

// Find image by ID
function getImageById(id: string): ImageMetadata | null {
  const storage = loadStorage();
  
  console.log(`[STORAGE] Looking up image by ID: ${id}`);
  console.log(`[STORAGE] Number of images in storage: ${storage.images.length}`);
  
  // Find the image with the matching ID
  const image = storage.images.find(img => img.id === id);
  
  if (image) {
    console.log(`[STORAGE] Found image with ID: ${id}, path: ${image.filePath}`);
    
    if (fs.existsSync(image.filePath)) {
      console.log(`[STORAGE] Image file exists at path: ${image.filePath}`);
      return image;
    } else {
      console.log(`[STORAGE] WARNING: Image file does not exist at path: ${image.filePath}`);
    }
  } else {
    console.log(`[STORAGE] No image found with ID: ${id}`);
  }
  
  return null;
}

// Add new image to storage
function addImageToStorage(metadata: Omit<ImageMetadata, 'id' | 'createdAt'>, base64Data: string | undefined): ImageMetadata {
  const storage = loadStorage();
  
  console.log(`[STORAGE] Adding new image to storage with metadata:`, {
    location: metadata.location,
    weatherCondition: metadata.weatherCondition,
    time: metadata.time,
    date: metadata.date
  });
  
  // Generate unique ID
  const id = `img_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  console.log(`[STORAGE] Generated new image ID: ${id}`);
  
  // Save image to disk - make sure we have valid base64 data
  if (!base64Data) {
    console.error(`[STORAGE] ERROR: Cannot save image: base64Data is undefined`);
    throw new Error("Cannot save image: base64Data is undefined");
  }
  
  const filePath = saveImage(id, base64Data);
  console.log(`[STORAGE] Saved image to path: ${filePath}`);
  
  // Create metadata
  const imageMetadata: ImageMetadata = {
    id,
    ...metadata,
    createdAt: new Date().toISOString(),
    filePath
  };
  
  // Add to storage
  storage.images.push(imageMetadata);
  console.log(`[STORAGE] Added image metadata to storage. Total images: ${storage.images.length}`);
  
  // Keep only the last 50 images to prevent unlimited growth
  if (storage.images.length > 50) {
    const removedImages = storage.images.splice(0, storage.images.length - 50);
    console.log(`[STORAGE] Removed ${removedImages.length} old images from storage`);
    
    // Delete removed image files
    removedImages.forEach(img => {
      try {
        if (fs.existsSync(img.filePath)) {
          fs.unlinkSync(img.filePath);
          console.log(`[STORAGE] Deleted old image file: ${img.filePath}`);
        }
      } catch (err) {
        console.error(`[STORAGE] Failed to delete image file ${img.filePath}:`, err);
      }
    });
  }
  
  // Save updated storage
  saveStorage(storage);
  console.log(`[STORAGE] Saved updated storage data`);
  
  return imageMetadata;
}

// Get image data
function getImageData(filePath: string): string {
  try {
    console.log(`[STORAGE] Reading image data from path: ${filePath}`);
    const data = fs.readFileSync(filePath, 'base64');
    console.log(`[STORAGE] Successfully read image data, size: ${data.length} characters`);
    return data;
  } catch (error) {
    console.error(`[STORAGE] ERROR reading image file from ${filePath}:`, error);
    throw new Error('Failed to read image file');
  }
}

// User settings functions with async implementation
export async function getUserSettings(): Promise<UserSettings | null> {
  // First try to load from separate settings file
  const settingsFilePath = path.join(dataDir, 'user-settings.json');
  
  try {
    if (fs.existsSync(settingsFilePath)) {
      const data = await fs.promises.readFile(settingsFilePath, 'utf8');
      return JSON.parse(data) as UserSettings;
    }
    
    // Fall back to the storage file
    const storage = loadStorage();
    return storage.userSettings;
  } catch (error) {
    console.error('Error reading user settings:', error);
    return null;
  }
}

export async function saveUserSettings(settings: UserSettings): Promise<UserSettings> {
  // Save to dedicated settings file
  const settingsFilePath = path.join(dataDir, 'user-settings.json');
  
  try {
    // Ensure directory exists
    await fs.promises.mkdir(path.dirname(settingsFilePath), { recursive: true });
    
    // Add last updated timestamp if not present
    if (!settings.lastUpdated) {
      settings.lastUpdated = new Date().toISOString();
    }
    
    await fs.promises.writeFile(settingsFilePath, JSON.stringify(settings, null, 2), 'utf8');
    
    // Also update in main storage
    const storage = loadStorage();
    storage.userSettings = settings;
    saveStorage(storage);
    
    return settings;
  } catch (error) {
    console.error('Error saving user settings:', error);
    throw new Error('Failed to save user settings');
  }
}

// Run a test of storage functionality on module load
(function testStorageFunctionality() {
  console.log(`[STORAGE] Testing storage functionality...`);
  try {
    // Ensure directories exist
    ensureDirectories();
    
    // Test loading storage
    const storage = loadStorage();
    console.log(`[STORAGE] Storage load test successful: ${storage.images.length} images found`);
    
    // Test adding a sample entry
    const testData = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFdwI2QIlN4QAAAABJRU5ErkJggg==";
    const testBase64 = testData.replace(/^data:image\/png;base64,/, '');
    
    if (!storage.images.some(img => img.location === 'TEST_LOCATION')) {
      console.log(`[STORAGE] Creating test image entry`);
      const testMetadata = {
        location: 'TEST_LOCATION',
        weatherCondition: 'TEST_CONDITION',
        time: 'TEST_TIME',
        date: new Date().toISOString().split('T')[0],
        filePath: '',
        prompt: 'Test prompt',
        revisedPrompt: 'Test revised prompt'
      };
      
      const savedImage = addImageToStorage(testMetadata, testBase64);
      console.log(`[STORAGE] Test image created with ID: ${savedImage.id}`);
      
      // Test retrieving the image
      const retrievedImage = getImageById(savedImage.id);
      if (retrievedImage) {
        console.log(`[STORAGE] Storage test successful - saved and retrieved test image`);
        
        // Test findCachedImage
        const foundImage = findCachedImage('TEST_LOCATION', 'TEST_CONDITION', 'TEST_TIME');
        if (foundImage && foundImage.id === savedImage.id) {
          console.log(`[STORAGE] findCachedImage test successful`);
        } else {
          console.error(`[STORAGE] findCachedImage test failed`);
        }
        
        // Remove test image to clean up
        const updatedStorage = loadStorage();
        const filteredImages = updatedStorage.images.filter(img => img.id !== savedImage.id);
        updatedStorage.images = filteredImages;
        saveStorage(updatedStorage);
        
        // Clean up test file
        if (fs.existsSync(savedImage.filePath)) {
          fs.unlinkSync(savedImage.filePath);
        }
        
        console.log(`[STORAGE] Test cleanup complete`);
      } else {
        console.error(`[STORAGE] Storage test failed - could not retrieve test image`);
      }
    } else {
      console.log(`[STORAGE] Test image already exists, skipping creation`);
    }
    
    console.log(`[STORAGE] Storage functionality test completed successfully`);
  } catch (error) {
    console.error(`[STORAGE] Storage functionality test failed:`, error);
  }
})();

export const storage = {
  findCachedImage,
  getImageById,
  addImageToStorage,
  getImageData,
  saveUserSettings,
  getUserSettings
};
