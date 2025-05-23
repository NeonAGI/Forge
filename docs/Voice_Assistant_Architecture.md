# Voice Assistant Agentic Pipeline & Features Documentation

## Overview

Forge implements a sophisticated voice assistant powered by OpenAI's Realtime API, featuring an agentic pipeline with tool calling capabilities, memory management, and real-time audio processing. The system operates through WebRTC connections, providing low-latency bidirectional communication between the user and AI assistant.

## Architecture Overview

### Core Components

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Voice Orb     │    │  Realtime Hook  │    │  Server Routes  │
│   (UI Layer)    │◄──►│  (Client Logic) │◄──►│  (API Layer)    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                       │                       │
        │                       │                       │
        ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Audio Context  │    │   WebRTC        │    │  OpenAI API     │
│  & Media Stream │    │   Connection    │    │  Integration    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Voice Assistant Pipeline

### 1. Session Initialization

**Client Side (`use-openai-realtime-v2.ts`)**
- Requests microphone permissions
- Establishes audio context for voice processing
- Creates WebRTC peer connection with STUN servers
- Fetches ephemeral token from server

**Server Side (`/api/realtime/session`)**
- Validates user authentication and API keys
- Retrieves user context (location, preferences, memories)
- Creates OpenAI Realtime session with:
  - User-specific instructions
  - Tool configurations
  - Voice preferences
  - Contextual information

### 2. WebRTC Connection Establishment

```typescript
// Audio stream processing with VAD workaround
async function createPaddedAudioStream(inputStream: MediaStream): Promise<MediaStream> {
  const audioContext = new AudioContext();
  const source = audioContext.createMediaStreamSource(inputStream);
  const gainNode = audioContext.createGain();
  const destination = audioContext.createMediaStreamDestination();
  
  source.connect(gainNode);
  gainNode.connect(destination);
  
  return destination.stream;
}
```

**Connection Flow:**
1. Create RTCPeerConnection with ICE servers
2. Add local audio track (microphone)
3. Create data channel for OpenAI events
4. Generate SDP offer and exchange with OpenAI
5. Establish bidirectional audio stream

### 3. Agent Configuration

The assistant is configured with comprehensive instructions and tools:

```typescript
const sessionConfig = {
  type: 'session.update',
  session: {
    instructions: `You are a helpful, friendly voice assistant with memory and web search capabilities.
    
    IMPORTANT USER CONTEXT:
    - User location: ${userSettings?.location || 'Unknown location'}
    - Temperature preference: ${userSettings?.temperatureUnit === 'C' ? 'Celsius' : 'Fahrenheit'}
    - Current time: ${new Date().toLocaleString()}
    
    KEY BEHAVIOR RULES:
    1. ALWAYS acknowledge when you're using tools with brief status updates
    2. When users ask about weather WITHOUT specifying a location, automatically use their location
    3. For current events, news, restaurant recommendations, local information, ALWAYS use web_search
    4. When users share personal info, use remember_user_info to save it`,
    
    tools: [weatherFunction, timeFunction, webSearchFunction, rememberFunction],
    tool_choice: 'auto',
    turn_detection: {
      type: 'semantic_vad',
      eagerness: 'low',
      threshold: 0.9,
      prefix_padding_ms: 500,
      silence_duration_ms: 1000
    }
  }
}
```

## Agentic Tool System

### Available Tools

#### 1. Weather Information (`get_weather`)
- **Purpose**: Provides current weather and forecasts
- **Context**: Auto-uses user's saved location if no location specified
- **Implementation**: Integrates with WeatherAPI service
- **Server Route**: `/api/weather`

```typescript
const weatherFunction = {
  type: 'function',
  name: 'get_weather',
  description: 'Get current weather conditions and forecast for any location worldwide',
  parameters: {
    type: 'object',
    properties: {
      location: {
        type: 'string',
        description: 'City name, address, or coordinates'
      },
      include_forecast: {
        type: 'boolean',
        description: 'Include hourly and daily forecast data',
        default: false
      }
    },
    required: ['location']
  }
}
```

