# Chat UI v2 Specification

A developer tool for interactively testing all Trio features.

## Goals & Non-Goals

### Goals

- **Test all Trio features**: Simple mode, ensemble mode, all aggregation methods, system prompts, nested ensembles
- **Usable**: Clear feedback, obvious controls, keyboard-friendly
- **Robust error handling**: Invalid states rejected with clear messages
- **Developer-focused**: Show raw details (voting results, request/response payloads)
- **Maintainable**: Clean architecture that's easy to modify

### Non-Goals

- **Polish**: No fancy animations, themes, or visual refinement
- **End-user UX**: No onboarding, tooltips, or hand-holding
- **Persistence**: No chat history saving (ephemeral by design)
- **Streaming**: Not supported by Trio backend, won't implement
- **Mobile optimization**: Desktop-first, mobile just needs to work

## Tech Stack

| Layer | Technology | Rationale |
|-------|------------|-----------|
| View | React | Component model, virtual DOM, avoids v1's innerHTML issues |
| Logic | Effect | Typed errors, validation, async handling |
| Validation | Effect Schema | Runtime validation with type inference |
| Build | Vite | Fast, works well with React + TypeScript |
| Styling | Minimal CSS | Developer tool, not a product |

## User Flows

### Flow 1: Simple Mode Chat

1. User opens UI (default: simple mode)
2. User enters model name (e.g., `llama3.2:1b`)
3. User types message, presses Enter or clicks Send
4. UI shows loading state
5. Response appears in chat
6. User continues conversation

### Flow 2: Ensemble Mode Chat

1. User switches to Ensemble mode
2. User adds ensemble members (model name + optional system prompt)
3. User selects aggregation method
4. If judge/synthesize: user enters judge/synthesize model name
5. User sends message
6. Response appears with voting details expandable

### Flow 3: Using Predefined Ensembles

1. User enters `trio:diverse` or other predefined ensemble name in simple mode
2. Backend resolves the reference
3. Response includes voting details from the ensemble

### Flow 4: Error Recovery

1. User submits invalid request (empty model, etc.)
2. UI shows error inline (not as chat message)
3. User corrects input
4. User resubmits successfully

## UI States

```
┌─────────────────────────────────────────────────────────┐
│                      App                                │
│  ┌─────────────────────────────────────────────────┐   │
│  │ State: Idle | Loading | Error                   │   │
│  └─────────────────────────────────────────────────┘   │
│                                                         │
│  ┌─────────────────┐  ┌─────────────────────────────┐  │
│  │  ModelConfig    │  │  ChatPanel                  │  │
│  │                 │  │                             │  │
│  │  Mode: Simple   │  │  Messages: ChatMessage[]    │  │
│  │       | Ensemble│  │                             │  │
│  │                 │  │  ┌───────────────────────┐  │  │
│  │  [model config] │  │  │ VotingDetails         │  │  │
│  │                 │  │  │ (collapsible)         │  │  │
│  └─────────────────┘  │  └───────────────────────┘  │  │
│                       │                             │  │
│                       │  ┌───────────────────────┐  │  │
│                       │  │ MessageInput          │  │  │
│                       │  │ [disabled when loading]│  │  │
│                       │  └───────────────────────┘  │  │
│                       └─────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

### State Machine

```
States:
  - Idle: Ready to send messages
  - Loading: Request in flight
  - Error: Validation or API error (dismissible)

Transitions:
  Idle → Loading: User sends valid message
  Idle → Error: User sends invalid message (client validation)
  Loading → Idle: Response received
  Loading → Error: API error
  Error → Idle: User dismisses error or corrects input
```

## Validation Rules

All validation happens **before** sending to backend. The UI should never send an invalid request.

### Simple Mode

| Field | Rule | Error Message |
|-------|------|---------------|
| Model name | Non-empty, non-whitespace | "Model name required" |
| Message | Non-empty, non-whitespace | "Message required" |

### Ensemble Mode

| Field | Rule | Error Message |
|-------|------|---------------|
| Ensemble members | At least 1 member | "At least one ensemble member required" |
| Each member model | Non-empty, non-whitespace | "Model name required for all members" |
| Aggregation method | Must be selected | "Aggregation method required" |
| Judge model | Required if aggregation = judge | "Judge model required" |
| Synthesize model | Required if aggregation = synthesize | "Synthesize model required" |
| Message | Non-empty, non-whitespace | "Message required" |

### Validation Implementation

Use Effect Schema to define and validate:

```typescript
// Pseudocode - actual implementation may differ
const SimpleModel = Schema.String.pipe(
  Schema.nonEmpty({ message: () => "Model name required" }),
  Schema.trim
)

