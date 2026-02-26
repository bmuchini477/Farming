# Vercel Deployment (Frontend + AI API)

This project can run both frontend and AI API on Vercel.

## 1) Import repo

- Go to Vercel Dashboard -> Add New -> Project
- Import `bmuchini477/Farming`
- Branch: `main`

`vercel.json` is already configured for Vite build + API functions.

## 2) Build settings

- Build Command: `npm run build`
- Output Directory: `dist`

## 3) Environment variables

In Vercel Project Settings -> Environment Variables, add:

- `GEMINI_API_KEY`
- `GEMINI_MODEL=gemini-2.5-flash`
- `VITE_FIREBASE_API_KEY`
- `VITE_FIREBASE_AUTH_DOMAIN`
- `VITE_FIREBASE_PROJECT_ID`
- `VITE_FIREBASE_STORAGE_BUCKET`
- `VITE_FIREBASE_MESSAGING_SENDER_ID`
- `VITE_FIREBASE_APP_ID`
- `VITE_FIREBASE_MEASUREMENT_ID` (optional)

Notes:

- Vercel serverless functions do not support local Ollama fallback.
- If `GEMINI_API_KEY` is missing, `/api/assistant` will fail.
- If `VITE_FIREBASE_*` keys are missing, frontend auth/database features cannot initialize.

## 4) Deploy

- Click Deploy in Vercel.

## 5) Verify

After deploy, test:

- `https://YOUR_VERCEL_DOMAIN/api/health`
- `https://YOUR_VERCEL_DOMAIN/api/assistant` (POST)
- `https://YOUR_VERCEL_DOMAIN/` (frontend)

