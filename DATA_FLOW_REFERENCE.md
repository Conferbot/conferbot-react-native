# Conferbot RN SDK vs Web Widget — Data Flow Reference

## Critical Differences to Fix

### 1. Dual Record System (SDK) vs Single Record (Widget)
- **Widget**: ONE `record` array — used for both display AND server. `_pushDataToRecord` pushes/merges into it. `_sendResponse` sends it as-is.
- **SDK**: TWO arrays — `chatState._record` (server) and `record` React state (UI). They are independent and populated at different times.
- **Impact**: Bot flow `sendMessage` (line 1187) sends the UI `record` to the server, not `chatState.buildResponseData()`. This sends wrong shapes like `bot-text-message` and `bot-choice-buttons` to the server.

### 2. When `response-record` is Emitted
- **Widget**: After user interactions (`_handleChoiceSelection`, `_handleUserInputSubmit`, `_handleHumanHandoverInputSubmit`) and after `_handleAddToTranscript` (which internally calls `_sendResponse`). Also at various points via explicit `_sendResponse()` calls.
- **SDK**: After every auto-continue node, after every user response, after handleProceed, after handleJumpTo, on flow completion. More frequent than widget.

### 3. Record Entry Format (Widget)
Each node pushed to record as: `{ ...nodeObject, time }` — the full node with all its data.
User selection merged into same entry: `{ ...existing, shape: "user-selected-choice", selectedChoice: "A", choices: node.data, time }`
Result: ONE entry per node, accumulating both bot data and user response.

### 4. Record Entry Format (SDK)
- `chatState._record`: Same merge behavior (addRecord merges by ID). Format matches widget.
- UI `record`: Uses different shapes (`bot-text-message`, `bot-choice-buttons`, `user-message`) — these are for DISPLAY only and should NEVER go to the server.

### 5. Missing Record Entries (SDK vs Widget)
- Widget pushes edges to record: `record.push(edge)` — SDK does NOT push edges.
- Widget pushes ALL nodes including redirect/navigate/logic — SDK only pushes nodes that go through `handleDisplayUI`.

### 6. Live Chat Messages
- **Widget**: User live messages pushed as `{ shape: "user-live-message", text }` to the SINGLE record, then `_sendResponse()` sends entire record.
- **SDK**: Should use `chatState.addRecord()` + `chatState.buildResponseData()` + `sendResponseRecord()`. Currently correct in live chat mode.

### 7. HTML Stripping
- **Widget**: Uses `dangerouslySetInnerHTML` to render — HTML is preserved in record, rendered as HTML in DOM.
- **SDK**: Must strip HTML since React Native has no HTML rendering in Text components. Strip at display time (agent messages, bot messages).
