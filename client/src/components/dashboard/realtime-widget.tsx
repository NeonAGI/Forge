import React from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Mic, CreditCard } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useOpenAIRealtime } from "@/hooks/use-openai-realtime";
import { Badge } from "@/components/ui/badge";

export const RealtimeWidget: React.FC = () => {
  const { 
    connectionStatus, 
    sessionInfo, 
    recentEvents,
    startVoiceChat,
    isConnecting,
    connectionError
  } = useOpenAIRealtime();

  return (
    <GlassCard 
      title="OpenAI Realtime" 
      className="col-span-1 xl:col-span-2"
      animationDelay={0.4}
      headerContent={
        <div className="flex items-center">
          <span className={`h-2 w-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500 pulse-dot' : 'bg-gray-400'} mr-2`}></span>
          <span className="text-xs text-accent">{connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}</span>
        </div>
      }
    >
      <div className="mb-4">
        <div className="text-sm font-medium mb-2">Voice Input/Output</div>
        <div className="flex flex-wrap gap-3">
          <Button 
            className="bg-white/50 hover:bg-white/70 transition flex items-center" 
            onClick={startVoiceChat}
            disabled={isConnecting || connectionStatus === 'connected'}
          >
            <Mic className="h-5 w-5 mr-2 text-accent" />
            {isConnecting ? 'Connecting...' : 'Start Voice Chat'}
          </Button>
          <Button className="bg-white/50 hover:bg-white/70 transition flex items-center">
            <CreditCard className="h-5 w-5 mr-2 text-accent" />
            Voice Settings
          </Button>
        </div>
        
        {connectionError && (
          <div className="mt-2 text-sm text-destructive">
            {connectionError}
          </div>
        )}
      </div>
      
      <div className="bg-white/50 rounded-xl p-4">
        <div className="flex justify-between items-center mb-3">
          <div className="text-sm font-medium">Current Session</div>
          {sessionInfo.startTime && (
            <div className="text-xs text-accent">
              Started {sessionInfo.startTime}
            </div>
          )}
        </div>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span>Voice</span>
            <span className="font-medium">{sessionInfo.voice || 'Not set'}</span>
          </div>
          <div className="flex justify-between">
            <span>Language</span>
            <span className="font-medium">{sessionInfo.language || 'English (US)'}</span>
          </div>
          <div className="flex justify-between">
            <span>Model</span>
            <span className="font-medium">{sessionInfo.model || 'gpt-4o-realtime-preview'}</span>
          </div>
          <div className="flex justify-between">
            <span>Connection</span>
            <Badge variant="outline" className={connectionStatus === 'connected' ? 'text-green-500' : 'text-gray-500'}>
              {sessionInfo.connectionType || 'WebRTC'}
            </Badge>
          </div>
        </div>
        
        {recentEvents.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200 border-opacity-50">
            <div className="text-xs text-accent mb-2">Recent API Activity</div>
            <div className="text-xs space-y-2">
              {recentEvents.map((event, index) => (
                <div key={index} className="flex items-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-green-500" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span>{event.name} ({event.time})</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
};
