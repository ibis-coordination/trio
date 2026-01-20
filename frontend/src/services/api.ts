/**
 * Effect-based API client for Trio chat completions
 */
import { Effect } from 'effect';
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  VotingDetails,
  AppError,
  EnsembleModel,
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
  readonly votingDetails: VotingDetails | null;
  readonly headers: Record<string, string>;
}

/**
 * Check if model is an EnsembleModel object
 */
const isEnsembleModel = (model: string | EnsembleModel): model is EnsembleModel => {
  return typeof model === 'object' && 'ensemble' in model;
};

/**
 * Validate an ensemble model configuration
 */
const validateEnsembleModel = (
  model: EnsembleModel
): Effect.Effect<EnsembleModel, ValidationError> => {
  // Validate ensemble has at least one member
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime validation of external data
  if (!model.ensemble || model.ensemble.length === 0) {
    return Effect.fail(new ValidationError('ensemble', 'At least one ensemble member required'));
  }

  // Validate each member has a non-empty model name
  const emptyModelIndex = model.ensemble.findIndex((member) => !member.model.trim());
  if (emptyModelIndex !== -1) {
    return Effect.fail(
      new ValidationError(`ensemble[${String(emptyModelIndex)}].model`, 'Model name required for all members')
    );
  }

  // Validate aggregation method is set
  // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- runtime validation of external data
  if (!model.aggregation_method) {
    return Effect.fail(new ValidationError('aggregation_method', 'Aggregation method required'));
  }

  // Validate judge model if aggregation is judge
  if (model.aggregation_method === 'judge') {
    if (!model.judge_model || !model.judge_model.trim()) {
      return Effect.fail(new ValidationError('judge_model', 'Judge model required'));
    }
  }

  // Validate synthesize model if aggregation is synthesize
  if (model.aggregation_method === 'synthesize') {
    if (!model.synthesize_model || !model.synthesize_model.trim()) {
      return Effect.fail(new ValidationError('synthesize_model', 'Synthesize model required'));
    }
  }

  // Return cleaned model with trimmed values
  return Effect.succeed({
    ...model,
    ensemble: model.ensemble.map((m) => ({
      ...m,
      model: m.model.trim(),
      system_prompt: m.system_prompt?.trim() || undefined,
    })),
    judge_model: model.judge_model?.trim(),
    synthesize_model: model.synthesize_model?.trim(),
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
  if (isEnsembleModel(request.model)) {
    return Effect.map(validateEnsembleModel(request.model), (validModel) => ({
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

        // Parse voting details from header
        const votingDetailsHeader = response.headers.get('X-Trio-Details');
        const votingDetails: VotingDetails | null = votingDetailsHeader
          ? ((parseJsonSafe(votingDetailsHeader) as VotingDetails | undefined) ?? null)
          : null;

        if (!response.ok) {
          const errorBody: unknown = await response.json().catch(() => ({}));
          const errorObj = errorBody as { readonly detail?: string; readonly message?: string } | null;
          const message = errorObj?.detail ?? errorObj?.message ?? `HTTP ${String(response.status)}`;
          throw new ApiError(response.status, message);
        }

        const data = (await response.json()) as ChatCompletionResponse;
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
