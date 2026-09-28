/**
 * The copilot agent: a provider-neutral streaming tool-use loop running in
 * the browser (user-supplied key, stored locally). Providers: Anthropic
 * (Claude) and Google (Gemini) - see ./providers.
 */
import { SYSTEM_PROMPT } from "./prompt";
import { toolDefinitions, type ToolExecResult } from "./tools";
import { createProvider } from "./index";
import type { ChatMessage, ContentBlock, ProviderSettings } from "./types";

export type AgentSettings = ProviderSettings;

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
  messages: ChatMessage[] = [];
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
      this.emit({ type: "error", message: "No API key configured. Open Settings (⚙), choose a provider and paste your API key." });
      return;
    }
    const provider = createProvider(settings);
    this.busy = true;
    this.controller = new AbortController();

    const userContent: ContentBlock[] = [];
    if (imageDataUrl) userContent.push({ type: "image", image: dataUrlToImage(imageDataUrl) });
    userContent.push({ type: "text", text });
    this.messages.push({ role: "user", content: userContent });
    this.emit({ type: "turn_start" });

    const usage = { input: 0, output: 0, cacheRead: 0 };

    try {
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        const result = await provider.runTurn({
          model: settings.model,
          system: SYSTEM_PROMPT,
          tools: toolDefinitions,
          messages: this.messages,
          effort: settings.effort,
          maxTokens: MAX_TOKENS,
          signal: this.controller.signal,
          onText: (delta) => this.emit({ type: "text", delta }),
        });
        usage.input += result.usage.input;
        usage.output += result.usage.output;
        usage.cacheRead += result.usage.cacheRead;
        this.messages.push(result.message);

        if (result.stop === "refusal") {
          this.emit({ type: "stopped", reason: `The model declined this request${result.stopMessage ? `: ${result.stopMessage}` : "."}` });
          break;
        }
        if (result.stop === "max_tokens") {
          this.emit({ type: "stopped", reason: "Output limit reached; ask me to continue." });
          break;
        }
        if (result.stop === "other") {
          this.emit({ type: "stopped", reason: result.stopMessage ?? "The model stopped unexpectedly." });
          break;
        }

        const toolUses = result.message.content.filter((b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use");
        if (toolUses.length === 0) break;

        const results: ContentBlock[] = [];
        for (const tu of toolUses) {
          this.emit({ type: "tool_start", id: tu.id, name: tu.name, input: tu.input });
          let r: ToolExecResult;
          try {
            r = await this.execute(tu.name, tu.input);
          } catch (e) {
            r = { text: `Tool failed: ${(e as Error).message}`, isError: true, summary: `${tu.name} failed` };
          }
          this.emit({ type: "tool_end", id: tu.id, name: tu.name, result: r });
          results.push({ type: "tool_result", toolUseId: tu.id, name: tu.name, text: r.text, images: r.images, isError: r.isError || undefined });
        }
        this.messages.push({ role: "user", content: results });
        if (round === MAX_TOOL_ROUNDS - 1) this.emit({ type: "stopped", reason: "Tool-call limit reached for this turn." });
      }
    } catch (e) {
      if (this.controller.signal.aborted) {
        this.emit({ type: "stopped", reason: "Stopped." });
        this.repairHistoryAfterAbort();
      } else {
        this.emit({ type: "error", message: provider.describeError(e) });
        this.repairHistoryAfterAbort();
      }
    } finally {
      this.compactHistory();
      this.busy = false;
      this.controller = null;
      this.emit({ type: "turn_end", usage });
    }
  }

  /** Make sure the history ends in a consistent state after an abort or error. */
  private repairHistoryAfterAbort() {
    const last = this.messages[this.messages.length - 1];
    if (!last) return;
    if (last.role === "assistant") {
      const pending = last.content.filter((b): b is Extract<ContentBlock, { type: "tool_use" }> => b.type === "tool_use");
      if (pending.length) {
        this.messages.push({
          role: "user",
          content: pending.map((b) => ({ type: "tool_result", toolUseId: b.id, name: b.name, text: "Cancelled by user.", isError: true })),
        });
      }
    } else if (last.role === "user" && this.messages.length >= 1 && last.content.every((b) => b.type === "text" || b.type === "image")) {
      // the request itself failed before any assistant turn: drop it so the user can retry cleanly
      this.messages.pop();
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
      for (const block of m.content) {
        if (block.type === "image") {
          (block as unknown as { type: string; text: string }).type = "text";
          (block as unknown as { text: string }).text = "[screenshot omitted]";
          delete (block as unknown as { image?: unknown }).image;
        } else if (block.type === "tool_result") {
          if (block.text.length > 1500) block.text = block.text.slice(0, 1200) + "\n…[older tool output truncated]";
          if (block.images?.length) {
            block.images = undefined;
            block.text += "\n[screenshot omitted]";
          }
        } else if (block.type === "tool_use" && block.name === "replace_scene") {
          const inp = block.input as { x3d?: string };
          if (inp.x3d && inp.x3d.length > 1500) {
            inp.x3d = inp.x3d.slice(0, 800) + "\n…[older scene truncated; current scene available via get_scene]";
            delete m.raw; // raw copy would still hold the full document
          }
        }
      }
    }
  }
}

function dataUrlToImage(dataUrl: string) {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  return { mimeType: m?.[1] ?? "image/png", data: m?.[2] ?? "" };
}
