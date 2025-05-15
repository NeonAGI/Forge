import React from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Mic, Settings, Radio, Activity, CheckCircle2, Volume2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useOpenAIRealtime } from "@/hooks/use-openai-realtime";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export const RealtimeWidget: React.FC = () => {
  const { 
    connectionStatus, 
    sessionInfo, 
    recentEvents,
    startVoiceChat,
    isConnecting,
    connectionError,
    assistantMode,
    updateWakePhrase
  } = useOpenAIRealtime();
  
  const [wakePhrase, setWakePhrase] = React.useState(sessionInfo.wakePhrase);
  
  // Handle wake phrase input change
  const handleWakePhraseChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setWakePhrase(e.target.value);
  };
  
  // Save wake phrase changes
  const saveWakePhrase = () => {
    if (wakePhrase.trim()) {
      updateWakePhrase(wakePhrase);
    }
  };

  // Determine status color
  const getStatusColor = (status: string) => {
    if (status === 'connected') return 'bg-green-500 text-green-500';
    if (status === 'connecting') return 'bg-orange-500 text-orange-500';
    return 'bg-gray-500 text-gray-500';
  };
  
  const statusColor = getStatusColor(connectionStatus);

  return (
    <GlassCard 
      className="col-span-1 xl:col-span-2 glass-glow-cyan overflow-hidden"
      animationDelay={0.4}
      headerContent={
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center">
            <Radio className="h-4 w-4 text-accent-alt mr-2" />
            <span className="text-sm font-medium text-text-muted">OpenAI Realtime</span>
          </div>
          <div className="flex items-center">
            {/* Animated connection status indicator */}
            <div className="flex items-center bg-primary/60 rounded-full px-2 py-0.5 border border-border/30">
              <span className={`h-2 w-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500 pulse-dot' : 'bg-gray-500'} mr-1.5`}></span>
              <span className={`text-xs ${connectionStatus === 'connected' ? 'text-green-500' : 'text-text-muted'}`}>
                {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
              </span>
            </div>
          </div>
        </div>
      }
    >
      <div className="mb-6 relative">
        {/* Decorative background wave graphic */}
        <div className="absolute bottom-0 left-0 w-full h-12 opacity-10 pointer-events-none">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1440 320" className="text-accent-alt">
            <path fill="currentColor" fillOpacity="1" d="M0,224L40,229.3C80,235,160,245,240,250.7C320,256,400,256,480,234.7C560,213,640,171,720,165.3C800,160,880,192,960,197.3C1040,203,1120,181,1200,176C1280,171,1360,181,1400,186.7L1440,192L1440,320L1400,320C1360,320,1280,320,1200,320C1120,320,1040,320,960,320C880,320,800,320,720,320C640,320,560,320,480,320C400,320,320,320,240,320C160,320,80,320,40,320L0,320Z"></path>
          </svg>
        </div>
        
        <div className="text-sm text-text-muted mb-3 flex items-center">
          <Volume2 className="h-4 w-4 mr-2 text-accent-alt" />
          <span>Voice Communication</span>
        </div>
        
        <div className="flex flex-wrap gap-3">
          <Button 
            className={cn(
              "bg-primary/60 hover:bg-primary/80 transition-all flex items-center border border-border/30",
              connectionStatus === 'connected' && "bg-accent-alt/20 border-accent-alt/30"
            )}
            onClick={startVoiceChat}
            disabled={isConnecting || connectionStatus === 'connected'}
          >
            <Mic className="h-4 w-4 mr-2 text-accent-alt" />
            {isConnecting ? 'Connecting...' : connectionStatus === 'connected' ? 'Connected' : 'Start Voice Chat'}
          </Button>
          <Button 
            className="bg-primary/60 hover:bg-primary/80 transition-all flex items-center border border-border/30"
            onClick={() => document.getElementById('wake-phrase-dialog')?.classList.toggle('hidden')}
          >
            <Settings className="h-4 w-4 mr-2 text-accent-alt" />
            Voice Settings
          </Button>
          
          {/* Wake Phrase Settings Dialog */}
          <div id="wake-phrase-dialog" className="hidden absolute top-full left-0 mt-2 p-4 bg-primary/90 backdrop-blur-xl rounded-xl border border-border z-10 w-64 shadow-xl">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-sm font-medium text-text">Wake Phrase</h3>
              <Button 
                size="sm" 
                variant="ghost" 
                className="h-6 w-6 p-0"
                onClick={() => document.getElementById('wake-phrase-dialog')?.classList.toggle('hidden')}
              >
                ✕
              </Button>
            </div>
            <div className="space-y-3">
              <div className="text-xs text-text-muted">
                The system will start listening when you say:
              </div>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  className="flex-1 bg-primary/60 border border-border/30 rounded-md p-2 text-sm focus:outline-none focus:ring-1 focus:ring-accent-alt"
                  value={wakePhrase}
                  onChange={handleWakePhraseChange}
                  placeholder="e.g. Hey Assistant"
                />
                <Button 
                  size="sm" 
                  className="bg-accent-alt/20 hover:bg-accent-alt/30 text-accent-alt text-xs"
                  onClick={saveWakePhrase}
                >
                  Save
                </Button>
              </div>
              <div className="text-xs text-accent-alt">
                Speak clearly and pause slightly after the wake phrase.
              </div>
            </div>
          </div>
        </div>
        
        {connectionError && (
          <div className="mt-2 text-sm text-destructive">
            {connectionError}
          </div>
        )}
      </div>
      
      <div className="bg-primary/40 rounded-xl p-4 border border-border/30 backdrop-blur-sm">
        <div className="flex justify-between items-center mb-4">
          <div className="text-sm font-medium text-text flex items-center">
            <Activity className="h-4 w-4 mr-2 text-accent-alt" />
            Current Session
          </div>
          {sessionInfo.startTime && (
            <div className="text-xs text-accent-alt px-2 py-0.5 rounded-full bg-accent-alt/10 border border-accent-alt/20">
              Started {sessionInfo.startTime}
            </div>
          )}
        </div>
        
        {/* Session info with glowing borders */}
        <div className="space-y-2 text-sm">
          <div className="flex justify-between p-2 rounded-lg bg-primary/60 border border-border/20">
            <span className="text-text-muted">Voice</span>
            <span className="font-medium text-text">{sessionInfo.voice || 'Alloy'}</span>
          </div>
          <div className="flex justify-between p-2 rounded-lg bg-primary/60 border border-border/20">
            <span className="text-text-muted">Language</span>
            <span className="font-medium text-text">{sessionInfo.language || 'English (US)'}</span>
          </div>
          <div className="flex justify-between p-2 rounded-lg bg-primary/60 border border-border/20">
            <span className="text-text-muted">Model</span>
            <span className="font-medium text-accent-alt">{sessionInfo.model || 'gpt-4o-realtime-preview'}</span>
          </div>
          <div className="flex justify-between p-2 rounded-lg bg-primary/60 border border-border/20">
            <span className="text-text-muted">Connection</span>
            <Badge 
              variant="outline" 
              className={cn(
                "bg-primary/40 border", 
                connectionStatus === 'connected' 
                  ? 'text-green-500 border-green-500/30' 
                  : 'text-gray-500 border-gray-500/30'
              )}
            >
              {sessionInfo.connectionType || 'WebRTC'}
            </Badge>
          </div>
        </div>
        
        {/* Event log with animated indicators */}
        {recentEvents.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border/30">
            <div className="text-xs text-accent-alt mb-3 flex items-center">
              <Activity className="h-3 w-3 mr-1.5" />
              Recent API Activity
            </div>
            <div className="text-xs space-y-2.5">
              {recentEvents.map((event, index) => (
                <div key={index} className="flex items-center group transition-all hover:bg-primary/40 px-2 py-1 rounded-md">
                  <div className="h-5 w-5 mr-2 flex items-center justify-center relative">
                    <div className="absolute inset-0 rounded-full bg-green-500/10 group-hover:bg-green-500/20 transition-colors"></div>
                    <CheckCircle2 className="h-3 w-3 text-green-500" />
                  </div>
                  <span className="text-text-muted group-hover:text-text transition-colors">{event.name}</span>
                  <span className="ml-auto text-accent-alt/70 font-mono text-xs">({event.time})</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </GlassCard>
  );
};
