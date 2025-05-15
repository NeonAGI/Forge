import React, { useState } from "react";
import { ClockWidget } from "./clock-widget";
import { WeatherWidget } from "./weather-widget";
import { CalendarWidget } from "./calendar-widget";
import { AIAssistantWidget } from "./ai-assistant-widget";
import { RealtimeWidget } from "./realtime-widget";
import { Settings, User, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Dashboard: React.FC = () => {
  const [isListening, setIsListening] = useState(false);

  // For the AI Orb visual component
  const toggleListening = () => {
    setIsListening(!isListening);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl min-h-screen">
      {/* Animated background gradient overlay */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-64 bg-gradient-to-b from-black/40 to-transparent"></div>
        <div className="absolute bottom-0 left-0 w-full h-64 bg-gradient-to-t from-black/40 to-transparent"></div>
      </div>
      
      <header className="mb-8 flex flex-col md:flex-row justify-between items-center relative z-10">
        <h1 className="text-3xl font-bold mb-2 md:mb-0 bg-clip-text text-transparent bg-gradient-to-r from-[#f1f5fa] to-[#a0aec0]">
          My Dashboard
        </h1>
        <div className="flex items-center space-x-4">
          <Button variant="ghost" className="bg-primary/40 hover:bg-primary/60 backdrop-blur-lg transition-colors">
            <Settings className="h-5 w-5 mr-2 text-accent" />
            Settings
          </Button>
          <Avatar className="border-2 border-accent/30">
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback className="bg-primary/60 text-text">U</AvatarFallback>
          </Avatar>
        </div>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 relative z-10">
        <ClockWidget />
        <WeatherWidget />
        <CalendarWidget />
        <AIAssistantWidget />
        <RealtimeWidget />
      </div>
      
      {/* AI Voice Orb */}
      <div 
        className={`orb ${isListening ? 'listening' : 'idle'}`}
        onClick={toggleListening}
        role="button"
        aria-label="Toggle voice assistant"
      >
        <div className="orb-inner"></div>
        <Mic className={`absolute h-5 w-5 text-white ${isListening ? 'opacity-100' : 'opacity-30'}`} />
      </div>
    </div>
  );
};

export default Dashboard;
