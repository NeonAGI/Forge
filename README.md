# 🌦️ Forge - Intelligent Weather Dashboard

> **A next-generation weather dashboard with AI-powered backgrounds, voice interaction, and real-time data visualization**

[![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB)](https://reactjs.org/)
[![Node.js](https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Docker](https://img.shields.io/badge/Docker-2496ED?style=for-the-badge&logo=docker&logoColor=white)](https://www.docker.com/)

## ✨ Features

### 🎨 **AI-Generated Weather Backgrounds**
- **DALL-E 3 Integration**: Photorealistic backgrounds generated in real-time
- **Context-Aware**: Adapts to location, weather conditions, time of day, and season
- **Intelligent Caching**: Smart image reuse with file system persistence
- **High Resolution**: 1792x1024 landscape format optimized for dashboards

### 🌍 **Real-Time Weather Intelligence**
- **Multi-Source Weather Data**: Accurate forecasts and current conditions
- **Location Detection**: Automatic geolocation with manual override
- **Hourly & Daily Forecasts**: Extended weather planning
- **Severe Weather Alerts**: Stay informed about dangerous conditions

### 🎙️ **Voice-Powered AI Assistant**
- **OpenAI Realtime API**: Low-latency voice conversations
- **WebRTC Audio Streaming**: Professional-grade audio processing
- **Natural Language**: Ask about weather, get recommendations, control dashboard
- **Voice Activity Detection**: Seamless conversation flow

### 📅 **Integrated Calendar & Productivity**
- **Event Management**: View and organize upcoming events
- **Weather-Aware Planning**: Smart suggestions based on forecasts
- **Time Zone Support**: World clock functionality

### 🔐 **Enterprise-Grade Security**
- **Encrypted API Key Storage**: Secure credential management
- **User Authentication**: Protected user sessions
- **Rate Limiting**: Prevent API abuse and spam

## 🏗️ Architecture

### **Frontend Stack**
- **React 18** + TypeScript for type-safe UI development
- **Vite** for lightning-fast development and builds
- **Tailwind CSS** + **shadcn/ui** for modern, responsive design
- **TanStack Query** for intelligent server state management
- **React Router** for seamless navigation

### **Backend Stack**
- **Node.js** + **Express** for high-performance API server
- **PostgreSQL** with **Drizzle ORM** for robust data persistence
- **OpenAI APIs**: GPT-4, DALL-E 3, and Realtime for AI features
- **WebSocket Support** for real-time voice interaction

### **Infrastructure**
- **Docker Compose** for containerized development
- **Volume Persistence** for data integrity across restarts
- **Hot Reloading** for rapid development cycles
- **Environment-Based Configuration** for deployment flexibility

## 🚀 Quick Start

### **Prerequisites**
- **Docker** and **Docker Compose** (recommended)
- **Node.js 18+** and **npm** (for local development)
- **OpenAI API Key** ([Get one here](https://platform.openai.com/api-keys))

### **1. Clone and Setup**
```bash
git clone https://github.com/NeonAGI/Forge.git
cd Forge

# Interactive setup with API key configuration
npm run setup
```

### **2. Start with Docker (Recommended)**
```bash
# Start all services with hot-reload
docker-compose up

# Or run in background
docker-compose up -d
```

**Access Points:**
- 🌐 **Dashboard**: http://localhost:5173
- 🔧 **API Server**: http://localhost:3001
- 🗄️ **Database**: localhost:5432

### **3. Alternative: Local Development**
```bash
# Install dependencies
npm install

# Start frontend and backend
npm run dev

# Or start individually
npm run dev:client    # Frontend only
npm run dev:server    # Backend only
```

## 🔧 Configuration

### **Environment Variables**
Create `.env` file in the project root:

```env
# Required
OPENAI_API_KEY=sk-your-openai-api-key-here

# Optional (defaults provided)
WEATHER_API_KEY=your-weather-api-key
DATABASE_URL=postgresql://forge:forge_password@localhost:5432/forge
ENCRYPTION_KEY=your-64-character-encryption-key
PORT=3001
```

### **Database Setup**
The database initializes automatically with Docker Compose. For custom setups:

```bash
# Run migrations
npm run db:migrate

# Seed initial data
npm run db:seed
```

## 📱 Usage Guide

### **Dashboard Navigation**
- **Weather Widget**: Real-time conditions and forecasts
- **AI Assistant**: Voice interaction panel with visual feedback
- **Calendar**: Event management and weather-aware planning
- **Settings**: API key management and user preferences

### **Voice Commands**
- *"What's the weather like today?"*
- *"Should I bring an umbrella?"*
- *"Generate a new background image"*
- *"What's the forecast for this weekend?"*

### **Background Generation**
- **Manual**: Click the refresh icon in the weather widget
- **Automatic**: Regenerates based on significant weather changes
- **Smart Caching**: Reuses similar conditions to save API costs

## 🛠️ Development

### **Project Structure**
```
forge/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── pages/          # Route components
│   │   └── lib/            # Utilities and configurations
├── server/                 # Node.js backend
│   ├── routes.ts           # API endpoints
│   ├── auth.ts             # Authentication logic
│   ├── openai.ts           # AI service integration
│   └── database-image-storage.ts  # Image persistence
├── shared/                 # Shared TypeScript types
└── data/                   # Persistent storage (Docker volume)
```

### **Key Commands**
```bash
# Development
npm run dev                 # Full stack development
npm run dev:client          # Frontend only
npm run dev:server          # Backend only

# Building
npm run build               # Production build
npm run build:client        # Frontend build
npm run build:server        # Backend build

# Database
npm run db:migrate          # Run migrations
npm run db:generate         # Generate new migration

# Docker
docker-compose up --build   # Rebuild and start
docker-compose down         # Stop all services
```

### **API Endpoints**

#### **Weather**
- `GET /api/weather` - Current weather data
- `POST /api/weather/background` - Generate AI background

#### **AI Assistant**
- `POST /api/assistant` - Chat with AI
- `POST /api/realtime/session` - Create voice session

#### **Images**
- `GET /api/images/:id` - Retrieve cached image
- `POST /api/images/cleanup` - Clean orphaned entries

#### **Settings**
- `GET /api/settings` - User preferences
- `PUT /api/settings` - Update preferences

## 🐛 Troubleshooting

### **Common Issues**

**🔑 API Key Errors**
```bash
# Verify API key is set
echo $OPENAI_API_KEY

# Re-run setup if needed
npm run setup
```

**🐳 Docker Issues**
```bash
# Clean and rebuild
docker-compose down
docker system prune -f
docker-compose up --build
```

**📁 Missing Images**
```bash
# Check volume mount
docker-compose ps
ls -la ./data/images/

# Manual cleanup
curl -X POST http://localhost:3001/api/images/cleanup
```

**🔄 Database Connection**
```bash
# Check database status
docker-compose logs db

# Reset database
docker-compose down -v
docker-compose up
```

### **Performance Optimization**

- **Image Caching**: Automatically reuses similar weather conditions
- **Rate Limiting**: 2-minute cooldown between generations
- **Database Indexing**: Optimized queries for fast image retrieval
- **Memory Management**: Automatic cleanup of stale cache entries

## 🚀 Deployment

### **Production Build**
```bash
# Build optimized production assets
npm run build

# Start production server
npm start
```

### **Environment Considerations**
- Set `NODE_ENV=production`
- Use strong `ENCRYPTION_KEY` (64 characters)
- Configure proper database credentials
- Set up reverse proxy (nginx recommended)
- Enable HTTPS for voice features

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

### **Development Workflow**
1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Submit a pull request

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **OpenAI** for providing powerful AI APIs
- **Weather APIs** for accurate meteorological data
- **shadcn/ui** for beautiful, accessible components
- **Vercel** for deployment platform inspiration

---

<p align="center">
  <strong>Built with ❤️ by the Forge team</strong><br>
  <sub>Making weather data beautiful and interactive</sub>
</p>