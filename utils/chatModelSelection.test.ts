import { describe, expect, it } from 'vitest';
import type { APIConfig, ApiPreset } from '../types';
import {
  buildChatModelChoices,
  getActiveChatModelChoiceId,
  getChatModelDisplayName,
  isChatApiConfigured,
  resolveChatReplyApi,
} from './chatModelSelection';

const defaultConfig: APIConfig = {
  baseUrl: 'https://default.example/v1',
  apiKey: 'sk-default',
  model: 'gpt-default',
  stream: true,
  temperature: 0.4,
};

const presets: ApiPreset[] = [
  {
    id: 'claude',
    name: 'Claude',
    config: {
      baseUrl: 'https://claude.example/v1/',
      apiKey: 'sk-claude',
      model: 'claude-sonnet',
      temperature: 0.7,
    },
  },
  {
    id: 'broken',
    name: '未完成',
    config: { baseUrl: 'https://broken.example/v1', apiKey: '', model: 'broken-model' },
  },
];

describe('chat model selection', () => {
  it('resolves a preset without copying credentials into the conversation override', () => {
    const override = { type: 'preset' as const, presetId: 'claude' };
    expect(override).toEqual({ type: 'preset', presetId: 'claude' });
    expect(resolveChatReplyApi(defaultConfig, presets, override)).toMatchObject({
      baseUrl: 'https://claude.example/v1',
      apiKey: 'sk-claude',
      model: 'claude-sonnet',
      stream: true,
      temperature: 0.7,
    });
    expect(getChatModelDisplayName(defaultConfig, presets, override)).toBe('Claude');
    expect(getActiveChatModelChoiceId(defaultConfig, presets, override)).toBe('preset:claude');
  });

  it('reuses the default provider for a model-list choice', () => {
    const override = { type: 'model' as const, model: 'deepseek-r1' };
    expect(resolveChatReplyApi(defaultConfig, presets, override)).toMatchObject({
      baseUrl: defaultConfig.baseUrl,
      apiKey: defaultConfig.apiKey,
      model: 'deepseek-r1',
    });
    expect(getChatModelDisplayName(defaultConfig, presets, override)).toBe('deepseek-r1');
    expect(getActiveChatModelChoiceId(defaultConfig, presets, override)).toBe('model:deepseek-r1');
  });

  it('falls back to the global default when a saved choice is missing or incomplete', () => {
    expect(resolveChatReplyApi(defaultConfig, presets, { type: 'preset', presetId: 'missing' })).toBeUndefined();
    expect(resolveChatReplyApi(defaultConfig, presets, { type: 'preset', presetId: 'broken' })).toBeUndefined();
    expect(getChatModelDisplayName(defaultConfig, presets, { type: 'preset', presetId: 'broken' })).toBe('gpt-default');
    expect(getActiveChatModelChoiceId(defaultConfig, presets, { type: 'preset', presetId: 'broken' })).toBe('default');
  });

  it('builds default, preset, and fetched-model choices while marking incomplete entries', () => {
    const choices = buildChatModelChoices(defaultConfig, presets, ['gpt-default', 'deepseek-r1', 'deepseek-r1', '']);
    expect(choices.map(choice => choice.id)).toEqual([
      'default',
      'preset:claude',
      'preset:broken',
      'model:deepseek-r1',
    ]);
    expect(choices.find(choice => choice.id === 'preset:broken')?.configured).toBe(false);
    expect(choices.find(choice => choice.id === 'model:deepseek-r1')?.configured).toBe(true);
  });

  it('requires URL, key, and model before a choice can be used', () => {
    expect(isChatApiConfigured(defaultConfig)).toBe(true);
    expect(isChatApiConfigured({ ...defaultConfig, apiKey: '  ' })).toBe(false);
    expect(isChatApiConfigured({ ...defaultConfig, model: '' })).toBe(false);
  });
});
