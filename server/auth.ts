import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and } from 'drizzle-orm';
import postgres from 'postgres';
import { users, userSessions, userApiKeys, userSettings } from '@shared/schema';

// Database connection - check if DATABASE_URL is available
if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL not found in environment variables');
}

const connectionString = process.env.DATABASE_URL || 'postgresql://forge:forge_password@localhost:5432/forge';
console.log('Connecting to database:', connectionString.replace(/:[^:@]*@/, ':***@')); // Hide password in logs

const client = postgres(connectionString);
const db = drizzle(client);

// Password hashing
export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 12;
  return bcrypt.hash(password, saltRounds);
};

export const verifyPassword = async (password: string, hash: string): Promise<boolean> => {
  return bcrypt.compare(password, hash);
};

// Session management
export const generateSessionToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const createSession = async (userId: number): Promise<string> => {
  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days
  
  await db.insert(userSessions).values({
    userId,
    sessionToken,
    expiresAt,
  });
  
  return sessionToken;
};

export const validateSession = async (sessionToken: string) => {
  const session = await db
    .select({
      user: users,
      session: userSessions,
    })
    .from(userSessions)
    .innerJoin(users, eq(userSessions.userId, users.id))
    .where(
      and(
        eq(userSessions.sessionToken, sessionToken),
        eq(users.isActive, true)
      )
    )
    .limit(1);

  if (!session.length) return null;

  const { user, session: userSession } = session[0];
  
  // Check if session is expired
  if (userSession.expiresAt < new Date()) {
    await db.delete(userSessions).where(eq(userSessions.sessionToken, sessionToken));
    return null;
  }

  return { user, session: userSession };
};

export const deleteSession = async (sessionToken: string): Promise<void> => {
  await db.delete(userSessions).where(eq(userSessions.sessionToken, sessionToken));
};

// Authentication middleware
export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const sessionToken = authHeader?.replace('Bearer ', '') || req.cookies?.session;

  if (!sessionToken) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  const sessionData = await validateSession(sessionToken);
  
  if (!sessionData) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }

  // Add user to request
  (req as any).user = sessionData.user;
  (req as any).session = sessionData.session;
  
  next();
};

// Optional auth middleware (doesn't fail if no auth)
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const sessionToken = authHeader?.replace('Bearer ', '') || req.cookies?.session;

  if (sessionToken) {
    const sessionData = await validateSession(sessionToken);
    if (sessionData) {
      (req as any).user = sessionData.user;
      (req as any).session = sessionData.session;
    }
  }
  
  next();
};

// User registration
export const registerUser = async (userData: {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}) => {
  const { username, email, password, displayName } = userData;
  
  // Check if user already exists
  const existingUser = await db
    .select()
    .from(users)
    .where(eq(users.username, username))
    .limit(1);

  if (existingUser.length > 0) {
    throw new Error('Username already exists');
  }

  const existingEmail = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingEmail.length > 0) {
    throw new Error('Email already exists');
  }

  // Hash password and create user
  const passwordHash = await hashPassword(password);
  
  const newUser = await db
    .insert(users)
    .values({
      username,
      email,
      passwordHash,
      displayName: displayName || username,
    })
    .returning();

  const user = newUser[0];

  // Create default user settings
  await db.insert(userSettings).values({
    userId: user.id,
    location: '',
    temperatureUnit: 'fahrenheit',
    timeFormat: '12h',
    theme: 'auto',
    voiceId: 'alloy',
  });

  return user;
};

// User login
export const loginUser = async (username: string, password: string) => {
  const user = await db
    .select()
    .from(users)
    .where(and(
      eq(users.username, username),
      eq(users.isActive, true)
    ))
    .limit(1);

  if (!user.length) {
    throw new Error('Invalid username or password');
  }

  const userData = user[0];
  const isValidPassword = await verifyPassword(password, userData.passwordHash);

  if (!isValidPassword) {
    throw new Error('Invalid username or password');
  }

  // Update last login
  await db
    .update(users)
    .set({ lastLoginAt: new Date() })
    .where(eq(users.id, userData.id));

  // Create session
  const sessionToken = await createSession(userData.id);

  return { user: userData, sessionToken };
};

// API Key encryption utilities
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');

export const encryptApiKey = (apiKey: string, userId: number): string => {
  const algorithm = 'aes-256-gcm';
  const iv = crypto.randomBytes(16);
  const salt = userId.toString(); // Use userId as salt for user-specific encryption
  
  const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 10000, 32, 'sha256');
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  
  let encrypted = cipher.update(apiKey, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  const authTag = cipher.getAuthTag();
  
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted}`;
};

export const decryptApiKey = (encryptedKey: string, userId: number): string => {
  const algorithm = 'aes-256-gcm';
  const parts = encryptedKey.split(':');
  
  // Handle both old format (iv:encrypted) and new format (iv:authTag:encrypted)
  let ivHex: string;
  let authTagHex: string;
  let encrypted: string;
  
  if (parts.length === 2) {
    // Old format without auth tag - fallback to simpler encryption
    return decryptApiKeyLegacy(encryptedKey, userId);
  } else if (parts.length === 3) {
    // New format with auth tag
    [ivHex, authTagHex, encrypted] = parts;
  } else {
    throw new Error('Invalid encrypted key format');
  }
  
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const salt = userId.toString();
  
  const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 10000, 32, 'sha256');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  decipher.setAuthTag(authTag);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};

// Legacy decryption for keys encrypted with old method
const decryptApiKeyLegacy = (encryptedKey: string, userId: number): string => {
  const algorithm = 'aes-256-cbc'; // Use CBC for legacy keys
  const [ivHex, encrypted] = encryptedKey.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const salt = userId.toString();
  
  const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 10000, 32, 'sha256');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
};