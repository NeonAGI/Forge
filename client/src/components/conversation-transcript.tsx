import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Trash2, Download, User, Bot, Settings } from 'lucide-react';
import type { TranscriptMessage } from '@/hooks/use-openai-realtime-v2';

interface ConversationTranscriptProps {
  transcripts: TranscriptMessage[];
  currentUserTranscript?: string;
  onClear: () => void;
  className?: string;
}

export function ConversationTranscript({ 
  transcripts, 
  currentUserTranscript = '', 
  onClear,
  className = '' 
}: ConversationTranscriptProps) {
  
  const exportTranscript = () => {
    const exportData = {
      timestamp: new Date().toISOString(),
      conversation: transcripts.map(msg => ({
        speaker: msg.speaker,
        text: msg.text,
        timestamp: msg.timestamp,
        toolCalls: msg.toolCalls
      }))
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { 
      type: 'application/json' 
    });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `conversation-transcript-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatToolCall = (tool: string, args: any, result?: any) => {
    const toolIcons = {
      'web_search': '🔍',
      'get_weather': '🌤️',
      'get_time': '🕐',
      'remember_user_info': '💾'
    };
    
    return (
      <div className="mt-2 p-2 bg-purple-500/10 border border-purple-500/30 rounded-lg text-sm">
        <div className="flex items-center gap-2 font-medium text-purple-400">
          <Settings className="w-3 h-3" />
          {toolIcons[tool as keyof typeof toolIcons] || '🔧'} Tool: {tool}
        </div>
        <div className="mt-1 text-xs text-purple-300">
          Input: {JSON.stringify(args)}
        </div>
        {result && (
          <div className="mt-1 text-xs text-green-400">
            Result: {typeof result === 'string' ? result : JSON.stringify(result)}
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className={`${className} bg-black/40 border-white/20`}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Bot className="w-4 h-4" />
            Conversation Transcript
          </CardTitle>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={exportTranscript}
              disabled={transcripts.length === 0}
              className="h-8 px-2 text-xs"
            >
              <Download className="w-3 h-3 mr-1" />
              Export
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={onClear}
              disabled={transcripts.length === 0}
              className="h-8 px-2 text-xs"
            >
              <Trash2 className="w-3 h-3 mr-1" />
              Clear
            </Button>
          </div>
        </div>
        <div className="text-sm text-white/70">
          Real-time conversation with embedded tool usage
        </div>
      </CardHeader>
      
      <CardContent className="pt-0">
        <ScrollArea className="h-96 w-full">
          <div className="space-y-3">
            {transcripts.length === 0 && !currentUserTranscript ? (
              <div className="text-center text-white/50 py-8">
                <Bot className="w-8 h-8 mx-auto mb-2 opacity-50" />
                No conversation yet. Start talking with the voice assistant!
              </div>
            ) : (
              <>
                {transcripts.map((message, index) => (
                  <div key={message.id} className="space-y-2">
                    <div className={`flex gap-3 ${
                      message.speaker === 'user' ? 'justify-end' : 'justify-start'
                    }`}>
                      <div className={`max-w-[85%] rounded-lg p-3 ${
                        message.speaker === 'user' 
                          ? 'bg-blue-600/30 border border-blue-500/50' 
                          : 'bg-gray-700/50 border border-gray-600/50'
                      }`}>
                        <div className="flex items-center gap-2 mb-1">
                          {message.speaker === 'user' ? (
                            <User className="w-3 h-3 text-blue-400" />
                          ) : (
                            <Bot className="w-3 h-3 text-green-400" />
                          )}
                          <Badge 
                            variant="secondary" 
                            className={`text-xs ${
                              message.speaker === 'user' 
                                ? 'bg-blue-500/20 text-blue-300' 
                                : 'bg-green-500/20 text-green-300'
                            }`}
                          >
                            {message.speaker === 'user' ? 'You' : 'Assistant'}
                          </Badge>
                          <span className="text-xs text-white/50">
                            {message.timestamp}
                          </span>
                        </div>
                        
                        <div className="text-white/90 text-sm leading-relaxed">
                          {message.text}
                        </div>
                        
                        {message.toolCalls && message.toolCalls.map((toolCall, toolIndex) => (
                          <div key={toolIndex}>
                            {formatToolCall(toolCall.tool, toolCall.args, toolCall.result)}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {index < transcripts.length - 1 && (
                      <Separator className="bg-white/10" />
                    )}
                  </div>
                ))}
                
                {/* Current user transcript (while speaking) */}
                {currentUserTranscript && (
                  <div className="flex gap-3 justify-end">
                    <div className="max-w-[85%] rounded-lg p-3 bg-blue-600/20 border border-blue-500/30 border-dashed">
                      <div className="flex items-center gap-2 mb-1">
                        <User className="w-3 h-3 text-blue-400" />
                        <Badge variant="secondary" className="text-xs bg-blue-500/20 text-blue-300">
                          You (typing...)
                        </Badge>
                        <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse" />
                      </div>
                      <div className="text-white/70 text-sm italic">
                        {currentUserTranscript}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
        
        {transcripts.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="text-xs text-white/50 text-center">
              {transcripts.length} messages • Real-time transcription active
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}