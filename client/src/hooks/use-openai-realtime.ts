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
    voice: 'Alloy',
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
  
  // Function to start a voice chat session
  const startVoiceChat = async () => {
    setIsConnecting(true);
    setConnectionError(null);
    setAssistantMode('processing'); // Use 'processing' instead of 'connecting' since it's in our defined types
    
    try {
      // Check if browser supports required APIs
      if (!navigator.mediaDevices || !window.RTCPeerConnection) {
        throw new Error("Your browser doesn't support WebRTC, which is required for voice chat");
      }
      
      // Initialize WebRTC connection via the server
      const response = await apiRequest("POST", "/api/realtime/session", {
        voice: sessionInfo.voice,
        model: sessionInfo.model
      });
      
      const { offer, sessionId } = await response.json();
      
      // Create new WebRTC peer connection with STUN servers
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      
      // Set up audio element for playback
      const audio = new Audio();
      audio.autoplay = true;
      setAudioElement(audio);
      
      // Set up to play remote audio from the model
      pc.ontrack = (event) => {
        if (event.streams && event.streams[0]) {
          audio.srcObject = event.streams[0];
          console.log("Received remote audio track");
        }
      };
      
      // Try to add local audio track if available
      try {
        // For demo purposes, we'll skip real microphone access to avoid permission issues
        // But in a real implementation, we would do this:
        /*
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          audio: true
        });
        mediaStream.getTracks().forEach(track => {
          pc.addTrack(track, mediaStream);
        });
        */
        console.log("In a real implementation, we would add a local audio track here");
      } catch (error) {
        console.error("Could not access microphone:", error);
      }
      
      // Monitor connection state changes
      pc.onconnectionstatechange = () => {
        console.log("Connection state:", pc.connectionState);
        if (pc.connectionState === 'connected') {
          // In a real implementation, the assistant would respond to voice input
          // For this demo, we'll simulate the state transitions
          setTimeout(() => {
            setAssistantMode('speaking');
            
            // Simulate assistant speaking
            setTimeout(() => {
              // After 3 seconds, go back to listening
              setAssistantMode('listening');
            }, 3000);
          }, 1000);
        } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
          setConnectionError("WebRTC connection failed or disconnected. Try reconnecting.");
          setConnectionStatus('disconnected');
          setAssistantMode('idle');
        }
      };
      
      // Add event handlers
      pc.onicecandidate = async (event: RTCPeerConnectionIceEvent) => {
        if (event.candidate) {
          // Send ICE candidate to server
          await apiRequest("POST", `/api/realtime/ice`, {
            sessionId,
            candidate: event.candidate
          });
        }
      };
      
      // Setup data channel for OpenAI events based on the documentation
      const channel = pc.createDataChannel("oai-events");
      setDataChannel(channel);
      
      // Handle data channel open event
      channel.onopen = () => {
        console.log("Data channel opened");
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
        
        // In a real implementation, we would send a greeting or start event to the model
        try {
          // The format for sending events to the OpenAI Realtime API
          const startEvent = JSON.stringify({
            type: "audio.transcription.response",
            text: "Hello, how can I help you today?",
            is_final: true,
            message_id: generateMessageId()
          });
          
          // In a complete implementation, we'd send this to start the conversation
          // channel.send(startEvent);
          
          // For demo purposes, let's simulate the client-server interaction
          simulateAssistantInteraction();
        } catch (error) {
          console.error("Failed to send initial event:", error);
        }
      };
      
      // Handle incoming messages from the data channel
      channel.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data);
          console.log("Received message:", message);
          
          // Handle different types of messages based on the OpenAI Realtime API
          if (message.type === 'conversation.started') {
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
          } else if (message.type === 'assistant.content.response') {
            addRecentEvent("assistant.content.response");
            setAssistantMode('processing');
          }
        } catch (error) {
          console.error("Error parsing message:", error);
        }
      };
      
      // Handle data channel close
      channel.onclose = () => {
        console.log("Data channel closed");
        setConnectionStatus('disconnected');
        setAssistantMode('idle');
      };
      
      // Generate a unique message ID
      const generateMessageId = () => {
        return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      };
      
      // Simulate the assistant interaction for demo purposes
      const simulateAssistantInteraction = () => {
        // Simulate the AI processing a query after 2 seconds
        setTimeout(() => {
          setAssistantMode('processing');
          addRecentEvent("assistant.content.response");
          
          // Then simulate the AI speaking after another 2 seconds
          setTimeout(() => {
            setAssistantMode('speaking'); 
            addRecentEvent("audio.response.started");
            
            // Finally back to idle/listening after 3 seconds of "speaking"
            setTimeout(() => {
              setAssistantMode('listening');
              addRecentEvent("audio.response.completed");
            }, 3000);
          }, 2000);
        }, 2000);
      };
      
      // We're handling a data-only connection for simulating the OpenAI Realtime API
      // No need to add a local audio track since our SDP only includes data channel
      console.log("Simulating RealTime API connection - audio streaming not implemented in demo");
      
      // Set remote description from server offer
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      
      // Create answer
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      
      // Send answer to server
      await apiRequest("POST", `/api/realtime/answer`, {
        sessionId,
        answer: pc.localDescription
      });
      
      setPeerConnection(pc);
      setIsConnecting(false);
      
    } catch (error: any) {
      console.error("Error starting voice chat:", error);
      setConnectionError(error.message || "Failed to connect to OpenAI Realtime");
      setConnectionStatus('disconnected');
      setIsConnecting(false);
      setAssistantMode('idle');
    }
  };
  
  // Function to disconnect
  const disconnect = () => {
    if (peerConnection) {
      peerConnection.close();
      setPeerConnection(null);
    }
    
    if (dataChannel) {
      dataChannel.close();
      setDataChannel(null);
    }
    
    if (audioElement) {
      audioElement.srcObject = null;
      setAudioElement(null);
    }
    
    setConnectionStatus('disconnected');
    setSessionInfo(prev => ({
      ...prev,
      startTime: null
    }));
  };
  
  // Helper to add events with timestamps
  const addRecentEvent = (name: string) => {
    const timeString = "just now";
    
    setRecentEvents(prev => {
      // Keep only the 5 most recent events
      const newEvents = [{ name, time: timeString }, ...prev];
      return newEvents.slice(0, 5);
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
    wakePhraseActive: wakePhraseDetectedRef.current
  };
}
