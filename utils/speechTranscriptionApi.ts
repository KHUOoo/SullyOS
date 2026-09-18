import type { APIConfig, SpeechToTextApiConfig } from '../types';
import { safeFetchJson } from './safeApi';

export const resolveSpeechToTextConfig = (apiConfig: Pick<APIConfig, 'sttApi'>): SpeechToTextApiConfig => ({
  enabled: apiConfig.sttApi?.enabled === true,
  baseUrl: String(apiConfig.sttApi?.baseUrl || '').trim().replace(/\/+$/, ''),
  apiKey: String(apiConfig.sttApi?.apiKey || '').trim(),
  model: String(apiConfig.sttApi?.model || 'whisper-1').trim(),
  language: String(apiConfig.sttApi?.language || 'zh').trim(),
});

export const isSpeechToTextReady = (apiConfig: Pick<APIConfig, 'sttApi'>): boolean => {
  const config = resolveSpeechToTextConfig(apiConfig);
  return config.enabled && !!config.baseUrl && !!config.apiKey && !!config.model;
};

export async function transcribeSpeechBlob(blob: Blob, apiConfig: Pick<APIConfig, 'sttApi'>): Promise<string> {
  const config = resolveSpeechToTextConfig(apiConfig);
  if (!isSpeechToTextReady(apiConfig)) throw new Error('请先到设置 → STT 语音转文字完成配置');
  if (!blob.size) throw new Error('没有录到有效语音');

  const endpoint = /\/audio\/transcriptions$/i.test(config.baseUrl)
    ? config.baseUrl
    : `${config.baseUrl}/audio/transcriptions`;
  const extension = blob.type.includes('ogg') ? 'ogg' : blob.type.includes('mp4') ? 'm4a' : 'webm';
  const form = new FormData();
  form.append('file', new File([blob], `voice-${Date.now()}.${extension}`, { type: blob.type || 'audio/webm' }));
  form.append('model', config.model);
  form.append('response_format', 'json');
  if (config.language) form.append('language', config.language);

  const data = await safeFetchJson(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.apiKey}` },
    body: form,
  }, 0, 120_000, { appId: 'chat', appName: '聊天', purpose: 'STT 语音转文字' });
  const text = String(data?.text || data?.transcript || data?.result?.text || '').trim();
  if (!text) throw new Error('STT 没有返回可用的转写文字');
  return text;
}
