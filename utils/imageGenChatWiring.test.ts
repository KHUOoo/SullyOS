import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../apps/Chat.tsx', import.meta.url), 'utf8');

describe('contextual chat image wiring', () => {
  it('sends natural-language photo requests through normal chat without opening the modal', () => {
    expect(source).not.toContain('isCharacterPhotoRequestText(text)');
    expect(source).not.toContain('setCharacterPhotoFromChat');
  });

  it('marks normal text turns and decides on an attachment after the text reply', () => {
    expect(source).toContain("status: 'pending'");
    expect(source).toContain('planContextualChatImage');
    expect(source).toContain("source: 'contextual_character_photo'");
    expect(source).toContain('kept text-only reply');
  });
});
