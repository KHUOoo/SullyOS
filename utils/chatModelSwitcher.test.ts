// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChatHeaderShell from '../components/chat/ChatHeaderShell';
import ChatModelSwitcher from '../components/chat/ChatModelSwitcher';
import type { ChatModelChoice } from './chatModelSelection';

let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  document.querySelector('[role="dialog"]')?.remove();
  container.remove();
  vi.restoreAllMocks();
});

describe('chat model switcher UI', () => {
  it('shows the current model in the header without opening the character panel', () => {
    const onModel = vi.fn();
    const onCharacters = vi.fn();
    act(() => root.render(React.createElement(ChatHeaderShell, {
      activeCharacter: { id: 'char', name: 'Draco', avatar: '' },
      selectionMode: false,
      selectedCount: 0,
      onCancelSelection() {},
      isTyping: false,
      isSummarizing: false,
      lastTokenUsage: null,
      onClose() {},
      onTriggerAI() {},
      onShowCharsPanel: onCharacters,
      modelAction: { label: 'Claude', onClick: onModel },
    })));
    const chip = container.querySelector<HTMLButtonElement>('.sully-chat-model')!;
    expect(chip.textContent).toContain('Claude');
    act(() => chip.click());
    expect(onModel).toHaveBeenCalledTimes(1);
    expect(onCharacters).not.toHaveBeenCalled();
  });

  it('renders friendly choices and returns the tapped selection', () => {
    const choices: ChatModelChoice[] = [
      { id: 'default', override: null, label: '跟随默认 · GPT-5.6', model: 'gpt-5.6', configured: true, isDefault: true },
      { id: 'preset:claude', override: { type: 'preset', presetId: 'claude' }, label: 'Claude', model: 'claude-sonnet', configured: true, isDefault: false },
      { id: 'preset:broken', override: { type: 'preset', presetId: 'broken' }, label: 'Gemini', model: '', configured: false, isDefault: false },
    ];
    const onSelect = vi.fn();
    act(() => root.render(React.createElement(ChatModelSwitcher, {
      open: true,
      choices,
      activeChoiceId: 'preset:claude',
      onClose() {},
      onSelect,
    })));
    const dialog = document.querySelector('[role="dialog"]')!;
    expect(dialog.textContent).toContain('从下一条普通聊天回复开始生效');
    expect(dialog.textContent).not.toContain('sk-');
    const claude = Array.from(dialog.querySelectorAll('button')).find(button => button.textContent?.includes('Claude'))!;
    expect(claude.getAttribute('aria-pressed')).toBe('true');
    act(() => (claude as HTMLButtonElement).click());
    expect(onSelect).toHaveBeenCalledWith(choices[1]);
    expect(dialog.textContent).toContain('未配置');
  });
});
