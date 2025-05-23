import { useState, useEffect, useRef } from "react";
import { apiRequest } from "@/lib/queryClient";

// Define SpeechRecognition interface for TypeScript
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  readonly isFinal: boolean;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  start(): void;
  stop(): void;
}

// Add global interface extensions for browser compatibility
declare global {
  interface Window {
    SpeechRecognition?: {
      new(): SpeechRecognition;
    };
    webkitSpeechRecognition?: {
      new(): SpeechRecognition;
    };
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

export function useOpenAIRealtime() {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [isConnecting, setIsConnecting] = useState(false);
  const [sessionInfo, setSessionInfo] = useState<SessionInfo>({
    voice: 'alloy',
    language: 'English (US)',
    model: 'gpt-4o-realtime-preview',
    connectionType: 'WebRTC',
    startTime: null,
    wakePhrase: 'Hey Assistant'
  });
  
  const [assistantMode, setAssistantMode] = useState<AssistantMode>('idle');
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const wakePhraseDetectedRef = useRef<boolean>(false);
  const [recentEvents, setRecentEvents] = useState<RealtimeEvent[]>([]);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  
  // WebRTC connection references
  const [peerConnection, setPeerConnection] = useState<RTCPeerConnection | null>(null);
  const [dataChannel, setDataChannel] = useState<RTCDataChannel | null>(null);
  const [audioElement, setAudioElement] = useState<HTMLAudioElement | null>(null);
  
  // --- ADD REFS FOR AUDIOCONTEXT AND LOCALSTREAM ---
  const audioContextRef = useRef<AudioContext | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const [voiceIntensity, setVoiceIntensity] = useState(0);
  
  // Function to start a voice chat session
  const startVoiceChat = async () => {
    setIsConnecting(true);
    setConnectionError(null);
    setAssistantMode('processing');
    
    // --- CLEANUP PREVIOUS CONNECTIONS ---
    disconnect();
    
    try {
      if (!navigator.mediaDevices || !window.RTCPeerConnection) {
        throw new Error("Your browser doesn't support WebRTC, which is required for voice chat");
      }
      
      console.log("Initializing WebRTC connection to OpenAI Realtime API...");
      
      // --- AUDIOCONTEXT SETUP ---
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }
      
      // --- FETCH SESSION TOKEN ---
      const response = await apiRequest("POST", "/api/realtime/session", {
        voice: sessionInfo.voice.toLowerCase(),
        model: sessionInfo.model
      });
      
      console.log("Session request response received, status:", response.status);
      
      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (parseError) {
          throw new Error(`Server error ${response.status}: ${response.statusText}. Unable to parse error details.`);
        }
        
        // Provide specific error messages based on the error type
        if (response.status === 500 && errorData.error) {
          if (errorData.error.includes('API key')) {
            throw new Error("❌ OpenAI API key is missing or invalid. Please configure your API key in Settings → API Keys.");
          } else if (errorData.error.includes('realtime')) {
            throw new Error("❌ OpenAI Realtime API access error. Check your API key permissions and billing status.");
          } else {
            throw new Error(`❌ Server configuration error: ${errorData.error}`);
          }
        }
        
        throw new Error(errorData.error || `Server returned ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("Session data received:", data);
      
      if (data.error) {
        if (data.error.includes('API key')) {
          throw new Error("OpenAI API key is missing or invalid. Please check server configuration.");
        } else {
          throw new Error(data.error);
        }
      }
      
      const { sessionId, ephemeralToken, sessionDetails } = data;
      
      if (!sessionId || !ephemeralToken) {
        throw new Error("Invalid session data received from server. Missing required fields.");
      }
      
      console.log(`Received session ID: ${sessionId} with ephemeral token`);
      
      // Update session info with details from the server
      if (sessionDetails) {
        setSessionInfo(prev => ({
          ...prev,
          voice: sessionDetails.voice || prev.voice,
          model: sessionDetails.model || prev.model
        }));
      }
      
      // Create new WebRTC peer connection with STUN servers
      const pc = new RTCPeerConnection({
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' },
          { urls: 'stun:stun2.l.google.com:19302' },
          { urls: 'stun:stun3.l.google.com:19302' }
        ]
      });
      
      console.log("RTCPeerConnection created with multiple STUN servers");
      
      // Set up audio element for playback
      let audio = new Audio();
      audio.autoplay = true;
      audio.volume = 1.0;
      document.body.appendChild(audio);
      setAudioElement(audio);
      
      // Set up to play remote audio from the model
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          const audioStream = new MediaStream();
          event.streams[0].getAudioTracks().forEach(track => audioStream.addTrack(track));
          audio.srcObject = audioStream;
          audio.play().catch(() => {
            // Fallback: connect to AudioContext
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
      
      // Add local audio track for microphone input
      try {
        console.log("Requesting microphone access...");
        const mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = mediaStream;
        mediaStream.getTracks().forEach(track => pc.addTrack(track, mediaStream));
        // --- SETUP ANALYSER FOR VOICE INTENSITY ---
        if (audioContextRef.current) {
          const source = audioContextRef.current.createMediaStreamSource(mediaStream);
          const analyser = audioContextRef.current.createAnalyser();
          analyser.fftSize = 256;
          source.connect(analyser);
          analyserRef.current = analyser;
          // Animation loop
          const dataArray = new Uint8Array(analyser.frequencyBinCount);
          const update = () => {
            analyser.getByteTimeDomainData(dataArray);
            // Calculate RMS (root mean square) for intensity
            let sum = 0;
            for (let i = 0; i < dataArray.length; i++) {
              const val = (dataArray[i] - 128) / 128;
              sum += val * val;
            }
            const rms = Math.sqrt(sum / dataArray.length);
            setVoiceIntensity(rms); // 0 (silent) to ~1 (loud)
            animationFrameRef.current = requestAnimationFrame(update);
          };
          update();
        }
      } catch (error) {
        console.error("Could not access microphone:", error);
        throw new Error("Microphone access is required for voice chat. Please allow microphone permissions.");
      }
      
      // Setup event listeners for connection state changes
      pc.onconnectionstatechange = () => {
        console.log("Connection state changed:", pc.connectionState);
        if (pc.connectionState === 'connected') {
          console.log("WebRTC connection established successfully!");
          setConnectionStatus('connected');
          setAssistantMode('listening');
          
          // Record session start time
          const now = new Date();
          const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
          
          setSessionInfo(prev => ({
            ...prev,
            startTime: formattedTime
          }));
          
          // Add a connection event
          addRecentEvent("session.created");
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          console.error("WebRTC connection failed or disconnected:", pc.connectionState);
          setConnectionError(`WebRTC connection failed or disconnected: ${pc.connectionState}. Try reconnecting.`);
          setConnectionStatus('disconnected');
          setAssistantMode('idle');
        }
      };
      
      // Monitor ICE connection state
      pc.oniceconnectionstatechange = () => {
        console.log("ICE connection state:", pc.iceConnectionState);
        if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
          console.error("ICE connection failed or disconnected:", pc.iceConnectionState);
          setConnectionError(`ICE connection state: ${pc.iceConnectionState}. Check your network connection.`);
        }
      };
      
      // Other event handlers...
      pc.onsignalingstatechange = () => {
        console.log("Signaling state:", pc.signalingState);
      };
      
      pc.onicegatheringstatechange = () => {
        console.log("ICE gathering state:", pc.iceGatheringState);
      };
      
      // Create data channel for communication
      console.log("Creating data channel");
      const channel = pc.createDataChannel("oai-events", {
        ordered: true,
      });
      setDataChannel(channel);
      
      // Handle data channel events
      channel.onopen = () => {
        console.log("Data channel opened successfully");
        setConnectionStatus('connected');
        setAssistantMode('listening');
        
        // --- SEND DETAILED SESSION CONFIG ---
        const weatherFunction = {
          type: 'function',
          name: 'get_weather',
          description: 'Get the current weather for a specific location',
          parameters: {
            type: 'object',
            properties: {
              location: { type: 'string', description: 'The city and state or country (e.g., "San Francisco, CA")' },
              unit: { type: 'string', enum: ['celsius', 'fahrenheit'], description: 'The unit of temperature' }
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
              timezone: { type: 'string', description: 'The timezone (e.g., "America/New_York")', enum: [ 'America/New_York', 'America/Los_Angeles', 'Europe/London', 'Asia/Tokyo', 'Australia/Sydney' ] }
            },
            required: ['timezone']
          }
        };
        const sessionConfig = {
          type: 'session.update',
          session: {
            instructions: 'You are a helpful voice assistant. Be concise in your responses. You can help users with weather information and telling the current time in different timezones.',
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
        channel.send(JSON.stringify(sessionConfig));
      };
      
      channel.onerror = (error) => {
        console.error("Data channel error:", error);
        setConnectionError(`Data channel error: ${error}`);
      };
      
      channel.onclose = () => {
        console.log("Data channel closed");
        setConnectionStatus('disconnected');
        setAssistantMode('idle');
      };
      
      channel.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          console.log("Received message from OpenAI:", message);
          
          // Handle different message types...
          // (existing message handling code)
          if (message.type === 'session.created') {
            addRecentEvent("session.created");
          } else if (message.type === 'session.updated') {
            addRecentEvent("session.updated");
          } else if (message.type === 'conversation.started') {
            addRecentEvent("conversation.started");
          } else if (message.type === 'conversation.completed') {
            addRecentEvent("conversation.completed");
            setAssistantMode('idle');
          } else if (message.type === 'audio.response.started') {
            addRecentEvent("audio.response.started");
            setAssistantMode('speaking');
          } else if (message.type === 'audio.response.message') {
            addRecentEvent("audio.response.message");
            setAssistantMode('speaking');
          } else if (message.type === 'audio.response.completed') {
            addRecentEvent("audio.response.completed");
            setAssistantMode('listening');
          } else if (message.type === 'audio.transcription.started') {
            addRecentEvent("audio.transcription.started");
            setAssistantMode('listening');
          } else if (message.type === 'audio.transcription.response') {
            addRecentEvent("audio.transcription.response");
          } else if (message.type === 'input_audio_buffer.speech_started') {
            addRecentEvent("input_audio_buffer.speech_started");
            setAssistantMode('listening');
          } else if (message.type === 'input_audio_buffer.speech_stopped') {
            addRecentEvent("input_audio_buffer.speech_stopped");
          } else if (message.type === 'input_audio_buffer.committed') {
            addRecentEvent("input_audio_buffer.committed");
          } else if (message.type === 'assistant.content.response') {
            addRecentEvent("assistant.content.response");
            setAssistantMode('processing');
          } else if (message.type === 'error') {
            console.error("Error from OpenAI:", message);
            addRecentEvent(`error: ${message.code || 'unknown'}`);
            setConnectionError(`OpenAI error: ${message.message || 'Unknown error'}`);
          }
        } catch (error) {
          console.error("Error parsing message:", error);
        }
      };
      
      // Create an offer to start the WebRTC connection
      console.log("Creating offer for WebRTC connection");
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      
      // Send the SDP offer directly to OpenAI using the ephemeral token
      console.log("Sending SDP offer to OpenAI");
      const baseUrl = "https://api.openai.com/v1/realtime";
      const token = typeof ephemeralToken === 'string' ? ephemeralToken : ephemeralToken.value;
      const sdpResponse = await fetch(`${baseUrl}?model=${sessionInfo.model}`, {
        method: "POST",
        body: pc.localDescription?.sdp,
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/sdp",
          "OpenAI-Beta": "realtime"
        }
      });
      
      if (!sdpResponse.ok) {
        const errorText = await sdpResponse.text();
        console.error("Failed to send SDP offer to OpenAI:", sdpResponse.status, errorText);
        throw new Error(`Failed to establish WebRTC connection: ${errorText}`);
      }
      
      // Set the answer SDP from OpenAI as the remote description
      const answerSdp = await sdpResponse.text();
      console.log("Received SDP answer from OpenAI");
      
      const answer = new RTCSessionDescription({
        type: "answer",
        sdp: answerSdp
      });
      
      await pc.setRemoteDescription(answer);
      console.log("Remote description set successfully");
      
      setPeerConnection(pc);
      setIsConnecting(false);
      console.log("Voice chat setup completed, waiting for connection to establish...");

    } catch (requestError: any) {
      console.error("Error in WebRTC setup:", requestError);
      throw new Error(`Failed to initialize WebRTC: ${requestError.message}`);
    }
  };
  
  // Function to send a text message to the AI
  const sendTextMessage = (text: string) => {
    if (!dataChannel || dataChannel.readyState !== 'open') {
      setConnectionError("Not connected to OpenAI. Please start a voice chat first.");
      return;
    }
    
    try {
      // Create a conversation item with the text message
      const createItemEvent = JSON.stringify({
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
      });
      
      // Send the message
      dataChannel.send(createItemEvent);
      
      // Request a response from the model
      const responseEvent = JSON.stringify({
        type: "response.create"
      });
      
      dataChannel.send(responseEvent);
      
      // Add an event for the sent message
      addRecentEvent(`sent: ${text.substring(0, 20)}${text.length > 20 ? '...' : ''}`);
      setAssistantMode('processing');
    } catch (error) {
      console.error("Error sending text message:", error);
      setConnectionError("Failed to send message to OpenAI");
    }
  };
  
  // Function to disconnect
  const disconnect = () => {
    if (dataChannel) {
      dataChannel.close();
      setDataChannel(null);
    }
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
    if (audioElement) {
      audioElement.pause();
      audioElement.srcObject = null;
      if (audioElement.parentNode) audioElement.parentNode.removeChild(audioElement);
      setAudioElement(null);
    }
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    // --- CLEANUP ANALYSER AND ANIMATION ---
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    analyserRef.current = null;
    setVoiceIntensity(0);
    setConnectionStatus('disconnected');
    setSessionInfo(prev => ({
      ...prev,
      startTime: null
    }));
    
    setAssistantMode('idle');
  };
  
  // Helper to add events with timestamps
  const addRecentEvent = (name: string) => {
    const now = new Date();
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    setRecentEvents(prev => {
      // Keep only the 10 most recent events
      const newEvents = [{ name, time: timeString }, ...prev];
      return newEvents.slice(0, 10);
    });
  };
  
  // Initialize wake phrase detection 
  const startWakePhraseDetection = () => {
    // Use the browser's SpeechRecognition API for wake phrase detection
    const SpeechRecognitionConstructor = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognitionConstructor) {
      console.error("Speech recognition not supported in this browser");
      return;
    }
    
    type SpeechRecognitionConstructorType = {
      new(): SpeechRecognition;
    };
    
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    
    try {
      const recognition = new (SpeechRecognitionConstructor as SpeechRecognitionConstructorType)();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US'; // Match this to user's language preference
      
      recognition.onresult = (event: SpeechRecognitionEvent) => {
        try {
          const results = Array.from({ length: event.results.length }, (_, i) => event.results[i]);
          const transcript = results
            .map(result => result[0].transcript.toLowerCase())
            .join(' ');
          
          console.log("Heard:", transcript);
          
          // Check if the wake phrase was detected
          if (transcript.includes(sessionInfo.wakePhrase.toLowerCase())) {
            console.log("Wake phrase detected!");
            wakePhraseDetectedRef.current = true;
            setAssistantMode('listening');
            addRecentEvent("wake_phrase.detected");
            
            // If already connected, start listening for the actual command
            if (connectionStatus === 'connected') {
              // The system is ready to receive the command
              // Visual feedback can be shown here
            } else {
              // If not connected, auto-connect when wake phrase is detected
              startVoiceChat();
            }
          }
        } catch (error) {
          console.error("Error processing speech recognition result:", error);
        }
      };
      
      recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
        console.error("Speech recognition error", event.error);
        // Restart if there was an error
        setTimeout(() => {
          if (recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (e) {
              console.error("Failed to restart speech recognition", e);
            }
          }
        }, 1000);
      };
      
      recognition.onend = () => {
        // Automatically restart recognition when it ends
        if (recognitionRef.current) {
          try {
            recognitionRef.current.start();
          } catch (e) {
            console.error("Failed to restart speech recognition", e);
          }
        }
      };
      
      recognitionRef.current = recognition;
      recognition.start();
      
      console.log("Wake phrase detection started");
      addRecentEvent("wake_phrase.detection.started");
      
    } catch (error) {
      console.error("Error starting wake phrase detection:", error);
    }
  };
  
  // Stop wake phrase detection
  const stopWakePhraseDetection = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
      console.log("Wake phrase detection stopped");
    }
  };
  
  // We'll now wait for user to explicitly start wake phrase detection
  // rather than auto-starting it (which many browsers block)
  useEffect(() => {
    // Only cleanup on unmount
    return () => {
      stopWakePhraseDetection();
      disconnect();
    };
  }, []);
  
  // Update the UI based on assistant mode changes
  useEffect(() => {
    // This effect can be used to trigger visual changes in the UI
    // when the assistant mode changes (idle, listening, speaking, processing)
    console.log("Assistant mode changed:", assistantMode);
    
    // If the assistant was in listening mode and now it's not, reset the wake phrase flag
    if (assistantMode !== 'listening' && wakePhraseDetectedRef.current) {
      wakePhraseDetectedRef.current = false;
    }
    
  }, [assistantMode]);
  
  // Update wake phrase
  const updateWakePhrase = (newWakePhrase: string) => {
    setSessionInfo(prev => ({
      ...prev,
      wakePhrase: newWakePhrase
    }));
    
    // If the recognition is running, restart it for the changes to take effect
    if (recognitionRef.current) {
      stopWakePhraseDetection();
      startWakePhraseDetection();
    }
  };

  // Update voice
  const updateVoice = (newVoice: string) => {
    setSessionInfo(prev => ({
      ...prev,
      voice: newVoice
    }));
  };

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
    wakePhraseActive: wakePhraseDetectedRef.current,
    sendTextMessage,
    updateVoice,
    voiceIntensity
  };
}
