/**
 * Effect-based API client for Trio chat completions
 */
import { Effect } from 'effect';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  TrioDetails,
  AppError,
  TrioModel,
} from '../types';

// Error types
export class ValidationError {
  readonly _tag = 'ValidationError';
  constructor(
    readonly field: string,
    readonly message: string
  ) {}
}

export class ApiError extends Error {
  readonly _tag = 'ApiError';
  constructor(
    readonly status: number,
    message: string
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class NetworkError {
  readonly _tag = 'NetworkError';
  constructor(readonly message: string) {}
}

export type ChatError = ValidationError | ApiError | NetworkError;

/**
 * Safely parse JSON, returning undefined on failure
 */
const parseJsonSafe = (json: string): unknown => {
  try {
    return JSON.parse(json) as unknown;
  } catch {
    return undefined;
  }
};

// Response type including headers
export interface ApiResponse {
  readonly data: ChatCompletionResponse;
  readonly trioDetails: TrioDetails | null;
  readonly headers: Record<string, string>;
}

/**
 * Check if model is a TrioModel object
 */
const isTrioModel = (model: string | TrioModel): model is TrioModel => {
  return typeof model === 'object' && 'trio' in model;
};

/**
 * Validate a trio model configuration
 */
const validateTrioModel = (
  model: TrioModel
): Effect.Effect<TrioModel, ValidationError> => {
  // Validate trio has exactly 3 members
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime validation of external data
  if (!model.trio || model.trio.length !== 3) {
    return Effect.fail(new ValidationError('trio', 'Trio must have exactly 3 members'));
  }

  // Validate each member has a non-empty model name
  const emptyModelIndex = model.trio.findIndex((member) => !member.model.trim());
  if (emptyModelIndex !== -1) {
    const labels = ['A', 'B', 'C'];
    return Effect.fail(
      new ValidationError(`trio[${labels[emptyModelIndex]}].model`, `Model ${labels[emptyModelIndex]} name required`)
    );
  }

  // Return cleaned model with trimmed values
  const [m0, m1, m2] = model.trio;
  return Effect.succeed({
    trio: [
      { model: m0.model.trim(), messages: m0.messages },
      { model: m1.model.trim(), messages: m1.messages },
      { model: m2.model.trim(), messages: m2.messages },
    ] as const,
  });
};

/**
 * Validate a chat request
 */
const validateRequest = (
  request: ChatCompletionRequest
): Effect.Effect<ChatCompletionRequest, ValidationError> => {
  // Validate messages
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime validation of external data
  if (!request.messages || request.messages.length === 0) {
    return Effect.fail(new ValidationError('messages', 'Messages required'));
  }

  // Validate model based on type
  if (isTrioModel(request.model)) {
    return Effect.map(validateTrioModel(request.model), (validModel) => ({
      ...request,
      model: validModel,
    }));
  }

  // Simple mode: validate model string
  const modelTrimmed = request.model.trim();
  if (!modelTrimmed) {
    return Effect.fail(new ValidationError('model', 'Model name required'));
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

        // Collect headers (immutably)
        const headers: Record<string, string> = Object.fromEntries(response.headers.entries());

        // Parse trio details from header
        const trioDetailsHeader = response.headers.get('X-Trio-Details');
        const trioDetails: TrioDetails | null = trioDetailsHeader
          ? ((parseJsonSafe(trioDetailsHeader) as TrioDetails | undefined) ?? null)
          : null;

        if (!response.ok) {
          const errorBody: unknown = await response.json().catch(() => ({}));
          const errorObj = errorBody as { readonly detail?: string; readonly message?: string } | null;
          const message = errorObj?.detail ?? errorObj?.message ?? `HTTP ${String(response.status)}`;
          throw new ApiError(response.status, message);
        }

        const data = (await response.json()) as ChatCompletionResponse;
        return { data, trioDetails, headers };
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
