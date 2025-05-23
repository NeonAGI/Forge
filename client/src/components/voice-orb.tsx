import { useOpenAIRealtimeV2 } from "@/hooks/use-openai-realtime-v2";
import { useWeatherBackground } from "@/hooks/use-weather-background";
import { useIsMobile } from "@/hooks/use-mobile";
import { useEffect, useState } from "react";
import { Info, Mic, Volume2, Activity, Square, PhoneOff } from "lucide-react";

export const VoiceOrb: React.FC = () => {
  const { 
    assistantMode, 
    connectionStatus, 
    startVoiceChat, 
    startWakePhraseDetection,
    sessionInfo,
    updateVoice,
    voiceIntensity,
    disconnect,
    forceStop,
    checkMicrophonePermission,
    connectionError,
    currentTool
  } = useOpenAIRealtimeV2();
  
  const { colorPalette } = useWeatherBackground();
  const isMobile = useIsMobile();
  
  const [showInfo, setShowInfo] = useState(false);
  
  // Toggle info panel
  const toggleInfo = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowInfo(!showInfo);
  };
  
  // Toggle orb: start if disconnected, stop if connected
  const handleToggle = async () => {
    if (connectionStatus !== 'connected') {
      // For mobile devices, especially iOS, check permissions first
      if (isMobile) {
        try {
          const hasPermission = await checkMicrophonePermission();
          if (!hasPermission) {
            // This will trigger the permission prompt through getUserMedia
            console.log('📱 iOS: Requesting microphone permission...');
          }
        } catch (error) {
          console.warn('Permission check failed:', error);
        }
      }
      
      startVoiceChat();
    } else {
      disconnect();
    }
  };
  
  // Force stop with microphone release
  const handleForceStop = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (typeof forceStop === 'function') {
      forceStop();
    } else {
      // Fallback to regular disconnect
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
    
    const size = isMobile ? '64px' : '80px';
    const bottom = isMobile ? '1.5rem' : '2.5rem';
    const right = isMobile ? '1.5rem' : '2.5rem';
    
    return {
      position: 'fixed' as 'fixed',
      bottom,
      right,
      zIndex: 50,
      width: size,
      height: size,
      cursor: 'pointer',
      backgroundColor: connectionStatus === 'connected' ? connectedBg : '#444',
      borderRadius: '50%',
      boxShadow: connectionStatus === 'connected'
        ? `0 0 ${isMobile ? '24px 6px' : '32px 8px'} ${connectedShadow}, 0 0 0 2px ${connectedBorder}`
        : `0 0 ${isMobile ? '12px 2px' : '16px 2px'} #222`,
      transition: 'background-color 0.2s, box-shadow 0.2s',
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
      const maxScale = isMobile ? 1.6 : 2.0; // Smaller max scale on mobile
      scale = minScale + Math.min(voiceIntensity, 1) * (maxScale - minScale);
    }
    
    // Use extracted colors from background image, fallback to defaults
    const activeColor = colorPalette ? colorPalette.primary : '#ffe600';
    const activeShadow = colorPalette ? colorPalette.primaryRgba(0.8) : '#ffe600';
    const inactiveColor = colorPalette ? colorPalette.secondary : '#7fd6ff';
    
    return {
      backgroundColor: connectionStatus === 'connected' && (assistantMode === 'listening' || assistantMode === 'speaking') ? activeColor : inactiveColor,
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
    
    // Show tool usage in status
    if (currentTool) {
      const toolDisplayName = {
        'web_search': 'Searching web',
        'get_weather': 'Getting weather',
        'get_time': 'Getting time',
        'remember_user_info': 'Saving memory'
      }[currentTool] || `Using ${currentTool}`;
      
      return isMobile ? toolDisplayName : `🔧 ${toolDisplayName}...`;
    }
    
    switch (assistantMode) {
      case 'listening':
        return isMobile ? "Listening..." : "Listening... (say 'stop' to end)";
      case 'speaking':
        return "Speaking...";
      case 'processing':
        return "Processing...";
      default:
        return isMobile ? `Say "${sessionInfo.wakePhrase}"` : `Say "${sessionInfo.wakePhrase}" or "stop"`;
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
          className={`absolute -top-2 -right-2 ${isMobile ? 'h-5 w-5' : 'h-6 w-6'} rounded-full bg-primary/80 border border-border/50 flex items-center justify-center hover:bg-primary`}
          style={{zIndex: 2}}
          onClick={toggleInfo}
        >
          <Info className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'} text-accent-alt`} />
        </button>
        
        {/* Stop button - only show when connected */}
        {connectionStatus === 'connected' && (
          <button 
            className={`absolute -top-2 -left-2 ${isMobile ? 'h-5 w-5' : 'h-6 w-6'} rounded-full bg-red-600/80 border border-red-500/50 flex items-center justify-center hover:bg-red-600 transition-colors`}
            style={{zIndex: 2}}
            onClick={handleForceStop}
            title="Force stop and release microphone"
          >
            <PhoneOff className={`${isMobile ? 'h-2.5 w-2.5' : 'h-3 w-3'} text-white`} />
          </button>
        )}
      </div>
      {/* Status text absolutely positioned below orb, not inside orb */}
      <div style={{
        position: 'fixed',
        bottom: isMobile ? '0.25rem' : '0.5rem',
        right: isMobile ? '1.5rem' : '2.5rem',
        width: isMobile ? '100px' : '120px',
        textAlign: 'center',
        zIndex: 51,
        pointerEvents: 'none',
      }}
        className={`whitespace-nowrap ${isMobile ? 'text-xs' : 'text-xs'} font-medium text-text-muted bg-primary/60 px-2 sm:px-3 py-1 rounded-full backdrop-blur-md border border-border/30`}
      >
        {isMobile ? getStatusMessage().replace('Tap to connect', 'Tap') : getStatusMessage()}
      </div>
      
      {/* Enhanced info panel for wall display - larger text and more readable */}
      {showInfo && (
        <div className={`fixed ${isMobile ? 'bottom-20 right-2 left-2 w-auto' : 'bottom-32 right-6 w-72'} p-3 sm:p-4 bg-primary/80 backdrop-blur-xl rounded-xl border border-border/50 shadow-xl z-50`}>
          <h4 className="font-medium mb-2 sm:mb-3 text-text text-xs sm:text-sm flex items-center">
            <Activity className="h-3 w-3 sm:h-4 sm:w-4 mr-2 text-accent" />
            Voice Assistant Status
          </h4>
          <div className="space-y-2 sm:space-y-3">
            <div className="flex justify-between items-center text-xs sm:text-sm">
              <span className="text-text-muted">Connection:</span>
              <span className={`px-1.5 sm:px-2 py-0.5 rounded-full text-xs ${connectionStatus === 'connected' ? 'bg-green-500/20 text-green-400' : 'bg-orange-500/20 text-orange-400'}`}>
                {connectionStatus === 'connected' ? 'Connected' : 'Disconnected'}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs sm:text-sm">
              <span className="text-text-muted">Mode:</span>
              <span className="bg-accent-alt/20 text-accent-alt px-1.5 sm:px-2 py-0.5 rounded-full text-xs">
                {assistantMode.charAt(0).toUpperCase() + assistantMode.slice(1)}
              </span>
            </div>
            
            {connectionError && (
              <div className="mt-2 p-2 bg-red-500/20 text-red-400 rounded-lg text-xs border border-red-500/30">
                <div className="font-medium mb-1">Connection Error:</div>
                <div className="text-red-300">{connectionError}</div>
                {isMobile && connectionError.includes('Microphone') && (
                  <div className="text-red-200 text-xs mt-1">
                    💡 On iPhone: Check Settings → Safari → Microphone → Allow
                  </div>
                )}
              </div>
            )}
            <div className="flex justify-between items-center text-xs sm:text-sm">
              <span className="text-text-muted">Voice:</span>
              <select
                className={`px-1.5 sm:px-2 py-0.5 rounded-full font-medium border text-xs shadow-sm ${
                  connectionStatus === 'connected' 
                    ? 'bg-gray-100 text-gray-500 border-gray-300 cursor-not-allowed' 
                    : 'bg-background/90 text-foreground border-border/40 focus:outline-none focus:ring-2 focus:ring-accent'
                }`}
                value={sessionInfo.voice}
                onChange={e => updateVoice(e.target.value)}
                disabled={connectionStatus === 'connected'}
                style={{ 
                  backgroundColor: connectionStatus === 'connected' 
                    ? 'rgba(128, 128, 128, 0.3)' 
                    : 'rgba(255, 255, 255, 0.95)',
                  color: connectionStatus === 'connected' 
                    ? 'rgba(128, 128, 128, 0.7)' 
                    : 'rgba(0, 0, 0, 0.9)',
                  border: '1px solid rgba(0, 0, 0, 0.2)'
                }}
              >
                <option value="alloy" style={{ backgroundColor: 'white', color: 'black' }}>Alloy</option>
                <option value="ash" style={{ backgroundColor: 'white', color: 'black' }}>Ash</option>
                <option value="ballad" style={{ backgroundColor: 'white', color: 'black' }}>Ballad</option>
                <option value="coral" style={{ backgroundColor: 'white', color: 'black' }}>Coral</option>
                <option value="echo" style={{ backgroundColor: 'white', color: 'black' }}>Echo</option>
                <option value="sage" style={{ backgroundColor: 'white', color: 'black' }}>Sage</option>
                <option value="shimmer" style={{ backgroundColor: 'white', color: 'black' }}>Shimmer</option>
                <option value="verse" style={{ backgroundColor: 'white', color: 'black' }}>Verse</option>
              </select>
            </div>
            
            {connectionStatus === 'connected' && (
              <div className="text-xs opacity-75 mt-2 text-center px-2 py-1 bg-yellow-500/20 text-yellow-300 rounded border border-yellow-500/30">
                Voice locked during session. Disconnect to change voice.
              </div>
            )}
            
            <div className="text-xs opacity-75 mt-3 sm:mt-4 text-center px-2 py-2 bg-primary/40 rounded-lg border border-border/20">
              {connectionStatus !== 'connected' ? 
                "Tap the orb to connect voice control" : 
                "Say 'stop', 'disconnect', or 'goodbye' to end the session"}
            </div>
            
            {connectionStatus === 'connected' && (
              <div className="mt-2 sm:mt-3 flex gap-2">
                <button
                  onClick={disconnect}
                  className="flex-1 bg-orange-600/20 text-orange-400 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-medium hover:bg-orange-600/30 transition-colors"
                >
                  Disconnect
                </button>
                <button
                  onClick={handleForceStop}
                  className="flex-1 bg-red-600/20 text-red-400 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg text-xs font-medium hover:bg-red-600/30 transition-colors"
                >
                  Force Stop
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
};