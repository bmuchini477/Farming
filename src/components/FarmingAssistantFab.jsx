import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../features/auth/AuthProvider";
import { askAssistant } from "../features/assistant/assistantApi.service";
import { buildAssistantContext } from "../features/assistant/assistantContext.service";
import "./FarmingAssistantFab.css";

const starter = [
  {
    role: "bot",
    text: "Hi. I am your farming AI assistant. Ask anything, from quick greetings to deep farm planning.",
  },
];

function toNumberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function mergeAssistantContexts(userContext, guestContext) {
  if (!userContext) return guestContext || null;
  if (!guestContext) return userContext;

  return {
    ...userContext,
    location: userContext.location || guestContext.location || null,
    weather: userContext.weather || guestContext.weather || null,
    profileMode: userContext.profileMode || guestContext.profileMode || "user-data",
  };
}

function buildGuestContext(initialContext, browserLocation) {
  const raw = initialContext && typeof initialContext === "object" ? initialContext : {};
  const rawLocation = raw.location && typeof raw.location === "object" ? raw.location : {};
  const rawWeather = raw.weather && typeof raw.weather === "object" ? raw.weather : {};

  const latitude = toNumberOrNull(rawLocation.latitude ?? browserLocation?.latitude);
  const longitude = toNumberOrNull(rawLocation.longitude ?? browserLocation?.longitude);
  const hasCoords = latitude !== null && longitude !== null;

  const hasWeather =
    toNumberOrNull(rawWeather.temperatureC) !== null ||
    toNumberOrNull(rawWeather.windSpeedKph) !== null ||
    toNumberOrNull(rawWeather.precipitationMm) !== null ||
    Boolean(rawWeather.condition) ||
    Boolean(rawWeather.fieldHealth);

  return {
    farmCount: Number(raw.farmCount || 0),
    cropCount: Number(raw.cropCount || 0),
    activeCropCount: Number(raw.activeCropCount || 0),
    farms: Array.isArray(raw.farms) ? raw.farms.slice(0, 6) : [],
    crops: Array.isArray(raw.crops) ? raw.crops.slice(0, 10) : [],
    cropPatterns: Array.isArray(raw.cropPatterns) ? raw.cropPatterns.slice(0, 6) : [],
    monitoring: Array.isArray(raw.monitoring) ? raw.monitoring.slice(0, 2) : [],
    profileMode: String(raw.profileMode || "guest-demo"),
    location: hasCoords
      ? {
          name: String(rawLocation.name || browserLocation?.name || "Current location"),
          latitude,
          longitude,
          source: String(rawLocation.source || browserLocation?.source || "browser"),
        }
      : null,
    weather: hasWeather
      ? {
          temperatureC: toNumberOrNull(rawWeather.temperatureC),
          condition: rawWeather.condition || "",
          fieldHealth: rawWeather.fieldHealth || "",
          windSpeedKph: toNumberOrNull(rawWeather.windSpeedKph),
          precipitationMm: toNumberOrNull(rawWeather.precipitationMm),
          source: rawWeather.source || "client",
          fetchedAt: rawWeather.fetchedAt || new Date().toISOString(),
        }
      : null,
    generatedAt: new Date().toISOString(),
  };
}

function buildContextLine(context) {
  if (!context || typeof context !== "object") return "";

  const parts = [];
  const farmCount = Number(context.farmCount || 0);
  const cropCount = Number(context.cropCount || 0);
  const activeCropCount = Number(context.activeCropCount || 0);

  if (farmCount || cropCount || activeCropCount) {
    parts.push(`data: ${farmCount} farms, ${cropCount} crops, ${activeCropCount} active`);
  }

  const location = context.location && typeof context.location === "object" ? context.location : null;
  if (location?.name) {
    parts.push(`location: ${location.name}`);
  } else if (location?.latitude != null && location?.longitude != null) {
    parts.push(`location coordinates: ${location.latitude}, ${location.longitude}`);
  }

  const weather = context.weather && typeof context.weather === "object" ? context.weather : null;
  if (weather?.temperatureC != null || weather?.condition) {
    const weatherBits = [];
    if (weather.temperatureC != null) weatherBits.push(`${weather.temperatureC}C`);
    if (weather.condition) weatherBits.push(String(weather.condition).toLowerCase());
    if (weather.fieldHealth) weatherBits.push(`field health ${String(weather.fieldHealth).toLowerCase()}`);
    parts.push(`weather: ${weatherBits.join(", ")}`);
  }

  return parts.length ? `${parts.join("; ")}.` : "";
}

