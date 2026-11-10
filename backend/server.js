// Backend API: stores users in Postgres.
//   POST /api/register  { username, password }  -> 201 or 400
//   POST /api/login     { username, password }  -> 200 or 401
//   GET  /api/health                             -> 200
import http from "node:http";
import pg from "pg";
import {
  AuthError, hashPassword, normalize, validatePassword, validateUsername, verifyPassword,
} from "./auth.js";

const PORT = Number(process.env.PORT || 3000);
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Postgres can take a few seconds to accept connections: retry before giving up.
async function initDb() {
  for (let attempt = 1; ; attempt++) {
    try {
      await db.query(`CREATE TABLE IF NOT EXISTS users (
        username      TEXT PRIMARY KEY,
        password_hash TEXT NOT NULL
      )`);
      return;
    } catch (err) {
      if (attempt >= 30) throw err;
      console.log(`Database not ready (${err.message}), retrying...`);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
}

async function register({ username, password }) {
  username = normalize(username);
  password = String(password ?? "");
  validateUsername(username);
  validatePassword(password);
  try {
    await db.query("INSERT INTO users (username, password_hash) VALUES ($1, $2)", [
      username,
      await hashPassword(password),
    ]);
  } catch (err) {
    if (err.code === "23505") throw new AuthError("Username already taken"); // unique violation
    throw err;
  }
  return username;
}

async function login({ username, password }) {
  username = normalize(username);
  const { rows } = await db.query("SELECT password_hash FROM users WHERE username = $1", [username]);
  const ok = rows.length === 1 && (await verifyPassword(String(password ?? ""), rows[0].password_hash));
  return ok ? username : null;
}

function send(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

async function readJson(req) {
  let body = "";
  for await (const chunk of req) body += chunk;
  try {
    return JSON.parse(body || "{}");
  } catch {
    return {};
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "GET" && req.url === "/api/health") {
      return send(res, 200, { status: "ok" });
    }
    if (req.method === "POST" && req.url === "/api/register") {
      try {
        const username = await register(await readJson(req));
        return send(res, 201, { username });
      } catch (err) {
        if (err instanceof AuthError) return send(res, 400, { error: err.message });
        throw err;
      }
    }
    if (req.method === "POST" && req.url === "/api/login") {
      const username = await login(await readJson(req));
      if (username) return send(res, 200, { username });
      return send(res, 401, { error: "Invalid username or password" });
    }
    send(res, 404, { error: "Not found" });
  } catch (err) {
    console.error(err);
    send(res, 500, { error: "Server error" });
  }
});

await initDb();
server.listen(PORT, () => console.log(`Backend listening on port ${PORT}`));
