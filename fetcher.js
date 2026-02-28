const https = require("https");

/**
 * Fetch market cap for a given mint.
 * DexScreener first (pump.fun blocks Railway IPs with HTTP 530).
 */
async function fetchMarketCap(mint) {
  try {
    const data = await fetchFromDexScreener(mint);
    if (data && data.mc > 0) return data;
  } catch (e) {
    console.log(`DexScreener failed for ${mint.slice(0, 8)}: ${e.message}`);
  }

  try {
    const data = await fetchFromPumpFun(mint);
    if (data && data.mc > 0) return data;
  } catch (e) {
    console.log(`pump.fun failed for ${mint.slice(0, 8)}: ${e.message}`);
  }

  return null;
}

function fetchFromDexScreener(mint) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      `https://api.dexscreener.com/latest/dex/tokens/${mint}`,
      { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" }, timeout: 8000 },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
            const json = JSON.parse(body);
            const pairs = json.pairs || [];
            if (!pairs.length) return resolve(null);
            const best = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
            resolve({
              mc: best.marketCap || best.fdv || 0,
              name: best.baseToken?.name || best.baseToken?.symbol || "Unknown",
              source: "dexscreener",
            });
          } catch (e) { reject(e); }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

function fetchFromPumpFun(mint) {
  return new Promise((resolve, reject) => {
    const req = https.get(
      `https://frontend-api.pump.fun/coins/${mint}`,
      { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json" }, timeout: 8000 },
      (res) => {
        let body = "";
        res.on("data", (c) => (body += c));
        res.on("end", () => {
          try {
            if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
            const json = JSON.parse(body);
            resolve({
              mc: json.usd_market_cap || 0,
              name: json.name || json.symbol || "Unknown",
              source: "pumpfun",
            });
          } catch (e) { reject(e); }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Timeout")); });
  });
}

module.exports = { fetchMarketCap };
