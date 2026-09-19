export const pushNavigationEntry = <T>(history: T[], current: T, next: T): boolean => {
  if (current === next) return false;
  if (history[history.length - 1] !== current) history.push(current);
  return true;
};

export const popNavigationEntry = <T>(history: T[], current: T, fallback: T): T => {
  let previous = history.pop();
  while (previous === current) previous = history.pop();
  return previous ?? fallback;
};
