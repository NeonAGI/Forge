// Enhanced Database Schema for Multi-User Forge
import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";

// Users with secure authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(), // bcrypt hashed
  displayName: text("display_name"),
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Encrypted API keys per user
export const userApiKeys = pgTable("user_api_keys", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  provider: text("provider").notNull(), // 'openai', 'weather', etc.
  encryptedKey: text("encrypted_key").notNull(), // AES encrypted
  keyName: text("key_name"), // User-friendly name
  isActive: boolean("is_active").default(true),
  lastUsedAt: timestamp("last_used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// User preferences and settings
export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  location: text("location").default("San Francisco, CA"),
  temperatureUnit: text("temperature_unit").default("fahrenheit"),
  timeFormat: text("time_format").default("12h"),
  theme: text("theme").default("auto"), // light/dark/auto
  voiceEnabled: boolean("voice_enabled").default(true),
  backgroundType: text("background_type").default("ai_generated"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// AI Assistant conversations with memory
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: text("title"),
  systemContext: text("system_context"), // AI personality/instructions
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Persistent AI memories
export const aiMemories = pgTable("ai_memories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  memoryType: text("memory_type").notNull(), // 'preference', 'fact', 'context'
  content: text("content").notNull(),
  importance: integer("importance").default(5), // 1-10 scale
  tags: json("tags").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"), // Optional expiry
});

// Enhanced message storage
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => conversations.id).notNull(),
  role: text("role").notNull(), // 'user', 'assistant', 'system'
  content: text("content").notNull(),
  metadata: json("metadata").$type<{
    model?: string;
    tokens?: number;
    audioFile?: string;
    emotions?: string[];
  }>(),
  timestamp: timestamp("timestamp").defaultNow(),
});

// Generated images with user association and advanced metadata
export const generatedImages = pgTable("generated_images", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  imageId: text("image_id").notNull().unique(), // Unique filename like img_1747529946005_c10q31v
  
  // Location and weather context
  location: text("location").notNull(),
  weatherCondition: text("weather_condition").notNull(),
  timeOfDay: text("time_of_day").notNull(), // morning, afternoon, evening, night
  temperature: integer("temperature"), // For more specific caching
  season: text("season"), // spring, summer, fall, winter
  
  // AI generation metadata
  prompt: text("prompt").notNull(),
  revisedPrompt: text("revised_prompt"),
  model: text("model").default("dall-e-3"),
  style: text("style"), // vivid, natural, etc.
  quality: text("quality").default("standard"), // standard, hd
  
  // File system info
  filePath: text("file_path").notNull(), // data/images/users/{userId}/img_123.png
  fileName: text("file_name").notNull(), // img_123.png
  fileSize: integer("file_size"), // bytes
  mimeType: text("mime_type").default("image/png"),
  
  // Usage and sharing
  isPublic: boolean("is_public").default(false),
  useCount: integer("use_count").default(0),
  lastUsedAt: timestamp("last_used_at"),
  
  // Cache optimization
  hashKey: text("hash_key"), // MD5 of location+weather+time for fast lookups
  tags: json("tags").$type<string[]>().default([]), // searchable tags
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Image sharing and collections
export const imageCollections = pgTable("image_collections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(), // "My Favorites", "Sunsets", etc.
  description: text("description"),
  isPublic: boolean("is_public").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const imageCollectionItems = pgTable("image_collection_items", {
  id: serial("id").primaryKey(),
  collectionId: integer("collection_id").references(() => imageCollections.id).notNull(),
  imageId: integer("image_id").references(() => generatedImages.id).notNull(),
  addedAt: timestamp("added_at").defaultNow(),
});

// User sessions for secure auth
export const userSessions = pgTable("user_sessions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  sessionToken: text("session_token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Weather cache per user location
export const weatherCache = pgTable("weather_cache", {
  id: serial("id").primaryKey(),
  location: text("location").notNull(),
  weatherData: json("weather_data").notNull(),
  cachedAt: timestamp("cached_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(),
});

// Calendar events per user
export const calendarEvents = pgTable("calendar_events", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: text("title").notNull(),
  description: text("description"),
  startTime: timestamp("start_time").notNull(),
  endTime: timestamp("end_time"),
  color: text("color").default("#3b82f6"),
  isAllDay: boolean("is_all_day").default(false),
  recurrence: json("recurrence").$type<{
    type: 'daily' | 'weekly' | 'monthly' | 'yearly';
    interval: number;
    endDate?: string;
  }>(),
  createdAt: timestamp("created_at").defaultNow(),
});