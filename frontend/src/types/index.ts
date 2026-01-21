/**
 * Shared TypeScript types for the Trio Chat UI
 */

// Configuration mode
export type ConfigMode = 'simple' | 'trio';

// API message format (for trio member messages)
export interface ApiMessage {
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
}

// Trio member (model + optional messages for variance vectors)
export interface TrioMember {
  readonly model: string;
  readonly messages?: readonly ApiMessage[];
}

// Trio model configuration - exactly 3 members (A, B, C)
export interface TrioModel {
  readonly trio: readonly [TrioMember, TrioMember, TrioMember];
}

export interface ChatMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
  readonly timestamp: Date;
  readonly metadata?: ResponseMetadata;
}

export interface ResponseMetadata {
  readonly model: string;
  readonly finishReason?: string;
  readonly promptTokens?: number;
  readonly completionTokens?: number;
  readonly totalTokens?: number;
  readonly durationMs?: number;
  readonly trioDetails?: TrioDetails;
}

// Trio execution details from X-Trio-Details header
export interface TrioDetails {
  readonly response_a: string;
  readonly response_b: string;
  readonly model_a: string;
  readonly model_b: string;
  readonly model_c: string;
}

// API types
export interface ChatCompletionRequest {
  readonly model: string | TrioModel;
  readonly messages: ReadonlyArray<{
    readonly role: 'user' | 'assistant' | 'system';
    readonly content: string;
  }>;
}

export interface ChatCompletionResponse {
  readonly id: string;
  readonly model: string;
  readonly choices: ReadonlyArray<{
    readonly index: number;
    readonly message: {
      readonly role: 'assistant';
      readonly content: string;
    };
    readonly finish_reason: string;
  }>;
  readonly usage?: {
    readonly prompt_tokens: number;
    readonly completion_tokens: number;
    readonly total_tokens: number;
  };
}

// App state types
export type AppState = 'idle' | 'loading' | 'error';

export interface AppError {
  readonly type: 'validation' | 'api' | 'network';
  readonly message: string;
  readonly field?: string;
}

export interface DebugInfo {
  readonly lastRequest: ChatCompletionRequest | null;
  readonly lastResponse: ChatCompletionResponse | null;
  readonly lastHeaders: Record<string, string> | null;
}
