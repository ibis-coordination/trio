import type { ChatMessage } from '../types';
import { TrioDetailsPanel } from './TrioDetailsPanel';

interface MessageBubbleProps {
  readonly message: ChatMessage;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const testId =
    message.role === 'user' ? 'user-message' : 'assistant-message';

  return (
    <div
      data-testid="message-bubble"
      className={`message-bubble message-${message.role}`}
    >
      <div data-testid={testId} className="message-content">
        {message.content}
      </div>
      {message.metadata && (
        <div data-testid="response-metadata" className="message-metadata">
          <span className="metadata-model">{message.metadata.model}</span>
          {message.metadata.totalTokens && (
            <span className="metadata-tokens">
              {message.metadata.totalTokens} tokens
            </span>
          )}
          {message.metadata.durationMs && (
            <span className="metadata-duration">
              {message.metadata.durationMs}ms
            </span>
          )}
        </div>
      )}
      {message.metadata?.trioDetails && (
        <TrioDetailsPanel details={message.metadata.trioDetails} />
      )}
    </div>
  );
}
