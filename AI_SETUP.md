# AI Farming Assistant Setup (FREE Cloud-Based)

This guide helps you set up a **FREE farming AI assistant** using Google Gemini API - no local installation required!

## 🌟 Recommended: Google Gemini API (100% FREE)

**Why Gemini?**

- ✅ Completely FREE with generous limits (1.5M requests/month)
- ✅ No local installation needed
- ✅ Better quality responses than local models
- ✅ Faster response times
- ✅ Works from anywhere (no need to run Ollama)

### 1️⃣ Get Your FREE Gemini API Key

1. Visit: **https://aistudio.google.com/app/apikey**
2. Sign in with your Google account
3. Click **"Create API Key"**
4. Copy the API key

### 2️⃣ Configure Your Environment

1. Open `.env` file in the project root
2. Replace `your_gemini_api_key_here` with your actual API key:

```env
GEMINI_API_KEY=your_actual_api_key_here
GEMINI_MODEL=gemini-1.5-flash
```

### 3️⃣ Install Dependencies

From project root:

```bash
npm install
```

### 4️⃣ Start the Application

```bash
npm run dev:all
```

This starts both:

- React app: `http://localhost:5173`
- Assistant API: `http://localhost:8793`

### 5️⃣ Verify It's Working

Check the API health:

```bash
curl http://localhost:8793/api/health
```

You should see:

```json
{
  "ok": true,
  "provider": "gemini",
  "model": "gemini-1.5-flash",
  "geminiConfigured": true
}
```

---

## 🔧 Alternative: Local Ollama (If You Have It Running)

If you prefer running AI locally or don't want to use cloud services, you can use Ollama as a fallback.

### Setup Ollama

1. Install Ollama from: https://ollama.ai
2. Pull a model:

```bash
ollama pull llama3.2:3b-instruct-q4_K_M
```

3. **Remove the Gemini API key** from `.env` (or leave it empty):

```env
GEMINI_API_KEY=
```

4. The system will automatically fall back to Ollama

---

## 📊 Firestore Context Used

The assistant analyzes your actual farm data:

- `farms` where `userId == auth.uid`
- `crops` where `userId == auth.uid`
- `users/{uid}/fields/{farmId}/seasons/{seasonId}`
  - `growthRecords`
  - `irrigationLogs`
  - `pestReports`
  - `fumigationSchedules`

---

## 🚀 Production Deployment

For production, you can:

1. **Use Gemini API** (recommended) - just ensure your API key is set in production environment
2. **Deploy the API separately** to free hosting:
   - Render
   - Railway
   - Fly.io
   - Vercel (Node server/API)

Then configure the frontend:

```env
VITE_ASSISTANT_API_URL=https://your-api-domain.com
```

---

## 🎯 What Makes This Farming Assistant Special?

- **Context-Aware**: Uses YOUR specific farm data (farm names, crop types, planting dates)
- **Personalized Advice**: Tailored recommendations based on your actual crops
- **Interactive**: Ask questions about your farms and get actionable answers
- **Focused on Farming**: Specialized prompts for agricultural advice
- **Free**: No cost with Gemini's generous free tier

---

## 🔒 Security Notes

- The Gemini API key is only used server-side (not exposed to frontend)
- All farm data stays in your Firestore database
- API requests only send minimal context needed for responses
