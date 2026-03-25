import type { NotificationJob } from "@pantry/shared";

type Env = {
  DB: D1Database;
  NOTIFICATION_QUEUE: Queue;
};

type CreateItemBody = {
  name: string;
  notes?: string;
};

type UpdateNotesBody = {
  notes: string;
};

type LoginBody = {
  username: string;
  password: string;
};

type DbItem = {
  id: string;
  user_id: string;
  name: string;
  status: string;
  notes: string | null;
  last_bought_at: string | null;
  snoozed_until: string | null;
  created_at: string;
  updated_at: string;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-User-Id",
};

const jsonHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type, X-User-Id",
};

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), { status, headers: jsonHeaders });
}

function err(message: string, status = 400): Response {
  return json({ error: message }, status);
}

// ── Auth helpers ──────────────────────────────────────────────────────────────

async function resolveUser(
  env: Env,
  userId: string,
): Promise<{ id: string; username: string; display_name: string } | null> {
  return env.DB.prepare("SELECT id, username, display_name FROM users WHERE id = ? LIMIT 1")
    .bind(userId)
    .first<{ id: string; username: string; display_name: string }>();
}

// ── Cadence logic (unchanged from original) ───────────────────────────────────

async function getDerivedCadenceDays(
  env: Env,
  itemId: string,
): Promise<number | null> {
  const result = await env.DB.prepare(
    "SELECT purchased_at FROM purchase_events WHERE item_id = ? ORDER BY purchased_at ASC",
  )
    .bind(itemId)
    .all<{ purchased_at: string }>();

  const events = result.results ?? [];
  if (events.length < 2) return null;

  const intervals: number[] = [];
  for (let i = 1; i < events.length; i++) {
    const prev = new Date(events[i - 1].purchased_at);
    const curr = new Date(events[i].purchased_at);
    const diffDays = Math.floor((curr.getTime() - prev.getTime()) / 86400000);
    if (diffDays > 0) intervals.push(diffDays);
  }

  if (intervals.length === 0) return null;
  return Math.round(intervals.reduce((sum, v) => sum + v, 0) / intervals.length);
}

function getDaysSince(dateString: string): number {
  return Math.floor((Date.now() - new Date(dateString).getTime()) / 86400000);
}

// ── Shopping sessions (user-scoped) ───────────────────────────────────────────

function getTodayDateStr(): string {
  return new Date().toISOString().slice(0, 10);
}

async function hasShoppingSessionToday(env: Env, userId: string): Promise<boolean> {
  const result = await env.DB.prepare(
    "SELECT COUNT(*) as count FROM shopping_sessions WHERE session_date = ? AND user_id = ?",
  )
    .bind(getTodayDateStr(), userId)
    .first<{ count: number }>();
  return (result?.count ?? 0) > 0;
}

async function ensureShoppingSessionToday(env: Env, userId: string): Promise<void> {
  const sessionDate = getTodayDateStr();
  const existing = await env.DB.prepare(
    "SELECT id FROM shopping_sessions WHERE session_date = ? AND user_id = ? LIMIT 1",
  )
    .bind(sessionDate, userId)
    .first<{ id: string }>();
  if (existing) return;
  const now = new Date().toISOString();
  await env.DB.prepare(
    "INSERT INTO shopping_sessions (id, session_date, user_id, created_at) VALUES (?, ?, ?, ?)",
  )
    .bind(crypto.randomUUID(), sessionDate, userId, now)
    .run();
}

// ── Suggestions (user-scoped, history items only) ─────────────────────────────

async function getSuggestedItems(env: Env, userId: string) {
  const shoppingSessionToday = await hasShoppingSessionToday(env, userId);

  const result = await env.DB.prepare(
    `SELECT * FROM pantry_items
     WHERE user_id = ?
       AND status = 'history'
       AND (snoozed_until IS NULL OR datetime(snoozed_until) <= datetime('now'))
     ORDER BY updated_at DESC`,
  )
    .bind(userId)
    .all<DbItem>();

  const items = result.results ?? [];
  const suggested: Array<Record<string, unknown>> = [];

  for (const item of items) {
    if (!item.last_bought_at) continue;

    const cadenceDays = await getDerivedCadenceDays(env, item.id);
    if (cadenceDays === null) continue;

    const daysSinceLastBought = getDaysSince(item.last_bought_at);
    const isDue = daysSinceLastBought >= cadenceDays;
    const isDueSoon = daysSinceLastBought === cadenceDays - 1;

    if (isDue) {
      suggested.push({ ...item, derived_cadence_days: cadenceDays, suggestion_reason: "REFILL_DUE" });
      continue;
    }
    if (isDueSoon && !shoppingSessionToday) {
      suggested.push({ ...item, derived_cadence_days: cadenceDays, suggestion_reason: "REFILL_DUE_SOON" });
    }
  }

  return suggested;
}

// ── Route helpers ─────────────────────────────────────────────────────────────

