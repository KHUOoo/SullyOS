import React, { useEffect, useRef, useState } from 'react';
import type { APIConfig, ImageGenApiConfig, ImageGenAspectRatio, ImageGenReferenceMode } from '../../types';
import { processImage } from '../../utils/file';
import { migrateDataUrlToRef } from '../../utils/blobRef';
import { resolveImageGenConfig, testImageGenApi } from '../../utils/imageGenApi';
import TokenImg from '../os/TokenImg';

interface Props {
  apiConfig: APIConfig;
  updateApiConfig: (patch: Partial<APIConfig>) => void;
  addToast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

const fieldClass = 'w-full rounded-xl border border-slate-200/70 bg-white/70 px-4 py-2.5 text-sm outline-none transition-colors focus:border-fuchsia-300 focus:bg-white disabled:opacity-50';

const ImageGenSettingsPanel: React.FC<Props> = ({ apiConfig, updateApiConfig, addToast }) => {
  const [draft, setDraft] = useState<ImageGenApiConfig>(() => resolveImageGenConfig(apiConfig));
  const [testing, setTesting] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(resolveImageGenConfig(apiConfig)), [apiConfig.imageGenApi]);

  const patch = <K extends keyof ImageGenApiConfig>(key: K, value: ImageGenApiConfig[K]) =>
    setDraft(current => ({ ...current, [key]: value }));

  const save = () => {
    if (draft.enabled && (!draft.baseUrl.trim() || !draft.apiKey.trim() || !draft.model.trim())) {
      addToast('开启生图 API 前，请填完整 URL、Key 和模型', 'error');
      return;
    }
    updateApiConfig({ imageGenApi: draft });
    addToast(draft.enabled ? '生图 API 已保存' : '生图 API 已关闭', 'success');
  };

  const test = async () => {
    setTesting(true);
    try {
      await testImageGenApi(draft);
      addToast('生图 API 连接成功', 'success');
    } catch (error: any) {
      addToast(error?.message || '生图 API 测试失败', 'error');
    } finally {
      setTesting(false);
    }
  };

  const uploadReference = async (file?: File) => {
    if (!file) return;
    try {
      const dataUrl = await processImage(file, { maxWidth: 1536, quality: 0.86, forceJpeg: true });
      patch('referenceImage', await migrateDataUrlToRef(dataUrl));
      addToast('全局锁脸参考图已载入，记得保存', 'success');
    } catch (error: any) {
      addToast(error?.message || '参考图处理失败', 'error');
    }
  };

