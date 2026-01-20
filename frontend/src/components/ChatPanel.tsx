import type { ChatMessage, AppError } from '../types';
import { ChatHeader } from './ChatHeader';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { ErrorBanner } from './ErrorBanner';

interface ChatPanelProps {
  readonly messages: readonly ChatMessage[];
  readonly isLoading: boolean;
  readonly error: AppError | null;
  readonly debugVisible: boolean;
  readonly onSendMessage: (message: string) => void;
  readonly onClearChat: () => void;
  readonly onToggleDebug: () => void;
  readonly onDismissError: () => void;
}

export function ChatPanel({
  messages,
  isLoading,
  error,
  debugVisible,
  onSendMessage,
  onClearChat,
  onToggleDebug,
  onDismissError,
}: ChatPanelProps) {
  return (
    <div data-testid="chat-panel" className="chat-panel">
      <ChatHeader
        onClearChat={onClearChat}
        onToggleDebug={onToggleDebug}
        debugVisible={debugVisible}
      />

      <MessageList messages={messages} isLoading={isLoading} />

      {error && error.type !== 'validation' && (
        <ErrorBanner error={error} onDismiss={onDismissError} />
      )}

      <MessageInput onSend={onSendMessage} disabled={isLoading} />
    </div>
  );
}
