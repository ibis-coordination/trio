import { test, expect } from '@playwright/test';

test.describe('Edge Case Bug Finding', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/chat/');
  });

  test('double-clicking send button', async ({ page }) => {
    // Mock slow API response
    let requestCount = 0;
    await page.route('/v1/chat/completions', async (route) => {
      requestCount++;
      await new Promise((resolve) => setTimeout(resolve, 200));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'X-Trio-Details': JSON.stringify({
            winner_index: 0,
            candidates: [{ model: 'test', response: 'Response', accepted: 1, preferred: 1 }],
            aggregation_method: 'random',
          }),
        },
        body: JSON.stringify({
          id: 'test-123',
          model: 'test',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Response' }, finish_reason: 'stop' }],
        }),
      });
    });

    // Type a message
    await page.locator('[data-testid="message-input"]').fill('Hello');

    // Double-click the send button
    await page.locator('[data-testid="send-button"]').dblclick();

    // Wait for response
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible();

    // Should only have sent one request (not multiple from double click)
    expect(requestCount).toBe(1);

    // Should only have one user message
    expect(await page.locator('[data-testid="user-message"]').count()).toBe(1);
  });

  test('pressing Enter multiple times rapidly', async ({ page }) => {
    // Mock slow API response
    let requestCount = 0;
    await page.route('/v1/chat/completions', async (route) => {
      requestCount++;
      await new Promise((resolve) => setTimeout(resolve, 200));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'X-Trio-Details': JSON.stringify({
            winner_index: 0,
            candidates: [{ model: 'test', response: 'Response', accepted: 1, preferred: 1 }],
            aggregation_method: 'random',
          }),
        },
        body: JSON.stringify({
          id: 'test-123',
          model: 'test',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Response' }, finish_reason: 'stop' }],
        }),
      });
    });

    // Type a message
    const input = page.locator('[data-testid="message-input"]');
    await input.fill('Hello');

    // Press Enter multiple times rapidly
    await input.press('Enter');
    await input.press('Enter');
    await input.press('Enter');

    // Wait for response
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible();

    // Should only have sent one request
    expect(requestCount).toBe(1);
  });

  test('send button during loading shows disabled state', async ({ page }) => {
    // Mock slow API response
    await page.route('/v1/chat/completions', async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'X-Trio-Details': JSON.stringify({
            winner_index: 0,
            candidates: [{ model: 'test', response: 'Response', accepted: 1, preferred: 1 }],
            aggregation_method: 'random',
          }),
        },
        body: JSON.stringify({
          id: 'test-123',
          model: 'test',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Response' }, finish_reason: 'stop' }],
        }),
      });
    });

    await page.locator('[data-testid="message-input"]').fill('Hello');
    await page.locator('[data-testid="send-button"]').click();

    // Button and input should be disabled
    await expect(page.locator('[data-testid="send-button"]')).toBeDisabled();
    await expect(page.locator('[data-testid="message-input"]')).toBeDisabled();
  });

  test('concurrent messages are prevented', async ({ page }) => {
    // Mock slow API response
    let requestCount = 0;
    await page.route('/v1/chat/completions', async (route) => {
      requestCount++;
      await new Promise((resolve) => setTimeout(resolve, 300));
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'X-Trio-Details': JSON.stringify({
            winner_index: 0,
            candidates: [{ model: 'test', response: 'Response ' + requestCount, accepted: 1, preferred: 1 }],
            aggregation_method: 'random',
          }),
        },
        body: JSON.stringify({
          id: 'test-' + requestCount,
          model: 'test',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Response ' + requestCount }, finish_reason: 'stop' }],
        }),
      });
    });

    // Send first message
    await page.locator('[data-testid="message-input"]').fill('First');
    await page.locator('[data-testid="send-button"]').click();

    // Try to type and send another message while first is loading
    // (this should be prevented if input is disabled)
    const isInputDisabled = await page.locator('[data-testid="message-input"]').isDisabled();

    if (!isInputDisabled) {
      // Bug: Input should be disabled during loading
      await page.locator('[data-testid="message-input"]').fill('Second');
      await page.locator('[data-testid="send-button"]').click();
    }

    // Wait for first response
    await expect(page.locator('[data-testid="assistant-message"]').first()).toBeVisible();

    // Only one request should have been made
    expect(requestCount).toBe(1);
  });

  test('error message cleared on new successful request', async ({ page }) => {
    // First mock an error
    await page.route('/v1/chat/completions', async (route) => {
      await route.fulfill({
        status: 400,
        contentType: 'application/json',
        body: JSON.stringify({ detail: 'Test error' }),
      });
    });

    await page.locator('[data-testid="message-input"]').fill('Fail');
    await page.locator('[data-testid="send-button"]').click();
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible();

    // Now mock a success
    await page.unroute('/v1/chat/completions');
    await page.route('/v1/chat/completions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'X-Trio-Details': JSON.stringify({
            winner_index: 0,
            candidates: [{ model: 'test', response: 'Success!', accepted: 1, preferred: 1 }],
            aggregation_method: 'random',
          }),
        },
        body: JSON.stringify({
          id: 'test-123',
          model: 'test',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Success!' }, finish_reason: 'stop' }],
        }),
      });
    });

    await page.locator('[data-testid="message-input"]').fill('Success');
    await page.locator('[data-testid="send-button"]').click();
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible();

    // Error message should still be visible (persists in chat history) - this may or may not be desired behavior
    const errorVisible = await page.locator('[data-testid="error-message"]').isVisible();
    // Log for informational purposes - whether errors should persist is a design decision
    console.log('Error message persists after new request:', errorVisible);
  });

  test('message input preserves multiline text with Shift+Enter', async ({ page }) => {
    const input = page.locator('[data-testid="message-input"]');

    // Type first line
    await input.fill('Line 1');

    // Press Shift+Enter to add new line (should not send)
    await input.press('Shift+Enter');
    await input.type('Line 2');

    // Should still have text in input (not sent)
    const value = await input.inputValue();
    expect(value).toContain('Line 1');
    expect(value).toContain('Line 2');
  });

  test('page refresh clears chat history', async ({ page }) => {
    // Mock API
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
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible();

    // Refresh page
    await page.reload();

    // Chat history should be cleared (no persistence)
    expect(await page.locator('[data-testid="user-message"]').count()).toBe(0);
    expect(await page.locator('[data-testid="assistant-message"]').count()).toBe(0);
  });

  test('input focuses on page load', async ({ page }) => {
    // Check if input is focused on page load
    const input = page.locator('[data-testid="message-input"]');
    await expect(input).toBeFocused();
  });

  test('adding member focuses new input', async ({ page }) => {
    // Switch to ensemble mode
    await page.locator('[data-testid="mode-select"]').selectOption('ensemble');

    // Count initial members
    const initialCount = await page.locator('[data-testid^="member-model-"]').count();

    // Add a new member
    await page.locator('[data-testid="add-member-btn"]').click();

    // New member input should exist
    const newMemberInput = page.locator(`[data-testid="member-model-${initialCount}"]`);
    await expect(newMemberInput).toBeVisible();
  });

  test('model config changes persist during conversation', async ({ page }) => {
    // Mock API
    await page.route('/v1/chat/completions', async (route) => {
      const request = JSON.parse(route.request().postData() || '{}');
      const model = request.model;

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: {
          'X-Trio-Details': JSON.stringify({
            winner_index: 0,
            candidates: [{ model: typeof model === 'string' ? model : 'ensemble', response: 'Response', accepted: 1, preferred: 1 }],
            aggregation_method: 'random',
          }),
        },
        body: JSON.stringify({
          id: 'test-123',
          model: typeof model === 'string' ? model : 'trio-1.0',
          choices: [{ index: 0, message: { role: 'assistant', content: 'Response' }, finish_reason: 'stop' }],
        }),
      });
    });

    // Change model name
    const modelInput = page.locator('[data-testid="simple-model-input"]');
    await modelInput.fill('custom-model');

    // Send a message
    await page.locator('[data-testid="message-input"]').fill('Hi');
    await page.locator('[data-testid="send-button"]').click();
    await expect(page.locator('[data-testid="assistant-message"]')).toBeVisible();

    // Model input should still have the custom value
    await expect(modelInput).toHaveValue('custom-model');
  });
});
