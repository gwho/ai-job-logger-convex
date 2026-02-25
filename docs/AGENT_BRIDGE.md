# Agent Development Bridge

How this simple AI Job Logger evolves into a full AI agent system.

---

## From Job Logger to Agent System

This app already contains the core primitives of an AI agent:

| Job Logger Concept | Agent System Equivalent |
|-------------------|------------------------|
| `jobLogs` table | Agent memory / execution log |
| `ai.runJob` action | Tool execution |
| `logs.create` mutation | State persistence |
| `logs.list` query | Agent introspection / observability |
| `status` field | Agent state machine |
| Real-time sync | Live agent monitoring |

---

## Actions as Tool Orchestrators

In an agent system, each "tool" is a Convex action. The orchestrator calls tools and persists results:

```typescript
// convex/tools/webSearch.ts
export const search = action({
  args: { query: v.string(), agentRunId: v.id("agentRuns") },
  handler: async (ctx, args) => {
    // Log tool invocation
    await ctx.runMutation(internal.agentMemory.logToolCall, {
      runId: args.agentRunId,
      tool: "webSearch",
      input: args.query,
      status: "running",
    });

    // Execute the tool
    const results = await searchWeb(args.query);

    // Persist results
    await ctx.runMutation(internal.agentMemory.logToolResult, {
      runId: args.agentRunId,
      tool: "webSearch",
      output: JSON.stringify(results),
      status: "completed",
    });

    return results;
  },
});
```

The key pattern: **action calls external API, mutation persists state**. This maps directly to `ai.runJob` → `logs.updateStatus` in our app.

---

## jobLogs as Agent Memory Store

The `jobLogs` table is already a primitive memory store. To evolve it:

```typescript
// convex/schema.ts — Agent-evolved schema
export default defineSchema({
  // Agent runs (formerly jobLogs)
  agentRuns: defineTable({
    goal: v.string(),                    // was: prompt
    status: v.union(                     // same pattern
      v.literal("planning"),
      v.literal("executing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    plan: v.optional(v.string()),        // agent's execution plan
    result: v.optional(v.string()),      // final output
    model: v.string(),
    totalDuration: v.optional(v.string()),
    parentRunId: v.optional(v.id("agentRuns")),  // for sub-agents
  }),

  // Tool execution log (new)
  toolCalls: defineTable({
    runId: v.id("agentRuns"),
    tool: v.string(),                    // tool name
    input: v.string(),                   // serialized input
    output: v.optional(v.string()),      // serialized output
    status: v.union(v.literal("running"), v.literal("completed"), v.literal("failed")),
    duration: v.optional(v.string()),
    sequence: v.number(),                // execution order
  }).index("by_run", ["runId"]),

  // Agent memory / context (new)
  memories: defineTable({
    runId: v.id("agentRuns"),
    type: v.union(v.literal("observation"), v.literal("reflection"), v.literal("fact")),
    content: v.string(),
    relevance: v.optional(v.float64()),  // for retrieval scoring
  }).index("by_run", ["runId"]),
});
```

---

## Multi-Agent Schema Extensions

For systems with multiple agents collaborating:

```typescript
// Additional tables for multi-agent systems
agents: defineTable({
  name: v.string(),
  role: v.string(),                      // "planner", "researcher", "coder"
  systemPrompt: v.string(),
  model: v.string(),
  capabilities: v.array(v.string()),    // tool names this agent can use
}),

// Agent communication channel
agentMessages: defineTable({
  fromAgentId: v.id("agents"),
  toAgentId: v.id("agents"),
  runId: v.id("agentRuns"),
  content: v.string(),
  messageType: v.union(
    v.literal("request"),
    v.literal("response"),
    v.literal("broadcast")
  ),
}).index("by_run", ["runId"]),
```

---

## Where Background Jobs and Scheduled Tasks Live

Convex has built-in support for scheduled functions:

```typescript
// Schedule a follow-up check
export const scheduleRetry = mutation({
  args: { runId: v.id("agentRuns") },
  handler: async (ctx, args) => {
    // Schedule the retry action to run in 30 seconds
    await ctx.scheduler.runAfter(30000, internal.ai.retryJob, {
      runId: args.runId,
    });
  },
});

// Recurring agent health check
export const scheduleHealthCheck = mutation({
  handler: async (ctx) => {
    // Run every 5 minutes
    await ctx.scheduler.runAfter(300000, internal.monitoring.checkAgentHealth, {});
  },
});
```

This replaces cron jobs, task queues (Bull, BullMQ), and background job frameworks.

---

## Event-Driven Workflow Patterns

Convex's real-time subscriptions enable event-driven agent architectures:

```
User Request
    ↓
Planner Agent (action)
    ↓ creates plan, persists via mutation
    ↓ subscribers see plan appear in real-time
    ↓
Executor Agent (action, called per plan step)
    ↓ executes tools, logs results via mutation
    ↓ subscribers see each tool result in real-time
    ↓
Reviewer Agent (action)
    ↓ evaluates results, may trigger re-planning
    ↓
Final Output
    ↓ persisted via mutation
    ↓ all subscribers see the final result
```

Each arrow is an action → mutation → query subscription cycle. The UI updates at every step without any additional code.

---

## Orchestration Patterns

### Sequential Tool Execution
```typescript
export const runSequential = action({
  handler: async (ctx, args) => {
    const searchResults = await ctx.runAction(internal.tools.webSearch, { query: "..." });
    const analysis = await ctx.runAction(internal.tools.analyze, { data: searchResults });
    const summary = await ctx.runAction(internal.tools.summarize, { input: analysis });
    return summary;
  },
});
```

### Parallel Tool Execution
```typescript
export const runParallel = action({
  handler: async (ctx, args) => {
    const [search, code, docs] = await Promise.all([
      ctx.runAction(internal.tools.webSearch, { query: args.query }),
      ctx.runAction(internal.tools.codeSearch, { query: args.query }),
      ctx.runAction(internal.tools.docSearch, { query: args.query }),
    ]);
    return { search, code, docs };
  },
});
```

### ReAct Loop (Reason + Act)
```typescript
export const reasonAndAct = action({
  handler: async (ctx, args) => {
    let done = false;
    let iteration = 0;

    while (!done && iteration < 10) {
      // Reason: Ask LLM what to do next
      const decision = await ctx.runAction(internal.ai.reason, {
        runId: args.runId,
        iteration,
      });

      if (decision.action === "finish") {
        done = true;
      } else {
        // Act: Execute the chosen tool
        await ctx.runAction(internal.tools[decision.tool], {
          runId: args.runId,
          input: decision.input,
        });
      }

      iteration++;
    }
  },
});
```

---

## Summary

The path from this app to a production agent system is incremental:

1. **Start here:** Single action, single table, single model
2. **Add tools:** Each tool is a new action file
3. **Add memory:** Extend schema with tool calls and observations
4. **Add orchestration:** Chain actions with planning logic
5. **Add agents:** Multiple roles with different system prompts
6. **Add scheduling:** Background tasks and retries
7. **Add monitoring:** Real-time dashboards using query subscriptions

Every step uses the same three primitives: **queries**, **mutations**, **actions**.
