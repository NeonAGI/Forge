import express, { Express, Request, Response } from 'express';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { Server } from 'http';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import authRoutes from './auth-routes';
// Import modular route modules
import weatherRoutes from './routes/weather';
import imageRoutes from './routes/images';
import searchRoutes from './routes/search';
import memoryRoutes from './routes/memory';
import realtimeRoutes from './routes/realtime';
import calendarRoutes from './routes/calendar';
import assistantRoutes from './routes/assistant';
import fetch from 'node-fetch';
import { loadEnvFromPossibleLocations, testApiConnections } from './utils/environment';

// Function to get ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars from .env file
loadEnvFromPossibleLocations();

// Test API connections
testApiConnections();

// Create the express app
const app: Express = express();

// Configure middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Request logging middleware
app.use('/api', (req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Authentication routes
app.use('/api/auth', authRoutes);

// Modular API routes
app.use('/api/weather', weatherRoutes); // /api/weather endpoints
app.use('/api/images', imageRoutes);   // /api/images endpoints
app.use('/api/search', searchRoutes);   // /api/search endpoints
app.use('/api/memories', memoryRoutes); // /api/memories endpoints
app.use('/api/memory', memoryRoutes);   // /api/memory endpoints (agent compatibility)
app.use('/api/realtime', realtimeRoutes); // /api/realtime endpoints
app.use('/api', realtimeRoutes);             // /api/session, /api/time endpoints
app.use('/api/calendar', calendarRoutes); // /api/calendar endpoints
app.use('/api/assistant', assistantRoutes); // /api/assistant endpoints

// Only serve static files and handle client routing in production
if (process.env.NODE_ENV === 'production') {
  // Serve static files from the client build directory
  const clientDistPath = path.resolve(__dirname, '../dist');
  app.use(express.static(clientDistPath));

  // Handle client-side routing - serve index.html for all non-API routes
  app.get('*', (req: Request, res: Response) => {
    // Don't serve index.html for API routes
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    // For all other routes, serve the React app
    const indexPath = path.join(clientDistPath, 'index.html');
    res.sendFile(indexPath, (err) => {
      if (err) {
        console.error('Error serving index.html:', err);
        res.status(500).json({ error: 'Failed to serve client application' });
      }
    });
  });
} else {
  // In development mode, the client is served by Vite dev server
  // Only handle unknown API routes
  app.get('*', (req: Request, res: Response) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'API endpoint not found' });
    }
    
    // For non-API routes in development, return a helpful message
    res.status(404).json({ 
      error: 'Development mode: Client is served by Vite dev server',
      clientUrl: 'http://localhost:5173',
      message: 'Access the application at http://localhost:5173'
    });
  });
}

// Create HTTP server
const httpServer = http.createServer(app);

// Create WebSocket server
const wss = new WebSocketServer({ server: httpServer });

// Handle WebSocket connections
wss.on('connection', (ws) => {
  console.log('New WebSocket connection established');
  
  ws.on('message', (message) => {
    const messageStr = message.toString();
    console.log('Received message:', messageStr);
    
    // Echo the message back for now
    ws.send(`Echo: ${messageStr}`);
  });
  
  ws.on('close', () => {
    console.log('WebSocket connection closed');
  });
});

// Start the server
const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`API endpoints available at http://localhost:${PORT}/api/...`);
});

export default httpServer;
