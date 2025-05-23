-- Migration: Multi-user authentication and image storage
-- This migration transforms the existing single-user system into a multi-user system

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS "image_collection_items";
DROP TABLE IF EXISTS "image_collections";
DROP TABLE IF EXISTS "generated_images";
DROP TABLE IF EXISTS "user_sessions";
DROP TABLE IF EXISTS "weather_cache";
DROP TABLE IF EXISTS "ai_memories";
DROP TABLE IF EXISTS "user_settings";
DROP TABLE IF EXISTS "user_api_keys";
DROP TABLE IF EXISTS "messages";
DROP TABLE IF EXISTS "conversations";
DROP TABLE IF EXISTS "calendar_events";
DROP TABLE IF EXISTS "weather_preferences";
DROP TABLE IF EXISTS "users";

-- Create users table with secure authentication
CREATE TABLE "users" (
  "id" SERIAL PRIMARY KEY,
  "username" TEXT NOT NULL UNIQUE,
  "email" TEXT NOT NULL UNIQUE,
  "password_hash" TEXT NOT NULL,
  "display_name" TEXT,
  "is_active" BOOLEAN DEFAULT true,
  "last_login_at" TIMESTAMP,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

-- Create user API keys table with encryption
CREATE TABLE "user_api_keys" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users"("id") NOT NULL,
  "provider" TEXT NOT NULL,
  "encrypted_key" TEXT NOT NULL,
  "key_name" TEXT,
  "is_active" BOOLEAN DEFAULT true,
  "last_used_at" TIMESTAMP,
  "created_at" TIMESTAMP DEFAULT NOW()
);

-- Create user settings table
CREATE TABLE "user_settings" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users"("id") NOT NULL,
  "location" TEXT DEFAULT 'San Francisco, CA',
  "temperature_unit" TEXT DEFAULT 'fahrenheit',
  "time_format" TEXT DEFAULT '12h',
  "theme" TEXT DEFAULT 'auto',
  "voice_enabled" BOOLEAN DEFAULT true,
  "background_type" TEXT DEFAULT 'ai_generated',
  "updated_at" TIMESTAMP DEFAULT NOW()
);

-- Create conversations table for AI assistant
CREATE TABLE "conversations" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users"("id") NOT NULL,
  "title" TEXT,
  "system_context" TEXT,
  "is_active" BOOLEAN DEFAULT true,
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

-- Create AI memories table
CREATE TABLE "ai_memories" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users"("id") NOT NULL,
  "memory_type" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "importance" INTEGER DEFAULT 5,
  "tags" JSONB DEFAULT '[]',
  "created_at" TIMESTAMP DEFAULT NOW(),
  "expires_at" TIMESTAMP
);

-- Create messages table
CREATE TABLE "messages" (
  "id" SERIAL PRIMARY KEY,
  "conversation_id" INTEGER REFERENCES "conversations"("id") NOT NULL,
  "role" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "metadata" JSONB,
  "timestamp" TIMESTAMP DEFAULT NOW()
);

-- Create enhanced generated images table
CREATE TABLE "generated_images" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users"("id") NOT NULL,
  "image_id" TEXT NOT NULL UNIQUE,
  
  -- Location and weather context
  "location" TEXT NOT NULL,
  "weather_condition" TEXT NOT NULL,
  "time_of_day" TEXT NOT NULL,
  "temperature" INTEGER,
  "season" TEXT,
  
  -- AI generation metadata
  "prompt" TEXT NOT NULL,
  "revised_prompt" TEXT,
  "model" TEXT DEFAULT 'dall-e-3',
  "style" TEXT,
  "quality" TEXT DEFAULT 'standard',
  
  -- File system info
  "file_path" TEXT NOT NULL,
  "file_name" TEXT NOT NULL,
  "file_size" INTEGER,
  "mime_type" TEXT DEFAULT 'image/png',
  
  -- Usage and sharing
  "is_public" BOOLEAN DEFAULT false,
  "use_count" INTEGER DEFAULT 0,
  "last_used_at" TIMESTAMP,
  
  -- Cache optimization
  "hash_key" TEXT,
  "tags" JSONB DEFAULT '[]',
  
  -- Timestamps
  "created_at" TIMESTAMP DEFAULT NOW(),
  "updated_at" TIMESTAMP DEFAULT NOW()
);

-- Create image collections tables
CREATE TABLE "image_collections" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users"("id") NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "is_public" BOOLEAN DEFAULT false,
  "created_at" TIMESTAMP DEFAULT NOW()
);

CREATE TABLE "image_collection_items" (
  "id" SERIAL PRIMARY KEY,
  "collection_id" INTEGER REFERENCES "image_collections"("id") NOT NULL,
  "image_id" INTEGER REFERENCES "generated_images"("id") NOT NULL,
  "added_at" TIMESTAMP DEFAULT NOW()
);

-- Create user sessions table for authentication
CREATE TABLE "user_sessions" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users"("id") NOT NULL,
  "session_token" TEXT NOT NULL UNIQUE,
  "expires_at" TIMESTAMP NOT NULL,
  "created_at" TIMESTAMP DEFAULT NOW()
);

-- Create weather cache table
CREATE TABLE "weather_cache" (
  "id" SERIAL PRIMARY KEY,
  "location" TEXT NOT NULL,
  "weather_data" JSONB NOT NULL,
  "cached_at" TIMESTAMP DEFAULT NOW(),
  "expires_at" TIMESTAMP NOT NULL
);

-- Create calendar events table
CREATE TABLE "calendar_events" (
  "id" SERIAL PRIMARY KEY,
  "user_id" INTEGER REFERENCES "users"("id") NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "start_time" TIMESTAMP NOT NULL,
  "end_time" TIMESTAMP,
  "color" TEXT DEFAULT '#3b82f6',
  "is_all_day" BOOLEAN DEFAULT false,
  "recurrence" JSONB,
  "created_at" TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX "idx_user_api_keys_user_id" ON "user_api_keys"("user_id");
CREATE INDEX "idx_user_api_keys_provider" ON "user_api_keys"("provider");
CREATE INDEX "idx_user_settings_user_id" ON "user_settings"("user_id");
CREATE INDEX "idx_conversations_user_id" ON "conversations"("user_id");
CREATE INDEX "idx_ai_memories_user_id" ON "ai_memories"("user_id");
CREATE INDEX "idx_ai_memories_memory_type" ON "ai_memories"("memory_type");
CREATE INDEX "idx_messages_conversation_id" ON "messages"("conversation_id");
CREATE INDEX "idx_generated_images_user_id" ON "generated_images"("user_id");
CREATE INDEX "idx_generated_images_hash_key" ON "generated_images"("hash_key");
CREATE INDEX "idx_generated_images_location" ON "generated_images"("location");
CREATE INDEX "idx_user_sessions_token" ON "user_sessions"("session_token");
CREATE INDEX "idx_user_sessions_user_id" ON "user_sessions"("user_id");
CREATE INDEX "idx_weather_cache_location" ON "weather_cache"("location");
CREATE INDEX "idx_calendar_events_user_id" ON "calendar_events"("user_id");
CREATE INDEX "idx_calendar_events_start_time" ON "calendar_events"("start_time");

-- Create a default demo user for testing (password: "password123")
INSERT INTO "users" ("username", "email", "password_hash", "display_name") VALUES 
('demo', 'demo@forge.local', '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/lewfBNX12fq9zk/cu', 'Demo User');

-- Create default settings for demo user
INSERT INTO "user_settings" ("user_id", "location") VALUES 
(1, 'San Francisco, CA');