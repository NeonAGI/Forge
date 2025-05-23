import { useState, useRef, useCallback, useEffect } from "react";
import { useSettings } from "@/hooks/use-settings";

// Constants
const MODEL = 'gpt-4o-realtime-preview-2024-12-17';

// OpenAI VAD workaround: Add silence padding to prevent truncation
async function createPaddedAudioStream(inputStream: MediaStream): Promise<MediaStream> {
  try {
    // Create audio context for processing
    const audioContext = new AudioContext();
    
    // Create source from input stream
    const source = audioContext.createMediaStreamSource(inputStream);
    
    // Create a gain node for silence detection
    const gainNode = audioContext.createGain();
    gainNode.gain.value = 1.0;
    
    // Create destination for output
    const destination = audioContext.createMediaStreamDestination();
    
    // Simple silence padding: connect source through gain to destination
    // The key is in the VAD settings rather than complex audio processing
    source.connect(gainNode);
    gainNode.connect(destination);
    
    console.log('✅ Created padded audio stream with VAD workaround');
    return destination.stream;
    
  } catch (error) {
    console.warn('Failed to create padded audio stream, using original:', error);
    return inputStream; // Fallback to original stream
  }
}

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
export type AssistantMode = 'idle' | 'listening' | 'speaking' | 'processing';

export interface SessionInfo {
  voice: string;
  language: string;
  model: string;
  connectionType: string;
  startTime: string | null;
  wakePhrase: string;
}

export interface RealtimeEvent {
  name: string;
  time: string;
}

export interface TranscriptMessage {
  id: string;
  speaker: 'user' | 'assistant';
  text: string;
  timestamp: string;
  toolCalls?: {
    tool: string;
    args: any;
    result?: any;
  }[];
  isComplete: boolean;
}

