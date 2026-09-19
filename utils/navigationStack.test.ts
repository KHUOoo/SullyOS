import { describe, expect, it } from 'vitest';
import { popNavigationEntry, pushNavigationEntry } from './navigationStack';

describe('navigation stack', () => {
  it('returns through the real screen hierarchy', () => {
    const history: string[] = [];
    expect(pushNavigationEntry(history, 'home', 'chat-list')).toBe(true);
    expect(pushNavigationEntry(history, 'chat-list', 'chat')).toBe(true);
    expect(popNavigationEntry(history, 'chat', 'home')).toBe('chat-list');
    expect(popNavigationEntry(history, 'chat-list', 'home')).toBe('home');
  });

  it('does not add duplicate entries for the current screen', () => {
    const history = ['home'];
    expect(pushNavigationEntry(history, 'chat-list', 'chat-list')).toBe(false);
    expect(history).toEqual(['home']);
  });
});
