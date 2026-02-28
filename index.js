require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const { startTracker } = require("./tracker");
const db = require("./db");
const { fetchMarketCap } = require("./fetcher");

const BOT_TOKEN = process.env.BOT_TOKEN;
if (!BOT_TOKEN) {
  console.error("❌ BOT_TOKEN not set in environment variables!");
  process.exit(1);
}

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log("🤖 Pump Alert Bot v1 (Polling) started...");

function formatMC(mc) {
  if (!mc) return "$0";
  if (mc >= 1_000_000) return `$${(mc / 1_000_000).toFixed(2)}M`;
  if (mc >= 1_000) return `$${(mc / 1_000).toFixed(1)}K`;
  return `$${mc.toFixed(2)}`;
}

// ─── /start ───────────────────────────────────────────────
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;
  bot.sendMessage(
    chatId,
    `👋 *Welcome to Pump Alert Bot!*\n\n` +
    `I'll alert you when a token's market cap hits your target multiplier.\n\n` +
    `*Commands:*\n` +
    `🔍 /track \`<CA>\` \`<multiplier>\` — Start tracking a token\n` +
    `📋 /list — See all tracked tokens with Untrack buttons\n` +
    `🗑 /clear — Remove all tracked tokens\n\n` +
    `*Examples:*\n` +
    `/track <CA> 2   → alert at 2x\n` +
    `/track <CA> 1.5 → alert at +50%\n` +
    `/track <CA> 5   → alert at 5x`,
    { parse_mode: "Markdown" }
  );
});

// ─── /track <CA> <multiplier> ─────────────────────────────
bot.onText(/\/track (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const args = match[1].trim().split(/\s+/);

  if (args.length < 2) {
    return bot.sendMessage(
      chatId,
      `⚠️ Usage: /track \`<contract_address>\` \`<multiplier>\`\n\nExamples:\n/track <CA> 2\n/track <CA> 1.5`,
      { parse_mode: "Markdown" }
    );
  }

  const mint = args[0].trim();
  const multiplier = parseFloat(args[1]);

  if (isNaN(multiplier) || multiplier <= 1) {
    return bot.sendMessage(chatId, "⚠️ Multiplier must be greater than 1.\nExamples: 1.5, 2, 3, 5");
  }

  if (mint.length < 32 || mint.length > 50) {
    return bot.sendMessage(chatId, "⚠️ That doesn't look like a valid Solana contract address.");
  }

  await bot.sendMessage(
    chatId,
    `🔍 Fetching market cap for \`${mint.slice(0, 8)}...\``,
    { parse_mode: "Markdown" }
  );

  try {
    const data = await fetchMarketCap(mint);

    if (!data || !data.mc) {
      return bot.sendMessage(
        chatId,
        `❌ Could not fetch market cap.\n\nMake sure it's a valid pump.fun or Raydium token.`
      );
    }

    const existing = db.getToken(chatId, mint);
    if (existing) {
      return bot.sendMessage(
        chatId,
        `ℹ️ Already tracking this token!\n\n` +
        `💰 Baseline MC: *${formatMC(existing.baselineMC)}*\n` +
        `🎯 Target: *${existing.multiplier}x*\n\n` +
        `Use /list to untrack it.`,
        { parse_mode: "Markdown" }
      );
    }

    db.addToken(chatId, mint, data.mc, multiplier, data.name || "Unknown");

    const targetMC = data.mc * multiplier;
    bot.sendMessage(
      chatId,
      `✅ *Now tracking!*\n\n` +
      `📛 Token: *${data.name || "Unknown"}*\n` +
      `🔗 \`${mint}\`\n\n` +
      `💰 Baseline MC: *${formatMC(data.mc)}*\n` +
      `🎯 Alert at: *${multiplier}x → ${formatMC(targetMC)}*\n\n` +
      `🔄 Checking every 20 seconds`,
      { parse_mode: "Markdown" }
    );
  } catch (err) {
    console.error("Track error:", err.message);
    bot.sendMessage(chatId, `❌ Error: ${err.message}`);
  }
});

