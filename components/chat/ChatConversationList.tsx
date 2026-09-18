import React, { useEffect, useMemo, useState } from 'react';
import type { CharacterProfile, Message } from '../../types';
import { DB } from '../../utils/db';
import { isChatPreviewMessage } from '../../utils/chatMessageVisibility';
import TokenImg from '../os/TokenImg';

const previewText = (message?: Message): string => {
  if (!message) return '还没有聊天记录';
  if (message.type === 'image') return '[图片]';
  if (message.type === 'emoji') return '[表情包]';
  if (message.type === 'voice') return `[语音] ${String(message.metadata?.transcript || '').trim()}`.trim();
  return String(message.content || '[消息]').replace(/\s+/g, ' ').trim();
};

const timeText = (timestamp?: number): string => {
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const today = new Date();
  if (date.toDateString() === today.toDateString()) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  return date.toLocaleDateString([], { month: 'numeric', day: 'numeric' });
};

interface Props {
  characters: CharacterProfile[];
  unreadMessages: Record<string, number>;
  lastMsgTimestamp: number;
  onSelect: (id: string) => void;
  onClose: () => void;
}

const ChatConversationList: React.FC<Props> = ({ characters, unreadMessages, lastMsgTimestamp, onSelect, onClose }) => {
  const [lastByChar, setLastByChar] = useState<Record<string, Message | undefined>>({});

  useEffect(() => {
    let cancelled = false;
    void Promise.all(characters.map(async character => {
      const result = await DB.getRecentMessagesWithCount(character.id, 1, isChatPreviewMessage);
      return [character.id, result.messages[0]] as const;
    })).then(entries => { if (!cancelled) setLastByChar(Object.fromEntries(entries)); });
    return () => { cancelled = true; };
  }, [characters, lastMsgTimestamp]);

  const ordered = useMemo(() => [...characters].sort((a, b) =>
    (lastByChar[b.id]?.timestamp || 0) - (lastByChar[a.id]?.timestamp || 0)), [characters, lastByChar]);

  return (
    <div className="flex h-full flex-col bg-[#f5f7fb] text-slate-800">
      <header className="flex h-16 shrink-0 items-center gap-3 border-b border-white/80 bg-white/85 px-4 pt-safe backdrop-blur-xl">
        <button type="button" onClick={onClose} aria-label="返回桌面" className="grid h-10 w-10 place-items-center rounded-full text-2xl text-slate-500 active:bg-slate-100">‹</button>
        <div>
          <h1 className="text-base font-bold tracking-wide">聊天</h1>
          <p className="text-[10px] text-slate-400">选择一个角色继续会话</p>
        </div>
      </header>
      <div className="flex-1 overflow-y-auto px-3 py-3 no-scrollbar">
        {ordered.length === 0 ? (
          <div className="grid h-full place-items-center text-sm text-slate-400">还没有角色</div>
        ) : ordered.map(character => {
          const last = lastByChar[character.id];
          const unread = unreadMessages[character.id] || 0;
          return (
            <button key={character.id} type="button" onClick={() => onSelect(character.id)} className="mb-2 flex w-full items-center gap-3 rounded-3xl border border-white/80 bg-white/90 p-3 text-left shadow-sm transition active:scale-[0.99]">
              <TokenImg value={character.avatar} alt="" className="h-14 w-14 shrink-0 rounded-2xl object-cover bg-slate-100" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm font-bold">{character.name}</span>
                  <span className="shrink-0 text-[10px] text-slate-400">{timeText(last?.timestamp)}</span>
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-xs text-slate-400">{previewText(last)}</span>
                  {unread > 0 && <span className="grid min-w-5 h-5 place-items-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">{unread > 99 ? '99+' : unread}</span>}
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default ChatConversationList;
