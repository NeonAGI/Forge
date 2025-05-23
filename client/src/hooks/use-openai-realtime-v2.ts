import { useState, useRef, useCallback } from "react";

// Constants
const MODEL = 'gpt-4o-realtime-preview-2024-12-17';

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

export function useOpenAIRealtimeV2() {
  // State management
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isConnecting, setIsConnecting] = useState(false);
  const [assistantMode, setAssistantMode] = useState<AssistantMode>('idle');
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [recentEvents, setRecentEvents] = useState<RealtimeEvent[]>([]);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({
    voice: 'alloy',
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

  // Helper to add events with timestamps
  const addRecentEvent = useCallback((name: string) => {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    setRecentEvents(prev => {
      const newEvents = [{ name, time: timeString }, ...prev];
      return newEvents.slice(0, 10);
    });
  }, []);

  // Initialize WebRTC session
  const startVoiceChat = useCallback(async () => {
    setIsConnecting(true);
    setConnectionError(null);
    setAssistantMode('processing');
    
    try {
      // Ensure audio context is initialized
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
      }
      
      // Fetch ephemeral token
      console.log('Fetching ephemeral token...');
      const tokenResponse = await fetch('/api/session');
      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        throw new Error(errorData.error || 'Failed to get ephemeral token');
      }
      
      const data = await tokenResponse.json();
      const ephemeralKey = data.client_secret.value;
      
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
      
      // Request microphone access
      console.log('Requesting microphone access...');
      localStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Add local audio track to peer connection
      localStreamRef.current.getAudioTracks().forEach(track => {
        peerConnection.addTrack(track, localStreamRef.current!);
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
        console.error('Data channel error:', error);
        setConnectionError('Data channel error occurred');
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
    
    // Define available functions for the model to call
    const weatherFunction = {
      type: 'function',
      name: 'get_weather',
      description: 'Get the current weather for a specific location',
      parameters: {
        type: 'object',
        properties: {
          location: {
            type: 'string',
            description: 'The city and state or country (e.g., "San Francisco, CA")'
          },
          unit: {
            type: 'string',
            enum: ['celsius', 'fahrenheit'],
            description: 'The unit of temperature'
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
    
    // Configure semantic VAD for better turn detection
    const sessionConfig = {
      type: 'session.update',
      session: {
        instructions: "You are a helpful voice assistant. Be concise in your responses. You can help users with weather information and telling the current time in different timezones.",
        tools: [weatherFunction, timeFunction],
        tool_choice: 'auto',
        turn_detection: {
          type: 'semantic_vad',
          eagerness: 'medium',
          create_response: true,
          interrupt_response: true
        }
      }
    };
    
    // Send session configuration
    sendEvent(sessionConfig);
    addRecentEvent("session.configured");
  }, [addRecentEvent]);

  // Handle server events coming from the data channel
  const handleServerEvent = useCallback((event: MessageEvent) => {
    try {
      const serverEvent = JSON.parse(event.data);
      
      // Handle different event types
      switch (serverEvent.type) {
        case 'input_audio_buffer.speech_started':
          setAssistantMode('listening');
          addRecentEvent('speech_started');
          break;
          
        case 'input_audio_buffer.speech_stopped':
          setAssistantMode('processing');
          addRecentEvent('speech_stopped');
          break;
          
        case 'response.audio.delta':
          setAssistantMode('speaking');
          addRecentEvent('audio_response');
          break;
          
        case 'response.done':
          setAssistantMode('listening');
          addRecentEvent('response_completed');
          break;
          
        case 'error':
          console.error('Server error:', serverEvent.message);
          setConnectionError(`Server error: ${serverEvent.message}`);
          addRecentEvent('error');
          break;
          
        default:
          addRecentEvent(serverEvent.type);
          break;
      }
    } catch (error) {
      console.error('Error handling server event:', error);
    }
  }, [addRecentEvent]);

  // Helper to send events through the data channel
  const sendEvent = useCallback((event: any) => {
    if (dataChannelRef.current && dataChannelRef.current.readyState === 'open') {
      dataChannelRef.current.send(JSON.stringify(event));
    } else {
      console.error('Cannot send event - data channel not open');
    }
  }, []);

  // Disconnect session and clean up resources
  const disconnect = useCallback(() => {
    try {
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
      setSessionInfo(prev => ({ ...prev, startTime: null }));
      setConnectionError(null);
      
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

  const updateVoice = useCallback((newVoice: string) => {
    setSessionInfo(prev => ({ ...prev, voice: newVoice }));
  }, []);

  return {
    connectionStatus,
    sessionInfo,
    recentEvents,
    startVoiceChat,
    disconnect,
    isConnecting,
    connectionError,
    assistantMode,
    updateWakePhrase,
    startWakePhraseDetection,
    stopWakePhraseDetection,
    wakePhraseActive: false,
    sendTextMessage,
    updateVoice,
    voiceIntensity: 0
  };
}