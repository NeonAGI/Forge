import React, { useState, useRef, useEffect } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Mic, Send, Settings } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useOpenAI } from "@/hooks/use-openai";
import { cn } from "@/lib/utils";

interface MessageProps {
  role: "assistant" | "user";
  content: string;
}

const Message: React.FC<MessageProps> = ({ role, content }) => {
  const isUser = role === "user";
  
  return (
    <div className={`flex items-start ${isUser ? "flex-row-reverse" : ""}`}>
      <div 
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-medium",
          isUser ? "bg-gray-200 text-gray-700" : "bg-blue-500"
        )}
      >
        {isUser ? "You" : "AI"}
      </div>
      <div 
        className={cn(
          "px-4 py-2 max-w-[85%]",
          isUser 
            ? "mr-3 bg-accent text-white rounded-lg rounded-tr-none" 
            : "ml-3 bg-white rounded-lg rounded-tl-none"
        )}
      >
        <p>{content}</p>
      </div>
    </div>
  );
};

export const AIAssistantWidget: React.FC = () => {
  const [inputValue, setInputValue] = useState("");
  const [isListening, setIsListening] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { 
    messages, 
    sendMessage, 
    isProcessing, 
    startVoiceInput, 
    stopVoiceInput,
    voiceInputError
  } = useOpenAI();

  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSendMessage = () => {
    if (inputValue.trim() && !isProcessing) {
      sendMessage(inputValue);
      setInputValue("");
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      stopVoiceInput();
      setIsListening(false);
    } else {
      startVoiceInput((transcript: string) => {
        setInputValue(transcript);
      });
      setIsListening(true);
    }
  };

  return (
    <GlassCard 
      title="AI Assistant" 
      className="col-span-1 lg:col-span-3 xl:col-span-2"
      animationDelay={0.3}
      headerContent={
        <div className="flex space-x-2">
          <Button
            variant="ghost"
            size="icon"
            className={cn(
              "text-accent hover:text-text p-1 rounded-full hover:bg-white/30 transition",
              isListening && "bg-blue-100 text-blue-500"
            )}
            onClick={toggleVoiceInput}
          >
            <Mic className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-accent hover:text-text p-1 rounded-full hover:bg-white/30 transition"
          >
            <Settings className="h-5 w-5" />
          </Button>
        </div>
      }
    >
      <div 
        ref={containerRef}
        className="bg-white/50 rounded-xl p-4 h-64 overflow-y-auto mb-4"
      >
        <div className="space-y-4">
          {messages.map((message, index) => (
            <Message 
              key={index} 
              role={message.role} 
              content={message.content}
            />
          ))}
          {isProcessing && (
            <div className="flex items-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white font-medium">
                AI
              </div>
              <div className="ml-3 bg-white rounded-lg rounded-tl-none px-4 py-2 max-w-[85%]">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: "0.3s" }}></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
      
      <div className="relative">
        <Textarea
          id="userInput"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyPress}
          rows={2}
          placeholder="Type your message..."
          className="w-full px-4 py-3 pr-12 rounded-xl resize-none bg-white/50 focus:bg-white/70 focus:outline-none focus:ring-2 focus:ring-blue-300 placeholder-gray-400"
        />
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-3 bottom-3 text-blue-500 hover:text-blue-600 transition"
          onClick={handleSendMessage}
          disabled={isProcessing || !inputValue.trim()}
        >
          <Send className="h-6 w-6" />
        </Button>
      </div>
      
      {isListening && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-blue-500 bg-opacity-10 text-blue-500">
            <div className="flex space-x-1 mr-2">
              <div className="w-1 h-4 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: "0.1s" }}></div>
              <div className="w-1 h-6 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: "0.2s" }}></div>
              <div className="w-1 h-8 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: "0.3s" }}></div>
              <div className="w-1 h-6 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: "0.4s" }}></div>
              <div className="w-1 h-4 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: "0.5s" }}></div>
            </div>
            Listening...
          </div>
        </div>
      )}
      
      {voiceInputError && (
        <div className="mt-2 text-center text-destructive text-sm">
          {voiceInputError}
        </div>
      )}
    </GlassCard>
  );
};
