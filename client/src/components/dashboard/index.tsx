import React from "react";
import { ClockWidget } from "./clock-widget";
import { WeatherWidget } from "./weather-widget";
import { CalendarWidget } from "./calendar-widget";
import { AIAssistantWidget } from "./ai-assistant-widget";
import { RealtimeWidget } from "./realtime-widget";
import { Settings, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export const Dashboard: React.FC = () => {
  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <header className="mb-8 flex flex-col md:flex-row justify-between items-center">
        <h1 className="text-3xl font-bold mb-2 md:mb-0">My Dashboard</h1>
        <div className="flex items-center space-x-4">
          <Button variant="ghost" className="bg-white/70 hover:bg-white/90 transition-colors">
            <Settings className="h-5 w-5 mr-2 text-accent" />
            Settings
          </Button>
          <Avatar>
            <AvatarImage src="https://github.com/shadcn.png" />
            <AvatarFallback>U</AvatarFallback>
          </Avatar>
        </div>
      </header>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <ClockWidget />
        <WeatherWidget />
        <CalendarWidget />
        <AIAssistantWidget />
        <RealtimeWidget />
      </div>
    </div>
  );
};

export default Dashboard;
