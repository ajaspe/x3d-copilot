/**
 * Provider-neutral chat types. The agent loop works only with these; the
 * Anthropic and Gemini adapters translate to/from their SDK shapes.
 */
export interface ImageData {
  mimeType: string;
  /** base64, no data: prefix */
  data: string;
}

export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; image: ImageData }
  | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_result"; toolUseId: string; name: string; text: string; images?: ImageData[]; isError?: boolean };

export interface ChatMessage {
  role: "user" | "assistant";
  content: ContentBlock[];
  /**
   * Provider-specific verbatim representation of an assistant turn (keeps
   * thinking blocks / thought signatures intact when replaying history to the
   * same provider). Ignored by other providers.
   */
  raw?: { provider: ProviderId; value: unknown };
}

export interface ToolDefinition {
  name: string;
  description: string;
  /** JSON Schema (draft-07 subset) describing the input object */
  inputSchema: Record<string, unknown>;
}

export type ProviderId = "anthropic" | "gemini";

export type Effort = "" | "low" | "medium" | "high" | "xhigh";

export interface TurnRequest {
  model: string;
  system: string;
  tools: ToolDefinition[];
  messages: ChatMessage[];
  effort: Effort;
  maxTokens: number;
  signal: AbortSignal;
  onText: (delta: string) => void;
}

export type StopKind = "end" | "tool_use" | "max_tokens" | "refusal" | "other";

export interface TurnResult {
  /** The assistant message to append to history (text + tool_use blocks). */
  message: ChatMessage;
  stop: StopKind;
  stopMessage?: string;
  usage: { input: number; output: number; cacheRead: number };
}

export interface ModelInfo {
  id: string;
  label: string;
}

export interface Provider {
  readonly id: ProviderId;
  runTurn(req: TurnRequest): Promise<TurnResult>;
  listModels(): Promise<ModelInfo[]>;
  /** Map an SDK error to a short, user-facing message. */
  describeError(e: unknown): string;
}

export interface ProviderSettings {
  provider: ProviderId;
  apiKey: string;
  model: string;
  effort: Effort;
  baseURL?: string;
}

/** Sensible defaults per provider (the settings dialog can fetch the live list). */
export const DEFAULT_MODELS: Record<ProviderId, ModelInfo[]> = {
  anthropic: [
    { id: "claude-opus-5", label: "Claude Opus 5 (default)" },
    { id: "claude-sonnet-5", label: "Claude Sonnet 5 (faster, cheaper)" },
    { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 (fastest)" },
  ],
  gemini: [
    { id: "gemini-3.8-flash", label: "Gemini 3.8 Flash (default, agentic)" },
    { id: "gemini-3.1-pro-preview", label: "Gemini 3.1 Pro (preview)" },
    { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
    { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  ],
};

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  anthropic: "Anthropic (Claude)",
  gemini: "Google (Gemini)",
};

export const PROVIDER_KEY_HELP: Record<ProviderId, { placeholder: string; url: string; host: string }> = {
  anthropic: { placeholder: "sk-ant-…", url: "https://console.anthropic.com/settings/keys", host: "api.anthropic.com" },
  gemini: { placeholder: "AIza…", url: "https://aistudio.google.com/apikey", host: "generativelanguage.googleapis.com" },
};
