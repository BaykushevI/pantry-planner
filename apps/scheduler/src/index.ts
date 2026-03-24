import type { NotificationJob } from "@pantry/shared";

type Env = {
  DB: D1Database;
  NOTIFICATION_QUEUE: Queue;
};

const jsonHeaders = {
  "Content-Type": "application/json",
};
type DailySummaryPayload = {
  totalItems: number;
  lowStockItems: number;
  refillDueItems: number;
  suggestedItems: number;
};

async function buildDailySummary(env: Env): Promise<DailySummaryPayload> {
  const totalItemsResult = await env.DB.prepare(
    `
      SELECT COUNT(*) as count
      FROM pantry_items
      `,
  ).first<{ count: number }>();

  const lowStockItemsResult = await env.DB.prepare(
    `
      SELECT COUNT(*) as count
      FROM pantry_items
      WHERE low_stock_threshold IS NOT NULL
        AND quantity <= low_stock_threshold
      `,
  ).first<{ count: number }>();

  const refillDueItemsResult = await env.DB.prepare(
    `
      SELECT COUNT(*) as count
      FROM pantry_items
      WHERE last_bought_at IS NOT NULL
        AND refill_frequency_days IS NOT NULL
        AND CAST(julianday('now') - julianday(last_bought_at) AS INTEGER) >= refill_frequency_days
      `,
  ).first<{ count: number }>();

  const suggestedItemsResult = await env.DB.prepare(
    `
      SELECT COUNT(*) as count
      FROM pantry_items
      WHERE
        (
          low_stock_threshold IS NOT NULL
          AND quantity <= low_stock_threshold
        )
        OR
        (
          last_bought_at IS NOT NULL
          AND refill_frequency_days IS NOT NULL
          AND CAST(julianday('now') - julianday(last_bought_at) AS INTEGER) >= refill_frequency_days
        )
      `,
  ).first<{ count: number }>();

  return {
    totalItems: totalItemsResult?.count ?? 0,
    lowStockItems: lowStockItemsResult?.count ?? 0,
    refillDueItems: refillDueItemsResult?.count ?? 0,
    suggestedItems: suggestedItemsResult?.count ?? 0,
  };
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

    return new Response("Not Found", { status: 404 });
  },

  async scheduled(
    controller: ScheduledController,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    console.log("Cron triggered:", controller.cron);

    ctx.waitUntil(enqueueDailyDigest(env, "cron"));
  },
};
