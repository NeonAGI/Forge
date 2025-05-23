import React, { useState, useRef, useEffect } from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Mic, Send, Settings, MessageSquare } from "lucide-react";
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
      {/* Avatar with glow effect */}
      <div 
        className={cn(
          "flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-white font-medium relative",
          isUser 
            ? "bg-gradient-to-br from-accent to-accent/70" 
            : "bg-gradient-to-br from-accent-alt to-accent-alt/70"
        )}
      >
        {/* Glow effect */}
        <div className={cn(
          "absolute inset-0 rounded-full blur-sm -z-10 opacity-60",
          isUser 
            ? "bg-accent" 
            : "bg-accent-alt"
        )}></div>
        {isUser ? "You" : "AI"}
      </div>
      
      {/* Message bubble with glass effect */}
      <div 
        className={cn(
          "px-4 py-2 max-w-[85%] backdrop-blur-sm",
          isUser 
            ? "mr-3 bg-accent/30 text-white rounded-lg rounded-tr-none border border-accent/30" 
            : "ml-3 bg-accent-alt/20 text-text rounded-lg rounded-tl-none border border-accent-alt/30"
        )}
      >
        <p className={isUser ? "text-white" : "text-text"}>{content}</p>
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
      className="col-span-1 lg:col-span-3 xl:col-span-2 glass-glow overflow-hidden"
      animationDelay={0.3}
      headerContent={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center">
            <MessageSquare className="h-4 w-4 text-accent mr-2" />
            <span className="text-sm font-medium text-text-muted">AI Assistant</span>
          </div>
          <div className="flex space-x-2">
            <Button
              variant="ghost"
              size="icon"
              className={cn(
                "text-accent hover:bg-white/10 p-1 rounded-full transition-colors",
                isListening && "bg-accent/20 text-accent"
              )}
              onClick={toggleVoiceInput}
            >
              <Mic className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="text-accent hover:bg-white/10 p-1 rounded-full transition-colors"
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </div>
      }
    >
      {/* Ambient background for chat area */}
      <div className="relative mb-4">
        <div className="absolute inset-0 bg-gradient-to-b from-accent/5 to-transparent pointer-events-none rounded-xl"></div>
        <div 
          ref={containerRef}
          className="bg-primary/40 rounded-xl p-4 h-72 overflow-y-auto backdrop-blur-md border border-border/20 relative"
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
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gradient-to-br from-accent-alt to-accent-alt/70 flex items-center justify-center text-white font-medium relative">
                  <div className="absolute inset-0 rounded-full blur-sm -z-10 opacity-60 bg-accent-alt"></div>
                  AI
                </div>
                <div className="ml-3 bg-accent-alt/20 rounded-lg rounded-tl-none px-4 py-2 max-w-[85%] border border-accent-alt/30 backdrop-blur-sm">
                  <div className="flex space-x-1">
                    <div className="w-2 h-2 bg-accent-alt rounded-full animate-bounce" style={{ animationDelay: "0.1s" }}></div>
                    <div className="w-2 h-2 bg-accent-alt rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                    <div className="w-2 h-2 bg-accent-alt rounded-full animate-bounce" style={{ animationDelay: "0.3s" }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>
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
          className="w-full px-4 py-3 pr-12 rounded-xl resize-none bg-primary/60 focus:bg-primary/70 focus:outline-none focus:ring-1 focus:ring-accent border border-border/20 placeholder-text-muted text-text"
        />
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-3 bottom-3 text-accent hover:text-accent-foreground transition-colors p-1 rounded-full hover:bg-white/10"
          onClick={handleSendMessage}
          disabled={isProcessing || !inputValue.trim()}
        >
          <Send className="h-5 w-5" />
        </Button>
      </div>
      
      {isListening && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center px-4 py-2 rounded-full bg-accent/20 text-accent">
            <div className="flex space-x-1 mr-2">
              <div className="w-1 h-4 bg-accent rounded-full animate-pulse" style={{ animationDelay: "0.1s" }}></div>
              <div className="w-1 h-6 bg-accent rounded-full animate-pulse" style={{ animationDelay: "0.2s" }}></div>
              <div className="w-1 h-8 bg-accent rounded-full animate-pulse" style={{ animationDelay: "0.3s" }}></div>
              <div className="w-1 h-6 bg-accent rounded-full animate-pulse" style={{ animationDelay: "0.4s" }}></div>
              <div className="w-1 h-4 bg-accent rounded-full animate-pulse" style={{ animationDelay: "0.5s" }}></div>
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
