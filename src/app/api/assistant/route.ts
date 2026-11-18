import { NextResponse, type NextRequest } from "next/server";
import { ASSISTANT_RATE_LIMIT, ASSISTANT_RATE_WINDOW_MS, ASSISTANT_REQUEST_MAX_BYTES, assistantMessageSchema } from "@/lib/assistant/config";
import { getAssistantEngine } from "@/lib/assistant/engine";
import { getPublicAssistantSnapshot } from "@/lib/assistant/store";
import { getClientIp } from "@/lib/client-ip";
import { rateLimit } from "@/lib/rate-limit";
import { readBoundedRequestBody, RequestBodyTooLargeError } from "@/lib/request-body";
import { isSameOriginRequest } from "@/lib/request-security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// RARE Assistant public endpoint. Stateless: the message is matched in memory against the answers
// the Admin wrote and then dropped. It is never stored, logged, sent to analytics or to any third
// party, and it is not tied to a customer, session, order or visitor id. The client address is used
// only as the (hashed) rate-limit key and is not kept.

const noStore = { "cache-control": "no-store" };

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: noStore });
}

export async function POST(request: NextRequest) {
  if (!isSameOriginRequest(request)) return json({ error: "Origem inválida." }, 403);

  const limit = await rateLimit(`assistant:${getClientIp(request.headers)}`, ASSISTANT_RATE_LIMIT, ASSISTANT_RATE_WINDOW_MS);
  if (!limit.ok) return json({ error: "Muitas perguntas seguidas. Aguarde um instante." }, 429);

  if (request.headers.get("content-type")?.split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return json({ error: "Requisição inválida." }, 415);
  }

  let body: unknown;
  try {
    body = JSON.parse(new TextDecoder().decode(await readBoundedRequestBody(request, ASSISTANT_REQUEST_MAX_BYTES)));
  } catch (error) {
    return error instanceof RequestBodyTooLargeError ? json({ error: "Mensagem muito longa." }, 413) : json({ error: "Requisição inválida." }, 400);
  }

  const parsed = assistantMessageSchema.safeParse(body);
  if (!parsed.success) return json({ error: "Escreva uma pergunta de até 500 caracteres." }, 400);

  let snapshot;
  try {
    snapshot = await getPublicAssistantSnapshot();
  } catch (error) {
    // Kind only: never the message, never the request.
    console.error("[assistant] answer unavailable", error instanceof Error ? error.name : "unknown");
    return json({ error: "O assistente está indisponível agora. Tente novamente em instantes." }, 503);
  }
  if (!snapshot.config.enabled) return json({ error: "Assistente indisponível." }, 404);

  const result = getAssistantEngine().answer({ message: parsed.data, entries: snapshot.entries });
  if (result.kind === "answer") {
    return json({ matched: true, answer: result.text, category: result.category, cta: null });
  }
  return json({
    matched: false,
    answer: snapshot.config.fallbackMessage,
    category: null,
    cta: { label: snapshot.config.supportCtaLabel, href: snapshot.config.supportCtaHref },
  });
}
