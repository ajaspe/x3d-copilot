/**
 * The copilot agent: a streaming tool-use loop against the Claude API,
 * running directly in the browser (user-supplied key, stored locally).
 */
import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./prompt";
import { toolDefinitions, type ToolExecResult } from "./tools";

export interface AgentSettings {
  apiKey: string;
  model: string;
  effort: "" | "low" | "medium" | "high" | "xhigh";
  baseURL?: string;
  refusalFallback: boolean;
}

export type AgentEvent =
  | { type: "turn_start" }
  | { type: "text"; delta: string }
  | { type: "tool_start"; id: string; name: string; input: Record<string, unknown> }
  | { type: "tool_end"; id: string; name: string; result: ToolExecResult }
  | { type: "turn_end"; usage: { input: number; output: number; cacheRead: number } }
  | { type: "error"; message: string }
  | { type: "stopped"; reason: string };

const MAX_TOOL_ROUNDS = 16;
const MAX_TOKENS = 32000;

export class Copilot {
  messages: Anthropic.MessageParam[] = [];
  private controller: AbortController | null = null;
  busy = false;

  constructor(
    private getSettings: () => AgentSettings,
    private execute: (name: string, input: Record<string, unknown>) => Promise<ToolExecResult>,
    private emit: (e: AgentEvent) => void,
  ) {}

  reset() {
    this.messages = [];
  }

  abort() {
    this.controller?.abort();
  }

