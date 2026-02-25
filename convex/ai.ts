"use node";

import { action } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import OpenAI from "openai";

export const runJob = action({
  args: {
    prompt: v.string(),
    model: v.optional(v.string()),
  },
  handler: async (ctx, args): Promise<{ jobId: string; status: string }> => {
    const model = args.model || "meta-llama/llama-3.3-70b-instruct";

    const jobId = await ctx.runMutation(internal.logs.create, {
      prompt: args.prompt,
      model,
    });

    const startTime = Date.now();

    try {
      const openrouter = new OpenAI({
        baseURL: process.env.AI_INTEGRATIONS_OPENROUTER_BASE_URL,
        apiKey: process.env.AI_INTEGRATIONS_OPENROUTER_API_KEY,
      });

      const response = await openrouter.chat.completions.create({
        model,
        messages: [
          {
            role: "system",
            content: "You are a helpful AI assistant. Provide clear, concise responses.",
          },
          { role: "user", content: args.prompt },
        ],
        max_tokens: 8192,
      });

      const result = response.choices[0]?.message?.content || "No response generated";
      const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;

      await ctx.runMutation(internal.logs.updateStatus, {
        id: jobId,
        status: "completed",
        result,
        duration,
      });

      return { jobId: jobId.toString(), status: "completed" };
    } catch (error) {
      const duration = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
      const errorMessage = error instanceof Error ? error.message : "Unknown error";

      await ctx.runMutation(internal.logs.updateStatus, {
        id: jobId,
        status: "failed",
        result: `Error: ${errorMessage}`,
        duration,
      });

      return { jobId: jobId.toString(), status: "failed" };
    }
  },
});
