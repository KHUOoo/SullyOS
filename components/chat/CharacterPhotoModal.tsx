import React, { useEffect, useState } from 'react';
import { Camera, Dress, ForkKnife, Eye, House, Sparkle } from '@phosphor-icons/react';
import Modal from '../os/Modal';
import { CHARACTER_PHOTO_MODES, type CharacterPhotoMode } from '../../utils/imageGenApi';

interface Props {
  open: boolean;
  characterName: string;
  initialNote?: string;
  busy?: boolean;
  onClose: () => void;
  onSubmit: (mode: CharacterPhotoMode, note: string) => void | Promise<void>;
}

const modeIcons: Record<CharacterPhotoMode, React.ReactNode> = {
  selfie: <Camera weight="fill" />, outfit: <Dress weight="fill" />, food: <ForkKnife weight="fill" />,
  pov: <Eye weight="fill" />, room: <House weight="fill" />, free: <Sparkle weight="fill" />,
};

const CharacterPhotoModal: React.FC<Props> = ({ open, characterName, initialNote = '', busy = false, onClose, onSubmit }) => {
  const [mode, setMode] = useState<CharacterPhotoMode>('selfie');
  const [note, setNote] = useState(initialNote);

  useEffect(() => {
    if (!open) return;
    setMode('selfie');
    setNote(initialNote);
  }, [open, initialNote]);

  return (
    <Modal isOpen={open} title="拍给我看" onClose={busy ? () => {} : onClose}>
      <div className="space-y-4">
        <div className="rounded-2xl border border-fuchsia-100 bg-gradient-to-br from-fuchsia-50 to-violet-50 p-3.5">
          <p className="text-xs font-bold text-slate-700">想看 {characterName} 拍什么？</p>
          <p className="mt-1 text-[10px] leading-relaxed text-slate-400">会结合角色设定、当前时间、记忆和最近聊天决定画面，再由角色把照片发进聊天。</p>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {CHARACTER_PHOTO_MODES.map(item => {
            const selected = mode === item.id;
            return (
              <button key={item.id} type="button" disabled={busy} onClick={() => setMode(item.id)}
                className={`flex min-h-[78px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 transition-all active:scale-95 disabled:opacity-50 ${selected ? 'border-fuchsia-300 bg-fuchsia-50 text-fuchsia-600 shadow-sm' : 'border-slate-100 bg-white text-slate-500'}`}>
                <span className="h-5 w-5">{modeIcons[item.id]}</span>
                <span className="text-[11px] font-bold">{item.label}</span>
              </button>
            );
          })}
        </div>

        <div>
          <label className="mb-1.5 block pl-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">补充描述（可选）</label>
          <textarea value={note} disabled={busy} onChange={event => setNote(event.target.value)} rows={3}
            placeholder="比如：在宿舍、刚睡醒、镜头有点糊……"
            className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none focus:border-fuchsia-300 focus:bg-white disabled:opacity-60" />
        </div>

        <button type="button" disabled={busy} onClick={() => void onSubmit(mode, note)}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 to-violet-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-fuchsia-500/20 active:scale-[0.98] disabled:opacity-60">
          <Camera className={`h-5 w-5 ${busy ? 'animate-pulse' : ''}`} weight="fill" />
          {busy ? '正在准备并生成照片…' : `让 ${characterName} 拍一张`}
        </button>
        {busy && <p className="text-center text-[10px] leading-relaxed text-slate-400">正在先读取角色此刻的状态，再调用图片模型。生图通常会比文字回复久一些。</p>}
      </div>
    </Modal>
  );
};

export default CharacterPhotoModal;

