export async function api(url: string, method = "GET", data?: unknown) {
  const response = await fetch(url, {
    method,
    headers: data ? { "Content-Type": "application/json" } : undefined,
    body: data ? JSON.stringify(data) : undefined,
  });
  const result = await response.json();
  if (!response.ok)
    throw new Error(
      result.issues
        ? `${result.error}: ${result.issues.map((i: { message: string }) => i.message).join("; ")}`
        : result.error || "Request failed",
    );
  return result;
}
