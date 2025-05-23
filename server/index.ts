import express, { Express, Request, Response } from 'express';
import http from 'http';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { Server } from 'http';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import router from './routes';
import authRoutes from './auth-routes';
import fetch from 'node-fetch';
import { isPlaceholderKey } from './utils/env-helpers';

// Function to get ESM __dirname equivalent
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from different possible .env locations
function loadEnvFromPossibleLocations() {
  // Array of possible .env file locations relative to current file
  const possibleEnvPaths = [
    path.resolve(__dirname, '../.env'),          // server/index.ts level (../
    path.resolve(__dirname, '../../.env'),       // project root level (../../
    path.resolve(__dirname, '../../../.env'),    // One level up from project root
    path.resolve(__dirname, './.env'),           // In server directory directly
    path.resolve(process.cwd(), '.env')          // Current working directory
  ];
  
  // Try each path until one works
  for (const envPath of possibleEnvPaths) {
    console.log(`Trying to load .env from: ${envPath}`);
    
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      console.log(`Successfully loaded .env from: ${envPath}`);
      // Log all available environment variables (for debugging)
      console.log('Environment variables:');
      console.log('WEATHER_API_KEY available:', !!process.env.WEATHER_API_KEY);
      console.log('OPENAI_API_KEY available:', !!process.env.OPENAI_API_KEY);
      console.log('NODE_ENV:', process.env.NODE_ENV);
      return true;
    }
  }
  
  // If we got here, none of the paths worked
  console.warn('Failed to load .env file from any location. Using environment variables directly.');
  return false;
}

// Function to test API connections
async function testApiConnections() {
  console.log('Testing API connections on startup...');
  
  // Test OpenAI API
  const openaiApiKey = process.env.OPENAI_API_KEY;
  if (openaiApiKey && !isPlaceholderKey(openaiApiKey)) {
    try {
      console.log('Testing OpenAI API connection...');
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${openaiApiKey}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.ok) {
        console.log('✅ OpenAI API connection successful!');
      } else {
        console.error('❌ OpenAI API connection failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Error testing OpenAI API:', error);
    }
  } else {
    console.warn('⚠️ OpenAI API key not set or using placeholder value. Skipping connection test.');
  }
  
  // Test Weather API
  const weatherApiKey = process.env.WEATHER_API_KEY;
  if (weatherApiKey && !isPlaceholderKey(weatherApiKey)) {
    try {
      console.log('Testing Weather API connection...');
      const response = await fetch(`https://api.weatherapi.com/v1/current.json?key=${weatherApiKey}&q=London&aqi=no`);
      
      if (response.ok) {
        console.log('✅ Weather API connection successful!');
      } else {
        console.error('❌ Weather API connection failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Error testing Weather API:', error);
    }
  } else {
    console.warn('⚠️ Weather API key not set or using placeholder value. Skipping connection test.');
  }
  
  console.log('API connection tests completed.');
}

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

// Authentication routes
app.use('/api/auth', authRoutes);

// Main API routes
app.use('/api', router);

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