const EnsembleMember = Schema.Struct({
  model: SimpleModel,
  system_prompt: Schema.optional(Schema.String)
})

const EnsembleModel = Schema.Struct({
  ensemble: Schema.NonEmptyArray(EnsembleMember),
  aggregation_method: AggregationMethod,
  judge_model: Schema.optional(SimpleModel),
  synthesize_model: Schema.optional(SimpleModel)
}).pipe(
  Schema.filter((m) => {
    if (m.aggregation_method === "judge" && !m.judge_model) {
      return "Judge model required"
    }
    if (m.aggregation_method === "synthesize" && !m.synthesize_model) {
      return "Synthesize model required"
    }
    return true
  })
)
```

## Component Structure

```
App
├── ModelConfigPanel
│   ├── ModeToggle (Simple | Ensemble)
│   ├── SimpleModelInput (when mode = Simple)
│   └── EnsembleConfig (when mode = Ensemble)
│       ├── EnsembleMemberList
│       │   └── EnsembleMemberRow (repeating)
│       │       ├── ModelInput OR NestedEnsembleConfig (toggle)
│       │       └── SystemPromptInput (optional)
│       ├── AddMemberButton
│       ├── AggregationMethodSelect
│       └── JudgeModelInput (conditional)
│       └── SynthesizeModelInput (conditional)
│
├── ChatPanel
│   ├── ChatHeader
│   │   ├── ClearChatButton
│   │   └── DebugToggleButton
│   ├── MessageList
│   │   └── MessageBubble (repeating)
│   │       └── ResponseMetadata (timing, tokens - when available)
│   ├── VotingDetailsPanel (collapsible, shown after ensemble response)
│   ├── ErrorBanner (when error state)
│   └── MessageInput
│       ├── Textarea
│       └── SendButton
│
└── DebugPanel (togglable, hidden by default)
    ├── LastRequest (raw JSON)
    └── LastResponse (raw JSON + headers)
```

### Component Responsibilities

| Component | Responsibility |
|-----------|----------------|
| App | Top-level state, layout, error boundary |
| ModelConfigPanel | Model configuration state, validation |
| ModeToggle | Switch between simple/ensemble |
| SimpleModelInput | Single model name input |
| EnsembleConfig | Ensemble-specific configuration |
| EnsembleMemberList | Manage list of members |
| EnsembleMemberRow | Single member with model/nested toggle + system prompt |
| NestedEnsembleConfig | Recursive ensemble config for nested members |
| AggregationMethodSelect | Dropdown for aggregation method |
| ChatPanel | Chat state, message submission |
| ChatHeader | Contains clear chat and debug toggle buttons |
| ClearChatButton | Clears all messages from chat |
| DebugToggleButton | Shows/hides the debug panel |
| MessageList | Render messages with auto-scroll |
| MessageBubble | Single message (user or assistant) |
| ResponseMetadata | Display timing and token counts for a response |
| VotingDetailsPanel | Display voting results from header |
| ErrorBanner | Display and dismiss errors |
| MessageInput | Text input + send button |
| DebugPanel | Show raw request/response (togglable) |

## API Contract

### Request

```typescript
// POST /v1/chat/completions
interface ChatCompletionRequest {
  model: string | EnsembleModel
  messages: Array<{
    role: "user" | "assistant" | "system"
    content: string
  }>
}

interface EnsembleModel {
  ensemble: EnsembleMember[]
  aggregation_method: "acceptance_voting" | "random" | "judge" | "synthesize" | "concat"
  judge_model?: string      // required if aggregation_method = "judge"
  synthesize_model?: string // required if aggregation_method = "synthesize"
}

interface EnsembleMember {
  model: string
  system_prompt?: string
}
```

### Response

```typescript
// Success (200)
interface ChatCompletionResponse {
  id: string
  model: string
  choices: Array<{
    index: number
    message: {
      role: "assistant"
      content: string
    }
    finish_reason: string
  }>
}

