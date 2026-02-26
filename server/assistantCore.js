const NETLIFY_FLAG = "true";

export function sanitizePrompt(input) {
  if (typeof input !== "string") return "";
  return input.trim().slice(0, 1500);
}

export function sanitizeContext(context) {
  if (!context || typeof context !== "object") return {};
  return {
    farmCount: Number(context.farmCount || 0),
    cropCount: Number(context.cropCount || 0),
    activeCropCount: Number(context.activeCropCount || 0),
    farms: Array.isArray(context.farms) ? context.farms.slice(0, 30) : [],
    crops: Array.isArray(context.crops) ? context.crops.slice(0, 80) : [],
    cropPatterns: Array.isArray(context.cropPatterns)
      ? context.cropPatterns.slice(0, 12)
      : [],
    monitoring: Array.isArray(context.monitoring)
      ? context.monitoring.slice(0, 6)
      : [],
    generatedAt: context.generatedAt || new Date().toISOString(),
  };
}

function summarizeContext(context) {
  const farms = Array.isArray(context.farms) ? context.farms : [];
  const crops = Array.isArray(context.crops) ? context.crops : [];
  const monitoring = Array.isArray(context.monitoring)
    ? context.monitoring
    : [];
  const active = crops.filter(
    (crop) => (crop.status || "").toLowerCase() === "active",
  );

  const topFarms = farms
    .slice(0, 5)
    .map(
      (farm) =>
        `${farm.name || "Unnamed farm"} (${farm.location || "no location"})`,
    );

  const topActiveCrops = active.slice(0, 8).map((crop) => {
    const farm = crop.farmName || crop.farmId || "unknown farm";
    const plant = crop.plantingDate || "no planting date";
    const harvest = crop.expectedHarvestDate || "no harvest date";
    return `${crop.name || "Unknown crop"} on ${farm} (planting: ${plant}, harvest: ${harvest})`;
  });

  return [
    `Context generated at: ${context.generatedAt || "unknown"}`,
    `Farm count: ${context.farmCount || farms.length || 0}`,
    `Crop count: ${context.cropCount || crops.length || 0}`,
    `Active crop count: ${context.activeCropCount || active.length || 0}`,
    `Farms: ${topFarms.length ? topFarms.join("; ") : "none"}`,
    `Active crops: ${topActiveCrops.length ? topActiveCrops.join("; ") : "none"}`,
    `Monitoring bundles: ${monitoring.length}`,
  ].join("\n");
}

function systemPrompt() {
  return [
    "You are an expert farming assistant. Analyze the provided farm data and provide specific, high-level recommendations.",
    "Do not use conversational fillers like 'Hello' or 'It's great to connect'. Start directly with the analysis.",
    "Focus on critical insights regarding growth, irrigation, and pest control.",
    "Structure your response with clear headings or bullet points.",
    "Keep the total response under 400 words but ensure it is complete and actionable.",
  ].join(" ");
}

function buildUserPrompt(prompt, context) {
  const contextSummary = summarizeContext(context);
  return [
    `Farmer's Question: ${prompt}`,
    "",
    "Current Farm Context:",
    contextSummary,
    "",
    "Detailed Farm Data:",
    JSON.stringify(context, null, 2),
  ].join("\n");
}

export function getRuntimeConfig(env = process.env) {
  const geminiApiKey = env.GEMINI_API_KEY || "";
  const geminiModel = env.GEMINI_MODEL || "gemini-2.5-flash";
  const ollamaModel = env.OLLAMA_MODEL || "llama3.2:3b-instruct-q4_K_M";
  const ollamaBaseUrl = (env.OLLAMA_BASE_URL || "http://127.0.0.1:11434")
    .replace(/\/$/, "");
  const useGemini = geminiApiKey.length > 0;
  
  // NETLIFY env var is set to "true" by Netlify automatically
  const isNetlify =
    String(env.NETLIFY || "").toLowerCase() === "true" ||
    Boolean(env.AWS_LAMBDA_FUNCTION_NAME) ||
    Boolean(env.NETLIFY_DEV);

  return {
    geminiApiKey,
    geminiModel,
    ollamaModel,
    ollamaBaseUrl,
    useGemini,
    isNetlify,
  };
}

function isGeminiRetryableError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("not found") ||
    message.includes("not supported") ||
    message.includes("quota") ||
    message.includes("429") ||
    message.includes("unavailable") ||
    message.includes("503") ||
    message.includes("timed out")
  );
}

async function askGemini(prompt, context, config) {
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${config.geminiModel}:generateContent?key=${config.geminiApiKey}`;
  const userPrompt = buildUserPrompt(prompt, context);
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45000);

  let response;
  try {
    response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            role: "user",
            parts: [{ text: `${systemPrompt()}\n\n${userPrompt}` }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 900,
          topP: 0.95,
          topK: 40,
        },
        safetySettings: [
          { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
          { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_NONE",
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_NONE",
          },
        ],
      }),
      signal: controller.signal,
    });
  } catch (error) {
    const reason = error?.name === "AbortError" ? "Request timed out." : error.message;
    const err = new Error(`Failed to connect to Gemini API: ${reason}`);
    err.statusCode = 503;
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorMsg = data?.error?.message || "Gemini API request failed";
    const error = new Error(errorMsg);
    error.statusCode = response.status;
    throw error;
  }

  const content = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!content) {
    throw new Error("Empty response from Gemini API");
  }
  return content.trim();
}

async function askOllama(prompt, context, config) {
  let response;
  try {
    response = await fetch(`${config.ollamaBaseUrl}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: config.ollamaModel,
        prompt: `${systemPrompt()}\n\n${buildUserPrompt(prompt, context)}`,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 600,
        },
      }),
    });
  } catch (_error) {
    const error = new Error(
      `Ollama is not reachable at ${config.ollamaBaseUrl}. Make sure Ollama is running or configure Gemini API instead.`,
    );
    error.statusCode = 503;
    throw error;
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error || "Ollama request failed.");
    error.statusCode = response.status;
    throw error;
  }

  return String(data?.response || "").trim();
}

export async function generateReply(prompt, context, env = process.env) {
  const config = getRuntimeConfig(env);

  if (config.useGemini) {
    const candidateModels = Array.from(
      new Set([config.geminiModel, "gemini-2.5-flash", "gemini-flash-latest"])
    );

    let lastError = null;
    for (const model of candidateModels) {
      try {
        return await askGemini(prompt, context, { ...config, geminiModel: model });
      } catch (error) {
        lastError = error;
        if (!isGeminiRetryableError(error)) {
          throw error;
        }
      }
    }

    if (lastError) {
      throw lastError;
    }
  }

  if (config.isNetlify) {
    const error = new Error(
      "GEMINI_API_KEY is not configured in Netlify environment variables. Local Ollama fallback is not available on Netlify.",
    );
    error.statusCode = 500;
    throw error;
  }

  return askOllama(prompt, context, config);
}

export function buildHealth(env = process.env) {
  const config = getRuntimeConfig(env);
  return {
    ok: true,
    provider: config.useGemini ? "gemini" : "ollama",
    model: config.useGemini ? config.geminiModel : config.ollamaModel,
    geminiConfigured: !!config.geminiApiKey,
    netlify: config.isNetlify,
    time: new Date().toISOString(),
  };
}
