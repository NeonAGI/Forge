# Background Generation Race Condition Analysis & Fixes

## Current Issues Identified

### 1. **Multiple Concurrent Requests (Root Cause)**
**Problem**: Frontend fires 3 POST requests in <8ms when a 410 error occurs
- Request 1: `forceRefresh: true` 
- Request 2: `forceRefresh: false`
- Request 3: `forceRefresh: false`

**Why**: No debouncing or request deduplication on the frontend

### 2. **Server-Side Race Conditions**
**Problem**: All 3 requests start parallel image generation jobs
- Each request checks database → finds no cached image
- All proceed to generate images simultaneously 
- Results in 3 separate DALL-E API calls (wasted tokens)

### 3. **Inconsistent forceRefresh Handling**
**Problem**: Force refresh semantics create data inconsistency
- Job A saves first image
- Job B (forceRefresh=true) replaces Job A's image
- Job C (forceRefresh=false) adds a duplicate record

### 4. **Orphaned Database Records**
**Problem**: Stale DB rows pointing to deleted files
- When Job B replaces Job A, Job A's file gets deleted
- But Job A's database record remains → 410 errors on future requests

### 5. **Missing Seasonal Context**
**Problem**: Cache lookups don't include season
- Spring rain vs Winter rain should be different images
- Current system may return inappropriate seasonal images

## Comprehensive Solution

### Frontend Fixes

#### A. Request Debouncing
```typescript
// In use-weather-background.ts
const debouncedGenerate = useMemo(
  () => debounce(generateBackground, 200),
  [generateBackground]
);

// Prevent multiple rapid calls
const requestCache = useRef<Map<string, Promise<any>>>(new Map());

const generateWithDeduplication = useCallback(async (options, forceRefresh) => {
  const key = `${options.location}|${options.weatherCondition}|${options.time}|${getCurrentSeason()}`;
  
  // Return existing promise if already in flight
  if (!forceRefresh && requestCache.current.has(key)) {
    return requestCache.current.get(key);
  }
  
  const promise = executeGeneration(options, forceRefresh);
  requestCache.current.set(key, promise);
  
  promise.finally(() => {
    requestCache.current.delete(key);
  });
  
  return promise;
}, []);
```

#### B. Error Handling Improvements
```typescript
// Handle 410 errors gracefully
const handleImageError = useCallback((imageId: string) => {
  console.log(`Image ${imageId} not found, requesting new generation`);
  // Clear invalid cache reference
  localStorage.removeItem(BACKGROUND_REF_KEY);
  // Request new image (once, with debouncing)
  debouncedGenerate(currentConditions, false);
}, []);
```

### Backend Fixes

#### A. Generation Locks
```typescript
// Prevent concurrent generation for same conditions
const activeGenerations = new Map<string, Promise<any>>();

async function generateWithLock(cacheKey: string, generationFn: () => Promise<any>) {
  // Return existing promise if generation in progress
  if (activeGenerations.has(cacheKey)) {
    console.log(`Waiting for existing generation: ${cacheKey}`);
    return activeGenerations.get(cacheKey);
  }
  
  // Start new generation
  const promise = generationFn();
  activeGenerations.set(cacheKey, promise);
  
  promise.finally(() => {
    activeGenerations.delete(cacheKey);
  });
  
  return promise;
}
```

#### B. Database Upsert Pattern
```typescript
// Use UPSERT to handle concurrent writes safely
const upsertImage = async (userId, metadata, imageData) => {
  return db.transaction(async (tx) => {
    // Try to find existing
    const existing = await tx.select()
      .from(generatedImages)
      .where(and(
        eq(generatedImages.userId, userId),
        eq(generatedImages.location, metadata.location),
        eq(generatedImages.weatherCondition, metadata.weatherCondition),
        eq(generatedImages.timeOfDay, metadata.timeOfDay),
        eq(generatedImages.season, metadata.season)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing (cleanup old file)
      await cleanupOldFile(existing[0].filePath);
      return tx.update(generatedImages)
        .set({...newData, updatedAt: new Date()})
        .where(eq(generatedImages.id, existing[0].id))
        .returning();
    } else {
      // Insert new
      return tx.insert(generatedImages)
        .values(newData)
        .returning();
    }
  });
};
```

#### C. Seasonal Context Integration
```typescript
// Include season in all cache operations
const buildCacheKey = (userId, location, weather, time) => {
  const season = getCurrentSeason();
  return `${userId}|${location}|${weather}|${time}|${season}`;
};

// Update database schema with unique constraint
ALTER TABLE generated_images 
ADD CONSTRAINT unique_user_conditions 
UNIQUE (user_id, location, weather_condition, time_of_day, season);
```

#### D. Orphaned Records Cleanup
```typescript
// Periodic cleanup job
const cleanupOrphanedRecords = async () => {
  const orphaned = await db.select()
    .from(generatedImages)
    .where(sql`NOT EXISTS (SELECT 1 FROM file_system WHERE path = file_path)`);
  
  for (const record of orphaned) {
    await db.delete(generatedImages)
      .where(eq(generatedImages.id, record.id));
    console.log(`Cleaned up orphaned record: ${record.imageId}`);
  }
};

// Run cleanup every hour
setInterval(cleanupOrphanedRecords, 60 * 60 * 1000);
```

## Implementation Priority

1. **HIGH**: Frontend debouncing (prevents root cause)
2. **HIGH**: Server-side generation locks (prevents wasted API calls)
3. **MEDIUM**: Database upsert pattern (prevents duplicates)
4. **MEDIUM**: Seasonal context integration (improves cache accuracy)
5. **LOW**: Orphaned records cleanup (maintenance)

## Expected Results After Fixes

### Before:
```
00:14:37.048 GET /images/img_123 → 410
00:14:37.049 POST /weather/background (forceRefresh: true)
00:14:37.051 POST /weather/background (forceRefresh: false) 
00:14:37.057 POST /weather/background (forceRefresh: false)
→ 3 DALL-E generations, 2 duplicate records, 1 orphaned record
```

### After:
```
00:14:37.048 GET /images/img_123 → 410
00:14:37.049 POST /weather/background (forceRefresh: false) [debounced]
→ 1 DALL-E generation, 1 clean record, proper seasonal context
```

This will eliminate token waste, prevent duplicates, and ensure seasonal appropriateness.