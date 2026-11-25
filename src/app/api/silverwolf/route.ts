import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { SILVER_WOLF_SYSTEM } from "@/lib/companion/persona";

/**
 * Silver Wolf chat through the Claude API.
 * - The API key stays on this local server (ANTHROPIC_API_KEY in .env.local); the browser never sees it.
 * - The browser sends only the conversation and a compact facts block (no UID, no profile name).
 * - Replies stream back as plain text; one line = one chat bubble.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL = process.env.SILVER_WOLF_MODEL || "claude-opus-5-5";

const RELATION_TEXT = { "little-sister": "the user's little sister", "big-sister": "the user's big sister", daughter: "the user's daughter" } as const;

const Body = z.object({
  context: z.string().max(16000),
  persona: z.object({ relationship: z.enum(["little-sister", "big-sister", "daughter"]), callsYou: z.string().max(24) }).optional(),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().min(1).max(2000) })).min(1).max(24),
});

export function GET() {
  const configured = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
  return Response.json({ configured, model: MODEL });
}

export async function POST(req: Request) {
  if (!process.env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_AUTH_TOKEN)
    return Response.json({ error: "Claude isn't configured. Add ANTHROPIC_API_KEY to .env.local and restart the app." }, { status: 503 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Invalid chat request." }, { status: 400 });
  const { context, messages, persona } = parsed.data;
  const name = persona?.callsYou.replace(/[<>\n]/g, "").trim() || "Trailblazer";
  const relationship = `<relationship>You are ${RELATION_TEXT[persona?.relationship ?? "little-sister"]}. You call them "${name}".</relationship>`;
  if (messages[messages.length - 1].role !== "user") return Response.json({ error: "Last message must be from the user." }, { status: 400 });

  // History first, then the fresh facts with the newest question (keeps the cached prefix stable).
  const history: Anthropic.Beta.BetaMessageParam[] = messages.slice(0, -1).map((m) => ({ role: m.role, content: m.text }));
  const last = messages[messages.length - 1].text;
  const apiMessages: Anthropic.Beta.BetaMessageParam[] = [
    ...history,
    { role: "user", content: `${relationship}\n<account_data>\n${context}\n</account_data>\n\n${last}` },
  ];

  const client = new Anthropic();
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const stream = client.beta.messages.stream({
          model: MODEL,
          max_tokens: 4096,
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
          output_config: { effort: "low" },
          system: [{ type: "text", text: SILVER_WOLF_SYSTEM, cache_control: { type: "ephemeral" } }],
          messages: apiMessages,
        });
        for await (const event of stream) {
          if (event.type === "content_block_delta" && event.delta.type === "text_delta") controller.enqueue(encoder.encode(event.delta.text));
        }
        const final = await stream.finalMessage();
        if (final.stop_reason === "refusal") controller.enqueue(encoder.encode("\n[[refusal]]"));
        else if (final.stop_reason === "max_tokens") controller.enqueue(encoder.encode("\n[[truncated]]"));
      } catch (e) {
        let msg = "Something broke talking to Claude.";
        if (e instanceof Anthropic.AuthenticationError) msg = "Claude rejected the API key. Check ANTHROPIC_API_KEY.";
        else if (e instanceof Anthropic.RateLimitError) msg = "Rate limited by the Claude API. Try again in a bit.";
        else if (e instanceof Anthropic.APIConnectionError) msg = "Couldn't reach the Claude API (network).";
        else if (e instanceof Anthropic.APIError) msg = `Claude API error ${e.status ?? ""}.`.trim();
        controller.enqueue(encoder.encode(`\n[[error]] ${msg}`));
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, { headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" } });
}
