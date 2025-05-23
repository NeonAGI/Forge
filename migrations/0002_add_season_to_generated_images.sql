-- Migration to ensure season field exists and is properly indexed
-- This migration is idempotent and safe to run multiple times

-- Add season column if it doesn't exist (it should already exist based on schema.ts)
ALTER TABLE "generated_images" 
ADD COLUMN IF NOT EXISTS "season" text;

-- Create index on season for faster lookups
CREATE INDEX IF NOT EXISTS "idx_generated_images_season" 
ON "generated_images" ("season");

-- Create composite index for common search patterns including season
CREATE INDEX IF NOT EXISTS "idx_generated_images_user_conditions_season" 
ON "generated_images" ("user_id", "location", "weather_condition", "time_of_day", "season");

-- Update existing records without season to have a default season based on creation date
-- This is optional and can be skipped if you want to keep existing records as-is
UPDATE "generated_images" 
SET "season" = CASE 
  WHEN EXTRACT(MONTH FROM "created_at") IN (3, 4, 5) THEN 'spring'
  WHEN EXTRACT(MONTH FROM "created_at") IN (6, 7, 8) THEN 'summer'
  WHEN EXTRACT(MONTH FROM "created_at") IN (9, 10, 11) THEN 'autumn'
  ELSE 'winter'
END
WHERE "season" IS NULL;