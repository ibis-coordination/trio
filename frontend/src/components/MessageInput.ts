export class MessageInput {
  private container: HTMLElement;
  private inputEl: HTMLTextAreaElement;
  private sendBtn: HTMLButtonElement;
  private onSend: (message: string) => void;

  constructor(container: HTMLElement, onSend: (message: string) => void) {
    this.container = container;
    this.onSend = onSend;

    const form = document.createElement('form');
    form.className = 'message-input-form';

    this.inputEl = document.createElement('textarea');
    this.inputEl.className = 'message-input';
    this.inputEl.setAttribute('data-testid', 'message-input');
    this.inputEl.placeholder = 'Type your message...';
    this.inputEl.rows = 2;

    this.sendBtn = document.createElement('button');
    this.sendBtn.type = 'submit';
    this.sendBtn.className = 'send-button';
    this.sendBtn.setAttribute('data-testid', 'send-button');
    this.sendBtn.textContent = 'Send';

    form.appendChild(this.inputEl);
    form.appendChild(this.sendBtn);
    this.container.appendChild(form);

    form.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleSend();
    });

    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSend();
      }
    });
  }

  private handleSend(): void {
    const message = this.inputEl.value.trim();
    if (message) {
      this.onSend(message);
      this.inputEl.value = '';
    }
  }

  setEnabled(enabled: boolean): void {
    this.inputEl.disabled = !enabled;
    this.sendBtn.disabled = !enabled;
  }

  focus(): void {
    this.inputEl.focus();
  }
}
