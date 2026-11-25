// API の Worker（結び付け名 API）へそのまま渡す。結び付けが無ければ 404。
export const onRequest = (context) =>
  context.env.API
    ? context.env.API.fetch(context.request)
    : new Response(JSON.stringify({ message: "not found" }), { status: 404, headers: { "content-type": "application/json" } });
