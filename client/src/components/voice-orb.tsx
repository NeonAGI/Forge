import { useOpenAIRealtime } from "@/hooks/use-openai-realtime";
import { useEffect, useState } from "react";
import { Info, Mic, Volume2 } from "lucide-react";

export const VoiceOrb: React.FC = () => {
  const { 
    assistantMode, 
    connectionStatus, 
    startVoiceChat, 
    startWakePhraseDetection
  } = useOpenAIRealtime();
  
  const [isEnabled, setIsEnabled] = useState(true);
  const [showInfo, setShowInfo] = useState(false);
  
  // Toggle orb visibility
  const toggleOrb = () => {
    setIsEnabled(!isEnabled);
  };
  
  // Toggle info panel
  const toggleInfo = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowInfo(!showInfo);
  };
  
  // Handle quick connection for voice-only interface
  const quickConnect = () => {
    if (connectionStatus !== 'connected') {
      startVoiceChat();
    } else if (assistantMode === 'idle') {
      startWakePhraseDetection();
    }
  };
  
  // Determine orb class based on assistant mode
  const getOrbClass = () => {
    if (!isEnabled) return "orb hidden";
    
    switch (assistantMode) {
      case 'listening':
        return "orb listening";
      case 'speaking':
        return "orb speaking";
      case 'processing':
        return "orb processing";
      default:
        return connectionStatus === 'connected' ? "orb idle" : "orb";
    }
  };
  
  // Animated inner orb styles
  const getInnerOrbStyle = () => {
    if (assistantMode === 'processing') {
      return { animation: 'pulse 0.8s infinite alternate' };
    }
    return {};
  };
  
  return (
    <>
      <div 
        className={getOrbClass()}
        onClick={quickConnect}
        title={assistantMode === 'listening' ? 'Listening...' : 
              assistantMode === 'speaking' ? 'Speaking...' :
              assistantMode === 'processing' ? 'Processing...' :
              connectionStatus === 'connected' ? 'Tap to enable wake phrase' : 
              'Tap to connect'}
      >
        <div className="orb-inner" style={getInnerOrbStyle()}></div>
        
        {/* Info button */}
        <button 
          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary/80 border border-border/50 flex items-center justify-center hover:bg-primary"
          onClick={toggleInfo}
        >
          <Info className="h-3 w-3 text-accent-alt" />
        </button>
      </div>
      
      {/* Info panel */}
      {showInfo && (
        <div className="fixed bottom-24 right-6 p-3 bg-primary/90 backdrop-blur-xl rounded-xl border border-border/50 w-64 text-xs shadow-xl z-50">
          <h4 className="font-medium mb-2 text-text">Voice Assistant Status</h4>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-text-muted">Connection:</span>
              <span className={connectionStatus === 'connected' ? 'text-green-500' : 'text-orange-500'}>
                {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-text-muted">Mode:</span>
              <span className="text-accent-alt">
                {assistantMode.charAt(0).toUpperCase() + assistantMode.slice(1)}
              </span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <button
                className="flex-1 bg-primary/60 hover:bg-primary/80 py-1.5 rounded text-center border border-border/40"
                onClick={startVoiceChat}
                disabled={connectionStatus === 'connected'}
              >
                <Mic className="h-3 w-3 inline-block mr-1 text-accent-alt" />
                Connect
              </button>
              <button
                className="flex-1 bg-primary/60 hover:bg-primary/80 py-1.5 rounded text-center border border-border/40"
                onClick={startWakePhraseDetection}
                disabled={connectionStatus !== 'connected'}
              >
                <Volume2 className="h-3 w-3 inline-block mr-1 text-accent-alt" />
                Listen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};