#### 2. Web Search (`web_search`)
- **Purpose**: Real-time web search for current information
- **Implementation**: Brave Search API as primary, DuckDuckGo fallback
- **Use Cases**: News, current events, local information, facts
- **Server Route**: `/api/search`

```typescript
const webSearchFunction = {
  type: 'function',
  name: 'web_search',
  description: 'Search the web for current information, news, facts, or any topic',
  parameters: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'The search query' },
      num_results: { type: 'number', description: 'Number of results (1-5)', minimum: 1, maximum: 5 }
    },
    required: ['query']
  }
}
```

#### 3. Time Information (`get_current_time`)
- **Purpose**: Provides current time for specific timezones
- **Supported Timezones**: Major world timezones
- **Context**: Integrates with user's timezone preferences

#### 4. Memory Management (`remember_user_info`)
- **Purpose**: Stores user information for personalized conversations
- **Types**: preferences, personal_info, interests, goals, context, important_facts
- **Persistence**: PostgreSQL database with importance scoring
- **Server Routes**: `/api/memories/*`

```typescript
const rememberFunction = {
  type: 'function',
  name: 'remember_user_info',
  description: 'Remember important information about the user for future conversations',
  parameters: {
    type: 'object',
    properties: {
      memory_type: { 
        type: 'string',
        enum: ['preference', 'personal_info', 'interest', 'goal', 'context', 'important_fact']
      },
      content: { type: 'string', description: 'The information to remember' },
      importance: { type: 'number', description: 'Importance level 1-10', minimum: 1, maximum: 10 }
    },
    required: ['memory_type', 'content']
  }
}
```

### Tool Execution Flow

The voice assistant implements a sophisticated agentic pipeline with full function calling capabilities:

### 1. Voice Input Processing
```
User speaks → OpenAI Realtime API processes → Determines tool needed
```

### 2. Function Call Detection
```typescript
// Client receives server events indicating function calls
case 'response.done':
  if (serverEvent.response?.output) {
    for (const item of serverEvent.response.output) {
      if (item.type === 'function_call' && item.status === 'completed') {
        console.log('🔧 EXECUTING FUNCTION CALL:', {
          function: item.name,
          arguments: item.arguments,
          callId: item.call_id
        });
        executeFunctionCall(item);
      }
    }
  }
```

### 3. Client-Side Function Execution
The client executes actual API calls to server endpoints:

- **Web Search**: `fetch('/api/search')` with Brave Search/DuckDuckGo
- **Weather Data**: `fetch('/api/weather')` with WeatherAPI integration
- **Memory Storage**: `fetch('/api/memories')` with PostgreSQL persistence
- **Time Queries**: Browser-based timezone calculations

### 4. Function Result Processing
```typescript
// Send results back to OpenAI
const sendFunctionResult = async (callId: string, output: string) => {
  const functionOutputEvent = {
    type: 'conversation.item.create',
    item: {
      type: 'function_call_output',
      call_id: callId,
      output: output
    }
  };
  sendEvent(functionOutputEvent);
  
  // Request new response with function data
  sendEvent({ type: 'response.create' });
};
```

### 5. AI Response Generation
OpenAI processes function results and generates comprehensive voice response incorporating tool data.

## Enhanced Transparency System

### Comprehensive Logging Architecture

**Voice Input/Output Tracking:**
```typescript
// Voice activity detection
case 'input_audio_buffer.speech_started':
  console.log('🎤 USER VOICE INPUT STARTED:', {
    timestamp: new Date().toLocaleTimeString(),
    mode: 'semantic_vad'
  });

case 'response.audio.delta':
  console.log('🔊 AI VOICE OUTPUT STREAMING:', {
    timestamp: new Date().toLocaleTimeString(),
    status: 'Streaming audio response to user'
  });
```

