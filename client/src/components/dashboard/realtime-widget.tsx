import React from "react";
import { GlassCard } from "@/components/ui/glass-card";
import { Button } from "@/components/ui/button";
import { Mic, Settings, Radio, Activity, CheckCircle2, Volume2, Send } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useOpenAIRealtimeV2 } from "@/hooks/use-openai-realtime-v2";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { Link } from "wouter";
import { ConversationTranscript } from "@/components/conversation-transcript";

function capitalizeFirstLetter(string: string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
}

export const RealtimeWidget: React.FC = () => {
  const { 
    connectionStatus, 
    sessionInfo, 
    recentEvents,
    startVoiceChat,
    disconnect,
    isConnecting,
    connectionError,
    assistantMode,
    currentTool,
    lastToolExecution,
    updateWakePhrase,
    startWakePhraseDetection,
    stopWakePhraseDetection,
    sendTextMessage,
    conversationTranscripts,
    currentUserTranscript,
    clearTranscripts
  } = useOpenAIRealtimeV2();
  
  const [wakePhrase, setWakePhrase] = React.useState(sessionInfo.wakePhrase);
  const [textInput, setTextInput] = React.useState("");
  
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

  // Send text message to the assistant
  const handleSendText = () => {
    if (textInput.trim() && connectionStatus === 'connected') {
      sendTextMessage(textInput);
      setTextInput("");
    }
  };

  // Handle Enter key press in the text input
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendText();
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
    <>
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
            onClick={connectionStatus === 'connected' ? disconnect : startVoiceChat}
            disabled={isConnecting}
          >
            <Mic className="h-4 w-4 mr-2 text-accent-alt" />
            {isConnecting ? 'Connecting...' : connectionStatus === 'connected' ? 'Disconnect' : 'Start Voice Chat'}
          </Button>
          <Button 
            className={cn(
              "transition-all flex items-center border border-border/30",
              connectionStatus === 'connected' && assistantMode !== 'idle' 
                ? "bg-red-700/30 hover:bg-red-700/40 border-red-700/30" 
                : "bg-primary/60 hover:bg-primary/80"
            )}
            onClick={() => {
              if (connectionStatus === 'connected' && assistantMode !== 'idle') {
                stopWakePhraseDetection();
              } else {
                startWakePhraseDetection();
              }
            }}
            disabled={!connectionStatus || connectionStatus !== 'connected'}
          >
            <Volume2 className="h-4 w-4 mr-2 text-accent-alt" />
            {connectionStatus === 'connected' && assistantMode !== 'idle' ? 'Stop Listening' : 'Enable Wake Phrase'}
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
          <div className="mt-2 p-3 bg-destructive/10 border border-destructive/30 rounded-lg">
            <div className="text-sm text-destructive font-medium mb-2">
              Connection Error
            </div>
            <div className="text-sm text-destructive">
              {connectionError}
            </div>
            {connectionError.includes('API key') && (
              <div className="mt-2 flex items-center justify-between">
                <div className="text-xs text-destructive/80">
                  💡 Configure your OpenAI API key to enable voice features
                </div>
                <Link href="/api-keys" className="text-xs text-accent-alt hover:text-accent-alt/80 underline">
                  Go to API Keys →
                </Link>
              </div>
            )}
          </div>
        )}
        
        {/* Text Input Section for Debugging */}
        {connectionStatus === 'connected' && (
          <div className="mt-4 border-t border-border/30 pt-4">
            <div className="text-sm text-text-muted mb-3 flex items-center">
              <Send className="h-4 w-4 mr-2 text-accent-alt" />
              <span>Test with Text Input</span>
            </div>
            <div className="flex gap-2">
              <Input
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                onKeyDown={handleKeyPress}
                placeholder="Type a message to test..."
                className="flex-1 bg-primary/60 border border-border/30 focus:outline-none focus:ring-1 focus:ring-accent-alt"
              />
              <Button
                className="bg-accent-alt/20 hover:bg-accent-alt/30 text-accent-alt"
                onClick={handleSendText}
                disabled={!textInput.trim() || connectionStatus !== 'connected'}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <div className="mt-2 text-xs text-accent-alt">
              Send text messages to test the connection without using voice.
            </div>
          </div>
        )}
        
        <div className="mt-4 text-xs text-accent-alt border border-border/30 bg-primary/40 p-2.5 rounded-lg">
          <p className="mb-1 font-medium">Voice Assistant Guide:</p>
          <ol className="list-decimal pl-4 space-y-1">
            <li>Click "Start Voice Chat" to connect</li>
            <li>Click "Enable Wake Phrase" to let the system listen</li>
            <li>Say "{sessionInfo.wakePhrase}" to activate the assistant</li>
            <li>Browser permission is required for microphone access</li>
          </ol>
        </div>
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
            <span className="font-medium text-text">{capitalizeFirstLetter(sessionInfo.voice || 'alloy')}</span>
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
          <div className="flex justify-between p-2 rounded-lg bg-primary/60 border border-border/20">
            <span className="text-text-muted">Mode</span>
            <Badge 
              variant="outline" 
              className={cn(
                "bg-primary/40 border", 
                assistantMode === 'listening' 
                  ? 'text-blue-500 border-blue-500/30' 
                  : assistantMode === 'speaking' 
                  ? 'text-green-500 border-green-500/30'
                  : assistantMode === 'processing'
                  ? 'text-yellow-500 border-yellow-500/30'
                  : 'text-gray-500 border-gray-500/30'
              )}
            >
              {assistantMode.charAt(0).toUpperCase() + assistantMode.slice(1)}
            </Badge>
          </div>
          {currentTool && (
            <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/30">
              <div className="flex justify-between items-center mb-2">
                <span className="text-text-muted text-sm">🔧 Agent Tool Active</span>
                <Badge 
                  variant="outline" 
                  className="bg-purple-500/20 border-purple-500/30 text-purple-500 animate-pulse"
                >
                  EXECUTING
                </Badge>
              </div>
              <div className="text-purple-400 font-medium">
                {currentTool === 'web_search' ? '🔍 Searching the web for current information...' :
                 currentTool === 'get_weather' ? '🌤️ Fetching weather data from API...' :
                 currentTool === 'get_time' ? '🕐 Getting current time information...' :
                 currentTool === 'remember_user_info' ? '🧠 Saving information to memory...' :
                 `🔧 Executing ${currentTool}...`}
              </div>
              <div className="text-xs text-purple-300 mt-1 opacity-75">
                The AI assistant is actively using tools to provide you with accurate, up-to-date information.
              </div>
            </div>
          )}
          
          {/* Last Tool Execution Details */}
          {lastToolExecution && (
            <div className="mt-3 p-3 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
              <div className="flex justify-between items-center mb-2">
                <span className="text-text-muted text-sm">📊 Last Tool Execution</span>
                <span className="text-xs text-cyan-400 font-mono">{lastToolExecution.timestamp}</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center">
                  <span className="text-cyan-400 font-medium mr-2">
                    {lastToolExecution.tool === 'web_search' ? '🔍 Web Search' :
                     lastToolExecution.tool === 'get_weather' ? '🌤️ Weather Lookup' :
                     lastToolExecution.tool === 'get_time' ? '🕐 Time Query' :
                     lastToolExecution.tool === 'remember_user_info' ? '🧠 Memory Save' :
                     `🔧 ${lastToolExecution.tool}`}
                  </span>
                </div>
                
                {/* Show tool arguments */}
                <div className="text-xs">
                  <span className="text-text-muted">Input: </span>
                  <span className="text-cyan-300">
                    {lastToolExecution.tool === 'web_search' && lastToolExecution.args?.query && `"${lastToolExecution.args.query}"`}
                    {lastToolExecution.tool === 'get_weather' && lastToolExecution.args?.location && `Location: ${lastToolExecution.args.location}`}
                    {lastToolExecution.tool === 'get_time' && lastToolExecution.args?.timezone && `Timezone: ${lastToolExecution.args.timezone}`}
                    {lastToolExecution.tool === 'remember_user_info' && lastToolExecution.args?.content && `${lastToolExecution.args.memory_type}: ${lastToolExecution.args.content.substring(0, 50)}...`}
                  </span>
                </div>
                
                {/* Show tool results if available */}
                {lastToolExecution.result && (
                  <div className="text-xs">
                    <span className="text-text-muted">Result: </span>
                    <span className="text-green-400">
                      {lastToolExecution.tool === 'web_search' && lastToolExecution.result?.results?.length && `Found ${lastToolExecution.result.results.length} results`}
                      {lastToolExecution.tool === 'get_weather' && lastToolExecution.result?.temperature && `${lastToolExecution.result.temperature} - ${lastToolExecution.result.condition}`}
                      {lastToolExecution.tool === 'get_time' && lastToolExecution.result?.current_time && `${lastToolExecution.result.current_time}`}
                      {lastToolExecution.tool === 'remember_user_info' && lastToolExecution.result?.status && `${lastToolExecution.result.status} (ID: ${lastToolExecution.result.memory_id})`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* Event log with animated indicators */}
        {recentEvents.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border/30">
            <div className="text-xs text-accent-alt mb-3 flex items-center">
              <Activity className="h-3 w-3 mr-1.5" />
              Recent API Activity
            </div>
            <div className="text-xs space-y-2.5 max-h-48 overflow-y-auto">
              {recentEvents.map((event, index) => {
                // Enhanced event display with icons and descriptions
                const getEventDetails = (eventName: string) => {
                  if (eventName.includes('tool_call_web_search')) {
                    return { icon: '🔍', color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'Web Search Tool Called' };
                  } else if (eventName.includes('tool_call_get_weather')) {
                    return { icon: '🌤️', color: 'text-orange-500', bg: 'bg-orange-500/10', label: 'Weather Tool Called' };
                  } else if (eventName.includes('tool_call_get_time')) {
                    return { icon: '🕐', color: 'text-purple-500', bg: 'bg-purple-500/10', label: 'Time Tool Called' };
                  } else if (eventName.includes('tool_call_remember_user_info')) {
                    return { icon: '🧠', color: 'text-pink-500', bg: 'bg-pink-500/10', label: 'Memory Tool Called' };
                  } else if (eventName.includes('tool_call_completed')) {
                    return { icon: '✅', color: 'text-green-500', bg: 'bg-green-500/10', label: 'Tool Execution Completed' };
                  } else if (eventName.includes('function_result_sent')) {
                    return { icon: '📤', color: 'text-cyan-500', bg: 'bg-cyan-500/10', label: 'Tool Results Sent to AI' };
                  } else if (eventName.includes('speech_started')) {
                    return { icon: '🎤', color: 'text-blue-500', bg: 'bg-blue-500/10', label: 'User Voice Input Started' };
                  } else if (eventName.includes('speech_stopped')) {
                    return { icon: '⏸️', color: 'text-yellow-500', bg: 'bg-yellow-500/10', label: 'User Voice Input Stopped' };
                  } else if (eventName.includes('audio_response')) {
                    return { icon: '🔊', color: 'text-green-500', bg: 'bg-green-500/10', label: 'AI Voice Response' };
                  } else {
                    return { icon: '●', color: 'text-gray-500', bg: 'bg-gray-500/10', label: event.name };
                  }
                };
                
                const eventDetails = getEventDetails(event.name);
                
                return (
                  <div key={index} className={`flex items-center group transition-all hover:bg-primary/40 px-2 py-1 rounded-md ${eventDetails.bg}`}>
                    <div className="h-5 w-5 mr-2 flex items-center justify-center relative">
                      <span className={`${eventDetails.color} text-sm`}>{eventDetails.icon}</span>
                    </div>
                    <span className={`${eventDetails.color} group-hover:text-text transition-colors flex-1`}>
                      {eventDetails.label}
                    </span>
                    <span className="ml-auto text-accent-alt/70 font-mono text-xs">({event.time})</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </GlassCard>
    
    {/* Conversation Transcript */}
    {connectionStatus === 'connected' && (
      <ConversationTranscript
        transcripts={conversationTranscripts}
        currentUserTranscript={currentUserTranscript}
        onClear={clearTranscripts}
        className="mt-4"
      />
    )}
    </>
  );
};
