const STORAGE_KEY = 'sully_recent_emoji_names_v1';
const MAX_RECENTS = 40;

export const loadRecentEmojiNames = (): string[] => {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(parsed) ? parsed.filter(value => typeof value === 'string').slice(0, MAX_RECENTS) : [];
  } catch {
    return [];
  }
};

export const recordRecentEmoji = (name: string): string[] => {
  const clean = String(name || '').trim();
  if (!clean) return loadRecentEmojiNames();
  const next = [clean, ...loadRecentEmojiNames().filter(item => item !== clean)].slice(0, MAX_RECENTS);
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* best effort */ }
  return next;
};

export const selectRecentEmojis = <T extends { name: string; categoryId?: string }>(items: T[], names: string[]): T[] => {
  const byName = new Map(items.map(item => [item.name, item]));
  const recent = names.map(name => byName.get(name)).filter((item): item is T => !!item);
  if (recent.length > 0) return recent;
  return items.filter(item => !item.categoryId || item.categoryId === 'default');
};
