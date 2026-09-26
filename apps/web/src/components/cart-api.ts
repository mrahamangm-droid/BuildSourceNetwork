/** Tiny fetch helper for the cart and list routes; throws the server's message on failure. */
export async function postJson<T = Record<string, unknown>>(
  url: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string } & T;
  if (!res.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");
  return data;
}

export type ListRow = { id: string; name: string; has?: boolean };
