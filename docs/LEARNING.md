# AI Job Logger — Learning Guide

## The Mental Model of Convex

Convex is a **reactive backend-as-a-service**. Think of it as a database that pushes updates to your frontend automatically. Unlike traditional REST APIs where the client polls or manually invalidates caches, Convex maintains a live subscription between your UI and your data.

The core mental model:

```
Frontend (React)  ←→  Convex Cloud (Functions + Database)
     ↑                        ↑
  useQuery()            Queries / Mutations / Actions
  useAction()           Schema-validated tables
  useMutation()         Automatic real-time sync
```

Your frontend **subscribes** to queries. When the underlying data changes (via a mutation), every subscribed client gets the new data instantly. No WebSocket setup, no cache invalidation, no polling.

---

## The Three Convex Primitives

### 1. Queries (Read-Only)

**File:** `convex/logs.ts` → `list`, `get`

Queries are **pure, deterministic read functions**. They:
- Can only read from the database
- Cannot have side effects (no HTTP calls, no randomness)
- Are automatically cached and re-run when their dependencies change
- Power the real-time subscription system

```typescript
export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("jobLogs").order("desc").collect();
  },
});
```

**Why read-only?** Because Convex needs to re-run queries deterministically whenever the underlying data changes. If a query had side effects, re-running it would cause duplicate actions.

### 2. Mutations (Transactional Writes)

**File:** `convex/logs.ts` → `create`, `updateStatus`, `seed`

Mutations are **transactional write functions**. They:
- Can read and write to the database
- Run within an ACID transaction (all-or-nothing)
- Are the only way to modify data
- Cannot make external API calls (no `fetch`, no HTTP)

```typescript
export const create = internalMutation({
  args: { prompt: v.string(), model: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db.insert("jobLogs", {
      prompt: args.prompt,
      status: "running",
      model: args.model,
    });
  },
});
```

**Why no external calls?** Transactions must be atomic. If a mutation called an external API and then the transaction failed, you'd have an inconsistent state (API called but data not written). Convex enforces this separation at the type level.

### 3. Actions (Side Effects)

**File:** `convex/ai.ts` → `runJob`

Actions are for **external side effects** — API calls, file I/O, anything non-deterministic. They:
- Can call external APIs (like OpenRouter)
- Can call mutations via `ctx.runMutation()` to persist results
- Cannot directly read/write the database
- Are NOT automatically retried (unlike mutations)

```typescript
export const runJob = action({
  args: { prompt: v.string() },
  handler: async (ctx, args) => {
    // 1. Create the job record (via mutation)
    const jobId = await ctx.runMutation(internal.logs.create, { ... });

    // 2. Call external API (side effect)
    const response = await openrouter.chat.completions.create({ ... });

    // 3. Update the job record (via mutation)
    await ctx.runMutation(internal.logs.updateStatus, { ... });
  },
});
```

**Why `runMutation` inside actions?** Actions run outside the database transaction. To write data, they must explicitly call a mutation. This keeps the boundary clean: mutations own data integrity, actions own external communication.

---

## What Happens When a User Clicks "Run Job"

Here's the exact data flow:

```
1. User types prompt → clicks "Run Job"
         ↓
2. Frontend calls useAction(api.ai.runJob)({ prompt: "..." })
         ↓
3. Convex receives the action call on its server
         ↓
4. Action calls ctx.runMutation(internal.logs.create)
   → Mutation inserts { status: "running" } into jobLogs table
   → Transaction commits
         ↓
5. All clients subscribed to logs.list get INSTANT update
   → UI shows new job with "Running" badge
         ↓
6. Action calls OpenRouter API with the prompt
   → Waits for LLM response (2-10 seconds)
         ↓
7. Action calls ctx.runMutation(internal.logs.updateStatus)
   → Mutation patches job with { status: "completed", result: "..." }
   → Transaction commits
         ↓
8. All clients subscribed to logs.list get INSTANT update
   → UI shows job with "Completed" badge and result
```

**Key insight:** Steps 5 and 8 happen automatically. No polling. No manual cache invalidation. No WebSocket messages to parse. The `useQuery` hook manages the subscription lifecycle.

---

## Where Real-Time Behavior Is Triggered

Real-time updates are triggered by **any mutation that modifies data read by an active query subscription**.

In this app:
- `useQuery(api.logs.list)` subscribes to the `jobLogs` table
- When `logs.create` or `logs.updateStatus` mutations run, Convex detects that `jobLogs` data changed
- Convex automatically re-runs the `logs.list` query
- The new result is pushed to all subscribed clients

This is fundamentally different from:
- **REST + polling:** Client periodically asks "is there new data?" (wastes bandwidth, has latency)
- **REST + WebSocket:** Server pushes a "data changed" event, client fetches new data (two round trips)
- **Convex:** Server pushes the actual new data directly (zero extra round trips)

---

## What Would Break Real-Time

1. **Using `fetch()` instead of `useQuery()`** — If you fetch data with a regular HTTP request, you lose the subscription. The UI won't update automatically.

2. **Caching query results locally** — If you store query results in `useState` and only update on mount, you've broken the live connection.

3. **Using `action` when you should use `mutation`** — Actions don't trigger reactive updates directly. You must call `runMutation` from within an action to modify data.

4. **Calling the database directly from an action** — Actions can't access `ctx.db`. They must go through mutations. This is by design.

---

## How This Differs From Traditional REST + Client Cache

| Aspect | REST + TanStack Query | Convex |
|--------|----------------------|--------|
| Data freshness | Stale until refetch | Always current |
| Cache invalidation | Manual (`queryClient.invalidateQueries`) | Automatic |
| Real-time updates | Requires WebSocket + custom logic | Built-in |
| Optimistic updates | Must implement manually | Supported natively |
| Type safety | Schema → API → Client (3 boundaries) | Schema → Client (1 boundary) |
| Backend code | Express routes + controllers + ORM | Functions with typed args |
| Deployment | Server + database + hosting | Single `npx convex deploy` |

---

## Schema Definition

**File:** `convex/schema.ts`

Convex uses a schema system with runtime validators (not just TypeScript types):

```typescript
export default defineSchema({
  jobLogs: defineTable({
    prompt: v.string(),
    status: v.union(v.literal("pending"), v.literal("running"), ...),
    result: v.optional(v.string()),
    model: v.string(),
    duration: v.optional(v.string()),
  }),
});
```

Every document in `jobLogs` is validated against this schema on insert and update. This means:
- Invalid data is rejected at the database level (not just TypeScript)
- Schema changes are validated during deployment
- Types are auto-generated for queries and mutations
