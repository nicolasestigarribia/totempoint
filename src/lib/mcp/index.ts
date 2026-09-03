import { auth, defineMcp } from "@lovable.dev/mcp-js";
import getCurrentUserTool from "./tools/get-current-user";
import listBusinessesTool from "./tools/list-businesses";
import getBusinessTool from "./tools/get-business";
import updateBusinessTool from "./tools/update-business";
import setBusinessActiveTool from "./tools/set-business-active";

const projectRef = import.meta.env["VITE_SUPABASE_PROJECT_ID"] ?? "project-ref-unset";

export default defineMcp({
  name: "burger-point-order",
  title: "Burger Point Order",
  version: "0.1.0",
  instructions:
    "Tools for Burger Point Order. Use get_current_user to verify the caller's identity, list_businesses to see accessible businesses, get_business for details, update_business to edit business metadata, and set_business_active to enable or disable a business (superadmin only).",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [getCurrentUserTool, listBusinessesTool, getBusinessTool, updateBusinessTool, setBusinessActiveTool],
});
