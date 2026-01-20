/**
 * Effect Schema definitions for request validation
 */
import { Schema } from 'effect';

// Model name validation - non-empty string
export const ModelName = Schema.NonEmptyTrimmedString.annotations({
  message: () => 'Model name required',
});

// Message content validation - non-empty string
export const MessageContent = Schema.NonEmptyTrimmedString.annotations({
  message: () => 'Message required',
});

// Chat message schema
export const ChatMessageSchema = Schema.Struct({
  role: Schema.Literal('user', 'assistant', 'system'),
  content: Schema.String, // Don't validate content here, just model
});

// Simple mode request validation
export const SimpleRequestSchema = Schema.Struct({
  model: ModelName,
  messages: Schema.NonEmptyArray(ChatMessageSchema),
});

// Type inference
export type SimpleRequest = typeof SimpleRequestSchema.Type;
