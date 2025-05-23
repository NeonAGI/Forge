import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Volume2, VolumeX, Check, Play, Pause } from 'lucide-react';
import { useSettings } from '@/hooks/use-settings';

// OpenAI available voices with descriptions (updated as of May 2025)
export const OPENAI_VOICES = [
  {
    id: 'alloy',
    name: 'Alloy',
    description: 'A balanced, natural voice suitable for most applications',
    gender: 'neutral',
    tone: 'balanced'
  },
  {
    id: 'ash',
    name: 'Ash',
    description: 'A warm, conversational voice with natural flow',
    gender: 'neutral',
    tone: 'warm'
  },
  {
    id: 'ballad',
    name: 'Ballad',
    description: 'A melodic, expressive voice with musical quality',
    gender: 'neutral',
    tone: 'melodic'
  },
  {
    id: 'coral',
    name: 'Coral',
    description: 'A bright, friendly voice with upbeat energy',
    gender: 'neutral',
    tone: 'friendly'
  },
  {
    id: 'echo',
    name: 'Echo',
    description: 'A clear, articulate voice with good pronunciation',
    gender: 'neutral',
    tone: 'clear'
  },
  {
    id: 'sage',
    name: 'Sage',
    description: 'A wise, thoughtful voice with calm authority',
    gender: 'neutral',
    tone: 'wise'
  },
  {
    id: 'shimmer',
    name: 'Shimmer',
    description: 'A gentle, soothing voice perfect for calm interactions',
    gender: 'neutral',
    tone: 'gentle'
  },
  {
    id: 'verse',
    name: 'Verse',
    description: 'A poetic, expressive voice with artistic flair',
    gender: 'neutral',
    tone: 'artistic'
  }
] as const;

export type OpenAIVoice = typeof OPENAI_VOICES[number]['id'];

interface VoiceSelectionProps {
  currentVoice?: string;
  onVoiceChange?: (voice: OpenAIVoice) => void;
  showPreview?: boolean;
}

export const VoiceSelection: React.FC<VoiceSelectionProps> = ({
  currentVoice = 'alloy',
  onVoiceChange,
  showPreview = true
}) => {
  const [selectedVoice, setSelectedVoice] = useState<OpenAIVoice>(currentVoice as OpenAIVoice);
  const [previewingVoice, setPreviewingVoice] = useState<string | null>(null);
  const { userSettings, updateUserSettings } = useSettings();

  const handleVoiceSelect = async (voice: OpenAIVoice) => {
    setSelectedVoice(voice);
    
    // Update settings to persist the voice choice
    if (userSettings) {
      try {
        await updateUserSettings({
          ...userSettings,
          // Add voice preference to settings (we'll need to extend the settings schema)
          // For now, store in a custom field
        });
      } catch (error) {
        console.warn('Could not save voice preference:', error);
      }
    }
    
    onVoiceChange?.(voice);
  };

  const previewVoice = async (voice: OpenAIVoice) => {
    if (previewingVoice === voice) {
      setPreviewingVoice(null);
      return;
    }

    setPreviewingVoice(voice);
    
    // In a real implementation, you might want to generate a short preview audio
    // For now, we'll just simulate the preview
    setTimeout(() => {
      setPreviewingVoice(null);
    }, 2000);
  };

  const getToneColor = (tone: string) => {
    switch (tone) {
      case 'balanced': return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'warm': return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'melodic': return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'friendly': return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'clear': return 'bg-green-100 text-green-800 border-green-300';
      case 'wise': return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'gentle': return 'bg-pink-100 text-pink-800 border-pink-300';
      case 'artistic': return 'bg-violet-100 text-violet-800 border-violet-300';
      default: return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Volume2 className="w-5 h-5" />
          Voice Selection
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Choose your preferred AI assistant voice for realtime conversations
        </p>
      </CardHeader>
      
      <CardContent className="space-y-3">
        {OPENAI_VOICES.map((voice) => {
          const isSelected = selectedVoice === voice.id;
          const isPreviewing = previewingVoice === voice.id;
          
          return (
            <div
              key={voice.id}
              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`}
              onClick={() => handleVoiceSelect(voice.id)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="font-medium text-lg">{voice.name}</h3>
                    <Badge 
                      variant="outline" 
                      className={`text-xs ${getToneColor(voice.tone)}`}
                    >
                      {voice.tone}
                    </Badge>
                    {isSelected && (
                      <Check className="w-4 h-4 text-blue-600" />
                    )}
                  </div>
                  
                  <p className="text-sm text-gray-600 mb-2">
                    {voice.description}
                  </p>
                  
                  <div className="text-xs text-gray-500">
                    ID: {voice.id}
                  </div>
                </div>
                
                {showPreview && (
                  <div className="ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        previewVoice(voice.id);
                      }}
                      disabled={isPreviewing}
                      className="w-20"
                    >
                      {isPreviewing ? (
                        <>
                          <Pause className="w-3 h-3 mr-1" />
                          Stop
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 mr-1" />
                          Preview
                        </>
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
        
        <div className="pt-4 border-t">
          <p className="text-xs text-gray-500">
            Current selection: <span className="font-medium">{selectedVoice}</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Voice changes will take effect on your next conversation session.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default VoiceSelection;