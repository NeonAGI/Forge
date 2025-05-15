import { useOpenAIRealtime } from "@/hooks/use-openai-realtime";
import { useEffect, useState } from "react";

export const VoiceOrb: React.FC = () => {
  const { assistantMode, connectionStatus } = useOpenAIRealtime();
  const [isEnabled, setIsEnabled] = useState(true);
  
  // Toggle orb visibility
  const toggleOrb = () => {
    setIsEnabled(!isEnabled);
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
        onClick={toggleOrb}
        title={assistantMode === 'listening' ? 'Listening...' : 
              assistantMode === 'speaking' ? 'Speaking...' :
              assistantMode === 'processing' ? 'Processing...' :
              'Voice Assistant'}
      >
        <div className="orb-inner" style={getInnerOrbStyle()}></div>
      </div>
    </>
  );
};