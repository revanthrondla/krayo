import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key, X-Report-URL, X-Tool-Name, X-Started-At",
};

const MAX_XML_BYTES = 5 * 1024 * 1024;

type ParsedCase = {
  name: string;
  outcome: "passed" | "failed" | "skipped" | "error" | "unknown";
  durationSeconds: number | null;
  failureMessage: string | null;
};

function response(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function decodeXml(value: string): string {
  return value.replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}

function attributes(source: string): Record<string, string> {
  const result: Record<string, string> = {};
  const pattern = /([A-Za-z_:][\w:.-]*)\s*=\s*["']([^"']*)["']/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) result[match[1]] = decodeXml(match[2]);
  return result;
}

function textContent(value: string): string {
  return decodeXml(value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
}

function parseCases(xml: string): ParsedCase[] {
  const results: ParsedCase[] = [];
  const casePattern = /<testcase\b([^>]*?)(?:\/>|>([\s\S]*?)<\/testcase>)/gi;
  let match: RegExpExecArray | null;
  while ((match = casePattern.exec(xml)) !== null) {
    const attrs = attributes(match[1]);
    const body = match[2] ?? "";
    const failure = body.match(/<(failure|error)\b([^>]*)>([\s\S]*?)<\/\1>|<(failure|error)\b([^>]*)\s*\/?>/i);
    const skipped = /<skipped\b/i.test(body);
    const outcome = failure ? (failure[1]?.toLowerCase() === "error" || failure[4]?.toLowerCase() === "error" ? "error" : "failed") : skipped ? "skipped" : "passed";
    const duration = Number(attrs.time);
    results.push({
      name: attrs.name || attrs.classname || "Unnamed test",
      outcome,
      durationSeconds: Number.isFinite(duration) ? duration : null,
      failureMessage: failure ? textContent(failure[3] ?? "") || failure[2] || failure[5] || "Automation test failed" : null,
    });
  }
  return results;
}

function extractApiKey(req: Request): string | null {
  const direct = req.headers.get("x-api-key");
  if (direct?.trim()) return direct.trim();
  const authorization = req.headers.get("authorization") ?? "";
  return authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : null;
}

async function hashKey(key: string): Promise<string> {
  const bytes = new TextEncoder().encode(key);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return response({ error: "Method not allowed" }, 405);

  try {
    const apiKey = extractApiKey(req);
    if (!apiKey || apiKey.length < 32) return response({ error: "Invalid API key" }, 401);
    const body = await req.arrayBuffer();
    if (body.byteLength > MAX_XML_BYTES) return response({ error: "JUnit report is too large" }, 413);
    const xml = new TextDecoder().decode(body);
    if (!/<testcase\b/i.test(xml)) return response({ error: "No JUnit test cases found" }, 400);

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const keyHash = await hashKey(apiKey);
    const { data: key, error: keyError } = await supabase.from("project_api_keys").select("id, project_id").eq("key_hash", keyHash).maybeSingle();
    if (keyError || !key) return response({ error: "Invalid API key" }, 401);

    const cases = parseCases(xml);
    if (cases.length === 0) return response({ error: "No JUnit test cases found" }, 400);

    const { data: testCases, error: testCaseError } = await supabase.from("test_cases").select("id, code").eq("project_id", key.project_id);
    if (testCaseError) return response({ error: "Could not load project test cases" }, 500);
    const byCode = new Map<string, { id: string; code: string }>((testCases ?? []).map((testCase) => [String(testCase.code).trim().toUpperCase(), testCase]));
    const reportUrl = req.headers.get("x-report-url")?.trim() || null;
    const toolName = req.headers.get("x-tool-name")?.trim() || "JUnit";
    const startedHeader = req.headers.get("x-started-at");
    const startedAt = startedHeader && !Number.isNaN(Date.parse(startedHeader)) ? new Date(startedHeader).toISOString() : null;

    const matched = cases.map((testCase) => {
      const codeMatch = testCase.name.match(/\bTC-\d+\b/i);
      const code = codeMatch?.[0]?.toUpperCase() ?? null;
      return { testCase, code, match: code ? byCode.get(code) ?? null : null };
    });
    const counts = {
      total_count: matched.length,
      passed_count: matched.filter((item) => item.testCase.outcome === "passed").length,
      failed_count: matched.filter((item) => item.testCase.outcome === "failed" || item.testCase.outcome === "error").length,
      skipped_count: matched.filter((item) => item.testCase.outcome === "skipped").length,
      unmatched_count: matched.filter((item) => !item.match).length,
    };

    const { data: run, error: runError } = await supabase.from("test_runs").insert({ project_id: key.project_id, tool_name: toolName, external_report_url: reportUrl, started_at: startedAt, ...counts }).select("id").single();
    if (runError || !run) return response({ error: "Could not save test run" }, 500);

    const rows = matched.map(({ testCase, code, match }) => ({
      test_run_id: run.id,
      project_id: key.project_id,
      incoming_name: testCase.name,
      test_case_id: match?.id ?? null,
      test_case_code: code,
      outcome: testCase.outcome,
      duration_seconds: testCase.durationSeconds,
      failure_message: testCase.failureMessage,
      external_report_url: reportUrl,
    }));
    const { error: resultError } = await supabase.from("test_run_results").insert(rows);
    if (resultError) return response({ error: "Could not save test run results" }, 500);

    for (const item of matched) {
      if (!item.match) continue;
      const status = item.testCase.outcome === "passed" ? "Passed" : item.testCase.outcome === "skipped" ? "Blocked" : "Failed";
      await supabase.from("test_cases").update({ status }).eq("id", item.match.id).eq("project_id", key.project_id);
    }
    await supabase.from("project_api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", key.id);

    return response({ run_id: run.id, ...counts }, 201);
  } catch {
    return response({ error: "Could not ingest JUnit report" }, 500);
  }
});