// Header: X-Trio-Details (JSON string)
interface VotingDetails {
  aggregation_method: string
  candidates: Array<{
    model: string
    response: string
    votes?: {
      accepted: number
      preferred: number
    }
  }>
  winner_index: number
}
```

### Errors

```typescript
// Validation Error (422)
interface ValidationError {
  detail: Array<{
    loc: string[]
    msg: string
    type: string
  }>
}

// Other errors (4xx, 5xx)
interface ApiError {
  detail: string
}
```

## Error Handling Strategy

### Error Types (Effect)

```typescript
// Typed errors for Effect
class ValidationError {
  readonly _tag = "ValidationError"
  constructor(readonly field: string, readonly message: string) {}
}

class ApiError {
  readonly _tag = "ApiError"
  constructor(readonly status: number, readonly message: string) {}
}

class NetworkError {
  readonly _tag = "NetworkError"
  constructor(readonly cause: unknown) {}
}

type ChatError = ValidationError | ApiError | NetworkError
```

### Error Display

| Error Type | Display Location | User Action |
|------------|------------------|-------------|
| ValidationError | Inline next to field | Fix input |
| ApiError (4xx) | Error banner above input | Dismiss, retry |
| ApiError (5xx) | Error banner above input | Retry |
| NetworkError | Error banner above input | Check connection, retry |

### Error Messages

- **Never show raw error objects** to user
- **Always provide actionable message**: what went wrong, what to do
- **Preserve technical details** in DebugPanel for developers

## Data Flow

```
User Input
    │
    ▼
┌─────────────────┐
│ Client-side     │──── Invalid ───▶ Show ValidationError
│ Validation      │
└────────┬────────┘
         │ Valid
         ▼
┌─────────────────┐
│ Build Request   │
│ (Effect)        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ API Call        │──── Network Error ───▶ Show NetworkError
│ (Effect)        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Parse Response  │──── Parse Error ───▶ Show ApiError
│ (Effect Schema) │
└────────┬────────┘
         │ Success
         ▼
┌─────────────────┐
│ Update State    │
│ (React)         │
└────────┬────────┘
         │
         ▼
    UI Re-render
```

## File Structure

```
frontend/
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
├── src/
│   ├── main.tsx                 # React entry point
│   ├── App.tsx                  # Root component
│   ├── styles.css               # Minimal global styles
│   │
│   ├── components/
│   │   ├── ModelConfigPanel.tsx
│   │   ├── ModeToggle.tsx
│   │   ├── SimpleModelInput.tsx
│   │   ├── EnsembleConfig.tsx
│   │   ├── EnsembleMemberList.tsx
│   │   ├── EnsembleMemberRow.tsx
│   │   ├── NestedEnsembleConfig.tsx
│   │   ├── AggregationMethodSelect.tsx
│   │   ├── ChatPanel.tsx
│   │   ├── ChatHeader.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── ResponseMetadata.tsx
│   │   ├── VotingDetailsPanel.tsx
│   │   ├── ErrorBanner.tsx
│   │   ├── MessageInput.tsx
│   │   └── DebugPanel.tsx
│   │
│   ├── services/
│   │   └── api.ts               # Effect-based API client
│   │
│   ├── schemas/
│   │   ├── request.ts           # Request validation schemas
│   │   └── response.ts          # Response parsing schemas
│   │
│   ├── state/
│   │   └── store.ts             # Application state (React context + Effect)
│   │
│   └── types/
│       └── index.ts             # Shared TypeScript types
│
└── e2e/
    └── *.spec.ts                # Playwright tests
```

## Design Decisions

1. **DebugPanel**: Togglable (hidden by default, button to show/hide)

2. **Nested ensembles**: Yes, UI will support nested `EnsembleModel` in ensemble members (recursive configuration)

3. **Predefined ensembles**: Free text input only - users type `trio:diverse` etc. directly (no dropdown)

4. **Response metadata**: Yes, show timing info and token counts when available

5. **Clear chat**: Yes, include a clear chat button

## Implementation Order

1. **Phase 1: Minimal viable**
   - Simple mode only
   - Basic chat (send message, show response)
   - Client-side validation
   - Error display

2. **Phase 2: Ensemble support**
   - Mode toggle
   - Ensemble configuration UI
   - Voting details display

3. **Phase 3: Developer features**
   - Debug panel
   - All aggregation methods with conditional inputs

4. **Phase 4: Polish (if needed)**
   - Keyboard shortcuts
   - Better error messages
   - Any UX improvements discovered during use