**Tool Execution Transparency:**
```typescript
// Complete tool execution flow logging
console.log('🚀 EXECUTING TOOL:', {
  toolName: name,
  arguments: args,
  callId: call_id,
  timestamp: new Date().toLocaleTimeString()
});

// Tool-specific progress tracking
console.log('🔍 WEB SEARCH STARTED:', {
  query: args.query,
  numResults: args.num_results || 5
});

console.log('✅ WEB SEARCH COMPLETED:', {
  query: args.query,
  resultCount: searchData.results?.length || 0,
  results: searchData.results?.slice(0, 3).map(r => r.title) || []
});

console.log('📤 SENDING FUNCTION RESULT TO AI:', {
  callId: callId,
  outputLength: output.length,
  timestamp: new Date().toLocaleTimeString()
});
```

### Real-Time UI Feedback System

**Voice Orb Enhancements:**
- Dynamic status messages showing current tool execution
- Tool-specific indicators: "🔧 Searching web...", "🌤️ Getting weather..."
- Visual feedback during tool processing phases

**Realtime Widget Transparency Panel:**
```tsx
// Active tool execution display
{currentTool && (
  <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
    <div className="flex justify-between items-center mb-2">
      <span className="text-text-muted text-sm">🔧 Agent Tool Active</span>
      <Badge className="animate-pulse">EXECUTING</Badge>
    </div>
    <div className="text-purple-400 font-medium">
      {currentTool === 'web_search' ? '🔍 Searching the web for current information...' :
       currentTool === 'get_weather' ? '🌤️ Fetching weather data from API...' :
       `🔧 Executing ${currentTool}...`}
    </div>
  </div>
)}

// Last tool execution details
{lastToolExecution && (
  <div className="mt-3 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
    <div className="flex justify-between items-center mb-2">
      <span className="text-text-muted text-sm">📊 Last Tool Execution</span>
      <span className="text-xs text-cyan-400">{lastToolExecution.timestamp}</span>
    </div>
    <div className="space-y-2">
      <div>Input: "{lastToolExecution.args?.query}"</div>
      <div>Result: Found {lastToolExecution.result?.results?.length} results</div>
    </div>
  </div>
)}
```

**Enhanced Event Log:**
- Color-coded events with tool-specific icons
- Real-time activity stream with timestamps
- Detailed descriptions of each pipeline step

### Tool State Management

**Real-Time State Tracking:**
```typescript
const [currentTool, setCurrentTool] = useState<string | null>(null);
const [lastToolExecution, setLastToolExecution] = useState<{
  tool: string;
  args: any;
  result?: any;
  timestamp: string;
} | null>(null);

// Update UI state during tool execution
setLastToolExecution({
  tool: name,
  args: args,
  timestamp: new Date().toLocaleTimeString()
});

// Update with results when complete
setLastToolExecution(prev => prev ? { 
  ...prev, 
  result: formattedResults 
} : null);
```

This architecture ensures complete transparency of the agentic pipeline, allowing users to see exactly:

1. **When AI decides to use tools** - Real-time detection and display
2. **What specific queries are made** - Full argument logging and UI display
3. **Tool execution progress** - Live status updates during API calls
4. **Actual results obtained** - Complete result summaries and data
5. **How results inform final response** - Integration with AI response generation

The system provides enterprise-grade observability into AI agent behavior while maintaining a user-friendly interface.

## Voice Activity Detection (VAD)

### Semantic VAD Configuration

The system uses OpenAI's semantic VAD with optimized settings:

```typescript
turn_detection: {
  type: 'semantic_vad',
  eagerness: 'low',          // Reduced false positives
  threshold: 0.9,            // High confidence threshold
  prefix_padding_ms: 500,    // Wait before considering speech
  silence_duration_ms: 1000, // Required silence to end turn
  create_response: true,
  interrupt_response: true   // Allow user interruptions
}
```

### Audio Processing Pipeline

