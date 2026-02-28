# 🚀 Pump Alert Bot

A Telegram bot that monitors pump.fun token market caps and alerts you when they hit your target multiplier.

---

## Features
- Track any pump.fun or Raydium token by contract address
- Set custom multiplier alerts (1.5x, 2x, 5x, etc.)
- Auto-detects pre and post graduation tokens
- Works 24/7 on Railway

---

## Setup & Deployment (Mobile Friendly)

### Step 1 — Create your Telegram Bot
1. Open Telegram, search for **@BotFather**
2. Send `/newbot`
3. Give it a name (e.g. `My Pump Alerts`)
4. Give it a username (e.g. `mypumpalerts_bot`)
5. Copy the **API Token** it gives you — looks like `123456789:ABCdef...`

### Step 2 — Put the code on GitHub
1. Go to **github.com** on your phone browser
2. Create a free account if you don't have one
3. Tap the **+** icon → **New repository**
4. Name it `pump-alert-bot`, set to **Private**, tap **Create repository**
5. On the next page tap **uploading an existing file**
6. Upload ALL the files from this folder one by one:
   - `index.js`
   - `tracker.js`
   - `fetcher.js`
   - `db.js`
   - `package.json`
   - `nixpacks.toml`
   - `.gitignore`
7. Tap **Commit changes**

### Step 3 — Deploy on Railway
1. Go to **railway.app** on your phone browser
2. Sign up with your GitHub account
3. Tap **New Project** → **Deploy from GitHub repo**
4. Select your `pump-alert-bot` repo
5. Railway will detect it automatically
6. Before it starts, tap **Variables** tab
7. Add this variable:
   - Key: `BOT_TOKEN`
   - Value: _(paste your token from BotFather)_
8. Tap **Deploy** — it will go live in ~1 minute!

---

## Bot Commands

| Command | Description |
|---|---|
| `/start` | Show welcome message |
| `/track <CA> <multiplier>` | Start tracking a token |
| `/list` | See all tracked tokens + current status |
| `/untrack <CA>` | Stop tracking a token |
| `/clear` | Remove all tracked tokens |

### Examples
```
/track EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v 2
/track TokenAddressHere 1.5
/track TokenAddressHere 5
```

---

## How It Works
1. When you `/track` a token, it records the **current market cap as baseline**
2. Every 20 seconds, it fetches the latest market cap
3. When `currentMC / baselineMC >= multiplier`, it fires the alert
4. Alert only fires **once** per tracked token (won't spam you)

---

## Notes
- Railway free tier gives 500 hours/month — enough for 24/7 running
- Data is stored in a JSON file inside the container
- ⚠️ If Railway redeploys (e.g. you push new code), tracked tokens reset. For permanent storage, upgrade to Railway's persistent volume or use a free MongoDB Atlas database.
