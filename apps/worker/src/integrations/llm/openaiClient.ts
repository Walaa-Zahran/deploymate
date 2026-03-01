import { env } from "../../config/env.js";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function chatComplete(opts: {
  system: string;
  user: string;
  temperature?: number;
}): Promise<string> {
  const url = `${env.LLM_BASE_URL.replace(/\/$/, "")}/chat/completions`;

  const body = {
    model: env.LLM_MODEL,
    temperature: opts.temperature ?? 0.2,
    messages: [
      { role: "system", content: opts.system } satisfies ChatMessage,
      { role: "user", content: opts.user } satisfies ChatMessage,
    ],
  };

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.LLM_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`LLM error: ${res.status} ${text}`);
  }

  const data = (await res.json()) as any;
  const content = data?.choices?.[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error("LLM returned no content");
  }

  return content.trim();
}
