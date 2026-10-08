// send-verification-email: sends verification email via Resend (custom token), falls back to Supabase OTP
import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!user.email) {
      return new Response(JSON.stringify({ error: "No email on account" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceKey);

    const appUrl = Deno.env.get("APP_URL") ?? "http://localhost:5173";

    const token = crypto.randomUUID() + crypto.randomUUID().replace(/-/g, "");
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    const { error: tokenError } = await admin.from("email_verification_tokens").insert({
      user_id: user.id,
      token,
      expires_at: expiresAt,
      used: false,
    });
    if (tokenError) throw tokenError;

    const verifyLink = `${appUrl}/verify-email?token=${token}`;

    const { data: profile } = await admin
      .from("user_profiles")
      .select("display_name")
      .eq("id", user.id)
      .maybeSingle();

    const displayName = (profile as { display_name: string | null } | null)?.display_name ?? user.email.split("@")[0];

    const emailHtml = `<!DOCTYPE html>
<html>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px; color: #1a1a2e;">
  <div style="margin-bottom: 24px;">
    <h1 style="font-size: 20px; font-weight: 700; color: #1a1a2e; margin: 0;">Krayo</h1>
  </div>
  <h2 style="font-size: 18px; font-weight: 600; margin: 0 0 16px 0;">Hi ${displayName},</h2>
  <p style="font-size: 15px; line-height: 1.6; color: #4a4a6a; margin: 0 0 24px 0;">
    Welcome to Krayo! Please verify your email address to complete your account setup.
  </p>
  <a href="${verifyLink}" style="display: inline-block; background: #2d6a4f; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-size: 15px; font-weight: 600; margin-bottom: 24px;">
    Verify my email
  </a>
  <p style="font-size: 13px; line-height: 1.6; color: #8a8a9a; margin: 0 0 8px 0;">
    Or copy this link into your browser:
  </p>
  <p style="font-size: 13px; line-height: 1.6; color: #2d6a4f; word-break: break-all; margin: 0 0 24px 0;">
    ${verifyLink}
  </p>
  <p style="font-size: 13px; color: #8a8a9a; margin: 0 0 8px 0;">
    This link expires in 24 hours. If you didn't create a Krayo account, you can safely ignore this email.
  </p>
  <hr style="border: none; border-top: 1px solid #e0e0e8; margin: 24px 0;" />
  <p style="font-size: 12px; color: #a0a0b0; margin: 0;">Krayo - Project Delivery Platform</p>
</body>
</html>`;

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    let emailSent = false;

    if (resendApiKey) {
      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${resendApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Krayo <onboarding@resend.dev>",
            to: [user.email],
            subject: "Verify your email - Krayo",
            html: emailHtml,
          }),
        });

        if (emailResponse.ok) {
          emailSent = true;
        } else {
          const errText = await emailResponse.text();
          console.error("Resend error:", errText);
        }
      } catch (err) {
        console.error("Resend fetch failed:", err);
      }
    }

    if (!emailSent) {
      const { error: sendError } = await admin.auth.admin.sendOtp(user.email, {
        shouldCreateUser: false,
      });
      if (sendError) {
        console.error("Supabase OTP send error:", sendError.message);
        return new Response(JSON.stringify({ error: "Failed to send verification email" }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ sent: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Verification email error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Verification email failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
