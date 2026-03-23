type Env = {
  DB: D1Database;
};
type CreatePantryItemBody = {
  name: string;
  quantity: number;
  unit: string;
  lastBoughtAt?: string | null;
  refillFrequencyDays?: number | null;
  lowStockThreshold?: number | null;
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
      WHERE low_stock_threshold IS NOT NULL
        AND quantity <= low_stock_threshold
      ORDER BY updated_at DESC
      `,
      ).all();

      return new Response(JSON.stringify(result.results), {
        headers: jsonHeaders,
      });
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
      unit,
      last_bought_at,
      refill_frequency_days,
      low_stock_threshold,
      created_at,
      updated_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `,
      )
        .bind(
          id,
          body.name,
          body.quantity,
          body.unit,
          body.lastBoughtAt ?? null,
          body.refillFrequencyDays ?? null,
          body.lowStockThreshold ?? null,
          now,
          now,
        )
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

    return new Response("Not Found", {
      status: 404,
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    });
  },
};
