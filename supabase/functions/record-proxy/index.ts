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

function validateUrl(raw: string): URL | null {
  try {
    const parsed = new URL(raw);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") return parsed;
    return null;
  } catch {
    return null;
  }
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
    const parsed = validateUrl(payload.url);
    if (!parsed) return jsonResponse({ error: "Invalid URL" }, 400);

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    let res: Response;
    try {
      res = await fetch(parsed.toString(), {
        headers: {
          "Accept": "text/html,application/xhtml+xml",
          "User-Agent": "Mozilla/5.0 (compatible; KrayoRecorder/1.0)",
        },
        redirect: "follow",
        signal: controller.signal,
      });
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

    const finalUrl = res.url || parsed.toString();
    const modified = injectRecorder(html, finalUrl);
    return jsonResponse({ html: modified, url: finalUrl });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("fetch") || msg.includes("abort") || msg.includes("connect") || msg.includes("dns") || msg.includes("resolution")) {
      return jsonResponse({ error: "Could not reach the requested page from the server. The site may be unreachable or block automated access." }, 502);
    }
    return jsonResponse({ error: msg || "Could not load the requested page" }, 500);
  }
});
