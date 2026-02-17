import dotenv from "dotenv";
import cors from "cors";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import {
  buildHealth,
  generateReply,
  sanitizeContext,
  sanitizePrompt,
} from "./assistantCore.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

const app = express();
const port = Number(process.env.PORT || 8787);

app.use(cors({ origin: true }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => {
  res.json(buildHealth(process.env));
});

app.post("/api/assistant", async (req, res) => {
  try {
    const prompt = sanitizePrompt(req.body?.prompt);
    if (!prompt) {
      return res.status(400).json({ error: "Prompt is required." });
    }

    const context = sanitizeContext(req.body?.context);
    const reply = await generateReply(prompt, context, process.env);

    if (!reply) {
      return res.status(502).json({ error: "Empty response from AI model." });
    }

    return res.json({
      reply,
      contextMeta: {
        farmCount: context.farmCount || context.farms.length,
        cropCount: context.cropCount || context.crops.length,
        activeCropCount: context.activeCropCount || 0,
        ...buildHealth(process.env),
      },
    });
  } catch (error) {
    console.error("Assistant API error:", error);
    if (error?.statusCode) {
      return res.status(error.statusCode).json({ error: error.message });
    }

    const apiMessage = error?.error?.message || error?.message || "";
    if (apiMessage) {
      return res.status(502).json({ error: `AI request failed: ${apiMessage}` });
    }

    return res
      .status(500)
      .json({ error: "Unable to generate assistant response right now." });
  }
});

app.listen(port, () => {
  const health = buildHealth(process.env);
  console.log(`Farming Assistant API running on http://localhost:${port}`);
  console.log(`Provider: ${health.provider}`);
  console.log(`Model: ${health.model}`);
});
