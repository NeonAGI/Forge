import { Router, Request, Response } from "express";
import { requireAuth } from './auth';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { aiMemories } from '../../shared/schema';
import { eq, desc, and, or, like, gt } from 'drizzle-orm';

const router = Router();

// Database connection for memory management
const connectionString = process.env.DATABASE_URL || 'postgresql://forge:forge_password@localhost:5432/forge';
const client = postgres(connectionString);
const db = drizzle(client);

// AI Memory Management API endpoints
router.get("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { type, limit = 20, importance_min = 1 } = req.query;
    
    let query = db.select().from(aiMemories).where(eq(aiMemories.userId, user.id));
    
    if (type) {
      query = query.where(eq(aiMemories.memoryType, type as string));
    }
    
    if (importance_min) {
      query = query.where(gt(aiMemories.importance, parseInt(importance_min as string)));
    }
    
    const memories = await query
      .orderBy(desc(aiMemories.importance), desc(aiMemories.createdAt))
      .limit(parseInt(limit as string));
    
    res.json({ memories });
  } catch (error: any) {
    console.error('Error fetching AI memories:', error);
    res.status(500).json({ error: 'Failed to fetch memories', details: error.message });
  }
});

router.post("/", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { memoryType, content, importance = 5, tags = [], expiresAt } = req.body;
    
    if (!memoryType || !content) {
      return res.status(400).json({ error: 'memoryType and content are required' });
    }
    
    const memoryData = {
      userId: user.id,
      memoryType,
      content,
      importance: Math.max(1, Math.min(10, importance)), // Clamp between 1-10
      tags,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
    };
    
    const [newMemory] = await db.insert(aiMemories).values(memoryData).returning();
    
    console.log(`Created new AI memory for user ${user.id}: ${memoryType} - ${content.substring(0, 50)}...`);
    
    res.json({ memory: newMemory });
  } catch (error: any) {
    console.error('Error creating AI memory:', error);
    res.status(500).json({ error: 'Failed to create memory', details: error.message });
  }
});

router.delete("/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { id } = req.params;
    
    const [deletedMemory] = await db
      .delete(aiMemories)
      .where(and(eq(aiMemories.id, parseInt(id)), eq(aiMemories.userId, user.id)))
      .returning();
    
    if (!deletedMemory) {
      return res.status(404).json({ error: 'Memory not found' });
    }
    
    res.json({ message: 'Memory deleted successfully' });
  } catch (error: any) {
    console.error('Error deleting AI memory:', error);
    res.status(500).json({ error: 'Failed to delete memory', details: error.message });
  }
});

// Get relevant memories for AI context
router.post("/relevant", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    const { query, limit = 5 } = req.body;
    
    if (!query) {
      return res.status(400).json({ error: 'Query is required' });
    }
    
    // Simple relevance search - in production, you might use vector search
    const relevantMemories = await db
      .select()
      .from(aiMemories)
      .where(
        and(
          eq(aiMemories.userId, user.id),
          or(
            like(aiMemories.content, `%${query}%`),
            like(aiMemories.memoryType, `%${query}%`)
          )
        )
      )
      .orderBy(desc(aiMemories.importance), desc(aiMemories.createdAt))
      .limit(limit);
    
    res.json({ memories: relevantMemories });
  } catch (error: any) {
    console.error('Error searching relevant memories:', error);
    res.status(500).json({ error: 'Failed to search memories', details: error.message });
  }
});

// Get user context for AI (memories summary)
router.get("/user-context", requireAuth, async (req: Request, res: Response) => {
  try {
    const user = (req as any).user;
    
    // Get recent high-importance memories
    const recentMemories = await db
      .select()
      .from(aiMemories)
      .where(and(
        eq(aiMemories.userId, user.id),
        gt(aiMemories.importance, 5)
      ))
      .orderBy(desc(aiMemories.importance), desc(aiMemories.createdAt))
      .limit(10);
    
    // Format memories for AI context
    const memoryContext = recentMemories.map(memory => 
      `[${memory.memoryType}] ${memory.content}`
    ).join('\n');
    
    res.json({ 
      memoryContext,
      memoryCount: recentMemories.length,
      memories: recentMemories
    });
    
  } catch (error: any) {
    console.error('Error fetching user context:', error);
    res.status(500).json({ error: 'Failed to fetch user context', details: error.message });
  }
});

// Memory storage endpoint for agent's remember_user_info function
router.post("/store", requireAuth, async (req: Request, res: Response) => {
  try {
    const { memory_type, content, importance = 5 } = req.body;
    const user = (req as any).user;
    
    if (!memory_type || !content) {
      return res.status(400).json({ 
        error: 'memory_type and content are required'
      });
    }
    
    console.log('🧠 AGENT MEMORY STORAGE CALLED:', {
      memoryType: memory_type,
      content: content.substring(0, 100) + (content.length > 100 ? '...' : ''),
      importance: importance,
      userId: user.id,
      timestamp: new Date().toISOString()
    });
    
    // Store the memory in the database
    const [newMemory] = await db.insert(aiMemories).values({
      userId: user.id,
      memoryType: memory_type,
      content: content,
      importance: Math.min(Math.max(importance, 1), 10), // Clamp between 1-10
      createdAt: new Date(),
      updatedAt: new Date()
    }).returning();
    
    console.log('✅ MEMORY STORED SUCCESSFULLY:', {
      memoryId: newMemory.id,
      memoryType: memory_type,
      importance: newMemory.importance,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      message: 'Memory stored successfully',
      memory: {
        id: newMemory.id,
        type: newMemory.memoryType,
        importance: newMemory.importance,
        createdAt: newMemory.createdAt
      }
    });
    
  } catch (error: any) {
    console.error('❌ Error storing memory:', error);
    res.status(500).json({ 
      error: 'Failed to store memory', 
      details: error.message 
    });
  }
});

export default router;