function buildFallbackReply(input, context) {
  const q = input.toLowerCase();
  const contextLine = buildContextLine(context);
  const withContext = (message) => (contextLine ? `${message} ${contextLine}` : message);

  if (/\b(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(q)) {
    return withContext(
      "Hi. I am here and ready. You can ask about crop planning, irrigation schedules, pest control, weather risk, profit planning, or any farm decision."
    );
  }

  if (q.includes("how are you")) {
    return "I am ready to help. Tell me your crop, location, and current issue, and I will break it into actionable steps.";
  }

  if (q.includes("thank")) {
    return "You are welcome. If you want, I can also give a practical 7-day action plan for your farm.";
  }

  if (q.includes("stage") || q.includes("day")) {
    return withContext(
      "Track progress as day/current cycle, then align watering, fertilization, and scouting to each growth stage. The biggest gains come from stage-specific timing."
    );
  }

  if (q.includes("irrig") || q.includes("water")) {
    return withContext(
      "Irrigate early morning to reduce evaporation, prioritize uniform soil moisture at root depth, and reduce watering near maturity to limit disease and grain quality loss."
    );
  }

  if (q.includes("pest") || q.includes("disease")) {
    return withContext(
      "Use integrated pest management: scouting twice weekly, threshold-based spraying, resistant varieties, and field sanitation. Treat hotspots fast and rotate active ingredients."
    );
  }

  if (q.includes("weather")) {
    return withContext(
      "Use forecast windows for decisions: spray when rain risk is low, irrigate before heat spikes, and protect fields before storms with drainage checks and staking where needed."
    );
  }

  if (q.includes("fertiliz") || q.includes("soil") || q.includes("nutrient")) {
    return withContext(
      "Base nutrition on soil test targets, split nitrogen into key stages, and combine mineral fertilizer with organic matter to improve retention and root-zone biology."
    );
  }

  if (q.includes("yield") || q.includes("harvest")) {
    return withContext(
      "For better yield: consistent stand establishment, moisture stress control during critical stages, and harvest at the right maturity window to reduce field and storage losses."
    );
  }

  return withContext(
    "I can answer broadly, not only from database records. Ask me any farming or agribusiness question, and include location, crop, and growth stage for a precise recommendation."
  );
}

function buildBackendErrorHint(error) {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("ollama")) {
    return "Cannot reach local Ollama model. Start Ollama and check OLLAMA_BASE_URL.";
  }
  if (message.includes("quota") || message.includes("429")) {
    return "AI quota limit reached. Check Gemini quota/billing or switch to another supported model.";
  }
  if (message.includes("failed to fetch")) {
    return "Cannot reach assistant API. Verify deployment and API route availability.";
  }
  if (message.includes("timed out") || message.includes("timeout")) {
    return "Assistant API timed out. Retry and check network/model service health.";
  }
  if (message.includes("503") || message.includes("unavailable")) {
    return "Assistant API is temporarily unavailable.";
  }
  return "Assistant API request failed.";
}

