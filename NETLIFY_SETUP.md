# Netlify Deployment (Frontend + AI API)

This project can run both frontend and AI API on Netlify.

## 1) Connect project to Netlify

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`

`netlify.toml` is already configured for this.

## 2) Set environment variables in Netlify

In Netlify Site Settings -> Environment Variables, add:

- `GEMINI_API_KEY` = your real Gemini key
- `GEMINI_MODEL` = `gemini-2.5-flash` (or your preferred Gemini model)

Important:
- On Netlify, local Ollama fallback is not available.
- If `GEMINI_API_KEY` is missing, `/api/assistant` will return a clear error.

## 3) Deploy

- Push your repo to GitHub/GitLab/Bitbucket.
- Trigger deploy in Netlify.

## 4) Verify AI server is working in production

After deploy, test:

- `https://YOUR_SITE.netlify.app/api/health`
- `https://YOUR_SITE.netlify.app/api/assistant` (POST)

Expected health response includes:
- `"ok": true`
- `"provider": "gemini"`
- `"geminiConfigured": true`

## 5) Frontend API URL

No extra frontend env var is required when using this Netlify setup because requests to `/api/*` are redirected to Netlify Functions.

Only set `VITE_ASSISTANT_API_URL` if you move API to another host.
