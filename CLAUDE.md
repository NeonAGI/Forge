# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Forge is a weather-focused dashboard application with AI-generated backgrounds and voice interaction capabilities. It provides real-time weather information, calendar integration, and an AI assistant powered by OpenAI's APIs.

## Architecture

### Frontend Stack
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **State Management**: React Query (TanStack Query) for server state, React hooks for local state
- **Routing**: React Router with dashboard, settings, and API key pages

### Backend Stack
- **Runtime**: Node.js + Express
- **Database**: PostgreSQL with Drizzle ORM
- **APIs**: OpenAI (GPT, DALL-E 3, Realtime), Weather APIs, Calendar integration
- **Real-time**: WebSocket support for voice interaction
- **Authentication**: API key management with secure storage

## Core Features

- **Weather Dashboard**: Real-time weather data with forecasts and location detection
- **AI Assistant**: Voice-enabled chat using OpenAI Realtime API with WebRTC
- **Dynamic Backgrounds**: AI-generated weather-appropriate artwork using DALL-E 3
- **Calendar Integration**: Event display and management
- **Settings Management**: API key configuration and user preferences

## Development Commands

```bash
npm run setup          # Interactive setup with API key configuration
npm run dev            # Start full development stack (client + server)
npm run dev:client     # Frontend only (http://localhost:5173)
npm run dev:server     # Backend only (http://localhost:3001)
npm run build          # Production build
docker-compose up      # Full stack with hot-reload in containers
```

## Database Schema

PostgreSQL tables managed by Drizzle ORM:
- Core entities defined in `shared/schema.ts`
- API keys stored securely with encryption
- Weather data cached for performance
- User settings and preferences

## API Integration

### OpenAI APIs
- **Chat Completions**: Main AI assistant functionality
- **DALL-E 3**: Dynamic background generation based on weather
- **Realtime API**: Voice conversation with WebRTC audio streaming

### Weather APIs
- Real-time weather data with location detection
- Forecast information and severe weather alerts
- Background generation prompts based on current conditions

## Component Architecture

### Dashboard Widgets
- `weather-widget.tsx`: Main weather display with forecast
- `ai-assistant-widget.tsx`: Chat interface with voice controls
- `calendar-widget.tsx`: Event display and management
- `clock-widget.tsx`: Time display with world clock
- `realtime-widget.tsx`: Voice interaction controls

### Hooks
- `use-weather.ts`: Weather data fetching and caching
- `use-openai-realtime.ts`: WebRTC audio streaming and voice interaction
- `use-api-keys.ts`: Secure API key management
- `use-settings.ts`: User preferences and configuration

## Voice Implementation

Uses OpenAI Realtime API with WebRTC for low-latency voice interaction:
- Browser microphone access through getUserMedia
- Real-time audio streaming to OpenAI
- Voice activity detection and conversation management
- Visual feedback through voice orb component

## Memories
- memorize