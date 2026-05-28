const express = require("express");
const path = require("path");
const { Pool } = require("pg");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");

const app = express();
const PORT = process.env.PORT || 3000;

// Render / Heroku などリバースプロキシ環境でsecure cookieを正しく動かす
app.set("trust proxy", 1);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

pool.query(`
  CREATE TABLE IF NOT EXISTS storage (
    key TEXT PRIMARY KEY,
    value TEXT
  )
`).catch(console.error);

app.use(cookieParser());
app.use(express.json({ limit: "10mb" }));

app.use(session({
  secret: process.env.SESSION_SECRET || "attendance-app-secret-key-change-in-production",
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax"
    // maxAge はログイン時に rememberMe に応じて設定
  }
}));

app.use(express.static(path.join(__dirname, "public")));

function requireAuth(req, res, next) {
  if (req.session && req.session.authenticated) return next();
  res.status(401).json({ error: "Unauthorized" });
}

// 認証状態確認
app.get("/api/auth-check", (req, res) => {
  res.json({ authenticated: !!(req.session && req.session.authenticated) });
});

// ログイン
app.post("/api/login", async (req, res) => {
  const { id, password, rememberMe } = req.body;
  const adminUser = process.env.ADMIN_USER;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminUser || !adminPassword) {
    return res.status(500).json({ error: "認証設定が未構成です（ADMIN_USER / ADMIN_PASSWORD を環境変数に設定してください）" });
  }

  if (!id || !password) {
    return res.status(401).json({ error: "IDとパスワードを入力してください" });
  }

  if (id !== adminUser) {
    return res.status(401).json({ error: "IDまたはパスワードが正しくありません" });
  }

  // bcryptハッシュ or プレーンテキスト両対応
  let passwordMatch;
  if (adminPassword.startsWith("$2b$") || adminPassword.startsWith("$2a$")) {
    passwordMatch = await bcrypt.compare(password, adminPassword);
  } else {
    passwordMatch = password === adminPassword;
  }

  if (!passwordMatch) {
    return res.status(401).json({ error: "IDまたはパスワードが正しくありません" });
  }

  req.session.authenticated = true;
  if (rememberMe) {
    req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30日
  }

  res.json({ ok: true });
});

// ログアウト
app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

// ストレージAPI（認証必須）
app.get("/api/storage/:key", requireAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT value FROM storage WHERE key = $1", [req.params.key]);
    if (result.rows.length === 0) return res.json({ value: null });
    res.json({ value: result.rows[0].value });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post("/api/storage/:key", requireAuth, async (req, res) => {
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
