import { test, expect } from '@playwright/test';

test.describe('Trio Chat UI', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat/');
  });

  test('displays the chat interface', async ({ page }) => {
    // Check header is present
    await expect(page.locator('h1')).toContainText('Trio Chat');

    // Check main components are present
    await expect(page.locator('[data-testid="message-input"]')).toBeVisible();
    await expect(page.locator('[data-testid="send-button"]')).toBeVisible();
    await expect(page.locator('[data-testid="model-config"]')).toBeVisible();
    await expect(page.locator('[data-testid="chat-messages"]')).toBeVisible();
  });

  test('can switch between simple and ensemble mode', async ({ page }) => {
    const modeSelect = page.locator('[data-testid="mode-select"]');

    // Default should be simple mode
    await expect(modeSelect).toHaveValue('simple');
    await expect(page.locator('[data-testid="simple-model-input"]')).toBeVisible();

    // Switch to ensemble mode
    await modeSelect.selectOption('ensemble');
    await expect(page.locator('[data-testid="aggregation-select"]')).toBeVisible();
    await expect(page.locator('[data-testid="ensemble-members"]')).toBeVisible();

    // Switch back to simple
    await modeSelect.selectOption('simple');
    await expect(page.locator('[data-testid="simple-model-input"]')).toBeVisible();
  });

  test('can add and remove ensemble members', async ({ page }) => {
    // Switch to ensemble mode
    await page.locator('[data-testid="mode-select"]').selectOption('ensemble');

    // Initial members count (default has 3)
    const initialMembers = await page.locator('[data-testid^="member-model-"]').count();
    expect(initialMembers).toBe(3);

    // Add a new member
    await page.locator('[data-testid="add-member-btn"]').click();
    const afterAddMembers = await page.locator('[data-testid^="member-model-"]').count();
    expect(afterAddMembers).toBe(4);

    // Remove a member
    await page.locator('[data-testid="remove-member-0"]').click();
    const afterRemoveMembers = await page.locator('[data-testid^="member-model-"]').count();
    expect(afterRemoveMembers).toBe(3);
  });

  test('shows judge model input when judge aggregation selected', async ({ page }) => {
    await page.locator('[data-testid="mode-select"]').selectOption('ensemble');

    // Initially no judge model input
    await expect(page.locator('[data-testid="judge-model-input"]')).not.toBeVisible();

    // Select judge aggregation
    await page.locator('[data-testid="aggregation-select"]').selectOption('judge');
    await expect(page.locator('[data-testid="judge-model-input"]')).toBeVisible();
  });

  test('shows synthesize model input when synthesize aggregation selected', async ({ page }) => {
    await page.locator('[data-testid="mode-select"]').selectOption('ensemble');

    // Select synthesize aggregation
    await page.locator('[data-testid="aggregation-select"]').selectOption('synthesize');
    await expect(page.locator('[data-testid="synthesize-model-input"]')).toBeVisible();
  });

  test('can type in message input', async ({ page }) => {
    const input = page.locator('[data-testid="message-input"]');
    await input.fill('Hello, Trio!');
    await expect(input).toHaveValue('Hello, Trio!');
  });

  test('send button is enabled with non-empty input', async ({ page }) => {
    const input = page.locator('[data-testid="message-input"]');
    const sendBtn = page.locator('[data-testid="send-button"]');

    // Type a message
    await input.fill('Test message');
    await expect(sendBtn).toBeEnabled();
  });

  test('voting details panel can be toggled', async ({ page }) => {
    // Mock the API to return a response with voting details
    await page.route('/v1/chat/completions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'X-Trio-Details': JSON.stringify({
            winner_index: 0,
            candidates: [
              { model: 'gpt-4', response: 'Hello!', accepted: 2, preferred: 1 },
              { model: 'claude-3', response: 'Hi there!', accepted: 1, preferred: 1 },
            ],
            aggregation_method: 'acceptance_voting',
          }),
        },
        body: JSON.stringify({
          id: 'test-123',
          model: 'trio-1.0',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Hello!' },
              finish_reason: 'stop',
            },
          ],
        }),
      });
    });

    // Send a message to trigger the response
    await page.locator('[data-testid="message-input"]').fill('Hi');
    await page.locator('[data-testid="send-button"]').click();

    // Wait for response
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible();

    // Check voting details panel
    await expect(page.locator('[data-testid="voting-details"]')).toBeVisible();

    // Toggle open
    await page.locator('[data-testid="voting-details-toggle"]').click();
    await expect(page.locator('[data-testid="candidate-0"]')).toBeVisible();
  });

  test('displays user and assistant messages', async ({ page }) => {
    // Mock the API
    await page.route('/v1/chat/completions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'X-Trio-Details': JSON.stringify({
            winner_index: 0,
            candidates: [{ model: 'gpt-4', response: 'Hello!', accepted: 1, preferred: 1 }],
            aggregation_method: 'none',
          }),
        },
        body: JSON.stringify({
          id: 'test-123',
          model: 'gpt-4',
          choices: [
            {
              index: 0,
              message: { role: 'assistant', content: 'Hello! How can I help you today?' },
              finish_reason: 'stop',
            },
          ],
        }),
      });
    });

    // Send a message
    await page.locator('[data-testid="message-input"]').fill('Hi there!');
    await page.locator('[data-testid="send-button"]').click();

    // Check user message is displayed
    await expect(page.locator('[data-testid="user-message"]')).toContainText('Hi there!');

    // Check assistant message is displayed
    await expect(page.locator('[data-testid="assistant-message"]')).toContainText('Hello! How can I help you today?');
  });

  test('shows loading indicator while waiting for response', async ({ page }) => {
    // Mock a slow API response
    await page.route('/v1/chat/completions', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'X-Trio-Details': JSON.stringify({
            winner_index: 0,
            candidates: [{ model: 'gpt-4', response: 'Done!', accepted: 1, preferred: 1 }],
            aggregation_method: 'none',
          }),
        },
        body: JSON.stringify({
          id: 'test-123',
          model: 'gpt-4',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Done!' }, finish_reason: 'stop' }],
        }),
      });
    });

    // Send a message
    await page.locator('[data-testid="message-input"]').fill('Test');
    await page.locator('[data-testid="send-button"]').click();

    // Check loading indicator appears
    await expect(page.locator('[data-testid="loading-indicator"]')).toBeVisible();

    // Wait for response and loading indicator to disappear
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible();
    await expect(page.locator('[data-testid="loading-indicator"]')).not.toBeVisible();
  });

  test('shows error message on API failure', async ({ page }) => {
    // Mock API error
    await page.route('/v1/chat/completions', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Invalid request' }),
      });
    });

    // Send a message
    await page.locator('[data-testid="message-input"]').fill('Test');
    await page.locator('[data-testid="send-button"]').click();

    // Check error message is displayed
    await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid request');
  });
});
