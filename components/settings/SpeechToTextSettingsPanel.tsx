import React, { useEffect, useState } from 'react';
import type { APIConfig, SpeechToTextApiConfig } from '../../types';
import { resolveSpeechToTextConfig } from '../../utils/speechTranscriptionApi';

interface Props {
  apiConfig: APIConfig;
  updateApiConfig: (patch: Partial<APIConfig>) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const SpeechToTextSettingsPanel: React.FC<Props> = ({ apiConfig, updateApiConfig, addToast }) => {
  const [form, setForm] = useState<SpeechToTextApiConfig>(() => resolveSpeechToTextConfig(apiConfig));
  useEffect(() => setForm(resolveSpeechToTextConfig(apiConfig)), [apiConfig.sttApi]);
  const set = <K extends keyof SpeechToTextApiConfig>(key: K, value: SpeechToTextApiConfig[K]) => setForm(current => ({ ...current, [key]: value }));

  const save = () => {
    const next = { ...form, baseUrl: form.baseUrl.trim().replace(/\/+$/, ''), apiKey: form.apiKey.trim(), model: form.model.trim(), language: form.language?.trim() || '' };
    if (next.enabled && (!next.baseUrl || !next.apiKey || !next.model)) {
      addToast('启用 STT 前请填写接口地址、API Key 和模型名称', 'error');
      return;
    }
    updateApiConfig({ sttApi: next });
    addToast('STT 语音转文字设置已保存', 'success');
  };

  const fieldClass = 'w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-cyan-400';
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between rounded-2xl bg-cyan-50 p-3.5">
        <div><div className="text-xs font-bold text-slate-600">接入独立 STT API</div><p className="mt-1 text-[10px] text-slate-400">只用于把用户录音转成角色能理解的文字。</p></div>
        <button type="button" role="switch" aria-checked={form.enabled} onClick={() => set('enabled', !form.enabled)} className={`relative h-6 w-11 rounded-full transition-colors ${form.enabled ? 'bg-cyan-500' : 'bg-slate-200'}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${form.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} /></button>
      </div>
      <label className="block text-[10px] font-bold text-slate-400">Base URL<input value={form.baseUrl} onChange={event => set('baseUrl', event.target.value)} placeholder="https://api.openai.com/v1" className={`${fieldClass} mt-1`} /></label>
      <label className="block text-[10px] font-bold text-slate-400">API Key<input type="password" value={form.apiKey} onChange={event => set('apiKey', event.target.value)} placeholder="sk-..." className={`${fieldClass} mt-1`} /></label>
      <div className="grid grid-cols-[1fr_6rem] gap-2">
        <label className="block text-[10px] font-bold text-slate-400">模型<input value={form.model} onChange={event => set('model', event.target.value)} placeholder="whisper-1" className={`${fieldClass} mt-1`} /></label>
        <label className="block text-[10px] font-bold text-slate-400">语言<input value={form.language || ''} onChange={event => set('language', event.target.value)} placeholder="zh" className={`${fieldClass} mt-1`} /></label>
      </div>
      <button type="button" onClick={save} className="w-full rounded-2xl bg-cyan-500 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/20 active:scale-95">保存 STT 设置</button>
      <p className="px-1 text-[9px] leading-relaxed text-slate-300">接口需兼容 OpenAI 的 audio/transcriptions。它不会替换聊天模型或 TTS 语音模型。</p>
    </div>
  );
};

export default SpeechToTextSettingsPanel;
