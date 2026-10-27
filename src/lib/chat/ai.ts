import { knowledgeForPrompt } from "@/lib/chat/knowledge-store";
import { logger } from "@/lib/log";
import { buildChatSystemPrompt } from "@/lib/chat/prompt";

export type ChatTurn = {
  role: "visitor" | "assistant" | "staff";
  body: string;
};

export function aiEnabled() {
  return Boolean(process.env.CHAT_AI_API_KEY?.trim());
}

const handoffTool = {
  type: "function",
  function: {
    name: "handoff",
    description:
      "Передати діалог живому спеціалісту, коли відвідувач просить людину або у базі знань немає факту, уставки чи рецепта.",
    parameters: {
      type: "object",
      properties: {
        reason: { type: "string", description: "Коротка причина передачі" },
      },
      required: ["reason"],
      additionalProperties: false,
    },
  },
};

export async function completeChat(turns: ChatTurn[]) {
  const apiKey = process.env.CHAT_AI_API_KEY?.trim();
  if (!apiKey) throw new Error("CHAT_AI_API_KEY is not set");

  const base = (process.env.CHAT_AI_BASE_URL?.trim() || "https://api.openai.com/v1").replace(/\/$/, "");
  const model = process.env.CHAT_AI_MODEL?.trim() || "gpt-4o-mini";
  const history = turns
    .filter((turn) => turn.role !== "staff")
    .slice(-20)
    .map((turn) => ({
      role: turn.role === "visitor" ? "user" : "assistant",
      content: turn.body,
    }));

  const response = await fetch(`${base}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [{ role: "system", content: buildChatSystemPrompt(await knowledgeForPrompt()) }, ...history],
      tools: [handoffTool],
    }),
  });

  if (!response.ok) {
    logger.error({ msg: "chat_ai_failed", status: response.status });
    return { text: "", handoff: true };
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string | null;
        tool_calls?: Array<{ function?: { name?: string } }>;
      };
    }>;
  };
  const message = data.choices?.[0]?.message;
  const handoff = message?.tool_calls?.some((call) => call.function?.name === "handoff") ?? false;
  const text = typeof message?.content === "string" ? message.content.trim() : "";
  if (!text && !handoff) {
    logger.error({ msg: "chat_ai_empty" });
    return { text: "", handoff: true };
  }
  return { text, handoff };
}
