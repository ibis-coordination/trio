/**
 * Effect-based API client for Trio chat completions
 */
import { Effect } from 'effect';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  VotingDetails,
  AppError,
} from '../types';

// Error types
export class ValidationError {
  readonly _tag = 'ValidationError';
  constructor(
    readonly field: string,
    readonly message: string
  ) {}
}

export class ApiError {
  readonly _tag = 'ApiError';
  constructor(
    readonly status: number,
    readonly message: string
  ) {}
}

export class NetworkError {
  readonly _tag = 'NetworkError';
  constructor(readonly message: string) {}
}

export type ChatError = ValidationError | ApiError | NetworkError;

// Response type including headers
export interface ApiResponse {
  data: ChatCompletionResponse;
  votingDetails: VotingDetails | null;
  headers: Record<string, string>;
}

/**
 * Validate a chat request
 */
const validateRequest = (
  request: ChatCompletionRequest
): Effect.Effect<ChatCompletionRequest, ValidationError> => {
  // Validate model name
  const modelTrimmed = request.model.trim();
  if (!modelTrimmed) {
    return Effect.fail(new ValidationError('model', 'Model name required'));
  }

  // Validate messages
  if (!request.messages || request.messages.length === 0) {
    return Effect.fail(new ValidationError('messages', 'Messages required'));
  }

  return Effect.succeed({ ...request, model: modelTrimmed });
};

/**
 * Send a chat completion request to the API
 */
export const sendChatCompletion = (
  request: ChatCompletionRequest
): Effect.Effect<ApiResponse, ChatError> =>
  Effect.flatMap(validateRequest(request), (validRequest) =>
    Effect.tryPromise({
      try: async () => {
        const response = await fetch('/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(validRequest),
        });

        // Collect headers
        const headers: Record<string, string> = {};
        response.headers.forEach((value, key) => {
          headers[key] = value;
        });

        // Parse voting details from header
        let votingDetails: VotingDetails | null = null;
        const votingDetailsHeader = response.headers.get('X-Trio-Details');
        if (votingDetailsHeader) {
          try {
            votingDetails = JSON.parse(votingDetailsHeader);
          } catch {
            // Ignore parse errors for voting details
          }
        }

        if (!response.ok) {
          const errorBody = await response.json().catch(() => ({}));
          const message =
            errorBody.detail || errorBody.message || `HTTP ${response.status}`;
          throw new ApiError(response.status, message);
        }

        const data: ChatCompletionResponse = await response.json();
        return { data, votingDetails, headers };
      },
      catch: (error) => {
        if (error instanceof ApiError) {
          return error;
        }
        if (error instanceof TypeError) {
          // Network errors are TypeErrors in fetch
          return new NetworkError(
            'Network error: Unable to connect to server'
          );
        }
        return new NetworkError(
          error instanceof Error ? error.message : 'Unknown error'
        );
      },
    })
  );

/**
 * Convert ChatError to AppError for UI display
 */
export const toAppError = (error: ChatError): AppError => {
  switch (error._tag) {
    case 'ValidationError':
      return {
        type: 'validation',
        message: error.message,
        field: error.field,
      };
    case 'ApiError':
      return {
        type: 'api',
        message: error.message,
      };
    case 'NetworkError':
      return {
        type: 'network',
        message: error.message,
      };
  }
};
