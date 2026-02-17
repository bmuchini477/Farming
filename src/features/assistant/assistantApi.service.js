const baseUrl = (import.meta.env.VITE_ASSISTANT_API_URL || "").trim();

function resolveEndpoint() {
  if (baseUrl) return `${baseUrl.replace(/\/$/, "")}/api/assistant`;
  return "/api/assistant";
}

export async function askAssistant(prompt, context) {
  const response = await fetch(resolveEndpoint(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt, context }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error || "Assistant request failed.");
  }

  return data;
}