export function useOpenAIRealtimeV2() {
  // Get user settings for location context and verbose logging
  const { userSettings, isLoading: settingsLoading, updateUserSettings } = useSettings();
  const verboseLogging = userSettings?.verboseLogging || false;
  
  // State management
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isConnecting, setIsConnecting] = useState(false);
  const [assistantMode, setAssistantMode] = useState<AssistantMode>('idle');
  const [currentTool, setCurrentTool] = useState<string | null>(null);
  const [lastToolExecution, setLastToolExecution] = useState<{ tool: string; args: any; result?: any; timestamp: string } | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [recentEvents, setRecentEvents] = useState<RealtimeEvent[]>([]);
  const [conversationTranscripts, setConversationTranscripts] = useState<TranscriptMessage[]>([]);
  const [currentUserTranscript, setCurrentUserTranscript] = useState<string>('');
  const [currentAssistantTranscript, setCurrentAssistantTranscript] = useState<string>('');
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({
    voice: userSettings?.voiceId || 'alloy',
    language: 'English (US)',
    model: MODEL,
    connectionType: 'WebRTC',
    startTime: null,
    wakePhrase: 'Hey Assistant'
  });

  // Refs for WebRTC components
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const dataChannelRef = useRef<RTCDataChannel | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  // Refs to track current values for callbacks
  const sessionInfoRef = useRef(sessionInfo);
  const userSettingsRef = useRef(userSettings);
  const sessionConfiguredRef = useRef(false);
  
  // Keep refs updated
  useEffect(() => {
    sessionInfoRef.current = sessionInfo;
  }, [sessionInfo]);
  
  useEffect(() => {
    userSettingsRef.current = userSettings;
  }, [userSettings]);

  // Helper to add events with timestamps
  const addRecentEvent = useCallback((name: string) => {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    setRecentEvents(prev => {
      const newEvents = [{ name, time: timeString }, ...prev];
      return newEvents.slice(0, 10);
    });
  }, []);

  // Pre-check microphone permissions (especially useful for iOS)
  const checkMicrophonePermission = useCallback(async (): Promise<boolean> => {
    try {
      // Check if permissions API is available
      if (navigator.permissions) {
        const permission = await navigator.permissions.query({ name: 'microphone' as PermissionName });
        return permission.state === 'granted';
      }
      
      // Fallback: try a quick getUserMedia test
      try {
        const testStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        testStream.getTracks().forEach(track => track.stop());
        return true;
      } catch {
        return false;
      }
    } catch {
      return false;
    }
  }, []);

  // Initialize WebRTC session
  const startVoiceChat = useCallback(async () => {
    setIsConnecting(true);
    setConnectionError(null);
    setAssistantMode('processing');
    
    // Reset session configuration flag for new session
    sessionConfiguredRef.current = false;
    
    try {
      // Ensure audio context is initialized
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
      }
      
      // Fetch ephemeral token from enhanced endpoint
      // Priority: 1. Local session voice (most recent UI change), 2. Saved user settings, 3. Default
      // Use refs to get current values and avoid stale closure issues
      const currentSessionInfo = sessionInfoRef.current;
      const currentUserSettings = userSettingsRef.current;
      const voiceToUse = currentSessionInfo.voice || currentUserSettings?.voiceId || 'alloy';
      const requestBody = {
        voice: voiceToUse.toLowerCase(),
        model: MODEL
      };
      console.log('Fetching ephemeral token with user context...', {
        selectedVoice: currentSessionInfo.voice,
        userVoiceId: currentUserSettings?.voiceId,
        actualVoiceUsed: voiceToUse,
        requestBody
      });
      const tokenResponse = await fetch('/api/realtime/session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        throw new Error(errorData.error || 'Failed to get ephemeral token');
      }
      
      const data = await tokenResponse.json();
      const ephemeralKey = data.ephemeralToken;
      
      console.log('Token received, creating peer connection...');
      
      // Create a new peer connection
      peerConnectionRef.current = new RTCPeerConnection();
      const peerConnection = peerConnectionRef.current;
      
      // Set up audio element for model output
      if (audioElementRef.current) {
        if (audioElementRef.current.srcObject) {
          const tracks = (audioElementRef.current.srcObject as MediaStream).getTracks();
          tracks.forEach(track => track.stop());
        }
        audioElementRef.current.remove();
      }
      
      audioElementRef.current = new Audio();
      audioElementRef.current.autoplay = true;
      document.body.appendChild(audioElementRef.current);
      audioElementRef.current.volume = 1.0;
      
      // Set up event handler for incoming audio tracks
      peerConnection.ontrack = (event) => {
        console.log('Received remote audio track');
        if (event.streams && event.streams[0] && audioElementRef.current) {
          const audioStream = new MediaStream();
          
          event.streams[0].getAudioTracks().forEach(track => {
            audioStream.addTrack(track);
          });
          
          audioElementRef.current.srcObject = audioStream;
          
          audioElementRef.current.play().catch(e => {
            console.log('Direct play failed, trying alternative approach');
            // Alternative approach if play fails
            try {
              if (audioContextRef.current) {
                const source = audioContextRef.current.createMediaStreamSource(audioStream);
                source.connect(audioContextRef.current.destination);
              }
            } catch (err) {
              console.error('Failed alternative audio approach:', err);
            }
          });
        }
      };
      
      // Request microphone access with iOS-specific handling
      console.log('Requesting microphone access...');
      
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Microphone access not supported in this browser');
      }
      
      try {
        // Request audio with explicit constraints for mobile compatibility
        localStreamRef.current = await navigator.mediaDevices.getUserMedia({ 
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            // iOS Safari compatibility
            channelCount: 1,
            sampleRate: 16000
          }
        });
        console.log('✅ Microphone access granted');
      } catch (micError: any) {
        console.error('❌ Microphone access denied:', micError);
        if (micError.name === 'NotAllowedError') {
          throw new Error('Microphone permission denied. Please allow microphone access and try again.');
        } else if (micError.name === 'NotFoundError') {
          throw new Error('No microphone found on this device.');
        } else {
          throw new Error(`Microphone error: ${micError.message}`);
        }
      }
      
      // Create processed audio stream with silence padding (OpenAI VAD workaround)
      const processedStream = await createPaddedAudioStream(localStreamRef.current);
      
      // Add processed audio track to peer connection
      processedStream.getAudioTracks().forEach(track => {
        peerConnection.addTrack(track, processedStream);
      });
      
      // Create data channel for events
      dataChannelRef.current = peerConnection.createDataChannel('oai-events');
      const dataChannel = dataChannelRef.current;
      
      // Set up data channel handlers
      dataChannel.onopen = () => {
        console.log('Data channel opened');
        setConnectionStatus('connected');
        setAssistantMode('listening');
        
        // Record session start time
        const now = new Date();
        const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        setSessionInfo(prev => ({ ...prev, startTime: formattedTime }));
        addRecentEvent("session.created");
        
        // Configure the session
        configureSession();
      };
      
      dataChannel.onclose = () => {
        console.log('Data channel closed');
        setConnectionStatus('disconnected');
        setAssistantMode('idle');
      };
      
      dataChannel.onerror = (error) => {
        console.error('📡 Data channel error:', error);
        // Don't set connection error for minor data channel issues
        // These often happen during normal operation and reconnection
        if (connectionStatus === 'connected') {
          console.log('🔄 Data channel error during active connection - will attempt to reconnect');
        }
      };
      
      dataChannel.onmessage = handleServerEvent;
      
      // Create and set local description (offer)
      console.log('Creating WebRTC offer...');
      const offer = await peerConnection.createOffer();
      await peerConnection.setLocalDescription(offer);
      
      // Send offer to server and get answer
      console.log('Sending offer to OpenAI...');
      const sdpResponse = await fetch(`https://api.openai.com/v1/realtime?model=${MODEL}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${ephemeralKey}`,
          'Content-Type': 'application/sdp'
        },
        body: offer.sdp
      });
      
      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        throw new Error(`SDP response error: ${sdpResponse.status} - ${errorText}`);
      }
      
      // Set remote description from answer
      const answerSdp = await sdpResponse.text();
      await peerConnection.setRemoteDescription({
        type: 'answer',
        sdp: answerSdp
      });
      
      console.log('WebRTC connection established successfully');
      
    } catch (error: any) {
      console.error('Error initializing session:', error);
      setConnectionError(error.message || 'Failed to initialize voice chat');
      setConnectionStatus('disconnected');
      setAssistantMode('idle');
      disconnect();
    } finally {
      setIsConnecting(false);
    }
  }, [addRecentEvent]);

  // Configure session settings
  const configureSession = useCallback(() => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
      console.error('Data channel not ready for session configuration');
      return;
    }
    
    // Wait for settings to load before configuring
    if (settingsLoading || userSettings === null) {
      console.log('Waiting for user settings to load before configuring session...');
      return;
    }
    
    // Prevent duplicate session configuration
    if (sessionConfiguredRef.current) {
      console.log('Session already configured, skipping duplicate configuration');
      return;
    }
    
    // Define available functions for the model to call
    const weatherFunction = {
      type: 'function',
      name: 'get_weather',
      description: 'Get current weather conditions and forecast for any location worldwide',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'City name, address, or coordinates (e.g., "New York", "Paris, France", "40.7128,-74.0060")'
          },
          include_forecast: {
            type: 'boolean',
            description: 'Include hourly and daily forecast data',
            default: false
          }
        },
        required: ['location']
      }
    };
    
    const timeFunction = {
      type: 'function',
      name: 'get_current_time',
      description: 'Get the current time for a specific timezone',
      parameters: {
        type: 'object',
        properties: {
          timezone: {
            type: 'string',
            description: 'The timezone to get the current time for (e.g., "America/New_York")',
            enum: [
              'America/New_York',
              'America/Los_Angeles',
              'Europe/London',
              'Asia/Tokyo',
              'Australia/Sydney'
            ]
          }
        },
        required: ['timezone']
      }
    };
    
    const webSearchFunction = {
      type: 'function',
      name: 'web_search',
      description: 'Search the web for current information, news, facts, or any topic the user asks about. Use this when you need up-to-date information.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query to look up on the web' },
          num_results: { type: 'number', description: 'Number of search results to return (1-5)', minimum: 1, maximum: 5 }
        },
        required: ['query']
      }
    };
    
    const rememberFunction = {
      type: 'function',
      name: 'remember_user_info',
      description: 'Remember important information about the user for future conversations',
      parameters: {
        type: 'object',
        properties: {
          memory_type: { 
            type: 'string', 
            description: 'Type of memory (e.g., "preference", "personal_info", "interest", "goal", "context")',
            enum: ['preference', 'personal_info', 'interest', 'goal', 'context', 'important_fact']
          },
          content: { type: 'string', description: 'The information to remember about the user' },
          importance: { type: 'number', description: 'Importance level 1-10', minimum: 1, maximum: 10 }
        },
        required: ['memory_type', 'content']
      }
    };
    
    // Configure semantic VAD for better turn detection
    console.log('🔍 DEBUG: User settings in AI config:', userSettings);
    console.log('🔍 DEBUG: User location being passed to AI:', userSettings?.location || 'Unknown location');
    
    const sessionConfig = {
      type: 'session.update',
      session: {
        instructions: `You are a helpful, friendly voice assistant with memory and web search capabilities.

IMPORTANT USER CONTEXT:
- User location: ${userSettings?.location || 'Unknown location'}
- Temperature preference: ${userSettings?.temperatureUnit === 'C' ? 'Celsius' : 'Fahrenheit'}
- Current time: ${new Date().toLocaleString()}

KEY BEHAVIOR RULES:
1. ALWAYS acknowledge when you're using tools with brief status updates like "Let me search for that" or "I'll check the weather for you"
2. When users ask about weather WITHOUT specifying a location, automatically use their location: ${userSettings?.location}
3. For current events, news, restaurant recommendations, local information, ALWAYS use web_search
4. When users share personal info, use remember_user_info to save it

TOOL USAGE:
- web_search: Use for current events, news, local businesses, recent information, sports scores, etc.
- get_weather: Use for weather requests (default to user's location: ${userSettings?.location})
- remember_user_info: Save personal details, preferences, interests they share
- get_time: For time/date questions

CONVERSATION STYLE:
- Be conversational and personable - chat casually or help with tasks
- Give brief "working on it" acknowledgments when using tools
- Remember details they share to build rapport
- If they say 'stop', 'disconnect', 'goodbye', etc., acknowledge and end gracefully

Use your functions proactively and keep users informed!`,
        tools: [weatherFunction, timeFunction, webSearchFunction, rememberFunction],
        tool_choice: 'auto',
        input_audio_transcription: {
          model: 'gpt-4o-transcribe',
          prompt: 'Expect conversational speech with requests for weather, time, web search, and personal information.',
          language: 'en'
        },
        turn_detection: {
          type: 'semantic_vad',
          eagerness: 'low',  // Less eager to detect speech - reduces false positives
          create_response: true,
          interrupt_response: true,  // Allow user interruptions
          threshold: 0.9,  // Very high threshold - only very clear speech triggers
          prefix_padding_ms: 500,  // Wait 500ms before considering speech (forum recommendation)
          silence_duration_ms: 1000  // Require 1 second of silence to end turn (forum recommendation)
        }
      }
    };
    
    // Send session configuration
    console.log('🤖 SENDING AGENT CONTEXT:', {
      userLocation: userSettings?.location || 'Unknown location',
      temperatureUnit: userSettings?.temperatureUnit === 'C' ? 'Celsius' : 'Fahrenheit',
      currentTime: new Date().toLocaleString(),
      availableTools: sessionConfig.session.tools.map(t => t.name),
      instructionsLength: sessionConfig.session.instructions.length,
      vadSettings: {
        threshold: 0.9,
        prefixPadding: '500ms',
        silenceDuration: '1000ms',
        note: 'Tuned for OpenAI VAD truncation workaround'
      }
    });
    
    sendEvent(sessionConfig);
    addRecentEvent("session.configured");
    sessionConfiguredRef.current = true;
  }, [addRecentEvent, userSettings?.location, userSettings?.temperatureUnit]); // Only depend on location/temp, not voice

  // Effect to update voice when settings change
  useEffect(() => {
    if (userSettings?.voiceId) {
      setSessionInfo(prev => ({
        ...prev,
        voice: userSettings.voiceId || 'alloy'
      }));
    }
  }, [userSettings?.voiceId]);

  // Effect to configure session when settings become available
  useEffect(() => {
    if (!settingsLoading && userSettings && dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      console.log('Settings loaded, configuring session with location:', userSettings.location);
      configureSession();
    }
  }, [userSettings, settingsLoading]);

  // Handle server events coming from the data channel
  const handleServerEvent = useCallback((event: MessageEvent) => {
    try {
      const serverEvent = JSON.parse(event.data);
      
      // Verbose logging - only if enabled
      if (verboseLogging) {
        // Log all transcription-related events specifically
        if (serverEvent.type.includes('transcription') || serverEvent.type.includes('transcript')) {
          console.log('📝 TRANSCRIPTION EVENT:', {
            type: serverEvent.type,
            event: serverEvent,
            timestamp: new Date().toLocaleTimeString()
          });
        }
        
        // Debug log all events to see what we're receiving (excluding audio streams to reduce noise)
        if (serverEvent.type !== 'response.audio.delta' && 
            serverEvent.type !== 'input_audio_buffer.append' &&
            !serverEvent.type.includes('audio_transcript.delta')) {
          console.log('📥 RECEIVED EVENT:', {
            type: serverEvent.type,
            event: serverEvent,
            timestamp: new Date().toLocaleTimeString()
          });
        }
      }
      
      // Handle transcription events for conversation logging
      if (serverEvent.type === 'conversation.item.input_audio_transcription.delta') {
        const delta = serverEvent.delta || '';
        setCurrentUserTranscript(prev => prev + delta);
        if (verboseLogging) {
          console.log('📝 USER SPEAKING (REAL-TIME):', {
            delta: `"${delta}"`,
            currentText: currentUserTranscript + delta,
            itemId: serverEvent.item_id,
            timestamp: new Date().toLocaleTimeString()
          });
        }
        return;
      }
      
      if (serverEvent.type === 'conversation.item.input_audio_transcription.completed') {
        const transcript = serverEvent.transcript || '';
        const now = new Date();
        
        // Always show completed user input
        console.log(`%c🗣️ USER: "${transcript}"`, 'color: #3b82f6; font-weight: bold; font-size: 16px;');
        
        // Verbose details
        if (verboseLogging) {
          console.log('🗣️ USER SAID:', {
            fullTranscript: `"${transcript}"`,
            length: transcript.length,
            itemId: serverEvent.item_id,
            timestamp: now.toLocaleTimeString()
          });
        }
        
        // Add to conversation transcripts
        const userMessage: TranscriptMessage = {
          id: serverEvent.item_id || `user-${Date.now()}`,
          speaker: 'user',
          text: transcript,
          timestamp: now.toLocaleTimeString(),
          isComplete: true
        };
        
        setConversationTranscripts(prev => [...prev, userMessage]);
        setCurrentUserTranscript(''); // Reset current transcript
        
        // Check for stop commands
        const lowerTranscript = transcript.toLowerCase();
        const stopCommands = ['stop', 'disconnect', 'end call', 'hang up', 'bye', 'goodbye', 'exit'];
        
        if (stopCommands.some(cmd => lowerTranscript.includes(cmd))) {
          console.log('Stop command detected in transcript:', transcript);
          addRecentEvent('stop_command_detected');
          setTimeout(() => {
            disconnect();
          }, 500);
          return;
        }
        
        addRecentEvent('user_transcript_completed');
        return;
      }
      
      // Handle different event types
      switch (serverEvent.type) {
        case 'input_audio_buffer.speech_started':
          if (verboseLogging) {
            console.log('🎤 USER VOICE INPUT STARTED:', {
              timestamp: new Date().toLocaleTimeString(),
              mode: 'semantic_vad'
            });
          }
          setAssistantMode('listening');
          setCurrentTool(null);
          addRecentEvent('speech_started');
          break;
          
        case 'input_audio_buffer.speech_stopped':
          if (verboseLogging) {
            console.log('🎤 USER VOICE INPUT STOPPED:', {
              timestamp: new Date().toLocaleTimeString(),
              nextStep: 'Processing user input...'
            });
          }
          setAssistantMode('processing');
          addRecentEvent('speech_stopped');
          break;
          
        case 'response.function_call_delta':
          // Tool is being called
          if (serverEvent.name) {
            const toolName = serverEvent.name;
            setCurrentTool(toolName);
            setAssistantMode('processing');
            
            // Add user-friendly tool names
            const toolDisplayName = {
              'web_search': 'Searching the web',
              'get_weather': 'Getting weather info',
              'get_time': 'Getting current time',
              'remember_user_info': 'Saving to memory'
            }[toolName] || `Using ${toolName}`;
            
            console.log('🔧 AGENT TOOL CALL STARTED:', {
              tool: toolName,
              displayName: toolDisplayName,
              arguments: serverEvent.arguments || 'Loading...',
              timestamp: new Date().toLocaleTimeString()
            });
            
            addRecentEvent(`tool_call_${toolName}`);
          }
          break;
          
        case 'response.function_call_done':
          // Tool call completed
          console.log('✅ AGENT TOOL CALL COMPLETED:', {
            tool: serverEvent.name || 'unknown',
            result: serverEvent.output ? 'Success' : 'No output',
            timestamp: new Date().toLocaleTimeString()
          });
          
          setCurrentTool(null);
          addRecentEvent('tool_call_completed');
          break;
          
        case 'response.text.delta':
          // Assistant is generating text response in real-time
          const textDelta = serverEvent.delta || '';
          setCurrentAssistantTranscript(prev => prev + textDelta);
          console.log('📝 ASSISTANT SPEAKING (REAL-TIME):', {
            delta: `"${textDelta}"`,
            currentText: currentAssistantTranscript + textDelta,
            timestamp: new Date().toLocaleTimeString()
          });
          break;

        case 'response.text.done':
          // Assistant has completed text response
          const responseText = serverEvent.text || currentAssistantTranscript;
          console.log('🤖 ASSISTANT SAID:', {
            fullText: `"${responseText}"`,
            length: responseText.length,
            timestamp: new Date().toLocaleTimeString()
          });
          console.log(`%c🤖 ASSISTANT: "${responseText}"`, 'color: #10b981; font-weight: bold; font-size: 14px;');
          
          // Add to transcript
          if (responseText.trim()) {
            const assistantMessage: TranscriptMessage = {
              id: `assistant-text-${Date.now()}`,
              speaker: 'assistant',
              text: responseText.trim(),
              timestamp: new Date().toLocaleTimeString(),
              isComplete: true
            };
            setConversationTranscripts(prev => [...prev, assistantMessage]);
          }
          setCurrentAssistantTranscript('');
          break;

        case 'response.audio_transcript.delta':
          // Assistant is speaking - capture the transcript in real-time
          const audioDelta = serverEvent.delta || '';
          setCurrentAssistantTranscript(prev => prev + audioDelta);
          if (verboseLogging) {
            console.log('📝 ASSISTANT SPEAKING (REAL-TIME):', {
              delta: `"${audioDelta}"`,
              currentText: currentAssistantTranscript + audioDelta,
              timestamp: new Date().toLocaleTimeString()
            });
          }
          setAssistantMode('speaking');
          break;

        case 'response.audio_transcript.done':
          // Assistant has finished speaking - capture the complete transcript
          const completeAudioTranscript = serverEvent.transcript || currentAssistantTranscript;
          
          // Always show completed assistant response
          console.log(`%c🤖 ASSISTANT: "${completeAudioTranscript}"`, 'color: #10b981; font-weight: bold; font-size: 16px;');
          
          // Verbose details
          if (verboseLogging) {
            console.log('🤖 ASSISTANT SAID:', {
              fullTranscript: `"${completeAudioTranscript}"`,
              length: completeAudioTranscript.length,
              timestamp: new Date().toLocaleTimeString()
            });
          }
          
          // Add to transcript
          if (completeAudioTranscript.trim()) {
            const assistantMessage: TranscriptMessage = {
              id: `assistant-audio-${Date.now()}`,
              speaker: 'assistant',
              text: completeAudioTranscript.trim(),
              timestamp: new Date().toLocaleTimeString(),
              isComplete: true
            };
            setConversationTranscripts(prev => [...prev, assistantMessage]);
          }
          setCurrentAssistantTranscript('');
          break;

        case 'response.audio.delta':
          // Note: This is raw audio data, not text. Text transcription would require additional processing.
          setAssistantMode('speaking');
          setCurrentTool(null);
          addRecentEvent('audio_response');
          break;
          
        case 'response.done':
          // Verbose logging only
          if (verboseLogging) {
            console.log('🎤 AGENT RESPONSE COMPLETED:', {
              reason: serverEvent.response?.status || 'unknown',
              timestamp: new Date().toLocaleTimeString()
            });
            
            // Log the full response object to debug
            console.log('🔍 FULL RESPONSE DEBUG:', {
              response: serverEvent.response,
              output: serverEvent.response?.output,
              timestamp: new Date().toLocaleTimeString()
            });
          }
          
          // Process assistant response for transcript logging
          const now = new Date();
          let assistantText = '';
          let toolCalls: { tool: string; args: any; result?: any }[] = [];
          
          // Extract text content and tool calls from response
          if (serverEvent.response?.output) {
            for (const item of serverEvent.response.output) {
              if (verboseLogging) {
                console.log('🔍 PROCESSING RESPONSE ITEM:', {
                  type: item.type,
                  content: item.content,
                  item: item
                });
              }
              
              // Extract text responses - try multiple formats
              if (item.type === 'message' && item.content) {
                for (const content of item.content) {
                  if (content.type === 'text') {
                    assistantText += content.text || '';
                  }
                }
              }
              
              // Also try direct text access
              if (item.type === 'message' && item.text) {
                assistantText += item.text;
              }
              
              // Track tool calls for transcript
              if (item.type === 'function_call') {
                toolCalls.push({
                  tool: item.name || 'unknown',
                  args: item.arguments ? JSON.parse(item.arguments) : {},
                  result: undefined // Will be filled when function execution completes
                });
                
                if (item.status === 'completed') {
                  // Always show tool execution
                  console.log(`%c🔧 TOOL: ${item.name}(${item.arguments})`, 'color: #f59e0b; font-weight: bold; font-size: 14px;');
                  
                  if (verboseLogging) {
                    console.log('🔧 EXECUTING FUNCTION CALL:', {
                      function: item.name,
                      arguments: item.arguments,
                      callId: item.call_id,
                      timestamp: now.toLocaleTimeString()
                    });
                  }
                  
                  // Execute the function call
                  executeFunctionCall(item);
                  return; // Don't update mode yet, wait for function execution
                }
              }
            }
          }
          
          // Verbose logging for text extraction
          if (verboseLogging) {
            console.log('🤖 ASSISTANT TEXT EXTRACTED:', {
              text: `"${assistantText}"`,
              length: assistantText.length,
              toolCalls: toolCalls.length,
              timestamp: now.toLocaleTimeString()
            });
          }
          
          // Create assistant transcript entry for tool calls (audio transcript is handled separately)
          if (toolCalls.length > 0) {
            // Update the most recent assistant message with tool calls if it exists
            setConversationTranscripts(prev => {
              const updated = [...prev];
              const lastMessage = updated[updated.length - 1];
              
              if (lastMessage && lastMessage.speaker === 'assistant' && !lastMessage.toolCalls) {
                // Add tool calls to existing message
                lastMessage.toolCalls = toolCalls;
              } else {
                // Create new message for tool calls
                const toolMessage: TranscriptMessage = {
                  id: `assistant-tools-${Date.now()}`,
                  speaker: 'assistant',
                  text: `[Used ${toolCalls.length} tool(s): ${toolCalls.map(tc => tc.tool).join(', ')}]`,
                  timestamp: now.toLocaleTimeString(),
                  toolCalls: toolCalls,
                  isComplete: true
                };
                updated.push(toolMessage);
              }
              
              return updated;
            });
            
            if (verboseLogging) {
              console.log('📝 TOOL CALLS LOGGED:', {
                toolCallCount: toolCalls.length,
                tools: toolCalls.map(tc => tc.tool),
                timestamp: now.toLocaleTimeString()
              });
            }
          }
          
          setAssistantMode('listening');
          setCurrentTool(null);
          addRecentEvent('response_completed');
          break;
          
        case 'response.cancelled':
          console.log('⚠️ AGENT RESPONSE CANCELLED/INTERRUPTED:', {
            timestamp: new Date().toLocaleTimeString()
          });
          setAssistantMode('listening');
          setCurrentTool(null);
          addRecentEvent('response_cancelled');
          break;
          
        case 'error':
          const errorMessage = serverEvent.message || serverEvent.error || 'Unknown error';
          console.error('Server error:', errorMessage, serverEvent);
          setConnectionError(`Server error: ${errorMessage}`);
          setCurrentTool(null);
          addRecentEvent('error');
          break;
          
        default:
          addRecentEvent(serverEvent.type);
          break;
      }
    } catch (error) {
      console.error('Error handling server event:', error);
    }
  }, [addRecentEvent, verboseLogging]);

  // Helper to send events through the data channel
  const sendEvent = useCallback((event: any) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      // Log important events being sent to agent
      if (event.type === 'session.update') {
        console.log('📤 SENDING SESSION UPDATE TO AGENT');
      } else if (event.type === 'input_audio_buffer.append') {
        // Don't log audio data - too verbose
      } else {
        console.log('📤 SENDING EVENT TO AGENT:', {
          type: event.type,
          timestamp: new Date().toLocaleTimeString()
        });
      }
      
      dataChannelRef.current.send(JSON.stringify(event));
    } else {
      console.error('❌ Cannot send event - data channel not open');
    }
  }, []);

  // Send function call results back to OpenAI
  const sendFunctionResult = useCallback(async (callId: string, output: string) => {
    console.log('📤 SENDING FUNCTION RESULT TO AI:', {
      callId: callId,
      outputLength: output.length,
      timestamp: new Date().toLocaleTimeString()
    });
    
    // Create conversation item with function result
    const functionOutputEvent = {
      type: 'conversation.item.create',
      item: {
        type: 'function_call_output',
        call_id: callId,
        output: output
      }
    };
    
    sendEvent(functionOutputEvent);
    
    // Request new response from the model with the function result
    const responseEvent = {
      type: 'response.create'
    };
    
    sendEvent(responseEvent);
    
    addRecentEvent('function_result_sent');
    console.log('🔄 REQUESTING AI RESPONSE WITH FUNCTION RESULT');
  }, [sendEvent, addRecentEvent]);

  // Helper to update transcript with tool results
  const updateTranscriptWithToolResult = useCallback((toolName: string, args: any, result: any) => {
    setConversationTranscripts(prev => {
      // Find the last assistant message and update its tool calls
      const updated = [...prev];
      for (let i = updated.length - 1; i >= 0; i--) {
        if (updated[i].speaker === 'assistant' && updated[i].toolCalls) {
          const toolCallIndex = updated[i].toolCalls!.findIndex(tc => tc.tool === toolName);
          if (toolCallIndex !== -1) {
            updated[i].toolCalls![toolCallIndex].result = result;
            break;
          }
        }
      }
      return updated;
    });
  }, []);

  // Execute function calls from the AI agent
  const executeFunctionCall = useCallback(async (functionCall: any) => {
    const { name, arguments: argsString, call_id } = functionCall;
    
    try {
      // Parse function arguments
      const args = JSON.parse(argsString);
      if (verboseLogging) {
        console.log('🚀 EXECUTING TOOL:', {
          toolName: name,
          arguments: args,
          callId: call_id,
          timestamp: new Date().toLocaleTimeString()
        });
      }
      
      // Store tool execution details for UI transparency
      setLastToolExecution({
        tool: name,
        args: args,
        timestamp: new Date().toLocaleTimeString()
      });
      
      let result = null;
      
      // Execute the appropriate function based on the name
      switch (name) {
        case 'web_search':
          // Always show search query
          console.log(`%c🔍 SEARCHING: "${args.query}"`, 'color: #06b6d4; font-weight: bold; font-size: 14px;');
          
          if (verboseLogging) {
            console.log('🔍 WEB SEARCH STARTED:', {
              query: args.query,
              numResults: args.num_results || 5
            });
          }
          
          result = await fetch('/api/search', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
              query: args.query,
              num_results: args.num_results || 5
            })
          });
          
          if (result.ok) {
            const searchData = await result.json();
            
            // Always show search results summary
            const resultCount = searchData.results?.length || 0;
            const firstResult = searchData.results?.[0];
            console.log(`%c✅ FOUND: ${resultCount} results${firstResult ? ` - "${firstResult.title}"` : ''}`, 'color: #10b981; font-weight: bold; font-size: 14px;');
            
            if (verboseLogging) {
              console.log('✅ WEB SEARCH COMPLETED:', {
                query: args.query,
                resultCount: resultCount,
                results: searchData.results?.slice(0, 3).map(r => r.title) || []
              });
              
              // Log full search results for debugging
              console.log('🔍 FULL SEARCH RESULTS:', {
                query: args.query,
                fullData: searchData,
                firstResult: firstResult,
                timestamp: new Date().toLocaleTimeString()
              });
            }
            
            // Format results for the AI
            const formattedResults = {
              query: args.query,
              results: searchData.results?.map(r => ({
                title: r.title,
                url: r.url,
                snippet: r.snippet,
                source: r.source
              })) || [],
              total_results: searchData.total_results || 0
            };
            
            await sendFunctionResult(call_id, JSON.stringify(formattedResults));
            
            // Update tool execution with results
            setLastToolExecution(prev => prev ? { ...prev, result: formattedResults } : null);
            
            // Update transcript with tool result
            updateTranscriptWithToolResult(name, args, formattedResults);
          } else {
            throw new Error(`Search failed: ${result.status} ${result.statusText}`);
          }
          break;
          
        case 'get_weather':
          const weatherLocation = args.location || userSettingsRef.current?.location || 'Unknown';
          console.log(`%c🌤️ WEATHER: ${weatherLocation}`, 'color: #f59e0b; font-weight: bold; font-size: 14px;');
          
          if (verboseLogging) {
            console.log('🌤️ WEATHER REQUEST STARTED:', {
              location: args.location,
              includeForecast: args.include_forecast || false
            });
          }
          
          // Use user's location if no location specified
          const location = args.location || userSettingsRef.current?.location || 'Unknown';
          const unit = userSettingsRef.current?.temperatureUnit === 'C' ? 'C' : 'F';
          
          result = await fetch(`/api/weather?location=${encodeURIComponent(location)}&unit=${unit}`, {
            credentials: 'include'
          });
          
          if (result.ok) {
            const weatherData = await result.json();
            console.log('✅ WEATHER REQUEST COMPLETED:', {
              location: weatherData.location,
              temperature: weatherData.currentWeather?.temperature,
              condition: weatherData.currentWeather?.description
            });
            
            await sendFunctionResult(call_id, JSON.stringify(weatherData));
            
            // Update tool execution with results
            const weatherResult = { location: weatherData.location, temperature: weatherData.currentWeather?.temperature, condition: weatherData.currentWeather?.description };
            setLastToolExecution(prev => prev ? { ...prev, result: weatherResult } : null);
            
            // Update transcript with tool result
            updateTranscriptWithToolResult(name, args, weatherResult);
          } else {
            throw new Error(`Weather request failed: ${result.status} ${result.statusText}`);
          }
          break;
          
        case 'get_current_time':
          console.log('🕐 TIME REQUEST STARTED:', {
            timezone: args.timezone
          });
          
          const now = new Date();
          const timeData = {
            timezone: args.timezone,
            current_time: now.toLocaleString('en-US', { 
              timeZone: args.timezone,
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              timeZoneName: 'short'
            }),
            timestamp: now.toISOString()
          };
          
          console.log('✅ TIME REQUEST COMPLETED:', timeData);
          await sendFunctionResult(call_id, JSON.stringify(timeData));
          
          // Update tool execution with results
          setLastToolExecution(prev => prev ? { ...prev, result: timeData } : null);
          
          // Update transcript with tool result
          updateTranscriptWithToolResult(name, args, timeData);
          break;
          
        case 'remember_user_info':
          console.log('🧠 MEMORY SAVE STARTED:', {
            memoryType: args.memory_type,
            content: args.content?.substring(0, 50) + '...',
            importance: args.importance || 5
          });
          
          result = await fetch('/api/memories', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            credentials: 'include',
            body: JSON.stringify({
              memoryType: args.memory_type,
              content: args.content,
              importance: args.importance || 5
            })
          });
          
          if (result.ok) {
            const memoryData = await result.json();
            console.log('✅ MEMORY SAVE COMPLETED:', {
              memoryId: memoryData.memory?.id,
              type: args.memory_type,
              importance: args.importance || 5
            });
            
            const memoryResult = {
              status: 'saved',
              memory_id: memoryData.memory?.id,
              message: 'Information has been saved to memory'
            };
            
            await sendFunctionResult(call_id, JSON.stringify(memoryResult));
            
            // Update tool execution with results
            setLastToolExecution(prev => prev ? { ...prev, result: memoryResult } : null);
            
            // Update transcript with tool result
            updateTranscriptWithToolResult(name, args, memoryResult);
          } else {
            throw new Error(`Memory save failed: ${result.status} ${result.statusText}`);
          }
          break;
          
        default:
          console.error('❌ UNKNOWN FUNCTION CALL:', name);
          throw new Error(`Unknown function: ${name}`);
      }
      
    } catch (error: any) {
      console.error('❌ FUNCTION CALL FAILED:', {
        function: name,
        error: error.message,
        callId: call_id
      });
      
      // Send error result back to the AI
      await sendFunctionResult(call_id, JSON.stringify({
        error: true,
        message: error.message || 'Function execution failed'
      }));
    }
  }, [userSettingsRef, sendFunctionResult, updateTranscriptWithToolResult, verboseLogging]);

  // Disconnect session and clean up resources
  const disconnect = useCallback(() => {
    try {
      // Reset session configuration flag
      sessionConfiguredRef.current = false;
      
      // Close data channel if open
      if (dataChannelRef.current) {
        dataChannelRef.current.close();
        dataChannelRef.current = null;
      }
      
      // Close peer connection
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      
      // Stop audio tracks
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
      }
      
      // Clean up audio element
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.srcObject = null;
        if (audioElementRef.current.parentNode) {
          audioElementRef.current.parentNode.removeChild(audioElementRef.current);
        }
        audioElementRef.current = null;
      }
      
      // Reset state
      setConnectionStatus('disconnected');
      setAssistantMode('idle');
      setCurrentTool(null);
      setSessionInfo(prev => ({ ...prev, startTime: null }));
      setConnectionError(null);
      
      // Clear transcripts on disconnect (optional - user can choose to keep them)
      // setConversationTranscripts([]);
      setCurrentUserTranscript('');
      setCurrentAssistantTranscript('');
      
    } catch (error) {
      console.error('Error during disconnection:', error);
    }
  }, []);

  // Send text message (for testing)
  const sendTextMessage = useCallback((text: string) => {
    if (!dataChannelRef.current || dataChannelRef.current.readyState !== 'open') {
      setConnectionError("Not connected to OpenAI. Please start a voice chat first.");
      return;
    }
    
    try {
      const createItemEvent = {
        type: "conversation.item.create",
        item: {
          type: "message",
          role: "user",
          content: [
            {
              type: "input_text",
              text: text,
            }
          ]
        }
      };
      
      sendEvent(createItemEvent);
      
      const responseEvent = {
        type: "response.create"
      };
      
      sendEvent(responseEvent);
      addRecentEvent(`sent: ${text.substring(0, 20)}${text.length > 20 ? '...' : ''}`);
      setAssistantMode('processing');
    } catch (error) {
      console.error("Error sending text message:", error);
      setConnectionError("Failed to send message to OpenAI");
    }
  }, [sendEvent, addRecentEvent]);

  // Placeholder functions (not implemented in this version)
  const startWakePhraseDetection = useCallback(() => {
    console.log('Wake phrase detection not implemented in v2');
  }, []);
  
  const stopWakePhraseDetection = useCallback(() => {
    console.log('Wake phrase detection not implemented in v2');
  }, []);

  const updateWakePhrase = useCallback((newWakePhrase: string) => {
    setSessionInfo(prev => ({ ...prev, wakePhrase: newWakePhrase }));
  }, []);

  const updateVoice = useCallback(async (newVoice: string) => {
    console.log('🔊 Updating voice selection:', newVoice);
    
    // Update local session info immediately for UI responsiveness
    setSessionInfo(prev => ({ ...prev, voice: newVoice }));
    
    // Save to user settings for persistence
    try {
      await updateUserSettings({ 
        voiceId: newVoice as 'alloy' | 'ash' | 'ballad' | 'coral' | 'echo' | 'sage' | 'shimmer' | 'verse' 
      });
      console.log('✅ Voice saved to user settings:', newVoice);
      
      if (connectionStatus === 'connected') {
        console.log('🔄 Voice changed while connected - will apply on next session');
        // The new voice will be used on the next connection
      }
    } catch (error) {
      console.error('❌ Failed to save voice settings:', error);
    }
  }, [connectionStatus, updateUserSettings]);

  // Force stop - immediate disconnect with enhanced cleanup
  const forceStop = useCallback(() => {
    console.log('🛑 Force stop initiated - immediate disconnect');
    addRecentEvent('force_stop_initiated');
    
    // Reset session configuration flag
    sessionConfiguredRef.current = false;
    
    // Immediate cleanup without waiting for graceful close
    try {
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach(track => {
          track.stop();
          console.log(`Stopped ${track.kind} track:`, track.label);
        });
        localStreamRef.current = null;
      }
      
      if (dataChannelRef.current) {
        dataChannelRef.current.close();
        dataChannelRef.current = null;
      }
      
      if (peerConnectionRef.current) {
        peerConnectionRef.current.close();
        peerConnectionRef.current = null;
      }
      
      if (audioElementRef.current) {
        audioElementRef.current.pause();
        audioElementRef.current.srcObject = null;
        if (audioElementRef.current.parentNode) {
          audioElementRef.current.parentNode.removeChild(audioElementRef.current);
        }
        audioElementRef.current = null;
      }
      
      // Reset state immediately
      setConnectionStatus('disconnected');
      setAssistantMode('idle');
      setCurrentTool(null);
      setSessionInfo(prev => ({ ...prev, startTime: null }));
      setConnectionError(null);
      
      console.log('🛑 Force stop completed - all connections closed and microphone released');
      addRecentEvent('force_stop_completed');
      
    } catch (error) {
      console.error('Error during force stop:', error);
    }
  }, [addRecentEvent]);

  return {
    checkMicrophonePermission,
    connectionStatus,
    sessionInfo,
    recentEvents,
    startVoiceChat,
    disconnect,
    forceStop, // Emergency stop function
    isConnecting,
    connectionError,
    assistantMode,
    currentTool,
    lastToolExecution, // Tool execution transparency
    updateWakePhrase,
    startWakePhraseDetection,
    stopWakePhraseDetection,
    wakePhraseActive: false,
    sendTextMessage,
    updateVoice,
    voiceIntensity: 0,
    // Transcript features
    conversationTranscripts,
    currentUserTranscript,
    currentAssistantTranscript,
    clearTranscripts: () => setConversationTranscripts([])
  };
}