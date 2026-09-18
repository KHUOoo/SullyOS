import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(fileURLToPath(new URL(path, import.meta.url)), 'utf8');

describe('chat model override wiring', () => {
  it('passes the session choice into ordinary chat generation', () => {
    const chat = read('../apps/Chat.tsx');
    const hook = read('../hooks/useChatAI.ts');
    expect(chat).toContain('replyApiConfig: chatReplyApiConfig');
    expect(hook).toContain('const effectiveApi = overrideApiConfig || replyApiConfig || apiConfig;');
    expect(hook).toContain('model: effectiveApi.model');
  });

  it('keeps image, vision, emotion, and memory fallbacks on their original configs', () => {
    const chat = read('../apps/Chat.tsx');
    const hook = read('../hooks/useChatAI.ts');
    expect(chat).toContain('const imageConfig = apiConfig.imageGenApi;');
    expect(hook).toContain('visionApiConfig: apiConfig.visionApi');
    expect(hook).toContain('{ baseUrl: apiConfig.baseUrl, apiKey: apiConfig.apiKey, model: apiConfig.model, stream: evalStream }');
    expect(hook).toContain('{ baseUrl: apiConfig.baseUrl, apiKey: apiConfig.apiKey, model: apiConfig.model };');
  });
});
