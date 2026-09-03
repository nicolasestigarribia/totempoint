import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "update_business",
  title: "Update business",
  description: "Update editable fields of a business. Superadmins can edit any business; business admins can edit only their own business and cannot change the active flag.",
  inputSchema: {
    id: z.string().uuid().describe("Business UUID to update."),
    name: z.string().min(2).max(80).optional().describe("Business name."),
    logo_url: z.string().url().optional().describe("Public URL of the business logo."),
    primary_color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().describe("Hex primary color, e.g. #3B82F6."),
    phone: z.string().max(40).optional().describe("Contact phone."),
    address: z.string().max(200).optional().describe("Business address."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, openWorldHint: false },
  handler: async ({ id, ...updates }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const payload = Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined));
    if (Object.keys(payload).length === 0) {
      return { content: [{ type: "text", text: "No fields provided to update" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase.from("businesses").update(payload).eq("id", id).select().single();
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: data,
    };
  },
});
