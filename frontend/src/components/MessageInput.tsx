import { useState, useCallback, KeyboardEvent } from 'react';

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled: boolean;
}

export function MessageInput({ onSend, disabled }: MessageInputProps) {
  const [value, setValue] = useState('');

  const handleSend = useCallback(() => {
    const trimmed = value.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setValue('');
    }
  }, [value, disabled, onSend]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSend();
      }
    },
    [handleSend]
  );

  return (
    <div className="message-input-container">
      <textarea
        data-testid="message-input"
        className="message-input"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder="Type a message..."
        rows={3}
      />
      <button
        data-testid="send-button"
        className="send-button"
        onClick={handleSend}
        disabled={disabled || !value.trim()}
      >
        Send
      </button>
    </div>
  );
}