  const disabled = !draft.enabled;
  const showGlobalReference = draft.referenceMode === 'global' || draft.referenceMode === 'hybrid';

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-fuchsia-100 bg-fuchsia-50/60 p-3.5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-bold text-slate-700">接入独立生图 API</div>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-400">聊天里的“拍给我看”会调用 OpenAI Images 兼容接口。</p>
          </div>
          <button type="button" role="switch" aria-checked={draft.enabled} onClick={() => patch('enabled', !draft.enabled)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${draft.enabled ? 'bg-fuchsia-500' : 'bg-slate-200'}`}>
            <span className={`inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${draft.enabled ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>

      <div className={`space-y-3 ${disabled ? 'opacity-50' : ''}`}>
        <div>
          <label className="mb-1.5 block pl-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Base URL</label>
          <input disabled={disabled} value={draft.baseUrl} onChange={event => patch('baseUrl', event.target.value)} placeholder="https://api.openai.com/v1" className={`${fieldClass} font-mono`} />
        </div>
        <div>
          <label className="mb-1.5 block pl-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">API Key</label>
          <input disabled={disabled} type="password" autoComplete="new-password" value={draft.apiKey} onChange={event => patch('apiKey', event.target.value)} placeholder="sk-..." className={`${fieldClass} font-mono`} />
        </div>
        <div>
          <label className="mb-1.5 block pl-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Model</label>
          <input disabled={disabled} value={draft.model} onChange={event => patch('model', event.target.value)} placeholder="gpt-image-1" className={`${fieldClass} font-mono`} />
        </div>

        <div className="space-y-3 rounded-2xl border border-fuchsia-100 bg-white/70 p-3">
          <div>
            <div className="text-xs font-bold text-slate-700">普通聊天生图提示词</div>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-400">角色会先正常回复，再根据上下文自主判断是否附图。留空时使用内置默认值。</p>
          </div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-fuchsia-500">前置提示词
            <textarea disabled={disabled} rows={5} value={draft.chatPromptPrefix} onChange={event => patch('chatPromptPrefix', event.target.value)} placeholder="留空使用默认的私聊生活照提示词" className={`${fieldClass} mt-1.5 resize-y font-normal normal-case tracking-normal text-slate-600`} />
          </label>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-fuchsia-500">反向提示词
            <textarea disabled={disabled} rows={4} value={draft.chatNegativePrompt} onChange={event => patch('chatNegativePrompt', event.target.value)} placeholder="留空使用默认的私聊负面约束" className={`${fieldClass} mt-1.5 resize-y font-normal normal-case tracking-normal text-slate-600`} />
          </label>
        </div>

        <div className="space-y-3 rounded-2xl border border-violet-100 bg-white/70 p-3">
          <div>
            <div className="text-xs font-bold text-slate-700">朋友圈生图提示词</div>
            <p className="mt-1 text-[10px] leading-relaxed text-slate-400">只影响角色朋友圈配图，与普通聊天完全分开。留空时使用内置默认值。</p>
          </div>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-violet-500">前置提示词
            <textarea disabled={disabled} rows={5} value={draft.momentPromptPrefix} onChange={event => patch('momentPromptPrefix', event.target.value)} placeholder="留空使用默认的朋友圈生活照提示词" className={`${fieldClass} mt-1.5 resize-y font-normal normal-case tracking-normal text-slate-600`} />
          </label>
          <label className="block text-[10px] font-bold uppercase tracking-widest text-violet-500">反向提示词
            <textarea disabled={disabled} rows={4} value={draft.momentNegativePrompt} onChange={event => patch('momentNegativePrompt', event.target.value)} placeholder="留空使用默认的朋友圈负面约束" className={`${fieldClass} mt-1.5 resize-y font-normal normal-case tracking-normal text-slate-600`} />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">尺寸
            <select disabled={disabled} value={draft.size} onChange={event => patch('size', event.target.value as ImageGenApiConfig['size'])} className={`${fieldClass} mt-1.5 font-normal normal-case tracking-normal text-slate-600`}>
              <option value="auto">自动</option><option value="1024x1024">1024×1024</option><option value="1024x1536">1024×1536</option><option value="1536x1024">1536×1024</option>
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">画幅比例
            <select disabled={disabled} value={draft.aspectRatio} onChange={event => patch('aspectRatio', event.target.value as ImageGenAspectRatio)} className={`${fieldClass} mt-1.5 font-normal normal-case tracking-normal text-slate-600`}>
              {['auto', '1:1', '2:3', '3:2', '3:4', '4:3', '4:5', '5:4', '9:16', '16:9'].map(ratio => <option key={ratio} value={ratio}>{ratio === 'auto' ? '自动' : ratio}</option>)}
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">张数
            <select disabled={disabled} value={draft.count} onChange={event => patch('count', Number(event.target.value))} className={`${fieldClass} mt-1.5 font-normal normal-case tracking-normal text-slate-600`}>
              {[1, 2, 3, 4].map(count => <option key={count} value={count}>{count} 张</option>)}
            </select>
          </label>
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">超时（秒）
            <input disabled={disabled} type="number" min={10} max={600} value={Math.round(draft.timeoutMs / 1000)} onChange={event => patch('timeoutMs', Math.max(10, Number(event.target.value) || 120) * 1000)} className={`${fieldClass} mt-1.5 font-normal normal-case tracking-normal text-slate-600`} />
          </label>
        </div>

        <div className="rounded-2xl border border-fuchsia-100 bg-white/70 p-3 space-y-3">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-fuchsia-500">锁脸模式
            <select disabled={disabled} value={draft.referenceMode} onChange={event => patch('referenceMode', event.target.value as ImageGenReferenceMode)} className={`${fieldClass} mt-1.5 font-normal normal-case tracking-normal text-slate-600`}>
              <option value="off">关闭（纯文生图）</option>
              <option value="avatar">角色头像</option>
              <option value="global">全局参考图</option>
              <option value="hybrid">头像＋全局参考图</option>
              <option value="character">每角色参考图</option>
            </select>
          </label>
          <label className="block text-[10px] text-slate-500">相似度优先级 · {Math.round(draft.similarity * 100)}%
            <input disabled={disabled || draft.referenceMode === 'off'} type="range" min={0} max={1} step={0.05} value={draft.similarity} onChange={event => patch('similarity', Number(event.target.value))} className="mt-2 w-full accent-fuchsia-500" />
          </label>
          <label className="flex items-center justify-between gap-3 text-xs text-slate-600">
            最近聊天图片也作为参考
            <input disabled={disabled} type="checkbox" checked={draft.useRecentChatImages === true} onChange={event => patch('useRecentChatImages', event.target.checked)} className="h-4 w-4 accent-fuchsia-500" />
          </label>
          {showGlobalReference && (
            <div className="flex items-center gap-3 border-t border-fuchsia-50 pt-3">
              {draft.referenceImage ? <TokenImg value={draft.referenceImage} className="h-16 w-16 rounded-xl object-cover" alt="全局锁脸参考图" /> : <div className="grid h-16 w-16 place-items-center rounded-xl bg-slate-100 text-[10px] text-slate-400">未上传</div>}
              <div className="flex-1 space-y-2">
                <input value={draft.referenceImage || ''} onChange={event => patch('referenceImage', event.target.value)} placeholder="图片 URL 或上传本地图片" className={`${fieldClass} py-2 text-xs`} />
                <button type="button" disabled={disabled} onClick={() => uploadRef.current?.click()} className="rounded-xl bg-fuchsia-50 px-3 py-2 text-[11px] font-bold text-fuchsia-600 disabled:opacity-40">上传参考图</button>
                <input ref={uploadRef} type="file" accept="image/*" className="hidden" onChange={event => { void uploadReference(event.target.files?.[0]); event.currentTarget.value = ''; }} />
              </div>
            </div>
          )}
          <p className="text-[9px] leading-relaxed text-slate-400">锁脸会改走 <span className="font-mono">/images/edits</span>。若服务商只支持文生图，请选择“关闭”。“每角色参考图”在角色档案里上传。</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button type="button" disabled={testing || disabled} onClick={() => void test()} className="rounded-2xl border border-fuchsia-200 bg-fuchsia-50 py-3 text-sm font-bold text-fuchsia-600 disabled:opacity-40">{testing ? '测试中…' : '测试生图'}</button>
        <button type="button" onClick={save} className="rounded-2xl bg-fuchsia-500 py-3 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/20 active:scale-95">保存生图 API</button>
      </div>
      <p className="px-1 text-[9px] leading-relaxed text-slate-300">测试会真正生成一张最小测试图，可能产生一次图片生成费用。</p>
    </div>
  );
};

export default ImageGenSettingsPanel;
