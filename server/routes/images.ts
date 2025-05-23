import { Router, Request, Response } from "express";
import { requireAuth } from '../auth-routes';
import { databaseImageStorage } from '../database-image-storage';

const router = Router();

// Get image by ID endpoint
router.get('/:imageId', requireAuth, async (req: Request, res: Response) => {
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
router.post('/cleanup', requireAuth, async (req: Request, res: Response) => {
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

export default router;