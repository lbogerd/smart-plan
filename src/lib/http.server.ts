import { ZodError } from "zod";
import { HttpError } from "./store.server";
export function json(data: unknown, status = 200) {
  return Response.json(data, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
export async function handle(fn: () => Promise<Response>) {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ZodError)
      return json({ error: "Invalid plan", issues: error.issues }, 400);
    if (error instanceof HttpError)
      return json({ error: error.message }, error.status);
    if (error instanceof SyntaxError)
      return json({ error: "Invalid JSON" }, 400);
    console.error(error);
    return json({ error: "Unable to access plan storage" }, 500);
  }
}
export async function body(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== (process.env.APP_URL || new URL(request.url).origin))
    throw new HttpError(403, "Cross-origin writes are not allowed");
  if (!request.headers.get("content-type")?.includes("application/json"))
    throw new HttpError(415, "Use application/json");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "JSON body required");
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > 1_048_576) {
      await reader.cancel();
      throw new HttpError(413, "Maximum request size is 1 MB");
    }
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
