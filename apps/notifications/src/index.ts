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
};
