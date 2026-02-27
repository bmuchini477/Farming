export function sanitizePrompt(input) {
  if (typeof input !== "string") return "";
  return input.trim().slice(0, 1500);
}

export function sanitizeContext(context) {
  if (!context || typeof context !== "object") {
    return {
      farmCount: 0,
      cropCount: 0,
      activeCropCount: 0,
      farms: [],
      crops: [],
      cropPatterns: [],
      monitoring: [],
      profileMode: "general",
      location: null,
      weather: null,
      generatedAt: new Date().toISOString(),
    };
  }

  const locationRaw =
    context.location && typeof context.location === "object"
      ? context.location
      : null;
  const weatherRaw =
    context.weather && typeof context.weather === "object"
      ? context.weather
      : null;

  const latitude = Number(locationRaw?.latitude);
  const longitude = Number(locationRaw?.longitude);

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
    profileMode: String(context.profileMode || "general"),
    location:
      Number.isFinite(latitude) && Number.isFinite(longitude)
        ? {
            name: String(locationRaw?.name || "Current area").slice(0, 80),
            latitude,
            longitude,
            source: String(locationRaw?.source || "client").slice(0, 48),
          }
        : null,
    weather: weatherRaw
      ? {
          temperatureC: Number.isFinite(Number(weatherRaw.temperatureC))
            ? Number(weatherRaw.temperatureC)
            : null,
          condition: String(weatherRaw.condition || "").slice(0, 80),
          fieldHealth: String(weatherRaw.fieldHealth || "").slice(0, 40),
          windSpeedKph: Number.isFinite(Number(weatherRaw.windSpeedKph))
            ? Number(weatherRaw.windSpeedKph)
            : null,
          precipitationMm: Number.isFinite(Number(weatherRaw.precipitationMm))
            ? Number(weatherRaw.precipitationMm)
            : null,
          source: String(weatherRaw.source || "client").slice(0, 48),
          fetchedAt: weatherRaw.fetchedAt || null,
        }
      : null,
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
  const location =
    context.location && typeof context.location === "object"
      ? context.location
      : null;
  const weather =
    context.weather && typeof context.weather === "object"
      ? context.weather
      : null;

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
    `Profile mode: ${context.profileMode || "general"}`,
    `Context generated at: ${context.generatedAt || "unknown"}`,
    `Farm count: ${context.farmCount || farms.length || 0}`,
    `Crop count: ${context.cropCount || crops.length || 0}`,
    `Active crop count: ${context.activeCropCount || active.length || 0}`,
    `Location: ${
      location
        ? `${location.name || "Current area"} (${location.latitude}, ${location.longitude})`
        : "unknown"
    }`,
    `Weather: ${
      weather
        ? [
            weather.temperatureC != null ? `${weather.temperatureC}C` : null,
            weather.condition || null,
            weather.fieldHealth ? `field health ${weather.fieldHealth}` : null,
            weather.windSpeedKph != null
              ? `wind ${weather.windSpeedKph} kph`
              : null,
            weather.precipitationMm != null
              ? `rain ${weather.precipitationMm} mm`
              : null,
          ]
            .filter(Boolean)
            .join(", ") || "unknown"
        : "unknown"
    }`,
    `Farms: ${topFarms.length ? topFarms.join("; ") : "none"}`,
    `Active crops: ${topActiveCrops.length ? topActiveCrops.join("; ") : "none"}`,
    `Monitoring bundles: ${monitoring.length}`,
  ].join("\n");
}

function systemPrompt() {
  return [
    "You are FarmTrack AI, an expert agronomy and farm-operations assistant.",
    "You must handle both interactive conversation and deep technical farming analysis.",
    "If the user greets you or asks casual questions, respond naturally and continue the conversation.",
    "Do not restrict answers to database records only. Use broad agricultural knowledge when records are missing.",
    "When farm/location/weather context exists, deeply personalize advice and explain why each recommendation is realistic.",
    "Prioritize actionable guidance: immediate actions (24-48h), short-term actions (7-14 days), and strategic actions.",
    "Provide feasible options for low-budget and advanced setups when relevant.",
    "Call out assumptions and uncertainties clearly, and ask 1-2 clarifying questions when needed.",
    "Use concise headings or bullet points for readability.",
    "Always complete your final sentence. Do not end with unfinished bullets or half-sentences.",
  ].join(" ");
}

function weatherLabelFromCode(code) {
  if (code === 0) return "Clear";
  if ([1, 2, 3].includes(code)) return "Cloudy";
  if ([45, 48].includes(code)) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Mixed";
}

