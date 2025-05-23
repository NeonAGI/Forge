# Routes.ts Functionality Lost & Restoration Plan

## What Was Lost When `git checkout` Was Run

The current routes.ts is missing these essential components that were working before:

### 1. Background Generation Endpoints
- `POST /api/weather/background` - Main image generation endpoint
- `GET /api/weather/background` - Legacy compatibility endpoint  
- `GET /api/images/:id` - Image retrieval by ID

### 2. Cache Management System
- In-memory request caching (30-second TTL)
- Generation lock system to prevent duplicates
- Automatic cleanup of expired entries

### 3. Database Integration
- Integration with `databaseImageStorage` functions
- Seasonal metadata handling
- User-specific image management

### 4. Authentication Integration
- `requireAuth` middleware usage
- User API key retrieval and validation
- Per-user image storage

### 5. Advanced Features
- Force refresh handling
- Prompt seasoning (random style seeds)
- Seasonal context in prompts
- Race condition prevention

## Critical Issue
The frontend is currently trying to call:
- `/api/weather/background` (for generating images)
- `/api/images/:imageId` (for retrieving cached images)

But these endpoints don't exist in the current routes.ts, which means:
- ❌ Background generation is broken
- ❌ Image caching is broken  
- ❌ The app will show 404 errors for image requests

## Immediate Action Required

I need to restore the background generation functionality to routes.ts to make the app functional again. The current simple routes.ts is missing all the sophisticated image generation that was working in our earlier session.

This explains why the race condition fixes were "completed" but the underlying functionality is actually broken due to the accidental file revert.