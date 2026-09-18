import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Check, X } from '@phosphor-icons/react';
import type { ChatModelChoice } from '../../utils/chatModelSelection';

interface ChatModelSwitcherProps {
    open: boolean;
    choices: ChatModelChoice[];
    activeChoiceId: string;
    onClose: () => void;
    onSelect: (choice: ChatModelChoice) => void;
}

const ChatModelSwitcher: React.FC<ChatModelSwitcherProps> = ({
    open,
    choices,
    activeChoiceId,
    onClose,
    onSelect,
}) => {
    useEffect(() => {
        if (!open) return;
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [open, onClose]);

    if (!open || typeof document === 'undefined') return null;

    return createPortal(
        <div className="fixed inset-0 z-[100] flex items-end justify-center" role="dialog" aria-modal="true" aria-label="快速切换聊天模型">
            <button className="absolute inset-0 bg-slate-950/30 backdrop-blur-[2px]" onClick={onClose} aria-label="关闭模型选择" />
            <section className="relative w-full max-w-lg overflow-hidden rounded-t-[28px] border border-white/70 bg-white/95 px-4 pb-[calc(1rem+var(--safe-bottom))] pt-3 shadow-[0_-18px_55px_rgba(15,23,42,0.18)]">
                <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />
                <div className="mb-3 flex items-start justify-between gap-3 px-1">
                    <div>
                        <h2 className="text-sm font-bold text-slate-800">切换聊天模型</h2>
                        <p className="mt-0.5 text-[10px] text-slate-400">从下一条普通聊天回复开始生效</p>
                    </div>
                    <button onClick={onClose} className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100" aria-label="关闭">
                        <X className="h-4 w-4" weight="bold" />
                    </button>
                </div>

                <div className="max-h-[52vh] space-y-1 overflow-y-auto overscroll-contain pr-0.5">
                    {choices.map(choice => {
                        const selected = choice.id === activeChoiceId;
                        return (
                            <button
                                key={choice.id}
                                type="button"
                                onClick={() => onSelect(choice)}
                                aria-pressed={selected}
                                aria-disabled={!choice.configured}
                                className={`flex w-full items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition-colors ${
                                    selected
                                        ? 'border-primary/25 bg-primary/5'
                                        : 'border-transparent bg-slate-50/80 active:bg-slate-100'
                                } ${choice.configured ? '' : 'opacity-55'}`}
                            >
                                <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                    selected ? 'border-primary bg-primary text-white' : 'border-slate-200 bg-white text-transparent'
                                }`}>
                                    <Check className="h-3 w-3" weight="bold" />
                                </span>
                                <span className="min-w-0 flex-1">
                                    <span className="block truncate text-xs font-semibold text-slate-700">{choice.label}</span>
                                    {choice.model && choice.model !== choice.label && (
                                        <span className="mt-0.5 block truncate text-[10px] text-slate-400">{choice.model}</span>
                                    )}
                                </span>
                                {!choice.configured && <span className="shrink-0 text-[10px] font-semibold text-amber-500">未配置</span>}
                            </button>
                        );
                    })}
                </div>

                <p className="px-2 pt-3 text-center text-[9px] leading-relaxed text-slate-400">
                    模型与 API 仍在「AI 设置」中管理；这里仅保存本会话的选择。
                </p>
            </section>
        </div>,
        document.body,
    );
};

export default ChatModelSwitcher;
