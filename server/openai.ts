import OpenAI from "openai";

// Initialize OpenAI client - but don't throw errors at initialization time
// We'll check for the API key before each operation instead
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || "dummy_key_for_init"
});

// Log a warning at startup if no API key is set
if (!process.env.OPENAI_API_KEY) {
  console.warn("WARNING: No OpenAI API key provided. Set the OPENAI_API_KEY environment variable for AI image generation to work.");
}

// Utility function to check API key before operations
const checkApiKey = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OpenAI API key is not configured. Set the OPENAI_API_KEY environment variable.");
  }
  return apiKey;
};

// Text generation with the OpenAI API
export async function generateText(prompt: string, maxTokens = 500) {
  try {
    // Check API key before operation
    checkApiKey();
    
    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [{ role: "user", content: prompt }],
      max_tokens: maxTokens,
    });

    return {
      text: response.choices[0].message.content,
      model: response.model,
      finishReason: response.choices[0].finish_reason,
    };
  } catch (error) {
    console.error("OpenAI text generation error:", error);
    throw new Error("Failed to generate text with OpenAI");
  }
}

// Chat completion with conversation history
export async function chatCompletion(
  message: string,
  history: { role: "assistant" | "user"; content: string }[]
) {
  try {
    // Check API key before operation
    checkApiKey();
    
    // Format conversation history for OpenAI
    const messages = [
      {
        role: "system",
        content: "You are a helpful AI assistant on a personal dashboard. Provide concise and helpful responses.",
      },
      ...history.map((msg) => ({
        role: msg.role,
        content: msg.content,
      })),
      { role: "user", content: message },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: messages as any,
    });

    return {
      response: response.choices[0].message.content,
    };
  } catch (error) {
    console.error("OpenAI chat completion error:", error);
    throw new Error("Failed to generate chat response with OpenAI");
  }
}

// Text-to-speech with OpenAI
export async function generateSpeech(text: string, voice = "alloy") {
  try {
    // Check API key before operation
    checkApiKey();
    
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice,
      input: text,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());
    return buffer;
  } catch (error) {
    console.error("OpenAI speech generation error:", error);
    throw new Error("Failed to generate speech with OpenAI");
  }
}

// Generate images with OpenAI
export async function generateImage(prompt: string, userApiKey?: string) {
  try {
    // Use provided user API key or fall back to environment key
    const apiKey = userApiKey || process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error("OpenAI API key is not configured. Please provide an API key or set the OPENAI_API_KEY environment variable.");
    }
    
    // Create a fresh OpenAI client with the current API key to avoid stale clients
    const imageClient = new OpenAI({ apiKey });
    
    const response = await imageClient.images.generate({
      model: "dall-e-3", // Using DALL-E 3 for high-quality images
      prompt: prompt,
      size: "1792x1024", // Landscape format for background
      quality: "hd",
      response_format: "b64_json",
    });

    if (!response.data || response.data.length === 0) {
      throw new Error("No image data returned from OpenAI");
    }

    return {
      imageBase64: response.data[0].b64_json,
      revisedPrompt: response.data[0].revised_prompt,
    };
  } catch (error) {
    console.error("OpenAI image generation error:", error);
    throw new Error("Failed to generate image with OpenAI");
  }
}

// Create a real-time session with OpenAI
export async function createRealtimeSession(voice = "alloy", model = "gpt-4o-realtime-preview-2024-12-17") {
  try {
    // Check API key before operation
    const apiKey = checkApiKey();
    
    // Ensure voice parameter is lowercase
    const normalizedVoice = voice.toLowerCase();
    
    console.log(`Creating OpenAI Realtime session with voice: ${normalizedVoice}, model: ${model}`);
    
    // Create a fresh OpenAI client with the current API key
    const realtimeClient = new OpenAI({ apiKey });
    
    // There's currently a TypeScript definition issue with the beta realtime API
    // We'll use the client directly with appropriate types
    const url = "https://api.openai.com/v1/realtime/sessions";
    
    console.log("Making request to OpenAI Realtime API...");
    
    // Define a proper type for the payload to avoid TypeScript errors
    interface RealtimeSessionPayload {
      model: string;
      voice?: string;
      modalities?: string[];
      instructions?: string;
      turn_detection?: {
        type: string;
        threshold?: number;
        prefix_padding_ms?: number;
        silence_duration_ms?: number;
        create_response?: boolean;
        interrupt_response?: boolean;
      };
    }
    
    // Construct payload according to the API docs: https://platform.openai.com/docs/api-reference/realtime
    const payload: RealtimeSessionPayload = {
      model,             // Required: The model to use
      voice: normalizedVoice,  // Use lowercase voice value
      modalities: ["text", "audio"], // Optional: The modalities to enable
      instructions: "You are a helpful, friendly AI assistant. Be concise and clear in your responses."
    };
    
    // Add turn detection only if the model supports it
    if (model.includes("realtime")) {
      payload.turn_detection = {
        type: "server_vad", // The required type parameter for turn detection
        threshold: 0.5,     // Activation threshold (0 to 1)
        silence_duration_ms: 500, // Silence duration to detect speech stop
        prefix_padding_ms: 300,   // Audio to include before VAD detected speech
        create_response: true,
        interrupt_response: true
      };
    }
    
    console.log("Request payload:", JSON.stringify(payload, null, 2));
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'OpenAI-Beta': 'realtime'
      },
      body: JSON.stringify(payload)
    });
    
    console.log(`OpenAI Realtime API response status: ${response.status}`);
    
    const responseText = await response.text();
    console.log(`OpenAI Realtime API response body length: ${responseText.length}`);
    
    if (!response.ok) {
      // Log the full error response for debugging
      console.error("OpenAI Realtime API error:", {
        status: response.status,
        statusText: response.statusText,
        responseText
      });
      throw new Error(`OpenAI Realtime API error: ${response.status} ${response.statusText}`);
    }
    
    let sessionData;
    try {
      sessionData = JSON.parse(responseText);
      console.log("Successfully parsed session data, ID:", sessionData.id);
    } catch (parseError) {
      console.error("Failed to parse session data:", parseError);
      console.log("Raw response (truncated):", responseText.substring(0, 500) + "...");
      throw new Error("Failed to parse OpenAI Realtime session data");
    }
    
    return sessionData;
  } catch (error: any) {
    console.error("OpenAI realtime session creation error:", error);
    throw new Error(`Failed to create realtime session with OpenAI: ${error.message || error}`);
  }
}

export default {
  generateText,
  chatCompletion,
  generateSpeech,
  generateImage,
  createRealtimeSession,
};