async function fetchCurrentWeatherForLocation(location) {
  if (!location) return null;

  const latitude = Number(location.latitude);
  const longitude = Number(location.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 7000);
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    current: "temperature_2m,weather_code,wind_speed_10m,precipitation",
    timezone: "auto",
  });

  try {
    const response = await fetch(
      `https://api.open-meteo.com/v1/forecast?${params}`,
      {
        signal: controller.signal,
      },
    );
    if (!response.ok) return null;

    const data = await response.json();
    const current = data?.current;
    if (!current) return null;

    return {
      temperatureC: Number.isFinite(Number(current.temperature_2m))
        ? Number(current.temperature_2m)
        : null,
      condition: weatherLabelFromCode(Number(current.weather_code)),
      fieldHealth: "",
      windSpeedKph: Number.isFinite(Number(current.wind_speed_10m))
        ? Number(current.wind_speed_10m)
        : null,
      precipitationMm: Number.isFinite(Number(current.precipitation))
        ? Number(current.precipitation)
        : null,
      source: "open-meteo",
      fetchedAt: new Date().toISOString(),
    };
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

async function enrichContextWithWeather(context) {
  if (!context || typeof context !== "object") return context;
  const hasWeather =
    context.weather &&
    typeof context.weather === "object" &&
    (context.weather.temperatureC != null ||
      context.weather.condition ||
      context.weather.windSpeedKph != null ||
      context.weather.precipitationMm != null);

  if (hasWeather) return context;
  if (!context.location) return context;

  const liveWeather = await fetchCurrentWeatherForLocation(context.location);
  if (!liveWeather) return context;

  return {
    ...context,
    weather: liveWeather,
    generatedAt: new Date().toISOString(),
  };
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
  const ollamaBaseUrl = (
    env.OLLAMA_BASE_URL || "http://127.0.0.1:11434"
  ).replace(/\/$/, "");
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
  const basePrompt = buildUserPrompt(prompt, context);

  async function requestGemini(promptText) {
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
              parts: [{ text: `${systemPrompt()}\n\n${promptText}` }],
            },
          ],
          generationConfig: {
            temperature: 0.65,
            maxOutputTokens: 1800,
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
      const reason =
        error?.name === "AbortError" ? "Request timed out." : error.message;
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

    return data;
  }

  function readCandidateText(data) {
    const parts = data?.candidates?.[0]?.content?.parts;
    if (!Array.isArray(parts)) return "";
    return parts
      .map((part) => String(part?.text || ""))
      .join("")
      .trim();
  }

  function needsContinuation(data, segment) {
    const finishReason = String(data?.candidates?.[0]?.finishReason || "");
    if (finishReason === "MAX_TOKENS") return true;
    if (!segment) return false;

    // If it ends with trailing punctuation that suggests more is coming
    if (/[:;,-]\s*$/.test(segment)) return true;

    // If it ends with sentence-terminating punctuation, it's probably done
    if (/[.!?)]\s*$/.test(segment)) return false;

    // If it doesn't end with punctuation and is long, it's likely truncated
    return segment.trim().length > 20;
  }

  let collected = "";
  let currentPrompt = basePrompt;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const data = await requestGemini(currentPrompt);
    const segment = readCandidateText(data);
    if (!segment) {
      if (!collected) throw new Error("Empty response from Gemini API");
      break;
    }

    collected = collected
      ? `${collected}${collected.endsWith("\n") ? "" : "\n"}${segment}`
      : segment;

    if (!needsContinuation(data, segment)) break;

    const tail = collected.slice(-1400);
    currentPrompt = [
      `Original user question: ${prompt}`,
      "",
      "Tail of previous partial answer:",
      tail,
      "",
      "Continue exactly where this stopped. Do not repeat prior text. Finish any incomplete sentence or bullet.",
    ].join("\n");
  }

  const finalReply = collected.trim();
  if (!finalReply) {
    throw new Error("Empty response from Gemini API");
  }
  if (/[.!?)]\s*$/.test(finalReply)) return finalReply;
  if (/[:;,-]\s*$/.test(finalReply)) {
    return `${finalReply}\n- Continue if you want the next detailed step-by-step section.`;
  }
  return `${finalReply}.`;
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
          num_predict: 1100,
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
  const enrichedContext = await enrichContextWithWeather(context);

  if (config.useGemini) {
    const candidateModels = Array.from(
      new Set([config.geminiModel, "gemini-2.5-flash", "gemini-flash-latest"]),
    );

    let lastError = null;
    for (const model of candidateModels) {
      try {
        return await askGemini(prompt, enrichedContext, {
          ...config,
          geminiModel: model,
        });
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

  return askOllama(prompt, enrichedContext, config);
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
