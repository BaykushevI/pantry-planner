import type { NotificationJob } from "@pantry/shared";

const jsonHeaders = {
  "Content-Type": "application/json",
};

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

  async queue(batch: MessageBatch<NotificationJob>): Promise<void> {
    for (const message of batch.messages) {
      try {
        console.log(`Attempt ${message.attempts}:`, message.body);

        if (message.attempts > 3) {
          console.error("Dropping message after retries:", message.body);
          message.ack();
          continue;
        }

        if (Math.random() < 0.3) {
          throw new Error("Simulated random failure");
        }

        console.log("Processed:", message.body.type);

        message.ack();
      } catch (error) {
        console.error("Processing failed:", error);
      }
    }
  },
};
