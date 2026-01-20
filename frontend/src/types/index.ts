/**
 * Shared TypeScript types for the Trio Chat UI
 */

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata?: ResponseMetadata;
}

export interface ResponseMetadata {
  model: string;
  finishReason?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  durationMs?: number;
}

export interface VotingDetails {
  aggregation_method: string;
  candidates: Candidate[];
  winner_index: number;
}

export interface Candidate {
  model: string;
  response: string;
  votes?: {
    accepted: number;
    preferred: number;
  };
}

// API types
export interface ChatCompletionRequest {
  model: string;
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: 'assistant';
      content: string;
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

// App state types
export type AppState = 'idle' | 'loading' | 'error';

export interface AppError {
  type: 'validation' | 'api' | 'network';
  message: string;
  field?: string;
}

export interface DebugInfo {
  lastRequest: ChatCompletionRequest | null;
  lastResponse: ChatCompletionResponse | null;
  lastHeaders: Record<string, string> | null;
}
