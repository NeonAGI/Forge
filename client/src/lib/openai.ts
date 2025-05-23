import { apiRequest } from "./queryClient";

interface OpenAITextRequest {
  prompt: string;
  model?: string;
  maxTokens?: number;
}

interface OpenAITextResponse {
  text: string;
  model: string;
  finishReason: string;
}

interface OpenAIVoiceRequest {
  text: string;
  voice?: string;
}

interface OpenAIVoiceResponse {
  audioUrl: string;
}

interface OpenAIImageRequest {
  prompt: string;
  size?: string;
  quality?: string;
}

interface OpenAIImageResponse {
  imageBase64: string;
  revisedPrompt: string;
}

export const openai = {
  // Text generation with OpenAI
  async generateText(request: OpenAITextRequest): Promise<OpenAITextResponse> {
    const response = await apiRequest("POST", "/api/openai/text", {
      prompt: request.prompt,
      model: request.model || "gpt-4o",
      maxTokens: request.maxTokens || 500
    });
    
    return await response.json();
  },
  
  // Voice generation with OpenAI
  async generateVoice(request: OpenAIVoiceRequest): Promise<OpenAIVoiceResponse> {
    const response = await apiRequest("POST", "/api/openai/voice", {
      text: request.text,
      voice: request.voice || "alloy"
    });
    
    return await response.json();
  },
  
  // Generate image with OpenAI
  async generateImage(request: OpenAIImageRequest): Promise<OpenAIImageResponse> {
    const response = await apiRequest("POST", "/api/openai/image", {
      prompt: request.prompt,
      size: request.size || "1792x1024",
      quality: request.quality || "hd"
    });
    
    return await response.json();
  },
  
  // Chat completion with conversation history
  async chatCompletion(
    message: string, 
    history: { role: "assistant" | "user", content: string }[]
  ) {
    const response = await apiRequest("POST", "/api/assistant", {
      message,
      conversationHistory: history
    });
    
    return await response.json();
  }
};
