-- Migration: Add voice_id column to user_settings table
-- This allows users to select their preferred OpenAI voice

ALTER TABLE user_settings 
ADD COLUMN voice_id TEXT DEFAULT 'alloy';

-- Update existing users to have default voice
UPDATE user_settings 
SET voice_id = 'alloy' 
WHERE voice_id IS NULL;