  async send(text: string, imageDataUrl?: string): Promise<void> {
    if (this.busy) return;
    const settings = this.getSettings();
    if (!settings.apiKey) {
      this.emit({ type: "error", message: "No API key configured. Open Settings (⚙) and paste your Anthropic API key." });
      return;
    }
    this.busy = true;
    this.controller = new AbortController();
    const client = new Anthropic({
      apiKey: settings.apiKey,
      baseURL: settings.baseURL || undefined,
      dangerouslyAllowBrowser: true,
      maxRetries: 2,
    });

    const userContent: Anthropic.ContentBlockParam[] = [];
    if (imageDataUrl) {
      userContent.push({ type: "image", source: { type: "base64", media_type: "image/png", data: imageDataUrl.split(",")[1] ?? "" } });
    }
    userContent.push({ type: "text", text });
    this.messages.push({ role: "user", content: userContent });
    this.emit({ type: "turn_start" });

    const usage = { input: 0, output: 0, cacheRead: 0 };

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const params: Anthropic.MessageStreamParams = {
          model: settings.model,
          max_tokens: MAX_TOKENS,
          system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
          tools: toolDefinitions,
          messages: this.messages,
        };
        if (settings.effort) params.output_config = { effort: settings.effort };

        const stream = client.messages.stream(params, { signal: this.controller.signal });
        stream.on("text", (delta) => this.emit({ type: "text", delta }));
        const message = await stream.finalMessage();

        usage.input += message.usage.input_tokens;
        usage.output += message.usage.output_tokens;
        usage.cacheRead += message.usage.cache_read_input_tokens ?? 0;

        this.messages.push({ role: "assistant", content: message.content });

        if (message.stop_reason === "refusal") {
          this.emit({ type: "stopped", reason: `The model declined this request${message.stop_details?.explanation ? `: ${message.stop_details.explanation}` : "."}` });
          break;
        }
        if (message.stop_reason === "max_tokens") {
          this.emit({ type: "stopped", reason: "Output limit reached; ask me to continue." });
          break;
        }
        if (message.stop_reason === "pause_turn") continue;

        const toolUses = message.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
        if (toolUses.length === 0) break;

        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const tu of toolUses) {
          const input = (tu.input ?? {}) as Record<string, unknown>;
          this.emit({ type: "tool_start", id: tu.id, name: tu.name, input });
          let result: ToolExecResult;
          try {
            result = await this.execute(tu.name, input);
          } catch (e) {
            result = { content: `Tool failed: ${(e as Error).message}`, isError: true, summary: `${tu.name} failed` };
          }
          this.emit({ type: "tool_end", id: tu.id, name: tu.name, result });
          results.push({ type: "tool_result", tool_use_id: tu.id, content: result.content, is_error: result.isError || undefined });
        }
        this.messages.push({ role: "user", content: results });
        if (round === MAX_TOOL_ROUNDS - 1) {
          this.emit({ type: "stopped", reason: "Tool-call limit reached for this turn." });
        }
      }
    } catch (e) {
      if (this.controller.signal.aborted) {
        this.emit({ type: "stopped", reason: "Stopped." });
        this.repairHistoryAfterAbort();
      } else if (e instanceof Anthropic.AuthenticationError) {
        this.emit({ type: "error", message: "Authentication failed: check your API key in Settings." });
      } else if (e instanceof Anthropic.RateLimitError) {
        this.emit({ type: "error", message: "Rate limited by the API; wait a moment and try again." });
      } else if (e instanceof Anthropic.BadRequestError) {
        this.emit({ type: "error", message: `Bad request: ${e.message}` });
      } else if (e instanceof Anthropic.APIConnectionError) {
        this.emit({ type: "error", message: `Could not reach the API (${e.message}). Direct browser access requires a key from console.anthropic.com or a CORS-enabled proxy in Settings.` });
      } else if (e instanceof Anthropic.APIError) {
        this.emit({ type: "error", message: `API error ${e.status ?? ""}: ${e.message}` });
      } else {
        this.emit({ type: "error", message: (e as Error).message });
      }
    } finally {
      this.compactHistory();
      this.busy = false;
      this.controller = null;
      this.emit({ type: "turn_end", usage });
    }
  }

  /** If aborted mid tool-loop, make sure the history ends in a consistent state. */
  private repairHistoryAfterAbort() {
    const last = this.messages[this.messages.length - 1];
    if (!last) return;
    if (last.role === "assistant" && Array.isArray(last.content) && last.content.some((b) => b.type === "tool_use")) {
      // answer dangling tool_use blocks so the next request is valid
      const results: Anthropic.ToolResultBlockParam[] = last.content
        .filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use")
        .map((b) => ({ type: "tool_result", tool_use_id: b.id, content: "Cancelled by user.", is_error: true }));
      this.messages.push({ role: "user", content: results });
    }
  }

  /**
   * Keep the context lean: old tool results holding whole scenes or images
   * are summarised once the turn is over (the scene is always re-readable).
   */
  private compactHistory() {
    const keepFrom = Math.max(0, this.messages.length - 6);
    for (let i = 0; i < keepFrom; i++) {
      const m = this.messages[i];
      if (m.role !== "user" || !Array.isArray(m.content)) continue;
      for (const block of m.content) {
        if (block.type === "image") {
          (block as unknown as { type: string; text?: string }).type = "text";
          (block as unknown as { text: string }).text = "[screenshot omitted]";
          delete (block as unknown as { source?: unknown }).source;
        }
        if (block.type === "tool_result" && block.content) {
          if (typeof block.content === "string") {
            if (block.content.length > 1500) block.content = block.content.slice(0, 1200) + "\n…[older tool output truncated]";
          } else if (Array.isArray(block.content)) {
            block.content = block.content.map((c) => (c.type === "image" ? { type: "text", text: "[screenshot omitted]" } : c));
          }
        }
      }
    }
    // tool_use inputs with a full document are also large
    for (let i = 0; i < keepFrom; i++) {
      const m = this.messages[i];
      if (m.role !== "assistant" || !Array.isArray(m.content)) continue;
      for (const block of m.content) {
        if (block.type === "tool_use" && block.name === "replace_scene") {
          const inp = block.input as { x3d?: string };
          if (inp.x3d && inp.x3d.length > 1500) inp.x3d = inp.x3d.slice(0, 800) + "\n…[older scene truncated; current scene available via get_scene]";
        }
      }
    }
  }
}
