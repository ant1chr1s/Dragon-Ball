/**
 * Scouter Guess – Leaderboard Worker
 * ----------------------------------
 * Deploy this on Cloudflare Workers. It stores the leaderboard data
 * inside the GitHub repo (data/leaderboard-daily.json and
 * data/leaderboard-endless.json) using the GitHub Contents API.
 *
 * The GitHub token never reaches the browser — it lives only here,
 * as a Worker secret.
 *
 * Required environment variables / secrets (set in the Cloudflare
 * dashboard under Settings -> Variables and Secrets):
 *   GITHUB_TOKEN    (secret)  - fine-grained PAT with Contents: Read & write
 *                               on the ant1chr1s/Dragon-Ball repo
 *   GITHUB_OWNER    (var)     - "ant1chr1s"
 *   GITHUB_REPO     (var)     - "Dragon-Ball"
 *   ALLOWED_ORIGIN  (var)     - "https://ant1chr1s.github.io"
 *
 * Endpoints:
 *   GET  /daily?date=YYYY-MM-DD        -> [{name, guesses, ts}, ...]
 *   POST /daily   {date, name, guesses}-> appends + returns updated list
 *   GET  /endless                      -> [{name, streak, ts}, ...]
 *   POST /endless {name, streak}       -> appends + returns updated list
 */

const DAILY_PATH = "data/leaderboard-daily.json";
const ENDLESS_PATH = "data/leaderboard-endless.json";

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

async function githubGetFile(env, path) {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "scouter-guess-worker",
    },
  });
  if (res.status === 404) return { data: null, sha: null };
  if (!res.ok) throw new Error(`GitHub GET failed: ${res.status}`);
  const json = await res.json();
  const decoded = atob(json.content.replace(/\n/g, ""));
  return { data: JSON.parse(decoded), sha: json.sha };
}

async function githubPutFile(env, path, data, sha, message) {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
  const body = {
    message,
    content: btoa(unescape(encodeURIComponent(JSON.stringify(data, null, 2)))),
    branch: "main",
  };
  if (sha) body.sha = sha;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      Authorization: `token ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "scouter-guess-worker",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`GitHub PUT failed: ${res.status} ${t}`);
  }
  return res.json();
}

function jsonResponse(obj, env, status) {
  return new Response(JSON.stringify(obj), {
    status: status || 200,
    headers: { "Content-Type": "application/json", ...corsHeaders(env) },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders(env) });
    }

    try {
      // ---------------- DAILY ----------------
      if (url.pathname === "/daily" && request.method === "GET") {
        const date = url.searchParams.get("date");
        if (!date) return jsonResponse({ error: "date required" }, env, 400);
        const { data } = await githubGetFile(env, DAILY_PATH);
        const all = data || {};
        return jsonResponse(all[date] || [], env);
      }

      if (url.pathname === "/daily" && request.method === "POST") {
        const body = await request.json();
        const { date, name, guesses } = body;
        if (!date || !name || !guesses) {
          return jsonResponse({ error: "date, name, guesses required" }, env, 400);
        }
        const { data, sha } = await githubGetFile(env, DAILY_PATH);
        const all = data || {};
        const list = all[date] || [];
        list.push({ name: String(name).slice(0, 24), guesses: Number(guesses), ts: Date.now() });
        list.sort((a, b) => a.guesses - b.guesses || a.ts - b.ts);
        all[date] = list.slice(0, 50);
        await githubPutFile(env, DAILY_PATH, all, sha, `Daily leaderboard update (${date})`);
        return jsonResponse(all[date], env);
      }

      // ---------------- ENDLESS ----------------
      if (url.pathname === "/endless" && request.method === "GET") {
        const { data } = await githubGetFile(env, ENDLESS_PATH);
        return jsonResponse(data || [], env);
      }

      if (url.pathname === "/endless" && request.method === "POST") {
        const body = await request.json();
        const { name, streak } = body;
        if (!name || streak === undefined) {
          return jsonResponse({ error: "name, streak required" }, env, 400);
        }
        const { data, sha } = await githubGetFile(env, ENDLESS_PATH);
        const list = data || [];
        list.push({ name: String(name).slice(0, 24), streak: Number(streak), ts: Date.now() });
        list.sort((a, b) => b.streak - a.streak);
        const trimmed = list.slice(0, 50);
        await githubPutFile(env, ENDLESS_PATH, trimmed, sha, `Endless leaderboard update`);
        return jsonResponse(trimmed, env);
      }

      return jsonResponse({ error: "not found" }, env, 404);
    } catch (err) {
      return jsonResponse({ error: err.message }, env, 500);
    }
  },
};
