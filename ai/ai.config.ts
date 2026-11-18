import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { getApiKeyCredentials } from "../storage/repository";


interface AgentModelSettings {
  model_id?: string;
  api_key_ids?: string[];
}

interface ModelApiKey { secret: string; label: string }

function fallbackFetch(apiKeys: ModelApiKey[], onFallback?: (from: string, to: string, status: number) => void): typeof fetch {
  return (async (input, init) => {
    const original = new Request(input, init);
    let lastError: unknown;
    for (let index = 0; index < apiKeys.length; index++) {
      const attempt = original.clone();
      attempt.headers.set("Authorization", `Bearer ${apiKeys[index]!.secret}`);
      try {
        const response = await fetch(attempt);
        if (![401, 402, 403, 429].includes(response.status) || index === apiKeys.length - 1) return response;
        try { onFallback?.(apiKeys[index]!.label, apiKeys[index + 1]!.label, response.status); } catch { /* logging must not break the request */ }
        await response.body?.cancel();
      } catch (error) {
        lastError = error;
        if (index === apiKeys.length - 1) throw error;
      }
    }
    throw lastError instanceof Error ? lastError : new Error("No OpenRouter API key could complete the request.");
  }) as typeof fetch;
}

export function getAgentModel(
  settings?: AgentModelSettings,
  onFallback?: (from: string, to: string, status: number) => void,
) {
  const savedKeys = getApiKeyCredentials(settings?.api_key_ids)
    .map((key) => ({ secret: key.secret, label: key.label }));
  const apiKeys = [...savedKeys];
  const environmentKey = process.env.OPENROUTER_API_KEY?.trim();
  if (environmentKey && !apiKeys.some((key) => key.secret === environmentKey)) {
    apiKeys.push({ secret: environmentKey, label: ".env OpenRouter key" });
  }
  if (apiKeys.length === 0) {
    throw new Error("No OpenRouter API key is configured. Add a key in Agent settings or set OPENROUTER_API_KEY.");
  }

  const provider = createOpenRouter({
    apiKey: apiKeys[0]!.secret,
    fetch: fallbackFetch(apiKeys, onFallback),
  });
  const modelId = settings?.model_id || process.env.OPENROUTER_DEFAULT_MODEL || "openrouter/free";
  return provider(modelId);
}

