const fs = require("fs");
const path = require("path");

const DB_PATH = path.join(__dirname, "data", "db.json");

if (!fs.existsSync(path.join(__dirname, "data"))) {
  fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });
}

function load() {
  try {
    if (!fs.existsSync(DB_PATH)) return {};
    return JSON.parse(fs.readFileSync(DB_PATH, "utf8"));
  } catch { return {}; }
}

function save(data) {
  fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
}

function addToken(chatId, mint, baselineMC, multiplier, name) {
  const db = load();
  const key = String(chatId);
  if (!db[key]) db[key] = [];
  db[key] = db[key].filter((t) => t.mint !== mint);
  db[key].push({
    mint,
    name,
    baselineMC,
    multiplier,
    alertFired: false,
    addedAt: new Date().toISOString(),
  });
  save(db);
}

function getToken(chatId, mint) {
  const db = load();
  return (db[String(chatId)] || []).find((t) => t.mint === mint) || null;
}

function getUserTokens(chatId) {
  return load()[String(chatId)] || [];
}

function getAllTokens() {
  const db = load();
  const result = [];
  for (const [chatId, tokens] of Object.entries(db)) {
    for (const token of tokens) {
      result.push({ chatId, ...token });
    }
  }
  return result;
}

function markAlertFired(chatId, mint) {
  const db = load();
  const key = String(chatId);
  if (!db[key]) return;
  const token = db[key].find((t) => t.mint === mint);
  if (token) { token.alertFired = true; save(db); }
}

function removeToken(chatId, mint) {
  const db = load();
  const key = String(chatId);
  if (!db[key]) return false;
  const before = db[key].length;
  db[key] = db[key].filter((t) => t.mint !== mint);
  save(db);
  return db[key].length < before;
}

function clearUser(chatId) {
  const db = load();
  delete db[String(chatId)];
  save(db);
}

module.exports = { addToken, getToken, getUserTokens, getAllTokens, markAlertFired, removeToken, clearUser };
