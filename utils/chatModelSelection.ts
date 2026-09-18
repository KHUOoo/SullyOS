import type { APIConfig, ApiPreset, ChatModelOverride } from '../types';
import { configFromPreset, findActivePresetId } from './apiPresetSwitch';
import { normalizeApiBaseUrl, normalizeApiCredential, normalizeApiModel } from './apiConfigNormalize';

export interface ChatModelChoice {
  id: string;
  override: ChatModelOverride | null;
  label: string;
  model: string;
  configured: boolean;
  isDefault: boolean;
}

export const isChatApiConfigured = (
  config: Pick<APIConfig, 'baseUrl' | 'apiKey' | 'model'>,
): boolean => Boolean(
  normalizeApiBaseUrl(config.baseUrl)
  && normalizeApiCredential(config.apiKey)
  && normalizeApiModel(config.model),
);

const validPreset = (presets: ApiPreset[], presetId?: string): ApiPreset | null => {
  if (!presetId) return null;
  const preset = presets.find(item => item.id === presetId);
  return preset && isChatApiConfigured(preset.config) ? preset : null;
};

/** 会话只保存预设引用或模型名；来源失效/配置不完整时安全回退到全局默认。 */
export function resolveChatReplyApi(
  defaultConfig: APIConfig,
  presets: ApiPreset[],
  override?: ChatModelOverride,
): APIConfig | undefined {
  if (override?.type === 'preset') {
    const preset = validPreset(presets, override.presetId);
    return preset ? { ...defaultConfig, ...configFromPreset(preset) } : undefined;
  }
  if (override?.type === 'model') {
    const model = normalizeApiModel(override.model);
    const candidate = { ...defaultConfig, model };
    return model && isChatApiConfigured(candidate) ? candidate : undefined;
  }
  return undefined;
}

export function getChatModelDisplayName(
  defaultConfig: APIConfig,
  presets: ApiPreset[],
  override?: ChatModelOverride,
): string {
  if (override?.type === 'preset') {
    const preset = validPreset(presets, override.presetId);
    if (preset) return preset.name || preset.config.model || '未命名模型';
  }
  if (override?.type === 'model') {
    const model = normalizeApiModel(override.model);
    if (model && isChatApiConfigured({ ...defaultConfig, model })) return model;
  }

  const defaultPresetId = findActivePresetId(presets, defaultConfig);
  const defaultPreset = defaultPresetId ? presets.find(item => item.id === defaultPresetId) : null;
  return defaultPreset?.name || normalizeApiModel(defaultConfig.model) || '未配置模型';
}

export function buildChatModelChoices(
  defaultConfig: APIConfig,
  presets: ApiPreset[],
  availableModels: string[] = [],
): ChatModelChoice[] {
  const defaultName = getChatModelDisplayName(defaultConfig, presets);
  const currentModel = normalizeApiModel(defaultConfig.model);
  const listedModels = Array.from(new Set(availableModels.map(normalizeApiModel).filter(Boolean)))
    .filter(model => model !== currentModel);
  return [
    {
      id: 'default',
      override: null,
      label: `跟随默认 · ${defaultName}`,
      model: normalizeApiModel(defaultConfig.model),
      configured: isChatApiConfigured(defaultConfig),
      isDefault: true,
    },
    ...presets.map(preset => ({
      id: `preset:${preset.id}`,
      override: { type: 'preset' as const, presetId: preset.id },
      label: preset.name || preset.config.model || '未命名预设',
      model: normalizeApiModel(preset.config.model),
      configured: isChatApiConfigured(preset.config),
      isDefault: false,
    })),
    ...listedModels.map(model => ({
      id: `model:${model}`,
      override: { type: 'model' as const, model },
      label: model,
      model,
      configured: isChatApiConfigured({ ...defaultConfig, model }),
      isDefault: false,
    })),
  ];
}

/** 当前真正生效的选项；无效覆盖会按默认项高亮。 */
export function getActiveChatModelChoiceId(
  defaultConfig: APIConfig,
  presets: ApiPreset[],
  override?: ChatModelOverride,
): string {
  if (override?.type === 'preset' && validPreset(presets, override.presetId)) {
    return `preset:${override.presetId}`;
  }
  if (override?.type === 'model') {
    const model = normalizeApiModel(override.model);
    if (model && isChatApiConfigured({ ...defaultConfig, model })) return `model:${model}`;
  }
  return 'default';
}
