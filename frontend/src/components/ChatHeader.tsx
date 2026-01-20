interface ChatHeaderProps {
  onClearChat: () => void;
  onToggleDebug: () => void;
  debugVisible: boolean;
}

export function ChatHeader({
  onClearChat,
  onToggleDebug,
  debugVisible,
}: ChatHeaderProps) {
  return (
    <div className="chat-header">
      <h1>Trio Chat</h1>
      <div className="chat-header-actions">
        <button
          data-testid="clear-chat-button"
          className="header-button"
          onClick={onClearChat}
        >
          Clear Chat
        </button>
        <button
          data-testid="debug-toggle-button"
          className="header-button"
          onClick={onToggleDebug}
        >
          {debugVisible ? 'Hide Debug' : 'Show Debug'}
        </button>
      </div>
    </div>
  );
}