// ─── /list — each token gets inline Untrack button ────────
bot.onText(/\/list/, async (msg) => {
  const chatId = msg.chat.id;
  const tokens = db.getUserTokens(chatId);

  if (!tokens.length) {
    return bot.sendMessage(
      chatId,
      "📋 No tracked tokens.\n\nUse /track <CA> <multiplier> to start."
    );
  }

  await bot.sendMessage(chatId, `📋 *Your Tracked Tokens (${tokens.length})*`, {
    parse_mode: "Markdown",
  });

  for (const t of tokens) {
    const status = t.alertFired ? "✅ Alerted" : "🔄 Tracking";
    let text = "";

    try {
      const data = await fetchMarketCap(t.mint);
      const currentMC = data?.mc || 0;

      if (currentMC > 0) {
        const currentMult = currentMC / t.baselineMC;
        const targetMC    = t.baselineMC * t.multiplier;
        const needsMultFromHere = targetMC / currentMC;

        // Is the token up or down from baseline?
        const changeFromBaseline = ((currentMult - 1) * 100);
        const directionEmoji = currentMult >= 1 ? "📈" : "📉";
        const changeStr = currentMult >= 1
          ? `+${changeFromBaseline.toFixed(1)}% from baseline`
          : `${changeFromBaseline.toFixed(1)}% from baseline`;

        // How far to target from current price
        const toTargetStr = currentMult >= t.multiplier
          ? `✅ Target already hit!`
          : `Needs *${needsMultFromHere.toFixed(2)}x* from current to hit *${t.multiplier}x*`;

        text =
          `${status} *${t.name}*\n` +
          `\`${t.mint.slice(0, 8)}...${t.mint.slice(-6)}\`\n\n` +
          `💰 Baseline: ${formatMC(t.baselineMC)}\n` +
          `${directionEmoji} Current:  ${formatMC(currentMC)} (${currentMult.toFixed(2)}x)\n` +
          `🎯 Target: ${formatMC(targetMC)} (${t.multiplier}x)\n\n` +
          `${changeStr}\n` +
          `${toTargetStr}`;
      } else {
        text =
          `${status} *${t.name}*\n` +
          `\`${t.mint.slice(0, 8)}...${t.mint.slice(-6)}\`\n\n` +
          `⚠️ Could not fetch live data`;
      }
    } catch {
      text =
        `${status} *${t.name}*\n` +
        `\`${t.mint.slice(0, 8)}...${t.mint.slice(-6)}\`\n\n` +
        `⚠️ Could not fetch live data`;
    }

    // Each token gets its own message with an Untrack button
    await bot.sendMessage(chatId, text, {
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
          [
            {
              text: `❌ Untrack ${t.name}`,
              callback_data: `untrack:${t.mint}`,
            },
          ],
        ],
      },
    });
  }
});

// ─── Inline button tap handler ────────────────────────────
bot.on("callback_query", async (query) => {
  const chatId = query.message.chat.id;
  const messageId = query.message.message_id;
  const data = query.data;

  if (data.startsWith("untrack:")) {
    const mint = data.replace("untrack:", "");
    const token = db.getToken(chatId, mint);
    const name = token?.name || `${mint.slice(0, 8)}...`;

    db.removeToken(chatId, mint);

    // Edit message to confirm removal
    await bot.editMessageText(
      `🗑 *${name}* has been untracked`,
      {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "Markdown",
      }
    );

    // Small popup on button tap
    await bot.answerCallbackQuery(query.id, {
      text: `✅ ${name} removed`,
      show_alert: false,
    });
  }
});

// ─── /clear ───────────────────────────────────────────────
bot.onText(/\/clear/, (msg) => {
  const chatId = msg.chat.id;
  db.clearUser(chatId);
  bot.sendMessage(chatId, "🗑 All tracked tokens have been removed.");
});

// ─── Detect raw CA paste ──────────────────────────────────
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text || "";
  if (/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(text.trim())) {
    bot.sendMessage(
      chatId,
      `👀 Looks like a contract address!\n\nTrack it with:\n/track \`${text.trim()}\` 2\n\n_(Replace 2 with your target multiplier)_`,
      { parse_mode: "Markdown" }
    );
  }
});

// ─── Start polling tracker ────────────────────────────────
startTracker(bot);

module.exports = { bot };
