import { ChatWindow } from './components/ChatWindow';
import { MessageInput } from './components/MessageInput';
import { ModelConfig, type ModelConfigState } from './components/ModelConfig';
import { VotingDetails } from './components/VotingDetails';
import { sendChatCompletion } from './api';
import type { ChatMessage, VotingDetails as VotingDetailsType } from './types';
import './styles/main.css';

// Application state
let messages: ChatMessage[] = [];
let lastVotingDetails: VotingDetailsType | null = null;
let isLoading = false;

// Default model config (uses local Ollama models)
const defaultConfigState: ModelConfigState = {
  mode: 'simple',
  simpleModel: 'llama3.2:1b',
  ensemble: [
    { model: 'llama3.2:1b' },
    { model: 'llama3.2:1b' },
    { model: 'llama3.2:1b' },
  ],
  aggregationMethod: 'acceptance_voting',
  judgeModel: 'llama3.2:1b',
  synthesizeModel: 'llama3.2:1b',
};

let configState = { ...defaultConfigState };

// Initialize the app
function init(): void {
  const app = document.getElementById('app')!;

  // Create layout
  app.innerHTML = `
    <div class="app-container">
      <header class="app-header">
        <h1>Trio Chat</h1>
      </header>
      <div class="app-main">
        <aside class="sidebar" data-testid="sidebar">
          <div id="model-config"></div>
        </aside>
        <main class="chat-area">
          <div id="chat-window"></div>
          <div id="voting-details"></div>
          <div id="message-input"></div>
        </main>
      </div>
    </div>
  `;

  // Initialize components
  const chatWindow = new ChatWindow(document.getElementById('chat-window')!);
  const votingDetails = new VotingDetails(document.getElementById('voting-details')!);
  const modelConfig = new ModelConfig(
    document.getElementById('model-config')!,
    configState,
    (newState) => {
      configState = newState;
    }
  );

  const messageInput = new MessageInput(
    document.getElementById('message-input')!,
    async (content) => {
      if (isLoading) return;

      // Add user message
      const userMessage: ChatMessage = { role: 'user', content };
      messages.push(userMessage);
      chatWindow.render(messages);

      // Show loading
      isLoading = true;
      messageInput.setEnabled(false);
      chatWindow.showLoading();
      votingDetails.clear();

      try {
        const model = modelConfig.getModel();
        const result = await sendChatCompletion({
          model,
          messages,
        });

        // Add assistant response
        const assistantMessage = result.response.choices[0].message;
        messages.push(assistantMessage);
        lastVotingDetails = result.votingDetails;

        chatWindow.hideLoading();
        chatWindow.render(messages);
        votingDetails.render(lastVotingDetails);
      } catch (error) {
        chatWindow.hideLoading();
        chatWindow.showError(error instanceof Error ? error.message : 'Unknown error');
      } finally {
        isLoading = false;
        messageInput.setEnabled(true);
        messageInput.focus();
      }
    }
  );

  // Initial render
  chatWindow.render(messages);
  votingDetails.clear();
  messageInput.focus();
}

// Start the app
document.addEventListener('DOMContentLoaded', init);
