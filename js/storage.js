const KEYS = {
  characters: 'st84.characters',
  customLibrary: 'st84.customLibrary',
  diceLog: 'st84.diceLog'
};

function safeParse(raw, fallback) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function loadCharacters() {
  return safeParse(localStorage.getItem(KEYS.characters), []);
}

export function saveCharacters(characters) {
  localStorage.setItem(KEYS.characters, JSON.stringify(characters));
}

export function loadCustomLibrary() {
  return safeParse(localStorage.getItem(KEYS.customLibrary), {
    animals: [],
    items: [],
    statuses: []
  });
}

export function saveCustomLibrary(customLibrary) {
  localStorage.setItem(KEYS.customLibrary, JSON.stringify(customLibrary));
}

export function loadDiceLog() {
  return safeParse(localStorage.getItem(KEYS.diceLog), []);
}

export function saveDiceLog(log) {
  localStorage.setItem(KEYS.diceLog, JSON.stringify(log.slice(0, 50)));
}

export function downloadJson(filename, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function downloadText(filename, text, type = 'text/plain') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export async function readJsonFile(file) {
  const text = await file.text();
  return JSON.parse(text);
}
