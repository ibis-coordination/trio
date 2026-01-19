// Types matching src/models.py

export type AggregationMethod = 'acceptance_voting' | 'random' | 'judge' | 'synthesize' | 'concat';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface EnsembleMember {
  model: string | EnsembleModel;
  system_prompt?: string;
}

export interface EnsembleModel {
  ensemble: EnsembleMember[];
  aggregation_method: AggregationMethod;
  judge_model?: string;
  synthesize_model?: string;
}

export interface Candidate {
  model: string;
  response: string;
  accepted: number;
  preferred: number;
}

export interface VotingDetails {
  winner_index: number;
  candidates: Candidate[];
  aggregation_method: AggregationMethod | 'none';
}

export interface ChatCompletionRequest {
  model: string | EnsembleModel;
  messages: ChatMessage[];
  max_tokens?: number;
  temperature?: number;
}

export interface ChatCompletionChoice {
  index: number;
  message: ChatMessage;
  finish_reason: string;
}

export interface ChatCompletionResponse {
  id: string;
  model: string;
  choices: ChatCompletionChoice[];
}
