import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const jobs = await ctx.db
      .query("jobLogs")
      .order("desc")
      .collect();
    return jobs;
  },
});

export const get = query({
  args: { id: v.id("jobLogs") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = internalMutation({
  args: {
    prompt: v.string(),
    model: v.string(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("jobLogs", {
      prompt: args.prompt,
      status: "running",
      model: args.model,
    });
    return id;
  },
});

export const updateStatus = internalMutation({
  args: {
    id: v.id("jobLogs"),
    status: v.union(v.literal("completed"), v.literal("failed")),
    result: v.optional(v.string()),
    duration: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, {
      status: args.status,
      result: args.result,
      duration: args.duration,
    });
  },
});

export const seed = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("jobLogs").first();
    if (existing) return;

    await ctx.db.insert("jobLogs", {
      prompt: "Explain the difference between supervised and unsupervised learning in machine learning",
      status: "completed",
      result: "Supervised learning uses labeled training data where the algorithm learns to map inputs to known outputs. Examples include classification (spam detection) and regression (price prediction). Unsupervised learning works with unlabeled data, discovering hidden patterns and structures. Examples include clustering (customer segmentation) and dimensionality reduction (PCA). The key distinction is whether the training data includes the desired output labels.",
      model: "meta-llama/llama-3.3-70b-instruct",
      duration: "2.3s",
    });

    await ctx.db.insert("jobLogs", {
      prompt: "Write a haiku about debugging code",
      status: "completed",
      result: "Semicolons hide\nIn forests of nested loops\nBug found at midnight",
      model: "meta-llama/llama-3.3-70b-instruct",
      duration: "1.1s",
    });

    await ctx.db.insert("jobLogs", {
      prompt: "What are the key principles of clean architecture?",
      status: "completed",
      result: "Clean Architecture centers on dependency inversion: business logic should not depend on frameworks, databases, or UI. Key principles include: 1) Independence of frameworks, 2) Testability without external elements, 3) Independence of UI, 4) Independence of database, 5) Independence of any external agency. Code is organized in concentric layers: Entities (enterprise rules), Use Cases (application rules), Interface Adapters (controllers, presenters), and Frameworks & Drivers (external tools).",
      model: "meta-llama/llama-3.3-70b-instruct",
      duration: "3.8s",
    });

    await ctx.db.insert("jobLogs", {
      prompt: "Generate a TypeScript utility type that makes all nested properties optional",
      status: "completed",
      result: "type DeepPartial<T> = T extends object ? { [P in keyof T]?: DeepPartial<T[P]> } : T;\n\nThis recursively traverses the type tree, making each property optional at every level. For primitives it returns the type as-is. For objects, it maps over each key making it optional and recursively applies DeepPartial to the value type.",
      model: "meta-llama/llama-3.3-70b-instruct",
      duration: "1.9s",
    });

    await ctx.db.insert("jobLogs", {
      prompt: "Summarize the CAP theorem",
      status: "failed",
      result: "Error: Request timed out after 30 seconds",
      model: "meta-llama/llama-3.3-70b-instruct",
      duration: "30.0s",
    });
  },
});
