const db = require("./db");
const { fetchMarketCap } = require("./fetcher");

const POLL_INTERVAL_MS = 20_000; // 20 seconds

function formatMC(mc) {
  if (!mc) return "$0";
  if (mc >= 1_000_000) return `$${(mc / 1_000_000).toFixed(2)}M`;
  if (mc >= 1_000) return `$${(mc / 1_000).toFixed(1)}K`;
  return `$${mc.toFixed(2)}`;
}

async function runTrackerCycle(bot) {
  const allTokens = db.getAllTokens();
  const activeTokens = allTokens.filter((t) => !t.alertFired);

  if (!activeTokens.length) return;

  console.log(`[Tracker] Checking ${activeTokens.length} active token(s)...`);

  for (const token of activeTokens) {
    try {
      const data = await fetchMarketCap(token.mint);
      if (!data || !data.mc) continue;

      const currentMC = data.mc;
      const multiplier = currentMC / token.baselineMC;

      console.log(
        `[${new Date().toISOString()}] ${token.name} | ` +
        `Baseline: ${formatMC(token.baselineMC)} | ` +
        `Current: ${formatMC(currentMC)} | ` +
        `${multiplier.toFixed(2)}x`
      );

      if (multiplier >= token.multiplier && !token.alertFired) {
        db.markAlertFired(token.chatId, token.mint);

        const emoji = multiplier >= 5 ? "🔥🔥🔥" : multiplier >= 3 ? "🔥🔥" : multiplier >= 2 ? "🚀🚀" : "🚀";

        await bot.sendMessage(
          token.chatId,
          `${emoji} *ALERT: ${token.name}*\n\n` +
          `✅ Target hit: *${token.multiplier}x*\n\n` +
          `📊 Baseline MC: ${formatMC(token.baselineMC)}\n` +
          `📈 Current MC: *${formatMC(currentMC)}*\n` +
          `💹 Actual gain: *${multiplier.toFixed(2)}x (${((multiplier - 1) * 100).toFixed(0)}%)*\n\n` +
          `🔗 \`${token.mint}\``,
          { parse_mode: "Markdown" }
        );

        console.log(`✅ Alert fired for ${token.name} at ${multiplier.toFixed(2)}x`);
      }
    } catch (err) {
      console.error(`Error checking ${token.mint.slice(0, 8)}: ${err.message}`);
    }

    // Small delay between requests to avoid rate limits
    await new Promise((r) => setTimeout(r, 500));
  }
}

function startTracker(bot) {
  console.log(`🔄 Polling tracker started — every ${POLL_INTERVAL_MS / 1000}s`);

  // Run immediately on start
  runTrackerCycle(bot).catch(console.error);

  // Then on interval
  setInterval(() => {
    runTrackerCycle(bot).catch(console.error);
  }, POLL_INTERVAL_MS);
}

module.exports = { startTracker };
