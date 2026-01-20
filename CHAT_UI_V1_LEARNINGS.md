# Chat UI v1 Learnings

Observations and lessons learned from the first chat UI iteration to inform the v2 rewrite.

## What Went Wrong

### 1. Input Validation Was an Afterthought

The most significant pattern of bugs stemmed from validation being treated as optional:

- **Backend accepted invalid requests** (Bugs 1-2): Empty model names and empty ensemble arrays returned HTTP 200 with unhelpful fallback messages instead of proper 4xx errors
- **Frontend had no client-side validation** (Bugs 3-4): Users could submit forms with empty model names or zero ensemble members
- **Errors displayed as normal responses** (Bug 5): Because the backend returned 200 for invalid states, the frontend couldn't distinguish errors from valid responses

**Lesson:** Design validation as a first-class concern from the start. Define the contract (what's valid/invalid) before writing UI code. Validate on both sides: client-side for UX, server-side for security.

### 2. Global State Management Without Structure

The v1 architecture used module-level variables for state:

```typescript
// main.ts
let messages: ChatMessage[] = [];
let lastVotingDetails: VotingDetails | null = null;
let isLoading = false;
```

This approach caused:
- **Testing difficulties**: Components couldn't be tested in isolation
- **Implicit dependencies**: Components reached up to parent state
- **Re-render complexity**: Had to manually coordinate when to update which components
- **Race condition potential**: Rapid mode switching during in-flight requests could use stale config

**Lesson:** Use a proper state container from day one. Even a simple observable pattern or class-based state would help. Components should receive state, not reach for it.

### 3. DOM Manipulation via innerHTML

Components rebuilt their entire DOM trees on state changes:

```typescript
// ModelConfig.ts pattern
render() {
  this.container.innerHTML = '';
  this.container.innerHTML = `<div>...</div>`;
  // Re-attach all event listeners
}
```

This caused:
- **Lost focus**: When adding ensemble members, focus was lost
- **Event listener churn**: Listeners recreated on every render
- **Performance overhead**: Entire subtrees rebuilt for small changes

**Lesson:** Consider a virtual DOM, incremental updates, or at minimum, targeted DOM mutations rather than full rebuilds.

### 4. Error Handling Was Optimistic

The error handling strategy assumed the happy path:

- Backend returned "Sorry, I couldn't generate a response" as a 200 OK
- Frontend had to pattern-match response content to detect errors
- Voting details header parsing silently failed on malformed JSON

**Lesson:** Make errors explicit. Use HTTP status codes correctly. Design error states into the data model (discriminated unions). Never silently swallow parse failures.

### 5. No Data Persistence Strategy

Chat history disappeared on refresh (Bug 6). While this might be intentional, it wasn't a conscious design choice—it was the default.

**Lesson:** Decide upfront what persists and what doesn't. If ephemeral, communicate that to users. If persistent, choose the mechanism (localStorage, backend, etc.) early.

## What Worked Well

### 1. OpenAI API Compatibility

Using the standard `/v1/chat/completions` format made the UI work as a drop-in for any OpenAI-compatible backend. The request/response contract was clear and well-typed.

### 2. TypeScript with Strict Mode

Full type coverage caught many bugs at compile time. Types mirrored backend Pydantic models, reducing contract drift.

### 3. Comprehensive E2E Tests

The Playwright test suite caught edge cases that manual testing would have missed:
- XSS prevention
- Rapid mode switching
- Double-submit prevention
- Special characters in messages

### 4. Clean Component Boundaries

Each component had a single responsibility:
- `ChatWindow` → message rendering
- `MessageInput` → form submission
- `ModelConfig` → ensemble configuration
- `VotingDetails` → results visualization

### 5. Accessible Test Selectors

Extensive `data-testid` attributes made E2E tests stable and readable.

## Architectural Observations

### Component Coupling

The components were too coupled to the DOM structure:

```
main.ts (orchestrator)
  ├── ChatWindow (renders to #chat-window)
  ├── MessageInput (renders to #message-input)
  ├── ModelConfig (renders to #model-config)
  └── VotingDetails (renders to #voting-details)
```

Each component assumed a specific DOM container existed. This made:
- Testing require full DOM setup
- Layout changes require code changes
- Components non-portable

**Suggestion for v2:** Components should accept a container reference, not query for it.

### CSS Organization

All 414 lines of CSS in a single file. No scoping, no CSS modules, no component-level styles. BEM naming was attempted but inconsistent.

**Suggestion for v2:** Consider scoped styles, CSS modules, or a utility-first approach like Tailwind.

### Build Pipeline

The Vite setup was straightforward but the output path (`../static`) created implicit coupling between frontend and backend directory structures.

**Suggestion for v2:** Consider clearer separation or explicit configuration for deployment paths.

## Recommendations for v2

### Core Principles

1. **Validation-first design**: Define valid states before building UI. Reject invalid states explicitly at every layer.

2. **Explicit state management**: Use a state container (even a simple one). Components receive state, don't fetch it.

3. **Error states are states**: Model errors in the type system. `Result<T, E>` patterns, discriminated unions, etc.

4. **Progressive enhancement**: Start with core functionality, add features incrementally. Don't over-engineer upfront.

### Technical Suggestions

| Area | v1 Approach | v2 Suggestion |
|------|-------------|---------------|
| State | Module variables | Store/observable pattern |
| DOM updates | innerHTML rebuild | Targeted updates or VDOM |
| Validation | Backend-only | Both client and server |
| Error display | Pattern matching | HTTP status codes + error type |
| CSS | Single global file | Component-scoped or utility classes |
| Testing | E2E only | Unit + integration + E2E |

### Scope Control

The v1 chat UI tried to do too much in one pass:
- Simple mode AND ensemble mode
- Multiple aggregation methods with conditional UI
- Voting details visualization
- Dynamic form fields

**Suggestion for v2:** Build the simplest viable version first (single model, basic chat). Add ensemble features incrementally. Each increment should be fully tested and validated before adding more.

## Questions for v2 Planning

1. **Framework choice**: Vanilla TS worked but required manual DOM management. Consider a lightweight framework (Preact, Solid, Svelte) or stay vanilla with better patterns?

2. **State persistence**: Should chat history persist? If so, localStorage or backend?

3. **Streaming**: v1 rejected streaming. Should v2 support it? It significantly complicates the UI.

4. **Mobile support**: Current layout works on mobile but isn't optimized. Priority?

5. **Accessibility**: v1 has basic keyboard support. Should v2 have full a11y (screen readers, focus management, ARIA)?

6. **Ensemble complexity**: The ensemble configuration UI was complex. Simplify? Separate view? Advanced mode?
