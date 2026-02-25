import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  jobLogs: defineTable({
    prompt: v.string(),
    status: v.union(v.literal("pending"), v.literal("running"), v.literal("completed"), v.literal("failed")),
    result: v.optional(v.string()),
    model: v.string(),
    duration: v.optional(v.string()),
  }),
});
