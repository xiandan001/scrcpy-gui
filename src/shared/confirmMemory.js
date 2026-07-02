export const CONFIRM_MEMORY_STORAGE_KEY = 'adbDeviceManagement.confirmSuppressions';

export function readConfirmSuppressions() {
  if (typeof localStorage === 'undefined') return {};
  try {
    const parsed = JSON.parse(localStorage.getItem(CONFIRM_MEMORY_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function isConfirmSuppressed(key) {
  if (!key) return false;
  return readConfirmSuppressions()[key] === true;
}

export function rememberConfirmSuppressed(key) {
  if (!key || typeof localStorage === 'undefined') return;
  const next = { ...readConfirmSuppressions(), [key]: true };
  localStorage.setItem(CONFIRM_MEMORY_STORAGE_KEY, JSON.stringify(next));
}

export function clearConfirmSuppressionMemory() {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(CONFIRM_MEMORY_STORAGE_KEY);
}
