const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// テーブル作成
pool.query(`
  CREATE TABLE IF NOT EXISTS storage (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`).catch(console.error);

app.use(express.json({ limit: "10mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/api/storage/:key", async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM storage WHERE key = $1", [req.params.key]);
    if (result.rows.length === 0) return res.json({ value: null });
    res.json({ value: result.rows[0].value });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/storage/:key", async (req, res) => {
  try {
    await pool.query(
      "INSERT INTO storage (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2",
      [req.params.key, req.body.value]
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`サーバー起動 ポート:${PORT}`);
});