import { test, expect } from '@playwright/test';

test.describe('Exploratory Bug Finding', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat/');
  });

  test('empty model name in simple mode', async ({ page }) => {
    // Clear the simple model input
    const modelInput = page.locator('[data-testid="simple-model-input"]');
    await modelInput.fill('');

    // Try to send a message with empty model
    await page.locator('[data-testid="message-input"]').fill('Hello');
    await page.locator('[data-testid="send-button"]').click();

    // Should show an error
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 10000 });
  });

  test('empty model name in ensemble mode', async ({ page }) => {
    // Switch to ensemble mode
    await page.locator('[data-testid="mode-select"]').selectOption('ensemble');

    // Clear all ensemble member model names
    const memberInputs = await page.locator('[data-testid^="member-model-"]').all();
    for (const input of memberInputs) {
      await input.fill('');
    }

    // Try to send a message
    await page.locator('[data-testid="message-input"]').fill('Hello');
    await page.locator('[data-testid="send-button"]').click();

    // Should show an error
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 10000 });
  });

  test('remove all ensemble members', async ({ page }) => {
    // Switch to ensemble mode
    await page.locator('[data-testid="mode-select"]').selectOption('ensemble');

    // Remove all members
    while ((await page.locator('[data-testid^="remove-member-"]').count()) > 0) {
      await page.locator('[data-testid^="remove-member-"]').first().click();
    }

    // Should have no members now
    expect(await page.locator('[data-testid^="member-model-"]').count()).toBe(0);

    // Try to send a message
    await page.locator('[data-testid="message-input"]').fill('Hello');
    await page.locator('[data-testid="send-button"]').click();

    // Should show an error
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 10000 });
  });

  test('judge aggregation without judge model', async ({ page }) => {
    // Switch to ensemble mode
    await page.locator('[data-testid="mode-select"]').selectOption('ensemble');

    // Select judge aggregation
    await page.locator('[data-testid="aggregation-select"]').selectOption('judge');

    // Clear the judge model input
    const judgeInput = page.locator('[data-testid="judge-model-input"]');
    await judgeInput.fill('');

    // Send a message
    await page.locator('[data-testid="message-input"]').fill('Hello');
    await page.locator('[data-testid="send-button"]').click();

    // Should show an error
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 10000 });
  });

  test('synthesize aggregation without synthesize model', async ({ page }) => {
    // Switch to ensemble mode
    await page.locator('[data-testid="mode-select"]').selectOption('ensemble');

    // Select synthesize aggregation
    await page.locator('[data-testid="aggregation-select"]').selectOption('synthesize');

    // Clear the synthesize model input
    const synthInput = page.locator('[data-testid="synthesize-model-input"]');
    await synthInput.fill('');

    // Send a message
    await page.locator('[data-testid="message-input"]').fill('Hello');
    await page.locator('[data-testid="send-button"]').click();

    // Should show an error
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 10000 });
  });

  test('rapidly switch modes during operation', async ({ page }) => {
    // Send a message
    await page.locator('[data-testid="message-input"]').fill('Hello');
    await page.locator('[data-testid="send-button"]').click();

    // While loading, switch modes rapidly
    await page.locator('[data-testid="mode-select"]').selectOption('ensemble');
    await page.locator('[data-testid="mode-select"]').selectOption('simple');
    await page.locator('[data-testid="mode-select"]').selectOption('ensemble');

    // Wait for either response or error
    await Promise.race([
      expect(page.locator('[data-testid="assistant-message"]')).toBeVisible({ timeout: 30000 }),
      expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 30000 }),
    ]);

    // UI should still be functional
    const modeSelect = page.locator('[data-testid="mode-select"]');
    await expect(modeSelect).toBeEnabled();
  });

  test('send empty message', async ({ page }) => {
    // Don't fill anything, just click send
    const sendBtn = page.locator('[data-testid="send-button"]');
    await sendBtn.click();

    // Should not show any user message (empty messages should be blocked)
    expect(await page.locator('[data-testid="user-message"]').count()).toBe(0);
  });

  test('send whitespace-only message', async ({ page }) => {
    // Fill with whitespace only
    await page.locator('[data-testid="message-input"]').fill('   \n\t  ');
    await page.locator('[data-testid="send-button"]').click();

    // Should not show any user message
    expect(await page.locator('[data-testid="user-message"]').count()).toBe(0);
  });

  test('XSS prevention in messages', async ({ page }) => {
    // Try to inject script in message
    const xssPayload = '<script>alert("xss")</script>';
    await page.locator('[data-testid="message-input"]').fill(xssPayload);
    await page.locator('[data-testid="send-button"]').click();

    // Wait for user message to appear
    await expect(page.locator('[data-testid="user-message"]')).toBeVisible();

    // Script tags should be escaped, not executed
    const messageContent = await page.locator('[data-testid="user-message"] .message-content').textContent();
    expect(messageContent).toContain('&lt;script&gt;'); // HTML escaped
  });

  test('very long message input', async ({ page }) => {
    // Create a very long message
    const longMessage = 'x'.repeat(10000);
    await page.locator('[data-testid="message-input"]').fill(longMessage);

    // Should be able to send
    await page.locator('[data-testid="send-button"]').click();

    // Wait for user message
    await expect(page.locator('[data-testid="user-message"]')).toBeVisible();
  });

  test('send button disabled while loading', async ({ page }) => {
    // Send a message
    await page.locator('[data-testid="message-input"]').fill('Hello');
    await page.locator('[data-testid="send-button"]').click();

    // Button should be disabled during loading
    await expect(page.locator('[data-testid="send-button"]')).toBeDisabled();

    // Wait for response
    await Promise.race([
      expect(page.locator('[data-testid="assistant-message"]')).toBeVisible({ timeout: 30000 }),
      expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 30000 }),
    ]);

    // Button should be enabled again
    await expect(page.locator('[data-testid="send-button"]')).toBeEnabled();
  });

  test('voting details state after switching modes', async ({ page }) => {
    // Mock the API
    await page.route('/v1/chat/completions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'X-Trio-Details': JSON.stringify({
            winner_index: 0,
            candidates: [{ model: 'test', response: 'Hello!', accepted: 1, preferred: 1 }],
            aggregation_method: 'random',
          }),
        },
        body: JSON.stringify({
          id: 'test-123',
          model: 'test',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Hello!' }, finish_reason: 'stop' }],
        }),
      });
    });

    // Send a message
    await page.locator('[data-testid="message-input"]').fill('Hi');
    await page.locator('[data-testid="send-button"]').click();

    // Wait for response
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible();

    // Voting details should be visible
    await expect(page.locator('[data-testid="voting-details"]')).toBeVisible();

    // Switch modes
    await page.locator('[data-testid="mode-select"]').selectOption('ensemble');
    await page.locator('[data-testid="mode-select"]').selectOption('simple');

    // Voting details should still be visible (not cleared by mode switch)
    await expect(page.locator('[data-testid="voting-details"]')).toBeVisible();
  });

  test('special characters in model name', async ({ page }) => {
    // Set model name with special characters
    const modelInput = page.locator('[data-testid="simple-model-input"]');
    await modelInput.fill('model/with:special@chars!');

    // Should handle gracefully
    await page.locator('[data-testid="message-input"]').fill('Test');
    await page.locator('[data-testid="send-button"]').click();

    // Wait for response or error
    await Promise.race([
      expect(page.locator('[data-testid="assistant-message"]')).toBeVisible({ timeout: 30000 }),
      expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 30000 }),
    ]);
  });

  test('system prompt in ensemble member', async ({ page }) => {
    // Switch to ensemble mode
    await page.locator('[data-testid="mode-select"]').selectOption('ensemble');

    // Add a system prompt to the first member
    const promptInput = page.locator('[data-testid="member-prompt-0"]');
    await promptInput.fill('You are a helpful assistant.');

    // Should be able to send a message
    await page.locator('[data-testid="message-input"]').fill('Hello');
    await page.locator('[data-testid="send-button"]').click();

    // Wait for response or error
    await Promise.race([
      expect(page.locator('[data-testid="assistant-message"]')).toBeVisible({ timeout: 30000 }),
      expect(page.locator('[data-testid="error-message"]')).toBeVisible({ timeout: 30000 }),
    ]);
  });
});
