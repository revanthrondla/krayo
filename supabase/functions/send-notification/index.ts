import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const { createClient } = await import("npm:@supabase/supabase-js@2");

    // --- Authenticate the caller -------------------------------------------
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { type, recipientIds, projectId, itemType, itemId, message } = await req.json();

    if (!type || !recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
      return new Response(JSON.stringify({ error: "type, recipientIds (array) are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (recipientIds.length > 50) {
      return new Response(JSON.stringify({ error: "Too many recipients" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // --- Authorize: caller must share the project (or org) with recipients ---
    // The set of organizations the caller belongs to.
    const { data: callerOrgs } = await admin
      .from("org_memberships")
      .select("org_id")
      .eq("user_id", user.id);
    const callerOrgIds = (callerOrgs ?? []).map((m: { org_id: string }) => m.org_id);
    if (callerOrgIds.length === 0) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let allowedOrgIds = callerOrgIds;
    if (projectId) {
      const { data: project } = await admin
        .from("projects")
        .select("id, org_id")
        .eq("id", projectId)
        .maybeSingle();
      const projectOrgId = (project as { org_id: string } | null)?.org_id;
      if (!projectOrgId || !callerOrgIds.includes(projectOrgId)) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      allowedOrgIds = [projectOrgId];
    }

    // Recipients must be members of an organization the caller shares.
    const { data: allowedMembers } = await admin
      .from("org_memberships")
      .select("user_id")
      .in("org_id", allowedOrgIds)
      .in("user_id", recipientIds);
    const allowedIds = Array.from(
      new Set((allowedMembers ?? []).map((m: { user_id: string }) => m.user_id))
    );

    if (allowedIds.length === 0) {
      return new Response(JSON.stringify({ created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The actor is always the authenticated caller, never a client-supplied id.
    const actorId = user.id;
    const safeMessage = typeof message === "string" && message.trim().length > 0
      ? message.slice(0, 1000)
      : "You have a new notification";

    const rows = allowedIds.map((userId: string) => ({
      user_id: userId,
      type,
      project_id: projectId ?? null,
      item_type: itemType ?? null,
      item_id: itemId ?? null,
      actor_id: actorId,
      message: safeMessage,
    }));

    const { data, error } = await admin.from("notifications").insert(rows).select("id, user_id");

    if (error) throw error;
    const insertedIds = (data ?? []).map((n: { id: string }) => n.id);

    if (resendApiKey) {
      const { data: profiles } = await admin
        .from("user_profiles")
        .select("id, display_name, notification_email, notification_mentions, notification_assignments")
        .in("id", allowedIds);

      const profileMap = new Map(
        (profiles ?? []).map((p: Record<string, unknown>) => [p.id as string, p])
      );

      const { data: authUsers } = await admin.rpc("get_user_emails", { user_ids: allowedIds });

      const emailMap = new Map(
        ((authUsers ?? []) as { id: string; email: string }[]).map((u) => [u.id, u.email])
      );

      let actorName = "Someone";
      const { data: actorProfile } = await admin
        .from("user_profiles")
        .select("display_name")
        .eq("id", actorId)
        .maybeSingle();
      const name = (actorProfile as { display_name: string | null } | null)?.display_name;
      if (name) actorName = name;
      else if (user.email) actorName = user.email.split("@")[0];

      let projectName: string | null = null;
      if (projectId) {
        const { data: project } = await admin
          .from("projects")
          .select("name")
          .eq("id", projectId)
          .maybeSingle();
        projectName = (project as { name: string } | null)?.name ?? null;
      }

      const emailPromises: Promise<Response>[] = [];

      for (const userId of allowedIds) {
        const profile = profileMap.get(userId) as {
          notification_email?: boolean;
          notification_mentions?: boolean;
          notification_assignments?: boolean;
          display_name?: string | null;
        } | undefined;

        if (!profile) continue;

        if (profile.notification_email === false) continue;
        if (type === "mention" && profile.notification_mentions === false) continue;
        if (type === "assignment" && profile.notification_assignments === false) continue;

        const email = emailMap.get(userId);
        if (!email) continue;

        const displayName = escapeHtml(profile.display_name ?? email.split("@")[0]);
        const safeActor = escapeHtml(actorName);
        const subject = type === "mention"
          ? `${actorName} mentioned you on Krayo`
          : type === "assignment"
          ? `${actorName} assigned you a task on Krayo`
          : `New notification on Krayo`;

        const projectLine = projectName
          ? `<p style="font-size:13px;color:#8a8a9a;margin:0 0 16px 0;">Project: <strong>${escapeHtml(projectName)}</strong></p>`
          : "";

        const emailBody = `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a2e;">
  <div style="margin-bottom: 24px;">
    <h1 style="font-size: 20px; font-weight: 700; color: #1a1a2e; margin: 0;">Krayo</h1>
  </div>
  <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">Hi ${displayName},</h2>
  <p style="font-size: 13px; color: #8a8a9a; margin: 0 0 8px 0;">From ${safeActor}</p>
  <p style="font-size: 15px; line-height: 1.6; color: #4a4a6a; margin: 0 0 16px 0;">
    ${escapeHtml(safeMessage)}
  </p>
  ${projectLine}
  <a href="${Deno.env.get("APP_URL") ?? "http://localhost:5173"}/app" style="display: inline-block; background: #2d6a4f; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600; margin-bottom: 24px;">
    Open Krayo
  </a>
  <hr style="border: none; border-top: 1px solid #e0e0e8; margin: 24px 0;" />
  <p style="font-size: 12px; color: #a0a0b0; margin: 0;">You're receiving this because of your Krayo notification settings. You can change these in your preferences.</p>
</body>
</html>`;

        emailPromises.push(
          fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "Krayo <noreply@krayo.app>",
              to: [email],
              subject,
              html: emailBody,
            }),
          })
        );
      }

      const results = await Promise.allSettled(emailPromises);
      const failed = results.filter((r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok));
      if (failed.length > 0) {
        console.error(`Failed to send ${failed.length}/${emailPromises.length} notification emails`);
      }

      if (insertedIds.length > 0) {
        const { error: markError } = await admin
          .from("notifications")
          .update({ email_sent: true })
          .in("id", insertedIds);
        if (markError) console.error("Failed to mark email_sent:", markError.message);
      }
    } else {
      console.warn("RESEND_API_KEY not configured — notification emails not sent");
    }

    return new Response(JSON.stringify({ created: data?.length ?? 0 }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-notification error:", err);
    return new Response(JSON.stringify({ error: "Notification failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
