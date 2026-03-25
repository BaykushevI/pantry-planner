import type { NotificationJob } from "@pantry/shared";

type Env = {
  DB: D1Database;
  NOTIFICATION_QUEUE: Queue;
};

type DailySummaryPayload = {
  activeItems: number;
  knownItems: number;
  refillDueItems: number;
  dueSoonItems: number;
  suggestedItems: number;
};

type DbItem = {
  id: string;
  user_id: string;
  name: string;
  last_bought_at: string | null;
};

const jsonHeaders = { "Content-Type": "application/json" };

function getTodayDatePrefix(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── Cadence logic (unchanged) ─────────────────────────────────────────────────

async function getDerivedCadenceDays(env: Env, itemId: string): Promise<number | null> {
  const result = await env.DB.prepare(
    "SELECT purchased_at FROM purchase_events WHERE item_id = ? ORDER BY purchased_at ASC",
  )
    .bind(itemId)
    .all<{ purchased_at: string }>();

  const events = result.results ?? [];
  if (events.length < 2) return null;

  const intervals: number[] = [];
  for (let i = 1; i < events.length; i++) {
    const diffDays = Math.floor(
      (new Date(events[i].purchased_at).getTime() - new Date(events[i - 1].purchased_at).getTime()) / 86400000,
    );
    if (diffDays > 0) intervals.push(diffDays);
  }

  if (intervals.length === 0) return null;
  return Math.round(intervals.reduce((sum, v) => sum + v, 0) / intervals.length);
}

function getDaysSince(dateString: string): number {
  return Math.floor((Date.now() - new Date(dateString).getTime()) / 86400000);
}

// ── Per-user helpers ──────────────────────────────────────────────────────────

async function getAllUsers(env: Env): Promise<Array<{ id: string; username: string }>> {
  const result = await env.DB.prepare("SELECT id, username FROM users ORDER BY id").all<{
    id: string;
    username: string;
  }>();
  return result.results ?? [];
}

async function hasSuccessfulReminderToday(env: Env, itemId: string): Promise<boolean> {
  const todayPrefix = getTodayDatePrefix();
  const result = await env.DB.prepare(
    `SELECT COUNT(*) as count FROM notification_attempts
     WHERE job_type = 'REFILL_REMINDER'
       AND item_id = ?
       AND status = 'SUCCESS'
       AND substr(created_at, 1, 10) = ?`,
  )
    .bind(itemId, todayPrefix)
    .first<{ count: number }>();
  return (result?.count ?? 0) > 0;
}

async function getSuggestedItemsForUser(env: Env, userId: string) {
  const result = await env.DB.prepare(
    `SELECT id, user_id, name, last_bought_at
     FROM pantry_items
     WHERE user_id = ?
       AND status = 'history'
       AND last_bought_at IS NOT NULL
       AND (snoozed_until IS NULL OR datetime(snoozed_until) <= datetime('now'))
     ORDER BY updated_at DESC`,
  )
    .bind(userId)
    .all<DbItem>();

  const items = result.results ?? [];
  const suggested: Array<DbItem & { derivedCadenceDays: number; reason: string }> = [];

  for (const item of items) {
    if (!item.last_bought_at) continue;
    const cadenceDays = await getDerivedCadenceDays(env, item.id);
    if (cadenceDays === null) continue;
    const daysSince = getDaysSince(item.last_bought_at);
    if (daysSince >= cadenceDays) {
      suggested.push({ ...item, derivedCadenceDays: cadenceDays, reason: "REFILL_DUE" });
    } else if (daysSince === cadenceDays - 1) {
      suggested.push({ ...item, derivedCadenceDays: cadenceDays, reason: "REFILL_DUE_SOON" });
    }
  }

  return suggested;
}

async function buildDailySummaryForUser(env: Env, userId: string): Promise<DailySummaryPayload> {
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

  const suggested = await getSuggestedItemsForUser(env, userId);
  const refillDue = suggested.filter((i) => i.reason === "REFILL_DUE").length;
  const dueSoon = suggested.filter((i) => i.reason === "REFILL_DUE_SOON").length;

  return {
    activeItems: activeResult?.count ?? 0,
    knownItems: knownResult?.count ?? 0,
    refillDueItems: refillDue,
    dueSoonItems: dueSoon,
    suggestedItems: suggested.length,
  };
}

// ── Enqueue jobs ──────────────────────────────────────────────────────────────

async function enqueueDailyDigestForUser(env: Env, userId: string, source: "manual" | "cron") {
  const summary = await buildDailySummaryForUser(env, userId);
  const job: NotificationJob = {
    type: "DAILY_DIGEST",
    userId,
    createdAt: new Date().toISOString(),
    payload: { source, summary },
  };
  await env.NOTIFICATION_QUEUE.send(job);
}

async function enqueueRefillRemindersForUser(
  env: Env,
  userId: string,
  source: "manual" | "cron",
): Promise<number> {
  const dueItems = (await getSuggestedItemsForUser(env, userId)).filter(
    (i) => i.reason === "REFILL_DUE",
  );
  let enqueuedCount = 0;

  for (const item of dueItems) {
    const alreadyRemindedToday = await hasSuccessfulReminderToday(env, item.id);
    if (alreadyRemindedToday) continue;

    const job: NotificationJob = {
      type: "REFILL_REMINDER",
      userId,
      itemId: item.id,
      createdAt: new Date().toISOString(),
      payload: {
        source,
        name: item.name,
        derivedCadenceDays: item.derivedCadenceDays,
        lastBoughtAt: item.last_bought_at,
      },
    };
    await env.NOTIFICATION_QUEUE.send(job);
    enqueuedCount++;
  }

  return enqueuedCount;
}

async function runAllUsers(env: Env, source: "manual" | "cron") {
  const users = await getAllUsers(env);
  console.log(`Running scheduler for ${users.length} user(s), source: ${source}`);

  for (const user of users) {
    console.log(`Processing user: ${user.username} (${user.id})`);
    await enqueueDailyDigestForUser(env, user.id, source);
    const count = await enqueueRefillRemindersForUser(env, user.id, source);
    console.log(`  Enqueued ${count} refill reminders for ${user.username}`);
  }
}

// ── Worker ────────────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", service: "scheduler" }), {
        headers: jsonHeaders,
      });
    }

    if (url.pathname === "/run-daily-digest") {
      await runAllUsers(env, "manual");
      return new Response(
        JSON.stringify({ status: "ok", message: "daily digest enqueued for all users" }),
        { headers: jsonHeaders },
      );
    }

    if (url.pathname === "/run-refill-reminders") {
      const users = await getAllUsers(env);
      let total = 0;
      for (const user of users) {
        total += await enqueueRefillRemindersForUser(env, user.id, "manual");
      }
      return new Response(
        JSON.stringify({ status: "ok", message: "refill reminders enqueued", count: total }),
        { headers: jsonHeaders },
      );
    }

    return new Response("Not Found", { status: 404 });
  },

  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    console.log("Cron triggered:", controller.cron);
    ctx.waitUntil(runAllUsers(env, "cron"));
  },
};
