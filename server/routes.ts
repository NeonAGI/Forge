import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import openai from "./openai";

// Helper function to generate random strings of specified length for ICE parameters
const generateRandomString = (length: number): string => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};
export async function registerRoutes(app: Express): Promise<Server> {
  // Make the generateRandomString function available in this scope
  const createRandomString = generateRandomString;
  const httpServer = createServer(app);
  
  // Use a Map to store sessions for the OpenAI Realtime simulation
  const sessions = new Map();

  // Weather API endpoint
  app.get("/api/weather", async (req: Request, res: Response) => {
    try {
      // Mock weather data for demonstration
      const weatherData = {
        currentWeather: {
          temperature: "72°",
          unit: "F",
          weatherCode: "01d",
          description: "Clear sky"
        },
        forecast: [
          { time: "Now", temperature: "72°", weatherCode: "01d", isDay: true },
          { time: "2PM", temperature: "75°", weatherCode: "01d", isDay: true },
          { time: "4PM", temperature: "71°", weatherCode: "03d", isDay: true },
          { time: "6PM", temperature: "68°", weatherCode: "04d", isDay: false }
        ],
        location: "San Francisco, CA"
      };
      
      res.json(weatherData);
    } catch (err) {
      console.error("Error fetching weather:", err);
      res.status(500).json({ error: "Failed to fetch weather data" });
    }
  });

  // Calendar API endpoint
  app.get("/api/calendar", async (req: Request, res: Response) => {
    try {
      // Mock calendar data for demonstration
      const calendarEvents = [
        {
          id: "1",
          title: "Design Review Meeting",
          date: "01",
          month: "JUL",
          time: "2:00 PM - 3:30 PM",
          color: "blue"
        },
        {
          id: "2",
          title: "Team Brainstorm Session",
          date: "02",
          month: "JUL",
          time: "10:30 AM - 12:00 PM",
          color: "green"
        },
        {
          id: "3",
          title: "Quarterly Planning",
          date: "03",
          month: "JUL",
          time: "9:00 AM - 4:00 PM",
          color: "purple"
        }
      ];
      
      res.json(calendarEvents);
    } catch (err) {
      console.error("Error fetching calendar events:", err);
      res.status(500).json({ error: "Failed to fetch calendar data" });
    }
  });

  // OpenAI Assistant API
  app.post("/api/assistant", async (req: Request, res: Response) => {
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

  // Text-to-speech with OpenAI
  app.post("/api/openai/voice", async (req: Request, res: Response) => {
    try {
      const { text, voice } = req.body;
      
      if (!text) {
        return res.status(400).json({ error: "Text is required" });
      }
      
      const speechBuffer = await openai.generateSpeech(text, voice || "alloy");
      
      res.set({
        'Content-Type': 'audio/mpeg',
        'Content-Length': speechBuffer.length
      });
      
      res.send(speechBuffer);
    } catch (err) {
      console.error("Error generating speech:", err);
      res.status(500).json({ error: "Failed to generate speech" });
    }
  });

  // OpenAI Realtime Session setup
  app.post("/api/realtime/session", (req: Request, res: Response) => {
    try {
      const { voice, model } = req.body;
      
      // In a real implementation, this would use the OpenAI Realtime API
      // Here we're simulating the response
      const sessionId = Date.now().toString();
      
      // Create proper WebRTC offer with correct media sections and valid ICE parameters
      // Generate random values of the right length for ICE parameters
      const iceUfrag = createRandomString(8); // 4-256 characters
      const icePwd = createRandomString(24);  // 22-256 characters
      
      const offer = {
        type: "offer",
        sdp: `v=0\r
o=- 1234567890 1 IN IP4 0.0.0.0\r
s=-\r
t=0 0\r
a=group:BUNDLE data\r
m=application 9 UDP/DTLS/SCTP webrtc-datachannel\r
c=IN IP4 0.0.0.0\r
a=ice-ufrag:${iceUfrag}\r
a=ice-pwd:${icePwd}\r
a=fingerprint:sha-256 00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00:00\r
a=setup:actpass\r
a=mid:data\r
a=sctp-port:5000\r
`
      };
      
      // We're using the generateRandomString function that's defined at the top of the file
      
      // Store session info
      sessions.set(sessionId, {
        ...sessions.get(sessionId),
        voice,
        model,
        createdAt: new Date()
      });
      
      res.json({ sessionId, offer });
    } catch (err) {
      console.error("Error creating Realtime session:", err);
      res.status(500).json({ error: "Failed to create Realtime session" });
    }
  });

  // Handle WebRTC answers
  app.post("/api/realtime/answer", (req: Request, res: Response) => {
    try {
      const { sessionId, answer } = req.body;
      
      if (!sessionId || !sessions.has(sessionId)) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      // In a real implementation, this would process the SDP answer
      sessions.set(sessionId, {
        ...sessions.get(sessionId),
        answer
      });
      
      res.json({ success: true });
    } catch (err) {
      console.error("Error processing answer:", err);
      res.status(500).json({ error: "Failed to process answer" });
    }
  });

  // Handle ICE candidates
  app.post("/api/realtime/ice", (req: Request, res: Response) => {
    try {
      const { sessionId, candidate } = req.body;
      
      if (!sessionId || !sessions.has(sessionId)) {
        return res.status(404).json({ error: "Session not found" });
      }
      
      // In a real implementation, this would process the ICE candidate
      const session = sessions.get(sessionId);
      if (!session.candidates) {
        session.candidates = [];
      }
      
      session.candidates.push(candidate);
      sessions.set(sessionId, session);
      
      res.json({ success: true });
    } catch (err) {
      console.error("Error processing ICE candidate:", err);
      res.status(500).json({ error: "Failed to process ICE candidate" });
    }
  });

  return httpServer;
}
