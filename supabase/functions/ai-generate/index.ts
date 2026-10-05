import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GenerateRequest {
  module: string;
  description: string;
  context?: {
    projectName?: string;
    existingItems?: string[];
  };
}

const MODULE_PROMPTS: Record<string, { label: string; fields: string[]; instructions: string }> = {
  requirements: {
    label: "requirements",
    fields: ["code", "title", "description", "category", "priority", "status"],
    instructions: "Generate software requirements. Categories: Functional, Non-Functional, Security, Performance, Usability, Business. Priorities: Low, Medium, High, Critical. Status: Draft.",
  },
  testcases: {
    label: "test cases",
    fields: ["code", "title", "cycle", "steps", "expected_result", "status"],
    instructions: "Generate test cases. Cycles: CRP, SIT, UAT. Status: Not Run. Include clear step-by-step instructions and expected results.",
  },
  defects: {
    label: "defects",
    fields: ["code", "title", "severity", "description", "status"],
    instructions: "Generate likely defects/bugs. Severities: Low, Medium, High, Critical. Status: Open. Describe the defect and how to reproduce.",
  },
  actionitems: {
    label: "action items",
    fields: ["code", "title", "owner", "due_date", "status", "notes"],
    instructions: "Generate action items/tasks. Status: Open. Include owner suggestions and reasonable due dates.",
  },
  decisions: {
    label: "decisions",
    fields: ["code", "title", "description", "decided_by", "decision_date"],
    instructions: "Generate architectural/project decisions. Include rationale and decision maker suggestions.",
  },
  raid: {
    label: "RAID entries (Risks, Assumptions, Issues, Dependencies)",
    fields: ["code", "title", "type", "description", "owner", "status"],
    instructions: "Generate RAID log entries. Types: Risk, Assumption, Issue, Dependency. Status: Open. Cover all four types.",
  },
  jobaids: {
    label: "job aids / reference guides",
    fields: ["code", "title", "description", "url"],
    instructions: "Generate job aids and reference documentation. Include descriptions of what each aid covers.",
  },
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { createClient } = await import("npm:@supabase/supabase-js@2");
    const authed = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: { user }, error: userError } = await authed.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { module, description, context }: GenerateRequest = await req.json();

    if (!module || typeof module !== "string" || !description || typeof description !== "string") {
      return new Response(
        JSON.stringify({ error: "Module and description are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const moduleConfig = MODULE_PROMPTS[module];
    if (!moduleConfig) {
      return new Response(
        JSON.stringify({ error: `Unknown module: ${module}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const codePrefix: Record<string, string> = {
      requirements: "REQ",
      testcases: "TC",
      defects: "DEF",
      actionitems: "AI",
      decisions: "DEC",
      raid: "RSK",
      jobaids: "JA",
    };
    const prefix = codePrefix[module] ?? "ITM";

    const items = generateMockItems(module, description.slice(0, 2000), prefix, moduleConfig, context);

    return new Response(
      JSON.stringify({ items }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("ai-generate failed", err);
    return new Response(
      JSON.stringify({ error: "Generation failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function generateMockItems(
  module: string,
  description: string,
  prefix: string,
  config: { label: string; fields: string[]; instructions: string },
  context?: { projectName?: string; existingItems?: string[] }
): Record<string, string>[] {
  const lowerDesc = description.toLowerCase();
  const items: Record<string, string>[] = [];

  const keywords = extractKeywords(description);
  const numItems = Math.min(Math.max(keywords.length + 2, 4), 8);

  for (let i = 0; i < numItems; i++) {
    const keyword = keywords[i] ?? `aspect ${i + 1}`;
    const code = `${prefix}-${String(i + 1).padStart(3, "0")}`;
    const item: Record<string, string> = { code };

    if (module === "requirements") {
      item.title = capitalize(`${keyword} requirement`);
      item.description = `The system shall support ${keyword} functionality as described in the project context. This includes core capabilities, edge case handling, and integration points.`;
      item.category = i % 3 === 0 ? "Functional" : i % 3 === 1 ? "Non-Functional" : "Security";
      item.priority = i === 0 ? "Critical" : i < 3 ? "High" : "Medium";
      item.status = "Draft";
    } else if (module === "testcases") {
      item.title = `Verify ${keyword} functionality`;
      item.cycle = ["CRP", "SIT", "UAT"][i % 3];
      item.steps = `1. Navigate to ${keyword} feature\n2. Perform the primary action\n3. Verify the expected behavior\n4. Test edge cases\n5. Verify error handling`;
      item.expected_result = `The ${keyword} feature should work correctly with proper validation and error messages for invalid inputs.`;
      item.status = "Not Run";
    } else if (module === "defects") {
      item.title = `${capitalize(keyword)} fails under edge conditions`;
      item.severity = ["Medium", "High", "Low", "Critical"][i % 4];
      item.description = `When using ${keyword}, the system may exhibit unexpected behavior under certain conditions. Steps to reproduce: 1. Access ${keyword} 2. Perform edge case action 3. Observe incorrect response.`;
      item.status = "Open";
    } else if (module === "actionitems") {
      item.title = `Review and finalize ${keyword} implementation`;
      item.owner = ["Tech Lead", "QA Lead", "Product Manager", "DevOps"][i % 4];
      item.due_date = futureDate(i * 7 + 3);
      item.status = "Open";
      item.notes = `Coordinate with team on ${keyword} deliverables and timeline.`;
    } else if (module === "decisions") {
      item.title = `Decision on ${keyword} approach`;
      item.description = `After evaluating options for ${keyword}, the team decided to proceed with the recommended approach based on project requirements and constraints.`;
      item.decided_by = ["Architecture Team", "Tech Lead", "Product Owner", "Steering Committee"][i % 4];
      item.decision_date = futureDate(-i * 2);
    } else if (module === "raid") {
      const types = ["Risk", "Assumption", "Issue", "Dependency"];
      const type = types[i % 4];
      item.title = `${type}: ${capitalize(keyword)} ${type === "Risk" ? "may impact timeline" : type === "Assumption" ? "is assumed stable" : type === "Issue" ? "needs resolution" : "required for delivery"}`;
      item.type = type;
      item.description = `${type} related to ${keyword}: ${lowerDesc}. Monitor and address as needed throughout the project lifecycle.`;
      item.owner = ["Project Manager", "Tech Lead", "QA Lead", "Product Owner"][i % 4];
      item.status = "Open";
    } else if (module === "jobaids") {
      item.title = `${capitalize(keyword)} reference guide`;
      item.description = `Step-by-step guide covering ${keyword} workflows, common scenarios, and troubleshooting tips for team members.`;
      item.url = "";
    }

    items.push(item);
  }

  return items;
}

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "is", "are", "was", "were", "be", "been",
    "have", "has", "had", "do", "does", "did", "will", "would", "could", "should",
    "may", "might", "shall", "can", "need", "must", "to", "of", "in", "for", "on",
    "with", "at", "by", "from", "as", "into", "about", "like", "through", "after",
    "over", "between", "out", "against", "during", "without", "before", "under",
    "around", "among", "this", "that", "these", "those", "it", "its", "they", "them",
    "their", "we", "us", "our", "you", "your", "he", "she", "his", "her", "i", "me",
    "my", "project", "system", "feature", "functionality", "platform", "application",
    "build", "create", "generate", "develop", "implement", "include", "covering",
    "user", "users", "should", "would", "also", "each", "all", "both", "more", "most",
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  const freq: Record<string, number> = {};
  for (const word of words) {
    freq[word] = (freq[word] ?? 0) + 1;
  }

  return Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word)
    .slice(0, 8);
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function futureDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().split("T")[0];
}
