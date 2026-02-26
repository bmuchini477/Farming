import {
  buildHealth,
  generateReply,
  sanitizeContext,
  sanitizePrompt,
} from "../server/assistantCore.js";

function setCommonHeaders(res) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
}

async function readJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;

  if (typeof req.body === "string" && req.body.trim()) {
    return JSON.parse(req.body);
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  if (!raw) return {};
  return JSON.parse(raw);
}

export default async function handler(req, res) {
  setCommonHeaders(res);

  if (req.method === "OPTIONS") {
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  try {
    const body = await readJsonBody(req);
    const prompt = sanitizePrompt(body?.prompt);
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    const context = sanitizeContext(body?.context);
    const reply = await generateReply(prompt, context, process.env);

    if (!reply) {
      return res.status(502).json({ error: "Empty response from AI model." });
    }

    return res.status(200).json({
      reply,
      contextMeta: {
        farmCount: context.farmCount || context.farms.length,
        cropCount: context.cropCount || context.crops.length,
        activeCropCount: context.activeCropCount || 0,
        ...buildHealth(process.env),
      },
    });
  } catch (error) {
    console.error("Vercel assistant API error:", error);
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }
    return res.status(500).json({
      error: error?.message || "Unable to generate assistant response.",
    });
  }
}

