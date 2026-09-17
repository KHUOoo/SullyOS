const countMatches = (value: string, pattern: RegExp): number => value.match(pattern)?.length || 0;

/**
 * Only offer translation when a Moment is predominantly written in a language
 * other than Chinese. Short English interjections inside Chinese copy should
 * not add visual noise to the feed.
 */
export const shouldOfferMomentTranslation = (content: string): boolean => {
    const text = String(content || '').trim();
    if (!text) return false;

    const hanCount = countMatches(text, /\p{Script=Han}/gu);
    const latinCount = countMatches(text, /\p{Script=Latin}/gu);
    const otherForeignCount = countMatches(
        text,
        /[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}\p{Script=Cyrillic}\p{Script=Arabic}\p{Script=Hebrew}\p{Script=Thai}]/gu,
    );

    if (otherForeignCount >= 2 && otherForeignCount > hanCount) return true;
    return latinCount >= 6 && latinCount > hanCount;
};

export const buildMomentTranslationMessages = (content: string) => ([
    {
        role: 'system' as const,
        content: `你是朋友圈动态翻译器。请把用户提供的外语动态翻译成自然、准确的简体中文。
- 保留原文语气、情绪、段落、称呼、人名和表情符号。
- 原文中已经是中文的部分保持不变，只翻译其他语言。
- 不要解释，不要评价，不要加引号或“翻译：”等前缀。
- 只输出最终中文译文。`,
    },
    { role: 'user' as const, content },
]);
