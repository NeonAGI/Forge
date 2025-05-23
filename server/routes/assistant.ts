import { Router, Request, Response } from "express";
import openai from '../services/openai.service';

const router = Router();

// OpenAI Assistant API
router.post("/", async (req: Request, res: Response) => {
  try {
    const { message, conversationHistory } = req.body;
    
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    
    const response = await openai.chatCompletion(message, conversationHistory || []);
    res.json(response);
  } catch (err) {
    console.error("Error with OpenAI assistant:", err);
    res.status(500).json({ error: "Failed to generate assistant response" });
  }
});

export default router;