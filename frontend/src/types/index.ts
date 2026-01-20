/**
 * Shared TypeScript types for the Trio Chat UI
 */

// Aggregation methods supported by Trio
export type AggregationMethod = 'acceptance_voting' | 'random' | 'judge' | 'synthesize' | 'concat';

// Configuration mode
export type ConfigMode = 'simple' | 'ensemble';

// Ensemble member (model + optional system prompt)
export interface EnsembleMember {
  readonly model: string;
  readonly system_prompt?: string;
}

// Ensemble model configuration
export interface EnsembleModel {
  readonly ensemble: readonly EnsembleMember[];
  readonly aggregation_method: AggregationMethod;
  readonly judge_model?: string;
  readonly synthesize_model?: string;
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
  readonly votingDetails?: VotingDetails;
}

export interface VotingDetails {
  readonly aggregation_method: string;
  readonly candidates: readonly Candidate[];
  readonly winner_index: number;
}

export interface Candidate {
  readonly model: string;
  readonly response: string;
  readonly votes?: {
    readonly accepted: number;
    readonly preferred: number;
  };
}

// API types
export interface ChatCompletionRequest {
  readonly model: string | EnsembleModel;
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
