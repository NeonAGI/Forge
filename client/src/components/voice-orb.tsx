import { useOpenAIRealtimeV2 } from "@/hooks/use-openai-realtime-v2";
import { useWeatherBackground } from "@/hooks/use-weather-background";
import { useEffect, useState } from "react";
import { Info, Mic, Volume2, Activity } from "lucide-react";

export const VoiceOrb: React.FC = () => {
  const { 
    assistantMode, 
    connectionStatus, 
    startVoiceChat, 
    startWakePhraseDetection,
    sessionInfo,
    updateVoice,
    voiceIntensity,
    disconnect
  } = useOpenAIRealtimeV2();
  
  const { colorPalette } = useWeatherBackground();
  
  const [showInfo, setShowInfo] = useState(false);
  
  // Toggle info panel
  const toggleInfo = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowInfo(!showInfo);
  };
  
  // Toggle orb: start if disconnected, stop if connected
  const handleToggle = () => {
    if (connectionStatus !== 'connected') {
      startVoiceChat();
    } else {
      disconnect();
    }
  };
  
  // Determine orb class based on assistant mode
  const getOrbClass = () => {
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
  
  // Orb container style for placement and background
  const getOrbContainerStyle = (): React.CSSProperties => {
    // Use extracted colors from background image, fallback to defaults
    const connectedBg = colorPalette ? colorPalette.primaryRgba(0.15) : 'rgba(255, 230, 0, 0.15)';
    const connectedBorder = colorPalette ? colorPalette.primary : '#ffe600';
    const connectedShadow = colorPalette ? colorPalette.primaryRgba(0.5) : 'rgba(255, 230, 0, 0.5)';
    
    return {
      position: 'fixed' as 'fixed',
      bottom: '2.5rem',
      right: '2.5rem',
      zIndex: 50,
      width: '80px',
      height: '80px',
      cursor: 'pointer',
      background: connectionStatus === 'connected' ? connectedBg : '#444',
      borderRadius: '50%',
      boxShadow: connectionStatus === 'connected'
        ? `0 0 32px 8px ${connectedShadow}, 0 0 0 2px ${connectedBorder}`
        : '0 0 16px 2px #222',
      transition: 'background 0.2s, box-shadow 0.2s',
      // Make container relative for absolute children
      display: 'block',
      // Remove flex
    };
  };
  
  // Orb inner style for center color and animation
  const getInnerOrbStyle = (): React.CSSProperties => {
    let scale = 0.8;
    if (
      connectionStatus === 'connected' &&
      (assistantMode === 'listening' || assistantMode === 'speaking')
    ) {
      const minScale = 0.8;
      const maxScale = 2.0;
      scale = minScale + Math.min(voiceIntensity, 1) * (maxScale - minScale);
    }
    
    // Use extracted colors from background image, fallback to defaults
    const activeColor = colorPalette ? colorPalette.primary : '#ffe600';
    const activeShadow = colorPalette ? colorPalette.primaryRgba(0.8) : '#ffe600';
    const inactiveColor = colorPalette ? colorPalette.secondary : '#7fd6ff';
    
    return {
      background: connectionStatus === 'connected' && (assistantMode === 'listening' || assistantMode === 'speaking') ? activeColor : inactiveColor,
      boxShadow: connectionStatus === 'connected' && (assistantMode === 'listening' || assistantMode === 'speaking') ? `0 0 32px 8px ${activeShadow}` : '0 0 0 0 transparent',
      borderRadius: '50%',
      width: '100%',
      height: '100%',
      position: 'absolute' as 'absolute',
      top: 0,
      left: 0,
      transform: `scale(${scale})`,
      zIndex: 1,
    };
  };
  
  // Function to get status message for the UI
  const getStatusMessage = () => {
    if (connectionStatus !== 'connected') {
      return "Tap to connect";
    }
    
    switch (assistantMode) {
      case 'listening':
        return "Listening...";
      case 'speaking':
        return "Speaking...";
      case 'processing':
        return "Processing...";
      default:
        return `Say "${sessionInfo.wakePhrase}"`;
    }
  };
  
  return (
    <>
      {/* Main orb - fixed bottom right, toggle on click, relative for absolute children */}
      <div 
        className={getOrbClass()}
        title={getStatusMessage()}
        style={{
          ...getOrbContainerStyle(),
          position: 'fixed', // fixed on screen
          border: 0,
          outline: 0,
          boxSizing: 'border-box',
          overflow: 'visible',
          pointerEvents: 'auto',
          userSelect: 'none',
          WebkitUserSelect: 'none',
          MozUserSelect: 'none',
          msUserSelect: 'none',
          borderRadius: '50%',
          backgroundClip: 'padding-box',
        }}
        onClick={handleToggle}
      >
        <div
          className="orb-inner"
          style={getInnerOrbStyle()}
        ></div>
        {/* Info button absolutely positioned in orb */}
        <button 
          className="absolute -top-2 -right-2 h-6 w-6 rounded-full bg-primary/80 border border-border/50 flex items-center justify-center hover:bg-primary"
          style={{zIndex: 2}}
          onClick={toggleInfo}
        >
          <Info className="h-3 w-3 text-accent-alt" />
        </button>
      </div>
      {/* Status text absolutely positioned below orb, not inside orb */}
      <div style={{
        position: 'fixed',
        bottom: '0.5rem',
        right: '2.5rem',
        width: '120px',
        textAlign: 'center',
        zIndex: 51,
        pointerEvents: 'none',
      }}
        className="whitespace-nowrap text-xs font-medium text-text-muted bg-primary/60 px-3 py-1 rounded-full backdrop-blur-md border border-border/30"
      >
        {getStatusMessage()}
      </div>
      
      {/* Enhanced info panel for wall display - larger text and more readable */}
      {showInfo && (
        <div className="fixed bottom-32 right-6 p-4 bg-primary/80 backdrop-blur-xl rounded-xl border border-border/50 w-72 shadow-xl z-50">
          <h4 className="font-medium mb-3 text-text text-sm flex items-center">
            <Activity className="h-4 w-4 mr-2 text-accent" />
            Voice Assistant Status
          </h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-text-muted">Connection:</span>
              <span className={`px-2 py-0.5 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-muted">Mode:</span>
              <span className="bg-accent-alt/20 text-accent-alt px-2 py-0.5 rounded-full">
                {assistantMode.charAt(0).toUpperCase() + assistantMode.slice(1)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-text-muted">Voice:</span>
              <select
                className="bg-primary/30 text-accent px-2 py-0.5 rounded-full font-medium border border-border/20 focus:outline-none focus:ring-2 focus:ring-accent"
                value={sessionInfo.voice}
                onChange={e => updateVoice(e.target.value)}
              >
                <option value="alloy">Alloy</option>
                <option value="echo">Echo</option>
                <option value="fable">Fable</option>
                <option value="onyx">Onyx</option>
                <option value="nova">Nova</option>
                <option value="shimmer">Shimmer</option>
              </select>
            </div>
            <div className="text-xs opacity-75 mt-4 text-center px-2 py-2 bg-primary/40 rounded-lg border border-border/20">
              {connectionStatus !== 'connected' ? 
                "Tap the orb to connect voice control" : 
                "This display is voice-controlled."}
            </div>
          </div>
        </div>
      )}
    </>
  );
};