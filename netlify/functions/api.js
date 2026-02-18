import {
  buildHealth,
  generateReply,
  sanitizeContext,
  sanitizePrompt,
} from "../../server/assistantCore.js";

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    },
    body: JSON.stringify(payload),
  };
}

function getPath(event) {
  const pathValue = event.rawPath || event.path || "";
  // Strip both the direct function path and the /api prefix used in redirects
  return pathValue
    .replace(/^\/\.netlify\/functions\/api/, "")
    .replace(/^\/api/, "") || "/";
}

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return json(200, { ok: true });
  }

  const route = getPath(event);

  if (event.httpMethod === "GET" && route === "/health") {
    return json(200, buildHealth(process.env));
  }

  if (event.httpMethod === "POST" && route === "/assistant") {
    try {
      const body = event.body ? JSON.parse(event.body) : {};
      const prompt = sanitizePrompt(body?.prompt);
      if (!prompt) {
        return json(400, { error: "Prompt is required." });
      }

      const context = sanitizeContext(body?.context);
      const reply = await generateReply(prompt, context, process.env);

      if (!reply) {
        return json(502, { error: "Empty response from AI model." });
      }

      return json(200, {
        reply,
        contextMeta: {
          farmCount: context.farmCount || context.farms.length,
          cropCount: context.cropCount || context.crops.length,
          activeCropCount: context.activeCropCount || 0,
          ...buildHealth(process.env),
        },
      });
    } catch (error) {
      console.error("Netlify assistant API error:", error);
      if (error?.statusCode) {
        return json(error.statusCode, { error: error.message });
      }
      return json(500, {
        error: error?.message || "Unable to generate assistant response.",
      });
    }
  }

  return json(404, { error: "Not found." });
}
