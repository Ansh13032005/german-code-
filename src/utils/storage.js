export const PROFILE_KEY = 'bff-german-student-profile';
export const SELECTED_TEST_KEY = 'bff-german-selected-test';

function safeJsonParse(value, fallback) {
  try {
    return JSON.parse(value) || fallback;
  } catch {
    return fallback;
  }
}

export function getSavedJson(key, fallback = {}) {
  try {
    return safeJsonParse(window.localStorage.getItem(key), fallback);
  } catch (error) {
    console.warn(`Could not read ${key} from localStorage:`, error);
    return fallback;
  }
}

export function saveJson(key, value) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Could not save ${key} to localStorage:`, error);
  }
}

export function removeSavedJson(key) {
  try {
    window.localStorage.removeItem(key);
  } catch (error) {
    console.warn(`Could not remove ${key} from localStorage:`, error);
  }
}

export function answerStorageKey(test) {
  return `bff-german-${test.id}-answers`;
}

export function writingStorageKey(test) {
  return `bff-german-${test.id}-responses`;
}

export function moduleStatusStorageKey(test) {
  return `bff-german-${test.id}-module-status`;
}
