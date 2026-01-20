# Trio Chat UI - Bug Report

This document contains bugs discovered through exploratory testing with Playwright.

## Summary

| Bug # | Severity | Category | Status | Description |
|-------|----------|----------|--------|-------------|
| 1 | High | Backend | **FIXED** | Empty model name accepted by API (returns 200 instead of 400) |
| 2 | High | Backend | **FIXED** | Empty ensemble array accepted by API (returns 200 instead of 400) |
| 3 | Medium | Frontend | Open | No client-side validation for empty model name |
| 4 | Medium | Frontend | Open | No client-side validation when all ensemble members are removed |
| 5 | Medium | UX | Open | Error responses displayed as assistant messages instead of errors |
| 6 | Low | UX | Open | No chat history persistence across page refreshes |

---

## Bug Details

### Bug 1: Empty Model Name Accepted by API

**Status:** ✅ FIXED

**Severity:** High
**Category:** Backend Validation
**Affected Component:** `/v1/chat/completions` endpoint

**Description:**
When sending a request with an empty string model name (`"model": ""`), the API returns HTTP 200 with a response body containing "Sorry, I couldn't generate a response." instead of returning a proper HTTP 4xx error.

**Fix:**
Added Pydantic field validators in `src/models.py` to `ChatCompletionRequest` and `EnsembleMember` classes that reject empty or whitespace-only model names. API now returns HTTP 422 with a validation error message.

**Steps to Reproduce:**
```bash
curl -s -X POST http://localhost:8001/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":"","messages":[{"role":"user","content":"Hello"}]}'
```

**Expected Behavior:**
API should return HTTP 400 Bad Request with an error message like "Model name cannot be empty."

**Actual Behavior (after fix):**
API returns HTTP 422 with validation error: "Model name cannot be empty"

---

### Bug 2: Empty Ensemble Array Accepted by API

**Status:** ✅ FIXED

**Severity:** High
**Category:** Backend Validation
**Affected Component:** `/v1/chat/completions` endpoint

**Description:**
When sending a request with an empty ensemble array (`"ensemble": []`), the API returns HTTP 200 with "Sorry, I couldn't generate a response." instead of a proper HTTP 4xx error.

**Fix:**
Added Pydantic field validator in `src/models.py` to `EnsembleModel` class that rejects empty ensemble arrays. API now returns HTTP 422 with a validation error message.

**Steps to Reproduce:**
```bash
curl -s -X POST http://localhost:8001/v1/chat/completions \
  -H 'Content-Type: application/json' \
  -d '{"model":{"ensemble":[],"aggregation_method":"acceptance_voting"},"messages":[{"role":"user","content":"Hello"}]}'
```

**Expected Behavior:**
API should return HTTP 400 Bad Request with an error message like "Ensemble must contain at least one member."

**Actual Behavior (after fix):**
API returns HTTP 422 with validation error: "Ensemble must contain at least one member"

---

### Bug 3: No Client-Side Validation for Empty Model Name

**Severity:** Medium
**Category:** Frontend Validation
**Affected Component:** [ModelConfig.ts](frontend/src/components/ModelConfig.ts)

**Description:**
The frontend allows users to clear the model name input field and send messages without any client-side validation. The request is sent to the backend with an empty model string.

**Steps to Reproduce:**
1. Open the chat UI at `/chat/`
2. In "Simple (single model)" mode, clear the Model input field
3. Type a message and click Send

**Expected Behavior:**
- The Send button should be disabled when the model name is empty, OR
- An inline validation error should appear, OR
- A prompt should ask the user to enter a model name

**Actual Behavior:**
The message is sent with an empty model name, resulting in the unhelpful "Sorry, I couldn't generate a response." message.

---

### Bug 4: No Validation When All Ensemble Members Are Removed

**Severity:** Medium
**Category:** Frontend Validation
**Affected Component:** [ModelConfig.ts](frontend/src/components/ModelConfig.ts)

**Description:**
In ensemble mode, users can remove all ensemble members and still send messages. The frontend does not prevent sending with zero ensemble members.

**Steps to Reproduce:**
1. Open the chat UI at `/chat/`
2. Switch to "Ensemble" mode
3. Click the "x" button to remove all ensemble members
4. Type a message and click Send

**Expected Behavior:**
- The Send button should be disabled when there are no ensemble members, OR
- The "Remove" button should be disabled when there's only one member remaining, OR
- An error message should appear asking the user to add at least one ensemble member

**Actual Behavior:**
The request is sent with an empty ensemble array, resulting in "Sorry, I couldn't generate a response."

---

### Bug 5: Error Responses Displayed as Assistant Messages

**Severity:** Medium
**Category:** UX
**Affected Component:** [ChatWindow.ts](frontend/src/components/ChatWindow.ts), [api.ts](frontend/src/api.ts)

**Description:**
When the backend fails to generate a valid response (e.g., due to invalid configuration or model errors), the frontend displays "Sorry, I couldn't generate a response." as a regular assistant message rather than as an error message. This is confusing because it appears as if the AI chose to respond this way.

**Steps to Reproduce:**
1. Clear the model name and send a message
2. Observe the response

**Expected Behavior:**
Failures should be displayed with the error message styling (red background, distinct "Error:" prefix), using the existing `[data-testid="error-message"]` error display component.

**Actual Behavior:**
The failure message appears as a regular assistant message with the same styling as successful responses.

**Root Cause:**
The backend returns HTTP 200 for these failure cases (see Bug 1 and 2), so the frontend doesn't recognize them as errors. The validation needs to happen either:
- On the backend (return 4xx errors for invalid configurations)
- On the frontend (validate before sending, or check response content for error patterns)

---

### Bug 6: No Chat History Persistence

**Severity:** Low
**Category:** UX / Feature Gap
**Affected Component:** Application State

**Description:**
Chat history is not persisted across page refreshes. All messages are lost when the page is refreshed or navigated away from.

**Steps to Reproduce:**
1. Open the chat UI
2. Send a few messages
3. Refresh the page (F5 or Cmd+R)

**Expected Behavior:**
This depends on product requirements. Options include:
- Messages persist in localStorage/sessionStorage
- Messages persist on the backend (requires user accounts)
- A clear indicator that chat will be lost on refresh

**Actual Behavior:**
All chat history is cleared without warning.

**Note:** This may be intentional design, but should be documented or communicated to users.

---

## Tests Added

The following test files were created to identify these bugs:

- [explore.spec.ts](e2e/explore.spec.ts) - Exploratory tests for validation edge cases
- [edge-cases.spec.ts](e2e/edge-cases.spec.ts) - Tests for UI edge cases (all passing)

## Recommendations

1. **Backend Validation:** Add validation in `main.py` to reject:
   - Empty model strings with HTTP 400
   - Empty ensemble arrays with HTTP 400
   - Ensemble members with empty model names with HTTP 400

2. **Frontend Validation:** Add validation in `ModelConfig.ts` to:
   - Disable the Send button when model name is empty
   - Disable the Send button when ensemble has zero members
   - Show inline validation errors

3. **Error Display:** Update `api.ts` to detect when the response content indicates a failure (e.g., matches "Sorry, I couldn't generate a response") and treat it as an error rather than a successful response.

4. **Consider Chat Persistence:** If users expect chat history to persist, implement localStorage-based persistence or add a warning about data loss on refresh.
