import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "get_current_user",
  title: "Current user",
  description: "Returns the authenticated user's id, email and role claims.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: (_input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Not authenticated" }], isError: true };
    }
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              id: ctx.getUserId(),
              email: ctx.getUserEmail(),
              claims: ctx.getClaims(),
            },
            null,
            2,
          ),
        },
      ],
    };
  },
});
