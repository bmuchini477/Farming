import { useMemo, useState } from "react";
import { useAuth } from "../features/auth/AuthProvider";
import { askAssistant } from "../features/assistant/assistantApi.service";
import { buildAssistantContext } from "../features/assistant/assistantContext.service";

const starter = [
  {
    role: "bot",
    text: "Hi, I am your AI farming assistant. I can answer using your farm and crop records.",
  },
];

function buildContextLine(context) {
  if (!context || typeof context !== "object") return "";

  const farmCount = Number(context.farmCount || 0);
  const cropCount = Number(context.cropCount || 0);
  const activeCropCount = Number(context.activeCropCount || 0);
  const firstFarm = Array.isArray(context.farms) ? context.farms.find((f) => f?.name) : null;
  const firstActive = Array.isArray(context.crops)
    ? context.crops.find((crop) => (crop?.status || "").toLowerCase() === "active")
    : null;

  const parts = [`Project data: ${farmCount} farms, ${cropCount} crops, ${activeCropCount} active crops`];
  if (firstFarm?.name) parts.push(`sample farm: ${firstFarm.name}`);
  if (firstActive?.name) parts.push(`active crop: ${firstActive.name}`);
  return `${parts.join("; ")}.`;
}

function buildFallbackReply(input, context) {
  const q = input.toLowerCase();
  const contextLine = buildContextLine(context);
  const withContext = (message) => {
    if (!contextLine) return message;
    return `${message} ${contextLine}`;
  };

  if (q.includes("stage") || q.includes("day")) {
    return withContext(
      "Track day progress as day/current cycle (for example Day 32/120). Use the current stage block to decide watering and nutrient timing."
    );
  }

  if (q.includes("irrig") || q.includes("water")) {
    return withContext(
      "Irrigate early morning or late afternoon, then reduce watering at maturity to avoid harvest losses from high moisture."
    );
  }

  if (q.includes("pest") || q.includes("disease")) {
    return withContext(
      "Scout fields twice per week. Record hotspots by farm, isolate infected zones, and apply treatment based on crop stage and label guidance."
    );
  }

  if (q.includes("weather")) {
    return withContext(
      "Use the weather panel plus alerts together. Delay spray before heavy rain and increase mulching during heat stress periods."
    );
  }

  if (q.includes("fertiliz") || q.includes("soil") || q.includes("nutrient")) {
    return withContext(
      "Start with a soil test, then split fertilizer applications by growth stage. Add compost or mulch to improve water retention and microbial health."
    );
  }

  if (q.includes("weed")) {
    return withContext(
      "Control weeds early in the season. Use a mix of mulching, timely hand/mechanical weeding, and selective herbicides only when needed."
    );
  }

  if (q.includes("yield") || q.includes("harvest")) {
    return withContext(
      "Improve yield by maintaining uniform planting density, tracking moisture stress, and harvesting at the correct maturity window to reduce field loss."
    );
  }

  if (q.includes("report") || q.includes("history") || q.includes("analysis")) {
    return withContext(
      "Open Reports to export PDF/CSV and compare cycle duration, farms, and upcoming harvest windows for better planning."
    );
  }

  if (q.includes("farm") || q.includes("add farm")) {
    return withContext(
      "Create farms first, each with a unique farm ID. Then attach each crop to the correct farm so dashboard cards stay accurate."
    );
  }

  return withContext(
    "I can help with any farming question: crop planning, soil fertility, irrigation, weather risk, pest control, weed management, and harvest timing. Ask me a specific farming problem and your crop/location if you want a tailored answer."
  );
}

function buildBackendErrorHint(error) {
  const message = String(error?.message || "").toLowerCase();
  if (message.includes("ollama")) {
    return "Cannot reach local Ollama model. Start Ollama and make sure OLLAMA_BASE_URL is correct.";
  }
  if (message.includes("gpt-4.1-mini") || message.includes("openai")) {
    return "Old backend process is still running. Restart API so Ollama-only server is active.";
  }
  if (message.includes("failed to fetch")) {
    return "Cannot reach assistant API. Start backend with `npm run api` or `npm run dev:all`.";
  }
  if (message.includes("503")) {
    return "Assistant API is unavailable right now.";
  }
  return "Assistant API request failed.";
}

export default function FarmingAssistantFab({ 
  externalOpen, 
  setExternalOpen, 
  initialMessage 
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

  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setIsOpen = setExternalOpen || setInternalOpen;

  const quickPrompts = useMemo(
    () => ["Crop stage tips", "Weather planning", "Pest prevention", "Report insights"],
    []
  );

  useEffect(() => {
    if (isOpen && initialMessage && messages.length === 1) {
      send(initialMessage);
    }
  }, [isOpen, initialMessage]);

  async function send(text) {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    let context = null;

    setMessages((prev) => [...prev, { role: "user", text: trimmed }]);
    setInput("");
    setSending(true);
    setAssistantStatus({ mode: "loading", label: "Thinking.." });

    try {
      // If user is logged in, we try to get their context
      if (user) {
        try {
          context = await buildAssistantContext();
        } catch (ctxError) {
          console.warn("Failed to build context, continuing without it:", ctxError);
        }
      }

      const result = await askAssistant(trimmed, context);
      const reply = result?.reply;
      const hasReply = typeof reply === "string" && reply.trim();

      let finalReply = hasReply ? reply : buildFallbackReply(trimmed, context);
      
      // Guest mode hint
      if (!user && hasReply) {
        finalReply += "\n\n(Note: Sign in to get personalized advice based on your own farm data!)";
      }

      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: finalReply,
        },
      ]);
      setAssistantStatus({
        mode: hasReply ? "live" : "fallback",
        label: hasReply ? "Live" : "Fallback reply",
      });
    } catch (error) {
      console.error("Assistant request failed:", error);
      const hint = buildBackendErrorHint(error);
      setMessages((prev) => [
        ...prev,
        {
          role: "bot",
          text: `${buildFallbackReply(trimmed, context)} (${hint} Using offline fallback.)`,
        },
      ]);
      setAssistantStatus({ mode: "offline", label: "Offline fallback" });
    } finally {
      setSending(false);
    }
  }

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
            <button type="button" className="farm-bot-close" onClick={() => setIsOpen(false)}>
              Close
            </button>
          </div>

          <div className="farm-bot-stream">
            {messages.map((m, idx) => (
              <div key={`${m.role}-${idx}`} className={`farm-bot-msg ${m.role === "user" ? "farm-bot-msg-user" : ""}`}>
                {m.text}
              </div>
            ))}
          </div>

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
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="farm-bot-input"
              disabled={sending}
              placeholder="Ask about crops, weather, stages, or reports"
            />
            <button type="submit" className="farm-bot-send" disabled={sending}>
              {sending ? "Sending..." : "Send"}
            </button>
          </form>
        </div>
      )}

      {!externalOpen && (
        <button type="button" className="farm-bot-fab" onClick={() => setInternalOpen((v) => !v)}>
          AI Chat
        </button>
      )}
    </>
  );
}