1. **Input Capture**: Browser getUserMedia API
2. **Audio Padding**: Silence padding to prevent truncation
3. **Stream Processing**: WebRTC audio encoding
4. **VAD Analysis**: OpenAI server-side voice activity detection
5. **Response Generation**: Real-time audio synthesis
6. **Output Playback**: Browser audio element with fallback

## Connection Management

### Robust Connection System (`use-connection-manager.ts`)

Features enterprise-grade connection reliability:

- **Automatic Retry**: Exponential backoff with configurable attempts
- **Health Monitoring**: Periodic connection quality checks
- **Error Categorization**: Network, auth, server, audio error types
- **Quality Assessment**: Connection performance metrics
- **Graceful Degradation**: Fallback strategies for failures

```typescript
interface ConnectionManagerConfig {
  maxRetryAttempts: 3,
  retryDelayMs: 2000,
  exponentialBackoff: true,
  healthCheckIntervalMs: 30000,
  connectionTimeoutMs: 20000
}
```

### Connection States

- `disconnected`: No active connection
- `connecting`: Establishing connection
- `connected`: Active voice session
- `reconnecting`: Automatic retry in progress
- `failed`: Connection failed, manual intervention needed

## User Interface Components

### Voice Orb (`voice-orb.tsx`)

**Visual Feedback System:**
- **Idle**: Static orb with subtle glow
- **Listening**: Pulsing animation based on voice intensity
- **Speaking**: Bright glow with assistant activity
- **Processing**: Animated processing indicator

**Responsive Design:**
- Mobile-optimized sizing and positioning
- Dynamic color scheme based on weather themes
- Accessibility features for screen readers

### Realtime Widget (`realtime-widget.tsx`)

**Development Interface:**
- Session configuration and monitoring
- Real-time event logging
- Voice preference selection
- Text input testing
- Connection diagnostics

**Features:**
- API activity monitoring
- Tool execution tracking
- Connection quality display
- Manual session controls

## Memory System Architecture

### Database Schema

```sql
-- AI Memories Table
CREATE TABLE ai_memories (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id),
  memory_type VARCHAR(50) NOT NULL,
  content TEXT NOT NULL,
  importance INTEGER CHECK (importance >= 1 AND importance <= 10),
  tags TEXT[],
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP,
  INDEX idx_user_importance (user_id, importance),
  INDEX idx_memory_type (memory_type)
);
```

### Memory Operations

**Storage API Endpoints:**
- `GET /api/memories` - Retrieve user memories
- `POST /api/memories` - Store new memory
- `DELETE /api/memories/:id` - Remove memory
- `POST /api/memories/relevant` - Search relevant memories
- `GET /api/user-context` - Get context for AI

**Context Assembly:**
The server automatically includes relevant memories in AI conversations:

```typescript
// Get high-importance memories for AI context
const recentMemories = await db
  .select()
  .from(aiMemories)
  .where(and(
    eq(aiMemories.userId, user.id),
    gt(aiMemories.importance, 5)
  ))
  .orderBy(desc(aiMemories.importance), desc(aiMemories.createdAt))
  .limit(8);
```

## Security & Privacy

### API Key Management
- User-specific OpenAI API keys stored encrypted
- No server-side API key exposure
- Secure ephemeral token generation
- API key validation and placeholder detection

### Voice Data Handling
- Real-time processing only (no storage)
- WebRTC encryption for audio streams
- Memory data encrypted at rest
- User consent for microphone access

### Access Control
- JWT-based authentication
- Route-level authorization
- User-specific data isolation
- Rate limiting on expensive operations

## Performance Optimizations

### Audio Processing
- Optimized VAD settings to reduce false triggers
- Audio context reuse and efficient cleanup
- Minimal latency WebRTC configuration
- Fallback audio processing strategies

### Network Efficiency
- Connection pooling and reuse
- Intelligent retry strategies
- Compressed data transmission
- Efficient tool call serialization

### Memory Management
- Automatic cleanup of expired memories
- Efficient context assembly
- Optimized database queries
- Memory usage monitoring

## Error Handling & Diagnostics

