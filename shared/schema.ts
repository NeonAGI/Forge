import { pgTable, text, serial, integer, boolean, timestamp, json } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users with secure authentication
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
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
  provider: text("provider").notNull(),
  encryptedKey: text("encrypted_key").notNull(),
  keyName: text("key_name"),
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
  theme: text("theme").default("auto"),
  voiceEnabled: boolean("voice_enabled").default(true),
  backgroundType: text("background_type").default("ai_generated"),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// AI Assistant conversations with memory
export const conversations = pgTable("conversations", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  title: text("title"),
  systemContext: text("system_context"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Persistent AI memories
export const aiMemories = pgTable("ai_memories", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  memoryType: text("memory_type").notNull(),
  content: text("content").notNull(),
  importance: integer("importance").default(5),
  tags: json("tags").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
});

// Enhanced message storage
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").references(() => conversations.id).notNull(),
  role: text("role").notNull(),
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
  imageId: text("image_id").notNull().unique(),
  
  // Location and weather context
  location: text("location").notNull(),
  weatherCondition: text("weather_condition").notNull(),
  timeOfDay: text("time_of_day").notNull(),
  temperature: integer("temperature"),
  season: text("season"),
  
  // AI generation metadata
  prompt: text("prompt").notNull(),
  revisedPrompt: text("revised_prompt"),
  model: text("model").default("dall-e-3"),
  style: text("style"),
  quality: text("quality").default("standard"),
  
  // File system info
  filePath: text("file_path").notNull(),
  fileName: text("file_name").notNull(),
  fileSize: integer("file_size"),
  mimeType: text("mime_type").default("image/png"),
  
  // Usage and sharing
  isPublic: boolean("is_public").default(false),
  useCount: integer("use_count").default(0),
  lastUsedAt: timestamp("last_used_at"),
  
  // Cache optimization
  hashKey: text("hash_key"),
  tags: json("tags").$type<string[]>().default([]),
  
  // Timestamps
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Image sharing and collections
export const imageCollections = pgTable("image_collections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id).notNull(),
  name: text("name").notNull(),
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

// Zod schemas for validation
export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  passwordHash: true,
  displayName: true,
});

export const insertUserApiKeySchema = createInsertSchema(userApiKeys).pick({
  userId: true,
  provider: true,
  encryptedKey: true,
  keyName: true,
});

export const insertUserSettingsSchema = createInsertSchema(userSettings).pick({
  userId: true,
  location: true,
  temperatureUnit: true,
  timeFormat: true,
  theme: true,
  voiceEnabled: true,
  backgroundType: true,
});

export const insertConversationSchema = createInsertSchema(conversations).pick({
  userId: true,
  title: true,
  systemContext: true,
});

export const insertAiMemorySchema = createInsertSchema(aiMemories).pick({
  userId: true,
  memoryType: true,
  content: true,
  importance: true,
  tags: true,
  expiresAt: true,
});

export const insertMessageSchema = createInsertSchema(messages).pick({
  conversationId: true,
  role: true,
  content: true,
  metadata: true,
});

export const insertGeneratedImageSchema = createInsertSchema(generatedImages).pick({
  userId: true,
  imageId: true,
  location: true,
  weatherCondition: true,
  timeOfDay: true,
  temperature: true,
  season: true,
  prompt: true,
  revisedPrompt: true,
  model: true,
  style: true,
  quality: true,
  filePath: true,
  fileName: true,
  fileSize: true,
  mimeType: true,
  hashKey: true,
  tags: true,
});

export const insertCalendarEventSchema = createInsertSchema(calendarEvents).pick({
  userId: true,
  title: true,
  description: true,
  startTime: true,
  endTime: true,
  color: true,
  isAllDay: true,
  recurrence: true,
});

// TypeScript types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertUserApiKey = z.infer<typeof insertUserApiKeySchema>;
export type UserApiKey = typeof userApiKeys.$inferSelect;

export type InsertUserSettings = z.infer<typeof insertUserSettingsSchema>;
export type UserSettings = typeof userSettings.$inferSelect;

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

export type InsertAiMemory = z.infer<typeof insertAiMemorySchema>;
export type AiMemory = typeof aiMemories.$inferSelect;

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

export type InsertGeneratedImage = z.infer<typeof insertGeneratedImageSchema>;
export type GeneratedImage = typeof generatedImages.$inferSelect;

export type InsertCalendarEvent = z.infer<typeof insertCalendarEventSchema>;
export type CalendarEvent = typeof calendarEvents.$inferSelect;

export type UserSession = typeof userSessions.$inferSelect;
export type WeatherCacheEntry = typeof weatherCache.$inferSelect;
export type ImageCollection = typeof imageCollections.$inferSelect;