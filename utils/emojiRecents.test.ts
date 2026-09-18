import { beforeEach, describe, expect, it } from 'vitest';
import { loadRecentEmojiNames, recordRecentEmoji, selectRecentEmojis } from './emojiRecents';

describe('emojiRecents', () => {
  beforeEach(() => localStorage.clear());

  it('moves the latest used sticker to the front without duplicates', () => {
    recordRecentEmoji('开心');
    recordRecentEmoji('晚安');
    recordRecentEmoji('开心');
    expect(loadRecentEmojiNames()).toEqual(['开心', '晚安']);
  });

  it('uses legacy default stickers only before any recent sticker exists', () => {
    const items = [
      { name: '默认', categoryId: 'default' },
      { name: '猫猫', categoryId: 'cats' },
      { name: '狗狗', categoryId: 'dogs' },
    ];
    expect(selectRecentEmojis(items, [])).toEqual([items[0]]);
    expect(selectRecentEmojis(items, ['狗狗', '猫猫'])).toEqual([items[2], items[1]]);
  });
});
