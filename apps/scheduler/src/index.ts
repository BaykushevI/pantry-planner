import type { NotificationJob } from "@pantry/shared";

type Env = {
  DB: D1Database;
  NOTIFICATION_QUEUE: Queue;
};

type DailySummaryPayload = {
  totalItems: number;
  refillDueItems: number;
  dueSoonItems: number;
  suggestedItems: number;
};

type RefillDueItem = {
  id: string;
  name: string;
  quantity: number;
  last_bought_at: string | null;
};

const jsonHeaders = {
  "Content-Type": "application/json",
};

function getTodayDatePrefix(): string {
  return new Date().toISOString().slice(0, 10);
}

async function hasSuccessfulReminderToday(
  env: Env,
  itemId: string,
): Promise<boolean> {
  const todayPrefix = getTodayDatePrefix();

  const result = await env.DB.prepare(
    `
      SELECT COUNT(*) as count
      FROM notification_attempts
      WHERE job_type = 'REFILL_REMINDER'
        AND item_id = ?
        AND status = 'SUCCESS'
        AND substr(created_at, 1, 10) = ?
      `,
  )
    .bind(itemId, todayPrefix)
    .first<{ count: number }>();

  return (result?.count ?? 0) > 0;
}

async function getDerivedCadenceDays(
  env: Env,
  itemId: string,
): Promise<number | null> {
  const result = await env.DB.prepare(
    `
      SELECT purchased_at
      FROM purchase_events
      WHERE item_id = ?
      ORDER BY purchased_at ASC
      `,
  )
    .bind(itemId)
    .all<{ purchased_at: string }>();

  const events = result.results ?? [];

  if (events.length < 2) {
    return null;
  }

  const intervals: number[] = [];

  for (let i = 1; i < events.length; i++) {
    const previous = new Date(events[i - 1].purchased_at);
    const current = new Date(events[i].purchased_at);
    const diffMs = current.getTime() - previous.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      intervals.push(diffDays);
    }
  }

  if (intervals.length === 0) {
    return null;
  }

  const average =
    intervals.reduce((sum, value) => sum + value, 0) / intervals.length;

  return Math.round(average);
}

function getDaysSince(dateString: string): number {
  const target = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - target.getTime();

  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

async function getSuggestedItemsWithDerivedCadence(env: Env) {
  const result = await env.DB.prepare(
    `
      SELECT *
      FROM pantry_items
      WHERE (snoozed_until IS NULL OR datetime(snoozed_until) <= datetime('now'))
      ORDER BY updated_at DESC
      `,
  ).all<{
    id: string;
    name: string;
    quantity: number;
    last_bought_at: string | null;
    snoozed_until: string | null;
    created_at: string;
    updated_at: string;
  }>();

  const items = result.results ?? [];
  const suggestedItems: Array<Record<string, unknown>> = [];

  for (const item of items) {
    if (!item.last_bought_at) {
      continue;
    }

    const cadenceDays = await getDerivedCadenceDays(env, item.id);

    if (cadenceDays === null) {
      continue;
    }

    const daysSinceLastBought = getDaysSince(item.last_bought_at);

    const isDue = daysSinceLastBought >= cadenceDays;
    const isDueSoon = daysSinceLastBought === cadenceDays - 1;

    if (isDue) {
      suggestedItems.push({
        ...item,
        derived_cadence_days: cadenceDays,
        suggestion_reason: "REFILL_DUE",
      });

      continue;
    }

    if (isDueSoon) {
      suggestedItems.push({
        ...item,
        derived_cadence_days: cadenceDays,
        suggestion_reason: "REFILL_DUE_SOON",
      });
    }
  }

  return suggestedItems;
}

async function buildDailySummary(env: Env): Promise<DailySummaryPayload> {
  const totalItemsResult = await env.DB.prepare(
    `
      SELECT COUNT(*) as count
      FROM pantry_items
      `,
  ).first<{ count: number }>();

  const suggestedItems = await getSuggestedItemsWithDerivedCadence(env);

  const refillDueItems = suggestedItems.filter(
    (item) => item.suggestion_reason === "REFILL_DUE",
  ).length;

  const dueSoonItems = suggestedItems.filter(
    (item) => item.suggestion_reason === "REFILL_DUE_SOON",
  ).length;

  return {
    totalItems: totalItemsResult?.count ?? 0,
    refillDueItems,
    dueSoonItems,
    suggestedItems: suggestedItems.length,
  };
}

async function getRefillDueItems(
  env: Env,
): Promise<Array<RefillDueItem & { derivedCadenceDays: number }>> {
  const result = await env.DB.prepare(
    `
      SELECT id, name, quantity, last_bought_at
      FROM pantry_items
      WHERE
        (snoozed_until IS NULL OR datetime(snoozed_until) <= datetime('now'))
        AND last_bought_at IS NOT NULL
      ORDER BY updated_at DESC
      `,
  ).all<RefillDueItem>();

  const items = result.results ?? [];
  const dueItems: Array<RefillDueItem & { derivedCadenceDays: number }> = [];

  for (const item of items) {
    if (!item.last_bought_at) {
      continue;
    }

    const cadenceDays = await getDerivedCadenceDays(env, item.id);

    if (cadenceDays === null) {
      continue;
    }

    const daysSinceLastBought = getDaysSince(item.last_bought_at);

    if (daysSinceLastBought >= cadenceDays) {
      dueItems.push({
        ...item,
        derivedCadenceDays: cadenceDays,
      });
    }
  }

  return dueItems;
}

async function enqueueDailyDigest(env: Env, source: "manual" | "cron") {
  const summary = await buildDailySummary(env);

  const job: NotificationJob = {
    type: "DAILY_DIGEST",
    userId: "demo-user",
    createdAt: new Date().toISOString(),
    payload: {
      source,
      summary,
    },
  };

  await env.NOTIFICATION_QUEUE.send(job);
}

async function enqueueRefillReminders(env: Env, source: "manual" | "cron") {
  const dueItems = await getRefillDueItems(env);
  let enqueuedCount = 0;

  console.log("Refill due items:", dueItems);

  for (const item of dueItems) {
    const alreadyRemindedToday = await hasSuccessfulReminderToday(env, item.id);

    if (alreadyRemindedToday) {
      console.log("Skipping already-reminded item:", item.id);
      continue;
    }

    const job: NotificationJob = {
      type: "REFILL_REMINDER",
      userId: "demo-user",
      itemId: item.id,
      createdAt: new Date().toISOString(),
      payload: {
        source,
        name: item.name,
        quantity: item.quantity,
        derivedCadenceDays: item.derivedCadenceDays,
        lastBoughtAt: item.last_bought_at,
      },
    };

    await env.NOTIFICATION_QUEUE.send(job);
    enqueuedCount++;
  }

  return enqueuedCount;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({ status: "ok", service: "scheduler" }),
        { headers: jsonHeaders },
      );
    }

    if (url.pathname === "/run-daily-digest") {
      await enqueueDailyDigest(env, "manual");

      return new Response(
        JSON.stringify({
          status: "ok",
          message: "daily digest job enqueued",
        }),
        { headers: jsonHeaders },
      );
    }

    if (url.pathname === "/run-refill-reminders") {
      const count = await enqueueRefillReminders(env, "manual");

      return new Response(
        JSON.stringify({
          status: "ok",
          message: "refill reminder jobs enqueued",
          count,
        }),
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

    ctx.waitUntil(
      Promise.all([
        enqueueDailyDigest(env, "cron"),
        enqueueRefillReminders(env, "cron"),
      ]),
    );
  },
};
