import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_business",
  title: "Get business",
  description: "Get a single business by id or slug. The caller must be allowed to access it through RLS.",
  inputSchema: {
    id: z.string().uuid().optional().describe("Business UUID. Either id or slug is required."),
    slug: z.string().min(1).optional().describe("Business slug. Either id or slug is required."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, slug }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    if (!id && !slug) {
      return { content: [{ type: "text", text: "Provide either id or slug" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("businesses")
      .select("id, name, slug, active, logo_url, primary_color, phone, address, created_at, updated_at");
    if (id) query = query.eq("id", id);
    else if (slug) query = query.eq("slug", slug);
    const { data, error } = await query.single();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: data,
    };
  },
});
