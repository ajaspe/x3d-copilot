import Anthropic from "@anthropic-ai/sdk";
import type { ChatMessage, ContentBlock, ModelInfo, Provider, ProviderSettings, StopKind, TurnRequest, TurnResult } from "../types";

export class AnthropicProvider implements Provider {
  readonly id = "anthropic" as const;
  private client: Anthropic;

  constructor(settings: ProviderSettings) {
    this.client = new Anthropic({
      apiKey: settings.apiKey,
      baseURL: settings.baseURL || undefined,
      dangerouslyAllowBrowser: true,
      maxRetries: 2,
    });
  }

  async runTurn(req: TurnRequest): Promise<TurnResult> {
    const params: Anthropic.MessageStreamParams = {
      model: req.model,
      max_tokens: req.maxTokens,
      system: [{ type: "text", text: req.system, cache_control: { type: "ephemeral" } }],
      tools: req.tools.map((t) => ({ name: t.name, description: t.description, input_schema: t.inputSchema as Anthropic.Tool.InputSchema })),
      messages: req.messages.map(toAnthropicMessage),
    };
    if (req.effort) params.output_config = { effort: req.effort };

    const stream = this.client.messages.stream(params, { signal: req.signal });
    stream.on("text", (delta) => req.onText(delta));
    const message = await stream.finalMessage();

    const blocks: ContentBlock[] = [];
    for (const b of message.content) {
      if (b.type === "text") blocks.push({ type: "text", text: b.text });
      else if (b.type === "tool_use") blocks.push({ type: "tool_use", id: b.id, name: b.name, input: (b.input ?? {}) as Record<string, unknown> });
    }
    let stop: StopKind = "end";
    let stopMessage: string | undefined;
    switch (message.stop_reason) {
      case "tool_use": stop = "tool_use"; break;
      case "max_tokens": stop = "max_tokens"; break;
      case "refusal": stop = "refusal"; stopMessage = message.stop_details?.explanation ?? undefined; break;
      case "end_turn": case "stop_sequence": case null: stop = "end"; break;
      default: stop = "other";
    }
    return {
      message: { role: "assistant", content: blocks, raw: { provider: "anthropic", value: message.content } },
      stop,
      stopMessage,
      usage: {
        input: message.usage.input_tokens,
        output: message.usage.output_tokens,
        cacheRead: message.usage.cache_read_input_tokens ?? 0,
      },
    };
  }

  async listModels(): Promise<ModelInfo[]> {
    const out: ModelInfo[] = [];
    for await (const m of this.client.models.list({ limit: 100 })) out.push({ id: m.id, label: m.display_name });
    return out;
  }

  describeError(e: unknown): string {
    if (e instanceof Anthropic.AuthenticationError) return "Authentication failed: check your Anthropic API key in Settings.";
    if (e instanceof Anthropic.RateLimitError) return "Rate limited by the Anthropic API; wait a moment and try again.";
    if (e instanceof Anthropic.NotFoundError) return `Model not found: ${e.message}. Pick another model in Settings (use “Fetch models”).`;
    if (e instanceof Anthropic.BadRequestError) return `Bad request: ${e.message}`;
    if (e instanceof Anthropic.APIConnectionError) return `Could not reach api.anthropic.com (${e.message}).`;
    if (e instanceof Anthropic.APIError) return `Anthropic API error ${e.status ?? ""}: ${e.message}`;
    return (e as Error).message;
  }
}

function toAnthropicMessage(m: ChatMessage): Anthropic.MessageParam {
  if (m.role === "assistant" && m.raw?.provider === "anthropic") {
    return { role: "assistant", content: m.raw.value as Anthropic.ContentBlockParam[] };
  }
  const content: Anthropic.ContentBlockParam[] = [];
  for (const b of m.content) {
    switch (b.type) {
      case "text":
        content.push({ type: "text", text: b.text });
        break;
      case "image":
        content.push({ type: "image", source: { type: "base64", media_type: b.image.mimeType as "image/png", data: b.image.data } });
        break;
      case "tool_use":
        content.push({ type: "tool_use", id: b.id, name: b.name, input: b.input });
        break;
      case "tool_result": {
        const parts: Array<Anthropic.TextBlockParam | Anthropic.ImageBlockParam> = [];
        for (const img of b.images ?? []) parts.push({ type: "image", source: { type: "base64", media_type: img.mimeType as "image/png", data: img.data } });
        parts.push({ type: "text", text: b.text });
        content.push({ type: "tool_result", tool_use_id: b.toolUseId, content: parts, is_error: b.isError || undefined });
        break;
      }
    }
  }
  return { role: m.role, content };
}
