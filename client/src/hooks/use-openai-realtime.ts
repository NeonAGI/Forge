import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface SessionInfo {
  voice: string;
  language: string;
  model: string;
  connectionType: string;
  startTime: string | null;
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
    startTime: null
  });
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
      
      // Create new WebRTC peer connection
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
      });
      
      // Set up audio element for playback
      const audio = new Audio();
      audio.autoplay = true;
      setAudioElement(audio);
      
      // Handle incoming audio tracks
      pc.ontrack = (event) => {
        if (audio) {
          audio.srcObject = event.streams[0];
        }
      };
      
      // Add event handlers
      pc.onicecandidate = async (event) => {
        if (event.candidate) {
          // Send ICE candidate to server
          await apiRequest("POST", `/api/realtime/ice`, {
            sessionId,
            candidate: event.candidate
          });
        }
      };
      
      // Setup data channel for JSON messages
      const channel = pc.createDataChannel("json");
      setDataChannel(channel);
      
      channel.onopen = () => {
        console.log("Data channel opened");
        setConnectionStatus('connected');
        
        // Record session start time
        setSessionInfo(prev => ({
          ...prev,
          startTime: '1 minute ago' // In a real app, store the actual time
        }));
        
        // Add a connection event
        addRecentEvent("session.created");
      };
      
      channel.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          console.log("Received message:", message);
          
          // Handle different types of messages from the server
          if (message.type === 'session.updated') {
            // Update session info
          } else if (message.type === 'response.done') {
            addRecentEvent("response.done");
          } else if (message.type === 'conversation.item.created') {
            addRecentEvent("conversation.item.created");
          }
        } catch (err) {
          console.error("Error parsing message:", err);
        }
      };
      
      channel.onclose = () => {
        console.log("Data channel closed");
        setConnectionStatus('disconnected');
      };
      
      // Add local audio track
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
      } catch (err) {
        throw new Error("Microphone access denied. Please allow microphone access to use voice chat.");
      }
      
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
      
    } catch (err) {
      console.error("Error starting voice chat:", err);
      setConnectionError(err.message || "Failed to connect to OpenAI Realtime");
      setConnectionStatus('disconnected');
      setIsConnecting(false);
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
  
  // Clean up resources on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);
  
  return {
    connectionStatus,
    sessionInfo,
    recentEvents,
    startVoiceChat,
    disconnect,
    isConnecting,
    connectionError
  };
}