### Comprehensive Error Types
- **Network Errors**: Connection failures, timeouts
- **Authentication Errors**: Invalid API keys, expired tokens
- **Audio Errors**: Microphone access, codec issues
- **Server Errors**: Service unavailability, rate limits

### Diagnostic Features
- Real-time event logging
- Connection quality metrics
- Performance monitoring
- User-friendly error messages

### Recovery Mechanisms
- Automatic reconnection with backoff
- Graceful degradation for partial failures
- Manual recovery options
- Comprehensive cleanup procedures

## Integration Points

### Weather Service Integration
- Real-time weather data via WeatherAPI
- Location-based automatic queries
- Forecast data for planning assistance
- Weather-aware background generation

### Search Service Integration
- Brave Search API as primary search engine
- DuckDuckGo free API as fallback
- Result formatting for voice responses
- Source attribution and reliability

### Calendar Integration
- Mock calendar events (extensible architecture)
- Event-aware assistance
- Scheduling capabilities framework
- Future integration points identified

## Deployment Considerations

### Environment Configuration
```bash
# Required Environment Variables
OPENAI_API_KEY=sk-...          # Server fallback key
WEATHER_API_KEY=...            # WeatherAPI service
BRAVE_SEARCH_API_KEY=...       # Optional search enhancement
DATABASE_URL=postgresql://...   # User data persistence
```

### Production Optimizations
- CDN for static assets
- Database connection pooling
- Audio compression optimization
- Geographic server distribution

### Monitoring & Analytics
- Connection success rates
- Tool usage statistics
- Performance metrics
- User engagement tracking

## Recent Improvements (January 2025)

### Tool Execution Overhaul
- **Fixed Core Issue**: Transformed from context-only tools to fully functional client-side execution
- **Real Function Calls**: All 4 tools now execute actual API calls and return results to AI
- **Proper OpenAI Integration**: Implements correct `conversation.item.create` → `response.create` flow

### Enhanced Transparency System
- **Comprehensive Logging**: 11 different log types covering entire pipeline
- **Real-Time UI Feedback**: Live tool execution status in voice orb and widget
- **Tool State Management**: Complete visibility into inputs, progress, and results
- **Enhanced Event Stream**: Color-coded activity log with tool-specific icons

### Search Engine Optimization
- **Brave Search Primary**: Higher quality results for current events and commercial queries
- **DuckDuckGo Fallback**: Reliable free backup when Brave API unavailable
- **Smart Routing**: Automatic selection based on API key availability

### Architecture Improvements
- **Dependency Resolution**: Fixed initialization order issues in React hooks
- **Error Handling**: Comprehensive error recovery and user feedback
- **Performance**: Optimized logging and state updates for real-time operation

## Future Enhancements

### Planned Features
- Multi-language support with localized tool responses
- Custom voice training and personality configuration
- Advanced memory search with vector embeddings and semantic similarity
- Integration with external calendar services (Google Calendar, Outlook)
- Voice command shortcuts and custom wake phrases
- Contextual conversation threading and session persistence
- Tool result caching and intelligent result reuse

### Advanced Tool Capabilities
- **Enhanced Web Search**: Domain-specific search routing, real-time news integration
- **Weather Plus**: Historical data, severe weather alerts, agricultural insights
- **Smart Memory**: Automatic importance scoring, contextual retrieval, privacy controls
- **Time Intelligence**: Meeting scheduling, timezone coordination, reminder systems

### Scalability Considerations
- Horizontal scaling for concurrent users with load balancing
- Voice data processing optimization with edge computing
- Advanced caching strategies for tool results and AI responses
- Real-time collaboration features for multi-user sessions
- Enterprise deployment with SSO and admin controls

---

This architecture represents a production-ready voice assistant system with enterprise-grade reliability, comprehensive tool integration, and complete operational transparency. The enhanced agentic pipeline enables sophisticated AI interactions with full visibility into tool execution, ensuring users understand exactly how their voice assistant is helping them access real-time information and services.