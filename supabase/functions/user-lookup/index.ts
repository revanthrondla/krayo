import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceKey);
    const body = await req.json();
    const { mode } = body;

    // Organizations the caller belongs to, and whether they administer any.
    const { data: callerMemberships } = await admin
      .from("org_memberships")
      .select("org_id, role")
      .eq("user_id", user.id);
    const memberships = (callerMemberships ?? []) as { org_id: string; role: string }[];
    const callerOrgIds = memberships.map((m) => m.org_id);

    if (mode === "by_ids") {
      const userIds: string[] = body.user_ids;
      if (!Array.isArray(userIds) || userIds.length === 0) return json([]);
      if (callerOrgIds.length === 0) return json([]);

      // Only users who share an organization with the caller may be resolved.
      const { data: shared } = await admin
        .from("org_memberships")
        .select("user_id")
        .in("org_id", callerOrgIds)
        .in("user_id", userIds.slice(0, 200));
      const allowedIds = Array.from(
        new Set((shared ?? []).map((m: { user_id: string }) => m.user_id))
      );
      if (allowedIds.length === 0) return json([]);

      const { data, error } = await admin.rpc("get_user_emails", { user_ids: allowedIds });
      if (error) throw error;
      return json(data ?? []);
    }

    if (mode === "by_email") {
      const email: string = body.email;
      if (!email || typeof email !== "string") return json({ error: "email is required" }, 400);

      // Resolving an arbitrary address is an administrative action (used by the
      // invite flow), so it requires organization admin rights, and it returns
      // only an opaque id — never the address itself.
      const isAdmin = memberships.some((m) => m.role === "Owner" || m.role === "Admin");
      if (!isAdmin) return json({ error: "Forbidden" }, 403);

      const { data, error } = await admin.rpc("get_user_by_email", {
        _email: email.trim().toLowerCase(),
      });
      if (error) throw error;
      const rows = (data ?? []) as { id: string; email: string }[];
      const found = Array.isArray(rows) ? rows[0] : (rows as unknown as { id: string } | null);
      return json(found?.id ? { id: found.id } : null);
    }

    return json({ error: "Invalid mode. Use 'by_ids' or 'by_email'." }, 400);
  } catch (err) {
    console.error("user-lookup error:", err);
    return json({ error: "Lookup failed" }, 500);
  }
});
