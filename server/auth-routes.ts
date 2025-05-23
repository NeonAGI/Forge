import express from 'express';
import { registerUser, loginUser, deleteSession, requireAuth, optionalAuth, encryptApiKey, decryptApiKey } from './auth';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq, and } from 'drizzle-orm';
import postgres from 'postgres';
import { userApiKeys, userSettings } from '@shared/schema';

// Re-export auth functions for use in other files
export { requireAuth, optionalAuth } from './auth';

const router = express.Router();

// Database connection - check if DATABASE_URL is available  
if (!process.env.DATABASE_URL) {
  console.warn('DATABASE_URL not found in environment variables');
}

const connectionString = process.env.DATABASE_URL || 'postgresql://forge:forge_password@localhost:5432/forge';
console.log('Auth routes connecting to database:', connectionString.replace(/:[^:@]*@/, ':***@')); // Hide password in logs

const client = postgres(connectionString);
const db = drizzle(client);

// Register endpoint
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, displayName } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    const user = await registerUser({ username, email, password, displayName });
    
    // Remove password hash from response
    const { passwordHash, ...safeUser } = user;
    
    res.status(201).json({ 
      message: 'User registered successfully',
      user: safeUser 
    });
  } catch (error: any) {
    console.error('Registration error:', error);
    res.status(400).json({ error: error.message });
  }
});

// Login endpoint
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const { user, sessionToken } = await loginUser(username, password);
    
    // Remove password hash from response
    const { passwordHash, ...safeUser } = user;

    // Set session cookie
    res.cookie('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
    });

    res.json({ 
      message: 'Login successful',
      user: safeUser,
      sessionToken 
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(401).json({ error: error.message });
  }
});

// Logout endpoint
router.post('/logout', requireAuth, async (req, res) => {
  try {
    const session = (req as any).session;
    await deleteSession(session.sessionToken);
    
    res.clearCookie('session');
    res.json({ message: 'Logout successful' });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Failed to logout' });
  }
});

// Get current user
router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { passwordHash, ...safeUser } = user;
    
    res.json({ user: safeUser });
  } catch (error: any) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// API Keys management
router.get('/api-keys', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    
    const apiKeys = await db
      .select({
        id: userApiKeys.id,
        provider: userApiKeys.provider,
        keyName: userApiKeys.keyName,
        isActive: userApiKeys.isActive,
        lastUsedAt: userApiKeys.lastUsedAt,
        createdAt: userApiKeys.createdAt,
      })
      .from(userApiKeys)
      .where(eq(userApiKeys.userId, user.id));

    res.json({ apiKeys });
  } catch (error: any) {
    console.error('Get API keys error:', error);
    res.status(500).json({ error: 'Failed to get API keys' });
  }
});

router.post('/api-keys', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const { provider, apiKey, keyName } = req.body;

    if (!provider || !apiKey) {
      return res.status(400).json({ error: 'Provider and API key are required' });
    }

    // Encrypt the API key
    const encryptedKey = encryptApiKey(apiKey, user.id);

    // Check if key for this provider already exists
    const existingKey = await db
      .select()
      .from(userApiKeys)
      .where(and(
        eq(userApiKeys.userId, user.id),
        eq(userApiKeys.provider, provider)
      ))
      .limit(1);

    if (existingKey.length > 0) {
      // Update existing key
      await db
        .update(userApiKeys)
        .set({
          encryptedKey,
          keyName: keyName || provider,
          isActive: true,
        })
        .where(eq(userApiKeys.id, existingKey[0].id));
    } else {
      // Create new key
      await db.insert(userApiKeys).values({
        userId: user.id,
        provider,
        encryptedKey,
        keyName: keyName || provider,
      });
    }

    res.json({ message: 'API key saved successfully' });
  } catch (error: any) {
    console.error('Save API key error:', error);
    res.status(500).json({ error: 'Failed to save API key' });
  }
});

router.delete('/api-keys/:id', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const keyId = parseInt(req.params.id);

    await db
      .delete(userApiKeys)
      .where(and(
        eq(userApiKeys.id, keyId),
        eq(userApiKeys.userId, user.id)
      ));

    res.json({ message: 'API key deleted successfully' });
  } catch (error: any) {
    console.error('Delete API key error:', error);
    res.status(500).json({ error: 'Failed to delete API key' });
  }
});

// User settings
router.get('/settings', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    
    const settings = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, user.id))
      .limit(1);

    if (!settings.length) {
      // Create default settings
      const defaultSettings = await db
        .insert(userSettings)
        .values({
          userId: user.id,
          location: 'San Francisco, CA',
          temperatureUnit: 'fahrenheit',
          timeFormat: '12h',
          theme: 'auto',
        })
        .returning();

      return res.json({ settings: defaultSettings[0] });
    }

    res.json({ settings: settings[0] });
  } catch (error: any) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

router.put('/settings', requireAuth, async (req, res) => {
  try {
    const user = (req as any).user;
    const updates = req.body;

    const updatedSettings = await db
      .update(userSettings)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(userSettings.userId, user.id))
      .returning();

    res.json({ settings: updatedSettings[0] });
  } catch (error: any) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// Helper function to get decrypted API key for a user
export const getUserApiKey = async (userId: number, provider: string): Promise<string | null> => {
  try {
    const apiKeyRecord = await db
      .select()
      .from(userApiKeys)
      .where(and(
        eq(userApiKeys.userId, userId),
        eq(userApiKeys.provider, provider),
        eq(userApiKeys.isActive, true)
      ))
      .limit(1);

    if (!apiKeyRecord.length) {
      return null;
    }

    const decryptedKey = decryptApiKey(apiKeyRecord[0].encryptedKey, userId);
    
    // Update last used timestamp
    await db
      .update(userApiKeys)
      .set({ lastUsedAt: new Date() })
      .where(eq(userApiKeys.id, apiKeyRecord[0].id));

    return decryptedKey;
  } catch (error) {
    console.error('Error getting user API key:', error);
    return null;
  }
};

export default router;