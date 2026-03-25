import type { NotificationJob } from "@pantry/shared";

type Env = {
  DB: D1Database;
};

const jsonHeaders = {
  "Content-Type": "application/json",
};

async function recordNotificationAttempt(
  env: Env,
  input: {
    jobType: string;
    userId?: string;
    itemId?: string;
    attemptNumber: number;
    status: "RECEIVED" | "SUCCESS" | "FAILED" | "DROPPED";
    errorMessage?: string;
    payload: unknown;
  },
): Promise<void> {
  const now = new Date().toISOString();

  await env.DB.prepare(
    `
      INSERT INTO notification_attempts (
        id,
        job_type,
        user_id,
        item_id,
        attempt_number,
        status,
        error_message,
        payload_json,
        created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
  )
    .bind(
      crypto.randomUUID(),
      input.jobType,
      input.userId ?? null,
      input.itemId ?? null,
      input.attemptNumber,
      input.status,
      input.errorMessage ?? null,
      JSON.stringify(input.payload),
      now,
    )
    .run();
}

export default {
  fetch(request: Request): Response {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response(
        JSON.stringify({ status: "ok", service: "notifications" }),
        { headers: jsonHeaders },
      );
    }

    return new Response("Not Found", { status: 404 });
  },

  async queue(batch: MessageBatch<NotificationJob>, env: Env): Promise<void> {
    for (const message of batch.messages) {
      try {
        console.log(`Attempt ${message.attempts}:`, message.body);

        await recordNotificationAttempt(env, {
          jobType: message.body.type,
          userId: message.body.userId,
          itemId: message.body.itemId,
          attemptNumber: message.attempts,
          status: "RECEIVED",
          payload: message.body,
        });

        if (message.attempts > 3) {
          console.error("Dropping message after retries:", message.body);

          await recordNotificationAttempt(env, {
            jobType: message.body.type,
            userId: message.body.userId,
            itemId: message.body.itemId,
            attemptNumber: message.attempts,
            status: "DROPPED",
            payload: message.body,
          });

          message.ack();
          continue;
        }

        if (message.body.type === "DAILY_DIGEST") {
          console.log(
            "Daily digest job received for user:",
            message.body.userId,
          );
          console.log("Daily digest payload:", message.body.payload);
        }

        if (message.body.type === "REFILL_REMINDER") {
          console.log(
            "Refill reminder job received for item:",
            message.body.itemId,
          );
          console.log("Refill reminder payload:", message.body.payload);
        }

        if (Math.random() < 0.3) {
          throw new Error("Simulated random failure");
        }

        console.log("Processed:", message.body.type);

        await recordNotificationAttempt(env, {
          jobType: message.body.type,
          userId: message.body.userId,
          itemId: message.body.itemId,
          attemptNumber: message.attempts,
          status: "SUCCESS",
          payload: message.body,
        });

        message.ack();
      } catch (error) {
        console.error("Processing failed:", error);

        await recordNotificationAttempt(env, {
          jobType: message.body.type,
          userId: message.body.userId,
          itemId: message.body.itemId,
          attemptNumber: message.attempts,
          status: "FAILED",
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
          payload: message.body,
        });
      }
    }
  },
};
