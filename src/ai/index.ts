import type { Provider, ProviderSettings } from "./types";
import { AnthropicProvider } from "./providers/anthropic";
import { GeminiProvider } from "./providers/gemini";

export function createProvider(settings: ProviderSettings): Provider {
  switch (settings.provider) {
    case "gemini":
      return new GeminiProvider(settings);
    case "anthropic":
    default:
      return new AnthropicProvider(settings);
  }
}

export * from "./types";
