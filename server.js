const express = require("express");
const fs = require("fs");
const path = require("path");
const os = require("os");

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(__dirname, "data");

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

function safeKey(k) {
  return k.replace(/[^a-zA-Z0-9_\-]/g, "_");
}

app.get("/api/storage/:key", (req, res) => {
  const file = path.join(DATA_DIR, safeKey(req.params.key) + ".json");
  if (!fs.existsSync(file)) return res.json({ value: null });
  try {
    const value = fs.readFileSync(file, "utf8");
    res.json({ value });
  } catch {
    res.json({ value: null });
  }
});

app.post("/api/storage/:key", (req, res) => {
  const file = path.join(DATA_DIR, safeKey(req.params.key) + ".json");
  try {
    fs.writeFileSync(file, req.body.value, "utf8");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// LAN IP を表示
const interfaces = os.networkInterfaces();
const lanIps = [];
for (const iface of Object.values(interfaces)) {
  for (const addr of iface) {
    if (addr.family === "IPv4" && !addr.internal) lanIps.push(addr.address);
  }
}

app.listen(PORT, "0.0.0.0", () => {
  console.log(`\n✅ 出退勤管理アプリ 起動しました`);
  console.log(`\n  PC:      http://localhost:${PORT}`);
  lanIps.forEach(ip => console.log(`  スマホ:  http://${ip}:${PORT}`));
  console.log(`\n  ※スマホはPCと同じWi-Fiに接続してください\n`);
});
