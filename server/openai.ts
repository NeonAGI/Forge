import OpenAI from "openai";

// the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "" });

// Text generation with the OpenAI API
export async function generateText(prompt: string, maxTokens = 500) {
  try {
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

export default {
  generateText,
  chatCompletion,
  generateSpeech,
};
