import type { NotificationJob } from "@pantry/shared";

type Env = {
  NOTIFICATION_QUEUE: Queue;
};

const jsonHeaders = {
  "Content-Type": "application/json",
};

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
      const job: NotificationJob = {
        type: "DAILY_DIGEST",
        userId: "demo-user",
        createdAt: new Date().toISOString(),
        payload: {
          source: "scheduler",
        },
      };

      await env.NOTIFICATION_QUEUE.send(job);

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
};
