import { test, expect } from '@playwright/test';

/**
 * Phase 1 E2E Tests: Simple Mode Chat
 *
 * These tests define the expected behavior for the v2 chat UI.
 * TDD approach: tests written first, then implementation to make them pass.
 */

test.describe('Chat UI v2 - Phase 1: Simple Mode', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat/');
  });

  test.describe('Initial State', () => {
    test('displays the chat interface with required elements', async ({ page }) => {
      // Model config panel
      await expect(page.getByTestId('model-config-panel')).toBeVisible();
      await expect(page.getByTestId('model-input')).toBeVisible();

      // Chat panel
      await expect(page.getByTestId('chat-panel')).toBeVisible();
      await expect(page.getByTestId('message-list')).toBeVisible();
      await expect(page.getByTestId('message-input')).toBeVisible();
      await expect(page.getByTestId('send-button')).toBeVisible();

      // Chat header with controls
      await expect(page.getByTestId('clear-chat-button')).toBeVisible();
      await expect(page.getByTestId('debug-toggle-button')).toBeVisible();
    });

    test('starts with empty message list', async ({ page }) => {
      const messages = page.getByTestId('message-bubble');
      await expect(messages).toHaveCount(0);
    });

    test('debug panel is hidden by default', async ({ page }) => {
      await expect(page.getByTestId('debug-panel')).not.toBeVisible();
    });

    test('model input has default value', async ({ page }) => {
      const modelInput = page.getByTestId('model-input');
      // Should have some default model name
      await expect(modelInput).not.toHaveValue('');
    });
  });

  test.describe('Sending Messages', () => {
    test('can send a message and receive a response', async ({ page }) => {
      // Mock the API
      await page.route('/v1/chat/completions', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-123',
            model: 'llama3.2:1b',
            choices: [{
              index: 0,
              message: { role: 'assistant', content: 'Hello! How can I help you?' },
              finish_reason: 'stop',
            }],
          }),
        });
      });

      // Send a message
      await page.getByTestId('message-input').fill('Hello');
      await page.getByTestId('send-button').click();

      // Check user message appears
      await expect(page.getByTestId('user-message')).toContainText('Hello');

      // Check assistant message appears
      await expect(page.getByTestId('assistant-message')).toContainText('Hello! How can I help you?');
    });

    test('pressing Enter sends the message', async ({ page }) => {
      await page.route('/v1/chat/completions', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-123',
            model: 'llama3.2:1b',
            choices: [{
              index: 0,
              message: { role: 'assistant', content: 'Response' },
              finish_reason: 'stop',
            }],
          }),
        });
      });

      await page.getByTestId('message-input').fill('Test message');
      await page.getByTestId('message-input').press('Enter');

      await expect(page.getByTestId('user-message')).toContainText('Test message');
    });

    test('Shift+Enter adds a newline instead of sending', async ({ page }) => {
      const input = page.getByTestId('message-input');
      await input.fill('Line 1');
      await input.press('Shift+Enter');
      await input.type('Line 2');

      // Message should not be sent, input should contain both lines
      await expect(input).toHaveValue('Line 1\nLine 2');
      await expect(page.getByTestId('user-message')).toHaveCount(0);
    });

    test('clears input after sending', async ({ page }) => {
      await page.route('/v1/chat/completions', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-123',
            model: 'test',
            choices: [{ index: 0, message: { role: 'assistant', content: 'OK' }, finish_reason: 'stop' }],
          }),
        });
      });

      const input = page.getByTestId('message-input');
      await input.fill('Hello');
      await page.getByTestId('send-button').click();

      // Wait for response
      await expect(page.getByTestId('assistant-message')).toBeVisible();

      // Input should be cleared
      await expect(input).toHaveValue('');
    });

    test('shows loading state while waiting for response', async ({ page }) => {
      await page.route('/v1/chat/completions', async (route) => {
        await new Promise(resolve => setTimeout(resolve, 300));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-123',
            model: 'test',
            choices: [{ index: 0, message: { role: 'assistant', content: 'Done' }, finish_reason: 'stop' }],
          }),
        });
      });

      await page.getByTestId('message-input').fill('Test');
      await page.getByTestId('send-button').click();

      // Loading indicator should appear
      await expect(page.getByTestId('loading-indicator')).toBeVisible();

      // Send button should be disabled during loading
      await expect(page.getByTestId('send-button')).toBeDisabled();

      // Input should be disabled during loading
      await expect(page.getByTestId('message-input')).toBeDisabled();

      // After response, loading indicator should disappear
      await expect(page.getByTestId('assistant-message')).toBeVisible();
      await expect(page.getByTestId('loading-indicator')).not.toBeVisible();
      // Input should be enabled (button may be disabled because input is empty after clear)
      await expect(page.getByTestId('message-input')).toBeEnabled();
      // Verify we can type again
      await page.getByTestId('message-input').fill('Another message');
      await expect(page.getByTestId('send-button')).toBeEnabled();
    });

    test('prevents double-submit while loading', async ({ page }) => {
      let requestCount = 0;
      await page.route('/v1/chat/completions', async (route) => {
        requestCount++;
        await new Promise(resolve => setTimeout(resolve, 200));
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-123',
            model: 'test',
            choices: [{ index: 0, message: { role: 'assistant', content: 'Response' }, finish_reason: 'stop' }],
          }),
        });
      });

      await page.getByTestId('message-input').fill('Test');
      await page.getByTestId('send-button').click();

      // Try to click again while loading
      await page.getByTestId('send-button').click({ force: true });

      await expect(page.getByTestId('assistant-message')).toBeVisible();
      expect(requestCount).toBe(1);
    });
  });

  test.describe('Client-Side Validation', () => {
    test('prevents sending empty message', async ({ page }) => {
      const sendButton = page.getByTestId('send-button');
      const input = page.getByTestId('message-input');

      // Empty input - button should be disabled
      await expect(input).toHaveValue('');
      await expect(sendButton).toBeDisabled();

      // No message should be sent
      await expect(page.getByTestId('user-message')).toHaveCount(0);
    });

    test('prevents sending whitespace-only message', async ({ page }) => {
      const sendButton = page.getByTestId('send-button');
      await page.getByTestId('message-input').fill('   ');

      // Button should be disabled for whitespace-only input
      await expect(sendButton).toBeDisabled();

      await expect(page.getByTestId('user-message')).toHaveCount(0);
    });

    test('shows validation error for empty model name', async ({ page }) => {
      // Clear the model input
      await page.getByTestId('model-input').fill('');

      // Try to send a message
      await page.getByTestId('message-input').fill('Hello');
      await page.getByTestId('send-button').click();

      // Should show validation error, not send
      await expect(page.getByTestId('validation-error')).toBeVisible();
      await expect(page.getByTestId('validation-error')).toContainText('Model name required');
      await expect(page.getByTestId('user-message')).toHaveCount(0);
    });

    test('validation error clears when input is corrected', async ({ page }) => {
      // Trigger validation error
      await page.getByTestId('model-input').fill('');
      await page.getByTestId('message-input').fill('Hello');
      await page.getByTestId('send-button').click();

      await expect(page.getByTestId('validation-error')).toBeVisible();

      // Fix the model input
      await page.getByTestId('model-input').fill('llama3.2:1b');

      // Error should clear
      await expect(page.getByTestId('validation-error')).not.toBeVisible();
    });
  });

  test.describe('Error Handling', () => {
    test('displays API error in error banner', async ({ page }) => {
      await page.route('/v1/chat/completions', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Invalid model name' }),
        });
      });

      await page.getByTestId('message-input').fill('Hello');
      await page.getByTestId('send-button').click();

      await expect(page.getByTestId('error-banner')).toBeVisible();
      await expect(page.getByTestId('error-banner')).toContainText('Invalid model name');
    });

    test('displays network error gracefully', async ({ page }) => {
      await page.route('/v1/chat/completions', async (route) => {
        await route.abort('failed');
      });

      await page.getByTestId('message-input').fill('Hello');
      await page.getByTestId('send-button').click();

      await expect(page.getByTestId('error-banner')).toBeVisible();
      // Should show a user-friendly network error message
      await expect(page.getByTestId('error-banner')).toContainText(/network|connection|failed/i);
    });

    test('can dismiss error banner', async ({ page }) => {
      await page.route('/v1/chat/completions', async (route) => {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Server error' }),
        });
      });

      await page.getByTestId('message-input').fill('Hello');
      await page.getByTestId('send-button').click();

      await expect(page.getByTestId('error-banner')).toBeVisible();

      // Dismiss the error
      await page.getByTestId('error-dismiss-button').click();

      await expect(page.getByTestId('error-banner')).not.toBeVisible();
    });

    test('can retry after error', async ({ page }) => {
      let callCount = 0;
      await page.route('/v1/chat/completions', async (route) => {
        callCount++;
        if (callCount === 1) {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ detail: 'Temporary error' }),
          });
        } else {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              id: 'test-123',
              model: 'test',
              choices: [{ index: 0, message: { role: 'assistant', content: 'Success!' }, finish_reason: 'stop' }],
            }),
          });
        }
      });

      // First attempt fails
      await page.getByTestId('message-input').fill('Hello');
      await page.getByTestId('send-button').click();
      await expect(page.getByTestId('error-banner')).toBeVisible();

      // Dismiss error and retry
      await page.getByTestId('error-dismiss-button').click();
      await page.getByTestId('message-input').fill('Hello again');
      await page.getByTestId('send-button').click();

      await expect(page.getByTestId('assistant-message')).toContainText('Success!');
    });

    test('error is displayed as banner, not as chat message', async ({ page }) => {
      await page.route('/v1/chat/completions', async (route) => {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({ detail: 'Bad request' }),
        });
      });

      await page.getByTestId('message-input').fill('Hello');
      await page.getByTestId('send-button').click();

      // Error should be in banner, not in message list
      await expect(page.getByTestId('error-banner')).toBeVisible();
      await expect(page.getByTestId('assistant-message')).toHaveCount(0);

      // User message should still appear (they typed it)
      await expect(page.getByTestId('user-message')).toContainText('Hello');
    });
  });

  test.describe('Clear Chat', () => {
    test('clear button removes all messages', async ({ page }) => {
      await page.route('/v1/chat/completions', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-123',
            model: 'test',
            choices: [{ index: 0, message: { role: 'assistant', content: 'Hi!' }, finish_reason: 'stop' }],
          }),
        });
      });

      // Send a message
      await page.getByTestId('message-input').fill('Hello');
      await page.getByTestId('send-button').click();
      await expect(page.getByTestId('assistant-message')).toBeVisible();

      // Clear chat
      await page.getByTestId('clear-chat-button').click();

      // Messages should be gone
      await expect(page.getByTestId('user-message')).toHaveCount(0);
      await expect(page.getByTestId('assistant-message')).toHaveCount(0);
    });
  });

  test.describe('Debug Panel', () => {
    test('toggle button shows/hides debug panel', async ({ page }) => {
      await expect(page.getByTestId('debug-panel')).not.toBeVisible();

      // Show debug panel
      await page.getByTestId('debug-toggle-button').click();
      await expect(page.getByTestId('debug-panel')).toBeVisible();

      // Hide debug panel
      await page.getByTestId('debug-toggle-button').click();
      await expect(page.getByTestId('debug-panel')).not.toBeVisible();
    });

    test('debug panel shows last request and response', async ({ page }) => {
      await page.route('/v1/chat/completions', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-123',
            model: 'llama3.2:1b',
            choices: [{ index: 0, message: { role: 'assistant', content: 'Debug test' }, finish_reason: 'stop' }],
          }),
        });
      });

      // Send a message
      await page.getByTestId('message-input').fill('Hello');
      await page.getByTestId('send-button').click();
      await expect(page.getByTestId('assistant-message')).toBeVisible();

      // Show debug panel
      await page.getByTestId('debug-toggle-button').click();

      // Check request is shown
      const requestPanel = page.getByTestId('debug-request');
      await expect(requestPanel).toBeVisible();
      await expect(requestPanel).toContainText('Hello');

      // Check response is shown
      const responsePanel = page.getByTestId('debug-response');
      await expect(responsePanel).toBeVisible();
      await expect(responsePanel).toContainText('Debug test');
    });
  });

  test.describe('Accessibility', () => {
    test('message input can be focused with keyboard', async ({ page }) => {
      const input = page.getByTestId('message-input');
      await input.focus();
      await expect(input).toBeFocused();
    });

    test('messages are displayed in order', async ({ page }) => {
      await page.route('/v1/chat/completions', async (route) => {
        const body = JSON.parse(route.request().postData() || '{}');
        const lastMessage = body.messages[body.messages.length - 1].content;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'test-123',
            model: 'test',
            choices: [{ index: 0, message: { role: 'assistant', content: `Reply to: ${lastMessage}` }, finish_reason: 'stop' }],
          }),
        });
      });

      // Send first message
      await page.getByTestId('message-input').fill('First');
      await page.getByTestId('send-button').click();
      await expect(page.getByTestId('assistant-message')).toBeVisible();

      // Send second message
      await page.getByTestId('message-input').fill('Second');
      await page.getByTestId('send-button').click();

      // Wait for second response
      await expect(page.getByTestId('assistant-message')).toHaveCount(2);

      // Check order
      const messages = page.getByTestId('message-bubble');
      await expect(messages.nth(0)).toContainText('First');
      await expect(messages.nth(1)).toContainText('Reply to: First');
      await expect(messages.nth(2)).toContainText('Second');
      await expect(messages.nth(3)).toContainText('Reply to: Second');
    });
  });
});
