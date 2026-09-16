import type { APIConfig, ApiPreset } from '../types';

// Clipboard contents can carry zero-width characters that String.trim() does not
// remove. They are never valid at the edges of an API URL, token, or model id.
const EDGE_INVISIBLE_CHARS = /^[\s\u200B-\u200D\u2060\uFEFF]+|[\s\u200B-\u200D\u2060\uFEFF]+$/g;

const cleanEdgeCharacters = (value: unknown): string =>
  String(value ?? '').replace(EDGE_INVISIBLE_CHARS, '');

export const normalizeApiBaseUrl = (value: unknown): string =>
  cleanEdgeCharacters(value).replace(/\/+$/, '');

export const normalizeApiCredential = (value: unknown): string =>
  cleanEdgeCharacters(value);

export const normalizeApiModel = (value: unknown): string =>
  cleanEdgeCharacters(value);

export function normalizeApiConfig(config: APIConfig): APIConfig {
  const visionApi = config.visionApi;
  const imageGenApi = config.imageGenApi;
  return {
    ...config,
    baseUrl: normalizeApiBaseUrl(config.baseUrl),
    apiKey: normalizeApiCredential(config.apiKey),
    model: normalizeApiModel(config.model),
    ...(visionApi ? {
      visionApi: {
        enabled: visionApi.enabled === true,
        baseUrl: normalizeApiBaseUrl(visionApi.baseUrl),
        apiKey: normalizeApiCredential(visionApi.apiKey),
        model: normalizeApiModel(visionApi.model),
      },
    } : {}),
    ...(imageGenApi ? {
      imageGenApi: {
        ...imageGenApi,
        enabled: imageGenApi.enabled === true,
        baseUrl: normalizeApiBaseUrl(imageGenApi.baseUrl),
        apiKey: normalizeApiCredential(imageGenApi.apiKey),
        model: normalizeApiModel(imageGenApi.model),
        count: Math.max(1, Math.min(4, Math.round(Number(imageGenApi.count) || 1))),
        timeoutMs: Math.max(10_000, Math.min(600_000, Math.round(Number(imageGenApi.timeoutMs) || 120_000))),
        similarity: Math.max(0, Math.min(1, Number(imageGenApi.similarity) || 0)),
        referenceImage: String(imageGenApi.referenceImage || '').trim(),
        useRecentChatImages: imageGenApi.useRecentChatImages === true,
      },
    } : {}),
  };
}

export function normalizeApiPreset(preset: ApiPreset): ApiPreset {
  return {
    ...preset,
    name: String(preset.name ?? '').trim(),
    config: normalizeApiConfig(preset.config),
  };
}
