import React from 'react';
import type { Message } from '../../types';
import TokenImg from '../os/TokenImg';

interface Props {
  message: Message;
  onClose: () => void;
  onSave: (message: Message) => void | Promise<void>;
  onRegenerate?: (message: Message) => void | Promise<void>;
  regenerating?: boolean;
}

const ChatImageViewer: React.FC<Props> = ({ message, onClose, onSave, onRegenerate, regenerating = false }) => (
  <div className="fixed inset-0 z-[260] flex flex-col bg-black/92 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="查看聊天图片" onClick={onClose}>
    <div className="flex shrink-0 items-center justify-between px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] text-white">
      <span className="text-xs text-white/60">图片预览</span>
      <button type="button" onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-white/10 text-2xl">×</button>
    </div>
    <div
      className="flex min-h-0 flex-1 cursor-zoom-out items-center justify-center p-4"
      onClick={event => {
        event.stopPropagation();
        onClose();
      }}
    >
      <TokenImg value={message.content} alt="聊天图片大图" className="max-h-full max-w-full object-contain" />
    </div>
    <div className="flex shrink-0 justify-center gap-3 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3" onClick={event => event.stopPropagation()}>
      <button type="button" onClick={() => void onSave(message)} className="rounded-full bg-white px-5 py-2.5 text-sm font-bold text-slate-800 active:scale-95">保存到本地</button>
      {onRegenerate && (
        <button type="button" disabled={regenerating} onClick={() => void onRegenerate(message)} className="rounded-full bg-primary px-5 py-2.5 text-sm font-bold text-white active:scale-95 disabled:opacity-50">
          {regenerating ? '重新生成中…' : '重新生成'}
        </button>
      )}
    </div>
  </div>
);

export default ChatImageViewer;
