import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function randomKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `tl_${Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

async function hashKey(key: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(key));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("authorization") ?? "";
    if (!authorization.toLowerCase().startsWith("bearer ")) return response({ error: "Authentication required" }, 401);
    const token = authorization.slice(7).trim();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userData } = await supabase.auth.getUser(token);
    if (!userData.user) return response({ error: "Authentication required" }, 401);

    const payload = await req.json() as { project_id?: string };
    if (!payload.project_id) return response({ error: "Project is required" }, 400);
    const { data: membership } = await supabase.from("project_memberships").select("id").eq("project_id", payload.project_id).eq("user_id", userData.user.id).maybeSingle();
    if (!membership) return response({ error: "Project access required" }, 403);

    const key = randomKey();
    const { error } = await supabase.from("project_api_keys").upsert({
      project_id: payload.project_id,
      key_hash: await hashKey(key),
      key_prefix: key.slice(0, 11),
      created_by: userData.user.id,
      last_used_at: null,
    }, { onConflict: "project_id" });
    if (error) return response({ error: "Could not create project API key" }, 500);
    return response({ key, key_prefix: key.slice(0, 11) }, 201);
  } catch {
    return response({ error: "Could not create project API key" }, 500);
  }
});
