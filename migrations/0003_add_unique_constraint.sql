-- Migration to add unique constraint to prevent duplicate images
-- This ensures only one image per user/location/weather/time/season combination

-- First, remove any existing duplicates by keeping only the most recent one
WITH ranked_images AS (
  SELECT 
    id,
    ROW_NUMBER() OVER (
      PARTITION BY user_id, location, weather_condition, time_of_day, season 
      ORDER BY created_at DESC
    ) as rn
  FROM generated_images
  WHERE season IS NOT NULL -- Only consider images with season data
),
duplicates_to_delete AS (
  SELECT id FROM ranked_images WHERE rn > 1
)
DELETE FROM generated_images 
WHERE id IN (SELECT id FROM duplicates_to_delete);

-- Add unique constraint (this will prevent future duplicates)
ALTER TABLE generated_images 
ADD CONSTRAINT unique_user_conditions 
UNIQUE (user_id, location, weather_condition, time_of_day, season);

-- Create optimized index for the unique constraint
CREATE INDEX IF NOT EXISTS idx_generated_images_unique_lookup 
ON generated_images (user_id, location, weather_condition, time_of_day, season, created_at DESC);

-- Add check constraint to ensure season is not null for new records
ALTER TABLE generated_images 
ADD CONSTRAINT check_season_not_null 
CHECK (season IS NOT NULL);