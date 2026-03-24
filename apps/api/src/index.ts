import type { NotificationJob } from "@pantry/shared";

type Env = {
  DB: D1Database;
  NOTIFICATION_QUEUE: Queue;
};

type CreatePantryItemBody = {
  name: string;
  quantity: number;
  lastBoughtAt?: string | null;
};

type UpdateQuantityBody = {
  quantity: number;
};

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const jsonHeaders = {
  "Content-Type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

function getItemIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/items\/([^/]+)\/quantity$/);
  return match ? match[1] : null;
}

function getDeleteItemIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/items\/([^/]+)$/);
  return match ? match[1] : null;
}

function getSnoozeItemIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/items\/([^/]+)\/snooze$/);
  return match ? match[1] : null;
}

function getBoughtItemIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/items\/([^/]+)\/bought$/);
  return match ? match[1] : null;
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (url.pathname === "/health") {
      return new Response(JSON.stringify({ status: "ok", service: "api" }), {
        headers: jsonHeaders,
      });
    }

    if (url.pathname === "/health/db") {
      const result = await env.DB.prepare(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE '__cf_%' ORDER BY name",
      ).all();

      return new Response(
        JSON.stringify({
          status: "ok",
          service: "api",
          database: "connected",
          tables: result.results,
        }),
        { headers: jsonHeaders },
      );
    }

    if (url.pathname === "/items" && request.method === "GET") {
      const result = await env.DB.prepare(
        "SELECT * FROM pantry_items ORDER BY created_at DESC",
      ).all();

      return new Response(JSON.stringify(result.results), {
        headers: jsonHeaders,
      });
    }

    if (url.pathname === "/suggestions" && request.method === "GET") {
      const result = await env.DB.prepare(
        `
      SELECT *
      FROM pantry_items
      WHERE
        (snoozed_until IS NULL OR datetime(snoozed_until) <= datetime('now'))
        AND
        (
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
          OR
          (
            last_bought_at IS NOT NULL
            AND refill_frequency_days IS NOT NULL
            AND CAST(julianday('now') - julianday(last_bought_at) AS INTEGER) = refill_frequency_days - 1
          )
        )
      ORDER BY updated_at DESC
      `,
      ).all();

      return new Response(JSON.stringify(result.results), {
        headers: jsonHeaders,
      });
    }

    if (url.pathname === "/summary/daily" && request.method === "GET") {
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

      const dueSoonItemsResult = await env.DB.prepare(
        `
      SELECT COUNT(*) as count
      FROM pantry_items
      WHERE last_bought_at IS NOT NULL
        AND refill_frequency_days IS NOT NULL
        AND CAST(julianday('now') - julianday(last_bought_at) AS INTEGER) = refill_frequency_days - 1
      `,
      ).first<{ count: number }>();

      return new Response(
        JSON.stringify({
          totalItems: totalItemsResult?.count ?? 0,
          lowStockItems: lowStockItemsResult?.count ?? 0,
          refillDueItems: refillDueItemsResult?.count ?? 0,
          suggestedItems: suggestedItemsResult?.count ?? 0,
          dueSoonItems: dueSoonItemsResult?.count ?? 0,
        }),
        { headers: jsonHeaders },
      );
    }

    if (url.pathname === "/items" && request.method === "POST") {
      const body = (await request.json()) as CreatePantryItemBody;

      const id = crypto.randomUUID();
      const now = new Date().toISOString();

      await env.DB.prepare(
        `
      INSERT INTO pantry_items (
        id,
        name,
        quantity,
        last_bought_at,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?)
      `,
      )
        .bind(crypto.randomUUID(), body.name, body.quantity, now, now, now)
        .run();

      return new Response(
        JSON.stringify({
          id,
          message: "item created",
        }),
        { headers: jsonHeaders },
      );
    }

    const quantityItemId = getItemIdFromPath(url.pathname);

    if (quantityItemId && request.method === "PATCH") {
      const body = (await request.json()) as UpdateQuantityBody;
      const now = new Date().toISOString();
      const safeQuantity = Math.max(0, body.quantity);

      await env.DB.prepare(
        `
      UPDATE pantry_items
      SET quantity = ?, updated_at = ?
      WHERE id = ?
      `,
      )
        .bind(safeQuantity, now, quantityItemId)
        .run();

      return new Response(
        JSON.stringify({
          id: quantityItemId,
          message: "quantity updated",
        }),
        { headers: jsonHeaders },
      );
    }

    const deleteItemId = getDeleteItemIdFromPath(url.pathname);

    if (deleteItemId && request.method === "DELETE") {
      await env.DB.prepare(
        `
      DELETE FROM pantry_items
      WHERE id = ?
      `,
      )
        .bind(deleteItemId)
        .run();

      return new Response(
        JSON.stringify({
          id: deleteItemId,
          message: "item deleted",
        }),
        { headers: jsonHeaders },
      );
    }

    const snoozeItemId = getSnoozeItemIdFromPath(url.pathname);

    if (snoozeItemId && request.method === "POST") {
      const snoozeUntil = new Date();
      snoozeUntil.setDate(snoozeUntil.getDate() + 1);

      await env.DB.prepare(
        `
      UPDATE pantry_items
      SET snoozed_until = ?, updated_at = ?
      WHERE id = ?
      `,
      )
        .bind(snoozeUntil.toISOString(), new Date().toISOString(), snoozeItemId)
        .run();

      return new Response(
        JSON.stringify({
          status: "ok",
          message: "item snoozed",
          snoozedUntil: snoozeUntil.toISOString(),
        }),
        { headers: jsonHeaders },
      );
    }
    const boughtItemId = getBoughtItemIdFromPath(url.pathname);

    if (boughtItemId && request.method === "POST") {
      const now = new Date().toISOString();

      await env.DB.prepare(
        `
      UPDATE pantry_items
      SET last_bought_at = ?, snoozed_until = NULL, updated_at = ?
      WHERE id = ?
      `,
      )
        .bind(now, now, boughtItemId)
        .run();

      await env.DB.prepare(
        `
      INSERT INTO purchase_events (
        id,
        item_id,
        purchased_at,
        created_at
      )
      VALUES (?, ?, ?, ?)
      `,
      )
        .bind(crypto.randomUUID(), boughtItemId, now, now)
        .run();

      return new Response(
        JSON.stringify({
          status: "ok",
          message: "item marked as bought",
          lastBoughtAt: now,
        }),
        { headers: jsonHeaders },
      );
    }

    const cadenceItemIdMatch = url.pathname.match(
      /^\/items\/([^/]+)\/cadence$/,
    );

    if (cadenceItemIdMatch && request.method === "GET") {
      const itemId = cadenceItemIdMatch[1];
      const cadenceDays = await getDerivedCadenceDays(env, itemId);

      return new Response(
        JSON.stringify({
          itemId,
          cadenceDays,
        }),
        { headers: jsonHeaders },
      );
    }

    return new Response("Not Found", {
      status: 404,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  },
};
