import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_HTML_BYTES = 10 * 1024 * 1024;

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const BLOCKED_HOSTNAMES = new Set([
  "localhost",
  "localhost.localdomain",
  "metadata",
  "metadata.google.internal",
  "instance-data",
  "kubernetes.default",
  "kubernetes.default.svc",
]);

function isPrivateIpv4(host: string): boolean {
  const m = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (!m) return false;
  const [a, b] = [Number(m[1]), Number(m[2])];
  if ([a, b, Number(m[3]), Number(m[4])].some((n) => n > 255)) return true;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 192 && b === 0) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a >= 224) return true;
  return false;
}

function isPrivateIpv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, "").toLowerCase();
  if (!h.includes(":")) return false;
  if (h === "::" || h === "::1") return true;
  if (h.startsWith("fe80") || h.startsWith("fc") || h.startsWith("fd")) return true;
  if (h.startsWith("::ffff:")) return isPrivateIpv4(h.slice(7));
  return false;
}

function isBlockedHostname(rawHost: string): boolean {
  const host = rawHost.toLowerCase().replace(/\.$/, "");
  if (!host) return true;
  if (BLOCKED_HOSTNAMES.has(host)) return true;
  if (host.endsWith(".localhost") || host.endsWith(".local") || host.endsWith(".internal")) return true;
  if (isPrivateIpv4(host) || isPrivateIpv6(rawHost)) return true;
  return false;
}

async function resolvesToPublicAddress(hostname: string): Promise<boolean> {
  const host = hostname.replace(/^\[|\]$/g, "");
  if (isPrivateIpv4(host) || isPrivateIpv6(hostname)) return false;
  if (/^[\d.]+$/.test(host) || host.includes(":")) return true;
  let addresses: string[] = [];
  try {
    const [v4, v6] = await Promise.all([
      Deno.resolveDns(host, "A").catch(() => [] as string[]),
      Deno.resolveDns(host, "AAAA").catch(() => [] as string[]),
    ]);
    addresses = [...v4, ...v6];
  } catch {
    return false;
  }
  if (addresses.length === 0) return false;
  return addresses.every((addr) => !isPrivateIpv4(addr) && !isPrivateIpv6(addr));
}

async function validateUrl(raw: string): Promise<URL | null> {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;
  if (isBlockedHostname(parsed.hostname)) return null;
  if (!(await resolvesToPublicAddress(parsed.hostname))) return null;
  return parsed;
}

const MAX_REDIRECTS = 5;

async function fetchFollowingSafeRedirects(start: URL, signal: AbortSignal): Promise<{ res: Response; finalUrl: string }> {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(current.toString(), {
      headers: {
        "Accept": "text/html,application/xhtml+xml",
        "User-Agent": "Mozilla/5.0 (compatible; KrayoRecorder/1.0)",
      },
      redirect: "manual",
      signal,
    });
    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get("location");
      await res.body?.cancel();
      if (!location) throw new Error("blocked-destination");
      const next = await validateUrl(new URL(location, current).toString());
      if (!next) throw new Error("blocked-destination");
      current = next;
      continue;
    }
    return { res, finalUrl: res.url || current.toString() };
  }
  throw new Error("blocked-destination");
}

