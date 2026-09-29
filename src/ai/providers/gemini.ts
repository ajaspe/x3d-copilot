import { GoogleGenAI, ApiError, FinishReason, ThinkingLevel, type Content, type Part, type FunctionDeclaration, type GenerateContentConfig } from "@google/genai";
import type { ChatMessage, ContentBlock, ModelInfo, Provider, ProviderSettings, StopKind, TurnRequest, TurnResult } from "../types";

let callCounter = 0;

export class GeminiProvider implements Provider {
  readonly id = "gemini" as const;
  private ai: GoogleGenAI;

  constructor(settings: ProviderSettings) {
    this.ai = new GoogleGenAI({
      apiKey: settings.apiKey,
      httpOptions: settings.baseURL ? { baseUrl: settings.baseURL } : undefined,
    });
  }

  async runTurn(req: TurnRequest): Promise<TurnResult> {
    const config: GenerateContentConfig = {
      systemInstruction: req.system,
      tools: [{ functionDeclarations: req.tools.map(toFunctionDeclaration) }],
      maxOutputTokens: req.maxTokens,
      abortSignal: req.signal,
    };
    // Gemini 3+ exposes thinking levels; 2.x uses budgets (left at the model default).
    if (req.effort && !/^gemini-2\./.test(req.model)) {
      config.thinkingConfig = { thinkingLevel: req.effort === "low" ? ThinkingLevel.LOW : req.effort === "medium" ? ThinkingLevel.MEDIUM : ThinkingLevel.HIGH };
    }

    const stream = await this.ai.models.generateContentStream({
      model: req.model,
      contents: req.messages.map(toGeminiContent),
      config,
    });

    const parts: Part[] = [];
    let finish: FinishReason | undefined;
    let finishMessage: string | undefined;
    let usage = { input: 0, output: 0, cacheRead: 0 };
    let blockedReason: string | undefined;

    for await (const chunk of stream) {
      const cand = chunk.candidates?.[0];
      if (chunk.promptFeedback?.blockReason) blockedReason = String(chunk.promptFeedback.blockReason);
      for (const p of cand?.content?.parts ?? []) {
        if (p.thought) continue; // summaries of reasoning; not replayed
        if (p.text !== undefined && !p.functionCall && !p.thoughtSignature) {
          req.onText(p.text);
          const last = parts[parts.length - 1];
          if (last && last.text !== undefined && !last.functionCall && !last.thoughtSignature) last.text += p.text;
          else parts.push({ text: p.text });
        } else {
          if (p.text) req.onText(p.text);
          parts.push(p);
        }
      }
      if (cand?.finishReason) finish = cand.finishReason;
      if (cand?.finishMessage) finishMessage = cand.finishMessage;
      if (chunk.usageMetadata) {
        usage = {
          input: chunk.usageMetadata.promptTokenCount ?? usage.input,
          output: (chunk.usageMetadata.candidatesTokenCount ?? 0) + (chunk.usageMetadata.thoughtsTokenCount ?? 0),
          cacheRead: chunk.usageMetadata.cachedContentTokenCount ?? 0,
        };
      }
    }

    const blocks: ContentBlock[] = [];
    for (const p of parts) {
      if (p.functionCall) {
        if (!p.functionCall.id) p.functionCall.id = `call_${Date.now().toString(36)}_${++callCounter}`;
        blocks.push({ type: "tool_use", id: p.functionCall.id, name: p.functionCall.name ?? "", input: (p.functionCall.args ?? {}) as Record<string, unknown> });
      } else if (p.text) {
        blocks.push({ type: "text", text: p.text });
      }
    }

    let stop: StopKind = blocks.some((b) => b.type === "tool_use") ? "tool_use" : "end";
    let stopMessage: string | undefined;
    if (blockedReason) {
      stop = "refusal";
      stopMessage = `Prompt blocked (${blockedReason}).`;
    } else if (finish === FinishReason.MAX_TOKENS) {
      stop = "max_tokens";
    } else if (finish && [FinishReason.SAFETY, FinishReason.PROHIBITED_CONTENT, FinishReason.BLOCKLIST, FinishReason.RECITATION].includes(finish)) {
      stop = "refusal";
      stopMessage = finishMessage ?? `Response stopped by Gemini (${finish}).`;
    } else if (finish && finish !== FinishReason.STOP && finish !== FinishReason.FINISH_REASON_UNSPECIFIED && stop !== "tool_use") {
      stop = "other";
      stopMessage = finishMessage ?? `Response stopped (${finish}).`;
    }

    return {
      message: { role: "assistant", content: blocks, raw: { provider: "gemini", value: parts } },
      stop,
      stopMessage,
      usage,
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    const out: ModelInfo[] = [];
    const pager = await this.ai.models.list({ config: { pageSize: 200 } });
    for await (const m of pager) {
      const id = (m.name ?? "").replace(/^models\//, "");
      if (!id.startsWith("gemini-")) continue;
      if (m.supportedActions && !m.supportedActions.includes("generateContent")) continue;
      if (/(image|tts|live|transcribe|embedding|robotics|computer-use|native-audio|translate)/.test(id)) continue;
      out.push({ id, label: m.displayName ? `${m.displayName} (${id})` : id });
    }
    out.sort((a, b) => b.id.localeCompare(a.id));
    return out;
  }

  describeError(e: unknown): string {
    if (e instanceof ApiError) {
      if (e.status === 400 && /API key/i.test(e.message)) return "Authentication failed: check your Gemini API key in Settings.";
      if (e.status === 401 || e.status === 403) return `Gemini rejected the key or the request (${e.status}): ${shorten(e.message)}`;
      if (e.status === 404) return `Model not found: ${shorten(e.message)}. Pick another model in Settings (use “Fetch models”).`;
      if (e.status === 402) return "Gemini billing: the prepaid credits for this API key are depleted. Top up the project in Google AI Studio (aistudio.google.com → your project → billing) or use another key.";
      if (e.status === 429) return "Rate limited by the Gemini API (quota); wait a moment and try again.";
      return `Gemini API error ${e.status}: ${shorten(e.message)}`;
    }
    const msg = (e as Error)?.message ?? String(e);
    if (/Failed to fetch|NetworkError/i.test(msg)) return "Could not reach generativelanguage.googleapis.com (network or CORS).";
    return msg;
  }
}

function shorten(s: string): string {
  // Gemini error messages are often JSON blobs; pull the human message if possible
  try {
    const j = JSON.parse(s);
    return j?.error?.message ?? s;
  } catch {
    return s.length > 300 ? s.slice(0, 300) + "…" : s;
  }
}

function toFunctionDeclaration(t: { name: string; description: string; inputSchema: Record<string, unknown> }): FunctionDeclaration {
  const props = t.inputSchema.properties as Record<string, unknown> | undefined;
  const decl: FunctionDeclaration = { name: t.name, description: t.description };
  if (props && Object.keys(props).length) decl.parametersJsonSchema = t.inputSchema;
  return decl;
}

export function toGeminiContent(m: ChatMessage): Content {
  if (m.role === "assistant" && m.raw?.provider === "gemini") {
    return { role: "model", parts: m.raw.value as Part[] };
  }
  const parts: Part[] = [];
  for (const b of m.content) {
    switch (b.type) {
      case "text":
        parts.push({ text: b.text });
        break;
      case "image":
        parts.push({ inlineData: { mimeType: b.image.mimeType, data: b.image.data } });
        break;
      case "tool_use":
        parts.push({ functionCall: { id: b.id.startsWith("call_") ? undefined : b.id, name: b.name, args: b.input } });
        break;
      case "tool_result":
        parts.push({
          functionResponse: {
            id: b.toolUseId.startsWith("call_") ? undefined : b.toolUseId,
            name: b.name,
            response: b.isError ? { error: b.text } : { result: b.text },
            parts: b.images?.length ? b.images.map((img) => ({ inlineData: { mimeType: img.mimeType, data: img.data } })) : undefined,
          },
        });
        break;
    }
  }
  return { role: m.role === "assistant" ? "model" : "user", parts };
}
