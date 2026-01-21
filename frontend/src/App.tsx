import { useState, useCallback, useRef } from 'react';
import { Effect } from 'effect';
import type {
  ChatMessage,
  AppError,
  DebugInfo,
  ChatCompletionRequest,
  ConfigMode,
  TrioModel,
} from './types';
import { sendChatCompletion, toAppError, ValidationError } from './services/api';
import { ModelConfigPanel } from './components/ModelConfigPanel';
import { ChatPanel } from './components/ChatPanel';
import { DebugPanel } from './components/DebugPanel';

// Default trio configuration - 3 members (A, B, C)
const DEFAULT_TRIO_CONFIG: TrioModel = {
  trio: [
    { model: '' },
    { model: '' },
    { model: '' },
  ],
};

export function App() {
  // Model configuration state
  const [mode, setMode] = useState<ConfigMode>('simple');
  const [model, setModel] = useState('llama3.2:1b');
  const [trioConfig, setTrioConfig] = useState<TrioModel>(DEFAULT_TRIO_CONFIG);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Chat state
  const [messages, setMessages] = useState<readonly ChatMessage[]>([]);
  const messagesRef = useRef<readonly ChatMessage[]>([]); // Ref to avoid stale closure
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<AppError | null>(null);

  // Keep ref in sync with state
  messagesRef.current = messages;

  // Debug state
  const [debugVisible, setDebugVisible] = useState(false);
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    lastRequest: null,
    lastResponse: null,
    lastHeaders: null,
  });

  // Clear validation error when mode changes
  const handleModeChange = useCallback((newMode: ConfigMode) => {
    setMode(newMode);
    setValidationError(null);
  }, []);

  // Clear validation error when model changes
  const handleModelChange = useCallback((newModel: string) => {
    setModel(newModel);
    setValidationError(null);
  }, []);

  // Clear validation error when trio config changes
  const handleTrioConfigChange = useCallback((newConfig: TrioModel) => {
    setTrioConfig(newConfig);
    setValidationError(null);
  }, []);

  // Send message handler
  const handleSendMessage = useCallback(
    async (content: string) => {
      // Use ref to get latest messages (avoids stale closure)
      const currentMessages = messagesRef.current;

      // Create the request with full conversation history
      const requestMessages = [
        ...currentMessages.map((m) => ({ role: m.role, content: m.content })),
        { role: 'user' as const, content },
      ];

      // Build request based on mode
      const request: ChatCompletionRequest = {
        model: mode === 'simple' ? model : trioConfig,
        messages: requestMessages,
      };

      // Add user message to chat immediately
      const userMessage: ChatMessage = {
        id: `user-${String(Date.now())}`,
        role: 'user',
        content,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMessage]);

      // Update debug info
      setDebugInfo((prev) => ({
        ...prev,
        lastRequest: request,
      }));

      // Clear any previous errors
      setError(null);
      setIsLoading(true);

      // Send the request using Effect
      const result = await Effect.runPromise(
        Effect.either(sendChatCompletion(request))
      );

      setIsLoading(false);

      if (result._tag === 'Left') {
        const chatError = result.left;
        const appError = toAppError(chatError);

        // If validation error, show it inline
        if (chatError instanceof ValidationError) {
          setValidationError(appError.message);
          // Remove the user message we optimistically added
          setMessages((prev) => prev.filter((m) => m.id !== userMessage.id));
        } else {
          setError(appError);
        }
        return;
      }

      const { data, trioDetails, headers } = result.right;

      // Update debug info
      setDebugInfo((prev) => ({
        ...prev,
        lastResponse: data,
        lastHeaders: headers,
      }));

      // Add assistant message with trio details if available
      const assistantMessage: ChatMessage = {
        id: `assistant-${String(Date.now())}`,
        role: 'assistant',
        content: data.choices[0]?.message.content || '',
        timestamp: new Date(),
        metadata: {
          model: data.model,
          finishReason: data.choices[0]?.finish_reason,
          promptTokens: data.usage?.prompt_tokens,
          completionTokens: data.usage?.completion_tokens,
          totalTokens: data.usage?.total_tokens,
          trioDetails: trioDetails || undefined,
        },
      };
      setMessages((prev) => [...prev, assistantMessage]);
    },
    [mode, model, trioConfig]
  );

  // Clear chat handler
  const handleClearChat = useCallback(() => {
    setMessages([]);
    setError(null);
    setDebugInfo({
      lastRequest: null,
      lastResponse: null,
      lastHeaders: null,
    });
  }, []);

  // Toggle debug panel
  const handleToggleDebug = useCallback(() => {
    setDebugVisible((prev) => !prev);
  }, []);

  // Dismiss error
  const handleDismissError = useCallback(() => {
    setError(null);
  }, []);

  return (
    <div className="app">
      <div className="app-layout">
        <ModelConfigPanel
          mode={mode}
          onModeChange={handleModeChange}
          model={model}
          onModelChange={handleModelChange}
          trioConfig={trioConfig}
          onTrioConfigChange={handleTrioConfigChange}
          validationError={validationError}
        />

        <ChatPanel
          messages={messages}
          isLoading={isLoading}
          error={error}
          debugVisible={debugVisible}
          onSendMessage={(content) => {
            void handleSendMessage(content);
          }}
          onClearChat={handleClearChat}
          onToggleDebug={handleToggleDebug}
          onDismissError={handleDismissError}
        />
      </div>

      {debugVisible && <DebugPanel debugInfo={debugInfo} />}
    </div>
  );
}
