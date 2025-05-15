// Weather types
export interface WeatherData {
  currentWeather: {
    temperature: string;
    unit: string;
    weatherCode: string;
    description: string;
  };
  forecast: Array<{
    time: string;
    temperature: string;
    weatherCode: string;
    isDay: boolean;
  }>;
  location: string;
}

// Calendar types
export interface CalendarEvent {
  id: string;
  title: string;
  date: string;
  month: string;
  time: string;
  color: string;
}

// Chat/Assistant types
export interface ChatMessage {
  role: "assistant" | "user";
  content: string;
}

export interface ChatRequest {
  message: string;
  conversationHistory: ChatMessage[];
}

export interface ChatResponse {
  response: string;
}

// OpenAI Realtime types
export interface RealtimeSessionRequest {
  voice: string;
  model: string;
}

export interface RealtimeSessionResponse {
  sessionId: string;
  offer: RTCSessionDescriptionInit;
}

export interface RealtimeAnswerRequest {
  sessionId: string;
  answer: RTCSessionDescriptionInit;
}

export interface RealtimeIceCandidateRequest {
  sessionId: string;
  candidate: RTCIceCandidate;
}

// Custom TypeScript interfaces for SpeechRecognition
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
}

interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
}

interface SpeechRecognitionAlternative {
  readonly transcript: string;
  readonly confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onerror: (event: SpeechRecognitionErrorEvent) => void;
  onend: () => void;
  onresult: (event: SpeechRecognitionEvent) => void;
  start(): void;
  stop(): void;
}

declare global {
  interface Window {
    SpeechRecognition?: typeof SpeechRecognition;
    webkitSpeechRecognition?: typeof SpeechRecognition;
  }
}