function matchPath(pathname: string, pattern: RegExp): string | null {
  const match = pathname.match(pattern);
  return match ? match[1] : null;
}

// ── Main handler ──────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const { pathname } = url;

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    // ── Health ────────────────────────────────────────────────────────────────

    if (pathname === "/health") {
      return json({ status: "ok", service: "api" });
    }

    if (pathname === "/health/db") {
      const result = await env.DB.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '__cf_%' ORDER BY name",
      ).all();
      return json({ status: "ok", service: "api", database: "connected", tables: result.results });
    }

    // ── Auth ──────────────────────────────────────────────────────────────────

    if (pathname === "/auth/login" && request.method === "POST") {
      const body = (await request.json()) as LoginBody;
      if (!body.username || !body.password) {
        return err("username and password required");
      }
      const user = await env.DB.prepare(
        "SELECT id, username, display_name FROM users WHERE username = ? AND password = ? LIMIT 1",
      )
        .bind(body.username.trim().toLowerCase(), body.password)
        .first<{ id: string; username: string; display_name: string }>();

      if (!user) {
        return err("Invalid credentials", 401);
      }
      return json({ id: user.id, username: user.username, displayName: user.display_name });
    }

    // ── Resolve user from header (required for all /items, /suggestions, /summary) ──

    const userId = request.headers.get("X-User-Id") ?? "";

    if (
      (pathname.startsWith("/items") ||
        pathname.startsWith("/suggestions") ||
        pathname.startsWith("/summary")) &&
      !userId
    ) {
      return err("X-User-Id header required", 401);
    }

    if (userId) {
      const user = await resolveUser(env, userId);
      if (!user) return err("Unknown user", 401);
    }

    // ── Items ─────────────────────────────────────────────────────────────────

    if (pathname === "/items" && request.method === "GET") {
      const status = url.searchParams.get("status");
      let query = "SELECT * FROM pantry_items WHERE user_id = ?";
      const bindings: unknown[] = [userId];
      if (status) {
        query += " AND status = ?";
        bindings.push(status);
      }
      query += " ORDER BY updated_at DESC";
      const result = await env.DB.prepare(query).bind(...bindings).all<DbItem>();
      return json(result.results ?? []);
    }

    // Autocomplete — search known items by name prefix (any status)
    if (pathname === "/items/autocomplete" && request.method === "GET") {
      const q = (url.searchParams.get("q") ?? "").trim().toLowerCase();
      if (!q) return json([]);
      const result = await env.DB.prepare(
        `SELECT id, name, notes, status, last_bought_at
         FROM pantry_items
         WHERE user_id = ?
           AND lower(name) LIKE ?
         ORDER BY updated_at DESC
         LIMIT 10`,
      )
        .bind(userId, `${q}%`)
        .all<{ id: string; name: string; notes: string | null; status: string; last_bought_at: string | null }>();
      return json(result.results ?? []);
    }

    if (pathname === "/items" && request.method === "POST") {
      const body = (await request.json()) as CreateItemBody;
      if (!body.name?.trim()) return err("name is required");

      const trimmed = body.name.trim();
      const normalizedName = trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
      const now = new Date().toISOString();

      // Check for existing item with same normalized name (case-insensitive)
      const existing = await env.DB.prepare(
        "SELECT id, status FROM pantry_items WHERE user_id = ? AND lower(name) = lower(?) LIMIT 1",
      )
        .bind(userId, normalizedName)
        .first<{ id: string; status: string }>();

      if (existing) {
        if (existing.status === "active") {
          // Already on the list — return it as-is
          return json({ id: existing.id, message: "already on list", reactivated: false });
        }
        // Re-activate history item
        await env.DB.prepare(
          "UPDATE pantry_items SET status = 'active', notes = COALESCE(?, notes), snoozed_until = NULL, updated_at = ? WHERE id = ?",
        )
          .bind(body.notes ?? null, now, existing.id)
          .run();
        return json({ id: existing.id, message: "item re-added to list", reactivated: true });
      }

      // New item
      const id = crypto.randomUUID();
      await env.DB.prepare(
        `INSERT INTO pantry_items (id, user_id, name, status, notes, quantity, unit, created_at, updated_at)
         VALUES (?, ?, ?, 'active', ?, 0, '', ?, ?)`,
      )
        .bind(id, userId, normalizedName, body.notes ?? null, now, now)
        .run();

      return json({ id, message: "item created", reactivated: false }, 201);
    }

    // PATCH notes
    const notesItemId = matchPath(pathname, /^\/items\/([^/]+)\/notes$/);
    if (notesItemId && request.method === "PATCH") {
      const body = (await request.json()) as UpdateNotesBody;
      const now = new Date().toISOString();
      await env.DB.prepare(
        "UPDATE pantry_items SET notes = ?, updated_at = ? WHERE id = ? AND user_id = ?",
      )
        .bind(body.notes ?? null, now, notesItemId, userId)
        .run();
      return json({ id: notesItemId, message: "notes updated" });
    }

    // Remove from list → history, no purchase event
    const removeItemId = matchPath(pathname, /^\/items\/([^/]+)\/remove$/);
    if (removeItemId && request.method === "POST") {
      const now = new Date().toISOString();
      await env.DB.prepare(
        "UPDATE pantry_items SET status = 'history', updated_at = ? WHERE id = ? AND user_id = ?",
      )
        .bind(now, removeItemId, userId)
        .run();
      return json({ id: removeItemId, message: "item removed from list" });
    }

    // Bought → history + purchase event + shopping session
    const boughtItemId = matchPath(pathname, /^\/items\/([^/]+)\/bought$/);
    if (boughtItemId && request.method === "POST") {
      const now = new Date().toISOString();
      await env.DB.prepare(
        "UPDATE pantry_items SET status = 'history', last_bought_at = ?, snoozed_until = NULL, updated_at = ? WHERE id = ? AND user_id = ?",
      )
        .bind(now, now, boughtItemId, userId)
        .run();

      await ensureShoppingSessionToday(env, userId);

      await env.DB.prepare(
        "INSERT INTO purchase_events (id, item_id, user_id, purchased_at, created_at) VALUES (?, ?, ?, ?, ?)",
      )
        .bind(crypto.randomUUID(), boughtItemId, userId, now, now)
        .run();

      // Enqueue refill reminder to async pipeline
      const item = await env.DB.prepare(
        "SELECT name FROM pantry_items WHERE id = ? LIMIT 1",
      )
        .bind(boughtItemId)
        .first<{ name: string }>();

      if (item) {
        const job: NotificationJob = {
          type: "REFILL_REMINDER",
          userId,
          itemId: boughtItemId,
          payload: { source: "bought_action", name: item.name },
          createdAt: now,
        };
        await env.NOTIFICATION_QUEUE.send(job);
      }

      return json({ id: boughtItemId, message: "item marked as bought", lastBoughtAt: now });
    }

    // Snooze
    const snoozeItemId = matchPath(pathname, /^\/items\/([^/]+)\/snooze$/);
    if (snoozeItemId && request.method === "POST") {
      const snoozeUntil = new Date();
      snoozeUntil.setDate(snoozeUntil.getDate() + 1);
      const now = new Date().toISOString();
      await env.DB.prepare(
        "UPDATE pantry_items SET snoozed_until = ?, updated_at = ? WHERE id = ? AND user_id = ?",
      )
        .bind(snoozeUntil.toISOString(), now, snoozeItemId, userId)
        .run();
      return json({ id: snoozeItemId, message: "item snoozed", snoozedUntil: snoozeUntil.toISOString() });
    }

    // Cadence
    const cadenceItemId = matchPath(pathname, /^\/items\/([^/]+)\/cadence$/);
    if (cadenceItemId && request.method === "GET") {
      const cadenceDays = await getDerivedCadenceDays(env, cadenceItemId);
      return json({ itemId: cadenceItemId, cadenceDays });
    }

    // ── Suggestions ───────────────────────────────────────────────────────────

    if (pathname === "/suggestions" && request.method === "GET") {
      const suggested = await getSuggestedItems(env, userId);
      return json(suggested);
    }

    // ── Summary ───────────────────────────────────────────────────────────────

    if (pathname === "/summary/daily" && request.method === "GET") {
      const activeResult = await env.DB.prepare(
        "SELECT COUNT(*) as count FROM pantry_items WHERE user_id = ? AND status = 'active'",
      )
        .bind(userId)
        .first<{ count: number }>();

      const knownResult = await env.DB.prepare(
        "SELECT COUNT(*) as count FROM pantry_items WHERE user_id = ? AND status = 'history'",
      )
        .bind(userId)
        .first<{ count: number }>();

      const suggested = await getSuggestedItems(env, userId);
      const refillDue = suggested.filter((i) => i.suggestion_reason === "REFILL_DUE").length;
      const dueSoon = suggested.filter((i) => i.suggestion_reason === "REFILL_DUE_SOON").length;
      const shoppingSessionToday = await hasShoppingSessionToday(env, userId);

      return json({
        activeItems: activeResult?.count ?? 0,
        knownItems: knownResult?.count ?? 0,
        suggestedItems: suggested.length,
        refillDueItems: refillDue,
        dueSoonItems: dueSoon,
        shoppingSessionToday,
      });
    }

    // ── Notifications history ─────────────────────────────────────────────────

    if (pathname === "/notifications/history" && request.method === "GET") {
      const result = await env.DB.prepare(
        `SELECT id, job_type, user_id, item_id, attempt_number, status, error_message, payload_json, created_at
         FROM notification_attempts
         ORDER BY created_at DESC
         LIMIT 20`,
      ).all();
      return json(result.results);
    }

    return new Response("Not Found", { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
  },
};
