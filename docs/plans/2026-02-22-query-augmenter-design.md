# Query Augmenter Design

**Goal:** Add a preprocessing layer that uses a small/cheap model to classify, de-ambiguate, and route user queries before they reach the main agent model, improving consistency and reducing cost.

**Architecture:** A `queryAugmenter.ts` module called at the top of `processQuery()` in `Agent.ts`. It uses the same LLM provider with a smaller model to produce a structured JSON metadata envelope. Trivial queries get short-circuited (direct response). Complex queries get augmented metadata prepended to the context block sent to the big model.

---

## Pipeline

```
User query --> Small Model (augmenter) --> Route decision
  |-- "direct" --> Return response immediately (no big model)
  |-- "agent"  --> Metadata + original query --> Big Model (with tools) --> Response
```

## Augmenter Output Schema

```typescript
interface AugmentResult {
  route: 'direct' | 'agent';
  direct_response?: string;
  intent?: string;           // data_analysis | web_search | map_geo | interactive_app | code_execution | file_operation | general_knowledge | comparison
  entities?: Record<string, string>;
  augmented_query?: string;
  suggested_tools?: string[];
  complexity?: 'simple' | 'medium' | 'complex';
}
```

## Augmenter System Prompt

Compact prompt (~300 tokens). No tool definitions. Instructs the model to return JSON only.

- Trivial queries (greetings, thanks, identity, simple math): `route: "direct"` with a brief response.
- Everything else: `route: "agent"` with intent, entities, augmented query, suggested tools, complexity.
- Rule: augmented_query clarifies ambiguity and resolves pronouns using session context, but does NOT add requirements the user didn't ask for.

## Big Model Integration

The augmenter metadata is injected as a prefix in the user message:

```
[Augmenter context]
Intent: web_search | Complexity: medium
Entities: location=Paris, France; topic=weather
Suggested tools: web_search, render_component
Enhanced query: Show current weather conditions and forecast for Paris, France

[Original query]
weather paris
```

The big model's system prompt gets a small addition explaining that augmenter context is advisory (hints, not directives). The original query is always authoritative.

## Configuration

| Env var | Default | Description |
|---------|---------|-------------|
| `AUGMENTER_ENABLED` | `true` | Enable/disable the augmentation layer |
| `AUGMENTER_MODEL` | Provider-dependent (`gpt-4o-mini` / `claude-haiku-4-5-20251001`) | Model name for the augmenter |

Uses the same provider (same base URL, same API key) as the main model. A second `LLMProvider` instance is created with the augmenter model name.

## Routing Rules

**Route to direct (skip big model):**
- Greetings, thanks, acknowledgments
- Identity questions ("who are you")
- Trivial math
- Meta-conversation ("help", "what tools do you have")

**Route to agent (augment and forward):**
- Everything else

## Fallback Behavior

If the augmenter call fails (network error, malformed JSON, timeout), skip augmentation entirely and pass the raw query to the big model as-is. The augmenter is never a blocking dependency.

## Token Budget

- Augmenter input: ~300 token system prompt + raw query + minimal session state
- Augmenter output: `max_tokens: 512`
- Total cost per augmentation: ~500-800 tokens on a cheap model

## What Doesn't Change

- Tool definitions
- Agent loop (still iterates on tool calls)
- Memory management (stores original query + final response)
- Auto-rendering logic
- API contract (`AgentQueryRequest` -> `AgentResponse`)

## Testing

- Unit tests for `queryAugmenter.ts`: mock provider, test JSON parsing, test fallback, test routing
- Integration test: verify augmenter called before main loop, verify `AUGMENTER_ENABLED=false` skips it, verify direct-routed queries don't hit big model