const RECORDER_SCRIPT = `<script>
(function() {
  var recording = false;
  function describe(el) {
    var interactive = el.closest('button, a, [role="button"], [role="link"], input, select, textarea');
    var target = interactive || el;
    if (target.getAttribute('aria-label')) return target.getAttribute('aria-label');
    if (target.getAttribute('title')) return target.getAttribute('title');
    var tag = target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea') {
      if (target.placeholder) return target.placeholder;
      if (target.name) return target.name;
      return (target.type || 'text') + ' field';
    }
    if (tag === 'select') {
      if (target.name) return target.name;
      return 'dropdown';
    }
    if (tag === 'button' || tag === 'a') {
      var text = (target.textContent || '').trim();
      if (text) return text.slice(0, 60);
      if (target.getAttribute('value')) return target.getAttribute('value');
    }
    var text = (target.textContent || '').trim();
    if (text) return text.slice(0, 60);
    if (target.id) return target.id;
    return tag;
  }
  function getSelector(el) {
    if (el.id) return '#' + el.id;
    var parts = [];
    var node = el;
    while (node && node !== document.body && node !== document.documentElement) {
      var part = node.tagName.toLowerCase();
      if (node.className && typeof node.className === 'string') {
        var cls = node.className.trim().split(/\\s+/).slice(0, 2).join('.');
        if (cls) part += '.' + cls;
      }
      var parent = node.parentElement;
      if (parent) {
        var siblings = Array.from(parent.children).filter(function(c) { return c.tagName === node.tagName; });
        if (siblings.length > 1) part += ':nth-of-type(' + (siblings.indexOf(node) + 1) + ')';
      }
      parts.unshift(part);
      node = parent;
    }
    return parts.join(' > ');
  }
  function postStep(step) {
    if (!recording) return;
    window.parent.postMessage({ source: 'krayo-recorder', type: 'step', step: step }, '*');
  }
  document.addEventListener('click', function(e) {
    if (!recording) return;
    var el = e.target;
    if (!el || el === document.body || el === document.documentElement) return;
    var link = el.closest('a');
    if (link && link.href && link.href !== '#' && !link.href.startsWith('javascript:')) {
      e.preventDefault();
      postStep({ action: 'navigate', description: 'Click link "' + describe(link) + '"', url: link.href });
      window.parent.postMessage({ source: 'krayo-recorder', type: 'navigate', url: link.href }, '*');
      return;
    }
    postStep({ action: 'click', description: 'Click "' + describe(el) + '"', selector: getSelector(el) });
  }, true);
  document.addEventListener('blur', function(e) {
    if (!recording) return;
    var el = e.target;
    if (!el) return;
    var tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA') {
      if (['button', 'submit', 'reset', 'checkbox', 'radio', 'file', 'hidden', 'image'].indexOf(el.type) !== -1) return;
      var value = el.value;
      if (value) {
        postStep({ action: 'input', description: 'Type "' + value + '" into "' + describe(el) + '"', selector: getSelector(el), value: value });
      }
    }
  }, true);
  document.addEventListener('change', function(e) {
    if (!recording) return;
    var el = e.target;
    if (!el) return;
    if (el.tagName === 'SELECT') {
      var value = el.options[el.selectedIndex] ? el.options[el.selectedIndex].text : el.value;
      postStep({ action: 'select', description: 'Select "' + value + '" from "' + describe(el) + '"', selector: getSelector(el), value: value });
    }
    if (el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio')) {
      var action = el.checked ? 'Check' : 'Uncheck';
      postStep({ action: 'check', description: action + ' "' + describe(el) + '"', selector: getSelector(el) });
    }
  }, true);
  document.addEventListener('submit', function(e) {
    if (!recording) return;
    var form = e.target;
    if (form.tagName === 'FORM') {
      e.preventDefault();
      var desc = form.getAttribute('name') || form.getAttribute('aria-label') || 'form';
      postStep({ action: 'submit', description: 'Submit "' + desc + '"' });
    }
  }, true);
  window.addEventListener('message', function(e) {
    if (e.data && e.data.source === 'krayo-control') {
      if (e.data.type === 'start') recording = true;
      if (e.data.type === 'stop') recording = false;
    }
  });
  window.parent.postMessage({ source: 'krayo-recorder', type: 'loaded' }, '*');
})();
</script>`;

function injectRecorder(html: string, baseUrl: string): string {
  let modified = html.replace(/<meta\s+http-equiv=["']?Content-Security-Policy["']?[^>]*>/gi, "");
  const baseTag = `<base href="${baseUrl}">`;
  if (/<head[^>]*>/i.test(modified) && !/<base\s/i.test(modified)) {
    modified = modified.replace(/<head([^>]*)>/i, `<head$1>${baseTag}`);
  } else if (!/<base\s/i.test(modified)) {
    modified = baseTag + modified;
  }
  if (/<\/body>/i.test(modified)) {
    modified = modified.replace(/<\/body>/i, `${RECORDER_SCRIPT}</body>`);
  } else if (/<\/html>/i.test(modified)) {
    modified = modified.replace(/<\/html>/i, `${RECORDER_SCRIPT}</html>`);
  } else {
    modified = modified + RECORDER_SCRIPT;
  }
  return modified;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed" }, 405);

  try {
    const authorization = req.headers.get("authorization") ?? "";
    if (!authorization.toLowerCase().startsWith("bearer ")) return jsonResponse({ error: "Authentication required" }, 401);
    const token = authorization.slice(7).trim();
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: userData } = await supabase.auth.getUser(token);
    if (!userData.user) return jsonResponse({ error: "Authentication required" }, 401);

    const payload = await req.json() as { url?: string };
    if (!payload.url) return jsonResponse({ error: "URL is required" }, 400);
    const parsed = await validateUrl(payload.url);
    if (!parsed) return jsonResponse({ error: "That address cannot be recorded. Enter a public http or https web page." }, 400);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let res: Response;
    let finalUrl: string;
    try {
      const result = await fetchFollowingSafeRedirects(parsed, controller.signal);
      res = result.res;
      finalUrl = result.finalUrl;
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) return jsonResponse({ error: `Could not load page (HTTP ${res.status})` }, 502);
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml")) {
      return jsonResponse({ error: "URL did not return a web page" }, 400);
    }
    const html = await res.text();
    if (html.length > MAX_HTML_BYTES) return jsonResponse({ error: "Page is too large to record" }, 413);

    const modified = injectRecorder(html, finalUrl);
    return jsonResponse({ html: modified, url: finalUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("record-proxy error:", msg);
    if (msg.includes("blocked-destination")) {
      return jsonResponse({ error: "That address cannot be recorded. Enter a public http or https web page." }, 400);
    }
    return jsonResponse({ error: "Could not reach the requested page from the server. The site may be unreachable or block automated access." }, 502);
  }
});
