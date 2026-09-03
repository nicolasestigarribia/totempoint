import { defineTool } from "@lovable.dev/mcp-js";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_businesses",
  title: "List businesses",
  description: "List the businesses the signed-in user can see. Superadmins see all businesses; business admins see only their assigned business.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("businesses")
      .select("id, name, slug, active, logo_url, primary_color, phone, address, created_at, updated_at")
      .order("created_at", { ascending: false });
    if (error) {
      return { content: [{ type: "text", text: error.message }], isError: true };
    }
    return {
      content: [
        { type: "text", text: JSON.stringify({ count: data?.length ?? 0, businesses: data ?? [] }, null, 2) },
      ],
    };
  },
});