export default function FarmingAssistantFab({
  externalOpen,
  setExternalOpen,
  initialMessage,
  initialContext,
  resetOnOpen = false,
}) {
  const { user } = useAuth();
  const [internalOpen, setInternalOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState(starter);
  const [sending, setSending] = useState(false);
  const [assistantStatus, setAssistantStatus] = useState({
    mode: "idle",
    label: "Ready",
  });
  const [browserLocation, setBrowserLocation] = useState(null);
  const streamRef = useRef(null);
  const inputRef = useRef(null);
  const initialMessageSentRef = useRef("");
  const wasOpenRef = useRef(false);

  const isControlled = externalOpen !== undefined;
  const canSetExternal = typeof setExternalOpen === "function";
  const isOpen = isControlled ? Boolean(externalOpen) : internalOpen;

  const guestContext = useMemo(
    () => buildGuestContext(initialContext, browserLocation),
    [initialContext, browserLocation]
  );

  const quickPrompts = useMemo(
    () => [
      "Hi, what can you help with?",
      "Suggest crops for my location",
      "Give realistic irrigation plan",
      "How do I prevent pest losses?",
    ],
    []
  );

  function openChat() {
    if (isControlled) {
      if (canSetExternal) setExternalOpen(true);
      return;
    }
    setInternalOpen(true);
  }

  function closeChat() {
    if (isControlled) {
      if (canSetExternal) setExternalOpen(false);
      return;
    }
    setInternalOpen(false);
  }

  function resetChat() {
    if (sending) return;
    setMessages(starter);
    setInput("");
    setAssistantStatus({ mode: "idle", label: "Ready" });
    initialMessageSentRef.current = "";
    inputRef.current?.focus();
  }

  const appendMessage = useCallback((nextMessage) => {
    setMessages((prev) => {
      const combined = [...prev, nextMessage];
      if (combined.length <= 80) return combined;
      return [combined[0], ...combined.slice(-79)];
    });
  }, []);

  const send = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed || sending) return;
      let context = guestContext;

      appendMessage({ role: "user", text: trimmed });
      setInput("");
      setSending(true);
      setAssistantStatus({ mode: "loading", label: "Thinking..." });

      try {
        if (user?.uid) {
          try {
            const userContext = await buildAssistantContext(user.uid);
            context = mergeAssistantContexts(userContext, guestContext);
          } catch (ctxError) {
            console.warn("Failed to build user context, continuing with guest context:", ctxError);
          }
        }

        const result = await askAssistant(trimmed, context);
        const reply = result?.reply;
        const hasReply = typeof reply === "string" && reply.trim();

        appendMessage({
          role: "bot",
          text: hasReply ? reply : buildFallbackReply(trimmed, context),
        });

        setAssistantStatus({
          mode: hasReply ? "live" : "fallback",
          label: hasReply ? "Live AI" : "Smart fallback",
        });
      } catch (error) {
        console.error("Assistant request failed:", error);
        const hint = buildBackendErrorHint(error);
        appendMessage({
          role: "bot",
          text: `${buildFallbackReply(trimmed, context)} (${hint} Using offline fallback.)`,
        });
        setAssistantStatus({ mode: "offline", label: "Offline fallback" });
      } finally {
        setSending(false);
      }
    },
    [appendMessage, guestContext, sending, user]
  );

  useEffect(() => {
    const wasOpen = wasOpenRef.current;
    if (!wasOpen && isOpen) {
      if (resetOnOpen) {
        setMessages(starter);
        setInput("");
        setAssistantStatus({ mode: "idle", label: "Ready" });
      }
      initialMessageSentRef.current = "";
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, resetOnOpen]);

  useEffect(() => {
    if (!isOpen || user?.uid || browserLocation) return;
    if (!navigator.geolocation) return;

    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setBrowserLocation({
          name: "Current location",
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          source: "browser-geolocation",
        });
      },
      () => {
        if (cancelled) return;
        setBrowserLocation((prev) => prev || null);
      },
      {
        enableHighAccuracy: false,
        timeout: 9000,
        maximumAge: 300000,
      }
    );

    return () => {
      cancelled = true;
    };
  }, [browserLocation, isOpen, user]);

  useEffect(() => {
    const prompt = String(initialMessage || "").trim();
    if (!isOpen || !prompt || messages.length !== 1 || sending) return;
    if (initialMessageSentRef.current === prompt) return;
    initialMessageSentRef.current = prompt;
    send(prompt);
  }, [initialMessage, isOpen, messages.length, send, sending]);

  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      inputRef.current?.focus();
    }, 120);
    return () => clearTimeout(timer);
  }, [isOpen]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = "0px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 126)}px`;
  }, [input, isOpen]);

  useEffect(() => {
    const stream = streamRef.current;
    if (!stream || !isOpen) return;
    stream.scrollTop = stream.scrollHeight;
  }, [isOpen, messages, sending]);

  return (
    <>
      {isOpen && (
        <div className="farm-bot-panel" role="dialog" aria-label="Farming assistant">
          <div className="farm-bot-head">
            <div className="farm-bot-head-left">
              <h3>AI Farming Assistant</h3>
              <span className={`farm-bot-status farm-bot-status-${assistantStatus.mode}`}>
                {assistantStatus.label}
              </span>
            </div>
            <div className="farm-bot-head-actions">
              <button
                type="button"
                className="farm-bot-head-btn"
                onClick={resetChat}
                disabled={sending || messages.length <= 1}
              >
                New chat
              </button>
              <button type="button" className="farm-bot-close" onClick={closeChat}>
                Close
              </button>
            </div>
          </div>

          <div className="farm-bot-stream" ref={streamRef} aria-live="polite">
            {messages.map((m, idx) => (
              <div
                key={`${m.role}-${idx}`}
                className={`farm-bot-msg ${m.role === "user" ? "farm-bot-msg-user" : ""}`}
              >
                {m.text}
              </div>
            ))}
            {sending && <div className="farm-bot-msg farm-bot-msg-typing">Thinking...</div>}
          </div>

          <div className="farm-bot-footer">
            <div className="farm-bot-prompts">
              {quickPrompts.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  className="farm-bot-chip"
                  onClick={() => send(prompt)}
                  disabled={sending}
                >
                  {prompt}
                </button>
              ))}
            </div>

            <form
              className="farm-bot-input-row"
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
            >
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                className="farm-bot-input"
                disabled={sending}
                rows={1}
                placeholder="Ask anything: hi, weather plan, soil, pests, yield, or farm strategy"
              />
              <button type="submit" className="farm-bot-send" disabled={sending || !input.trim()}>
                {sending ? "Sending..." : "Send"}
              </button>
            </form>
            <p className="farm-bot-hint">Press Enter to send. Use Shift+Enter for a new line.</p>
          </div>
        </div>
      )}

      {!isOpen && (
        <button type="button" className="farm-bot-fab" onClick={openChat}>
          AI Chat
        </button>
      )}
    </>
  );
}

