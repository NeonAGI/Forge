import { useState, useEffect } from "react";
import { apiRequest } from "@/lib/queryClient";

export interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

export function useOpenAI() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: "assistant", content: "Hello! I'm your AI assistant. How can I help you today?" }
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [voiceInputError, setVoiceInputError] = useState<string | null>(null);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isProcessing) return;
    
    // Add user message to chat
    const userMessage: ChatMessage = { role: "user", content };
    setMessages(prevMessages => [...prevMessages, userMessage]);
    
    setIsProcessing(true);
    
    try {
      const response = await apiRequest("POST", "/api/assistant", { 
        message: content,
        conversationHistory: messages
      });
      
      const responseData = await response.json();
      
      // Add AI response to chat
      const assistantMessage: ChatMessage = { 
        role: "assistant", 
        content: responseData.response 
      };
      
      setMessages(prevMessages => [...prevMessages, assistantMessage]);
    } catch (error) {
      console.error("Error sending message to assistant:", error);
      // Add error message
      setMessages(prevMessages => [
        ...prevMessages, 
        { 
          role: "assistant", 
          content: "I'm sorry, I encountered an error processing your request. Please try again." 
        }
      ]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle voice input
  const startVoiceInput = (callback: (transcript: string) => void) => {
    setVoiceInputError(null);
    
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setVoiceInputError("Speech recognition is not supported in your browser.");
      return;
    }
    
    try {
      // Use the appropriate SpeechRecognition constructor
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        callback(transcript);
      };
      
      recognition.onerror = (event) => {
        setVoiceInputError(`Speech recognition error: ${event.error}`);
      };
      
      recognition.onend = () => {
        // Could automatically stop here or implement a manual stop button
      };
      
      recognition.start();
      
      // Store recognition instance in a ref or state to be able to stop it later
      (window as any).currentRecognition = recognition;
      
    } catch (error) {
      console.error("Error starting speech recognition:", error);
      setVoiceInputError("Failed to start speech recognition");
    }
  };
  
  const stopVoiceInput = () => {
    if ((window as any).currentRecognition) {
      (window as any).currentRecognition.stop();
      (window as any).currentRecognition = null;
    }
  };
  
  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopVoiceInput();
    };
  }, []);

  return {
    messages,
    sendMessage,
    isProcessing,
    startVoiceInput,
    stopVoiceInput,
    voiceInputError
  };
}

// Define SpeechRecognition interface for TypeScript
interface Window {
  SpeechRecognition?: typeof SpeechRecognition;
  webkitSpeechRecognition?: typeof SpeechRecognition;
}
