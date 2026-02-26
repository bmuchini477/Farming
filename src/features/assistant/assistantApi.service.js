const baseUrl = (import.meta.env.VITE_ASSISTANT_API_URL || "").trim();
const REQUEST_TIMEOUT_MS = 30000;

function resolveEndpoint() {
  if (baseUrl) return `${baseUrl.replace(/\/$/, "")}/api/assistant`;
  return "/api/assistant";
}

export async function askAssistant(prompt, context) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  let response;

  try {
    response = await fetch(resolveEndpoint(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ prompt, context }),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Assistant request timed out.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "Assistant request failed.");
  }

  return data;
}
