import type { NotificationJob } from "@pantry/shared";

type Env = {
  NOTIFICATION_QUEUE: Queue;
};

const jsonHeaders = {
  "Content-Type": "application/json",
};

async function enqueueDailyDigest(env: Env, source: "manual" | "cron") {
  const job: NotificationJob = {
    type: "DAILY_DIGEST",
    userId: "demo-user",
    createdAt: new Date().toISOString(),
    payload: {
      source,
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
