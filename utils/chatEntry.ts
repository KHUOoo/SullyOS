const CHAT_ENTRY_KEY = 'sully_chat_entry_mode';

export const markNextChatEntryAsList = (): void => {
  try { sessionStorage.setItem(CHAT_ENTRY_KEY, 'list'); } catch { /* storage unavailable */ }
};

export const consumeChatEntryAsList = (): boolean => {
  try {
    const shouldShow = sessionStorage.getItem(CHAT_ENTRY_KEY) === 'list';
    sessionStorage.removeItem(CHAT_ENTRY_KEY);
    return shouldShow;
  } catch {
    return false;
  }
};
