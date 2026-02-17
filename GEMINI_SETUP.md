# 🚀 Quick Start: Get Your FREE Gemini API Key

Follow these simple steps to activate your free farming assistant:

## Step 1: Get Your FREE API Key

1. **Visit**: https://aistudio.google.com/app/apikey
2. **Sign in** with your Google account
3. Click **"Create API Key"** (or "Get API Key")
4. **Copy** the generated API key

> **Note**: This is 100% FREE with very generous limits (1.5 million requests per month)

---

## Step 2: Add Your API Key

1. Open the `.env` file in your project root
2. Find this line:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   ```
3. Replace `your_gemini_api_key_here` with your actual API key

**Example:**

```env
GEMINI_API_KEY=your_real_gemini_api_key_value
```

---

## Step 3: Restart Your Server

Since your server is already running, you need to restart it:

1. **Stop the current API server** (press Ctrl+C in the terminal running `npm run api`)
2. **Start it again**:
   ```bash
   npm run api
   ```

Or restart both services together:

```bash
npm run dev:all
```

---

## Step 4: Verify It's Working

Visit: **http://localhost:8793/api/health**

You should see:

```json
{
  "ok": true,
  "provider": "gemini",
  "geminiConfigured": true
}
```

---

## ✅ That's It!

Your farming assistant is now powered by Google Gemini AI - completely free and much more powerful than local Ollama!

### What You Get:

- ✨ **Better responses** - Gemini is trained on more data
- 🚀 **Faster** - No local processing needed
- 🌍 **Works anywhere** - No need to install Ollama
- 💰 **FREE** - Up to 1.5M requests/month at no cost
- 🧠 **Smarter** - Better understanding of farming contexts

---

## 🆘 Need Help?

**API Key Not Working?**

- Make sure you copied the entire key value from AI Studio
- Check there are no extra spaces before or after the key
- Verify you've restarted the server after adding the key

**Still Using Ollama?**

- Check the health endpoint shows `"provider": "gemini"`
- If it shows `"ollama"`, make sure the `GEMINI_API_KEY` is set correctly in `.env`
