import { describe, expect, it } from 'vitest';
import { buildMomentTranslationMessages, shouldOfferMomentTranslation } from './momentTranslation';

describe('shouldOfferMomentTranslation', () => {
    it('offers translation for English Moments', () => {
        expect(shouldOfferMomentTranslation('A disastrous attempt at baking. But barely acceptable. 🍏')).toBe(true);
    });

    it('offers translation for other foreign scripts', () => {
        expect(shouldOfferMomentTranslation('今日はとてもいい天気です。')).toBe(true);
        expect(shouldOfferMomentTranslation('오늘은 산책하기 좋은 날이야.')).toBe(true);
    });

    it('does not offer translation for Chinese Moments', () => {
        expect(shouldOfferMomentTranslation('今天的天气很好，出去散步了。')).toBe(false);
    });

    it('ignores short foreign interjections in Chinese copy', () => {
        expect(shouldOfferMomentTranslation('今天状态还 OK，继续加油。')).toBe(false);
    });

    it('offers translation when foreign text dominates mixed copy', () => {
        expect(shouldOfferMomentTranslation('someone needs to go to sleep. 别熬了。')).toBe(true);
    });
});

describe('buildMomentTranslationMessages', () => {
    it('asks for a direct Simplified Chinese translation', () => {
        const messages = buildMomentTranslationMessages('Good night.');
        expect(messages[0].content).toContain('简体中文');
        expect(messages[0].content).toContain('只输出最终中文译文');
        expect(messages[1].content).toBe('Good night.');
    });
});
