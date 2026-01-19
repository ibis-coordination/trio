import type { ChatMessage } from '../types';

export class ChatWindow {
  private container: HTMLElement;
  private messagesEl: HTMLElement;

  constructor(container: HTMLElement) {
    this.container = container;
    this.messagesEl = document.createElement('div');
    this.messagesEl.className = 'chat-messages';
    this.messagesEl.setAttribute('data-testid', 'chat-messages');
    this.container.appendChild(this.messagesEl);
  }

  render(messages: ChatMessage[]): void {
    this.messagesEl.innerHTML = '';

    for (const msg of messages) {
      const msgEl = document.createElement('div');
      msgEl.className = `message message-${msg.role}`;
      msgEl.setAttribute('data-testid', `${msg.role}-message`);

      const roleEl = document.createElement('div');
      roleEl.className = 'message-role';
      roleEl.textContent = msg.role === 'user' ? 'You' : msg.role === 'assistant' ? 'Assistant' : 'System';

      const contentEl = document.createElement('div');
      contentEl.className = 'message-content';
      contentEl.textContent = msg.content;

      msgEl.appendChild(roleEl);
      msgEl.appendChild(contentEl);
      this.messagesEl.appendChild(msgEl);
    }

    // Auto-scroll to bottom
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  showLoading(): void {
    const loadingEl = document.createElement('div');
    loadingEl.className = 'message message-loading';
    loadingEl.setAttribute('data-testid', 'loading-indicator');
    loadingEl.innerHTML = '<div class="loading-dots"><span></span><span></span><span></span></div>';
    this.messagesEl.appendChild(loadingEl);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }

  hideLoading(): void {
    const loadingEl = this.messagesEl.querySelector('.message-loading');
    if (loadingEl) {
      loadingEl.remove();
    }
  }

  showError(error: string): void {
    const errorEl = document.createElement('div');
    errorEl.className = 'message message-error';
    errorEl.setAttribute('data-testid', 'error-message');
    errorEl.textContent = `Error: ${error}`;
    this.messagesEl.appendChild(errorEl);
    this.messagesEl.scrollTop = this.messagesEl.scrollHeight;
  }
}
