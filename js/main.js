import {
  loadCharacters,
  saveCharacters,
  loadCustomLibrary,
  saveCustomLibrary,
  loadDiceLog,
  saveDiceLog,
  downloadJson,
  readJsonFile
} from './storage.js';
import {
  deepClone,
  rollDiceString,
  uid,
  slugify,
  wpStrikeBonus,
  calculateCombatAttributeBonuses,
  calculateCarryStats,
  calculateSpeedYardsPerMinute,
  resolveHandToHand,
  accumulatePhysicalSkillBonuses,
  totalCarriedWeight,
  getSkillPercent
} from './rules.js';
import {
  createEmptyBuilder,
  createCharacterFromTemplate,
  rollAllAttributes,
  randomizeAnimal,
  applyBackgroundMoney,
  validateBuilder,
  resolveBuilderToCharacter,
  builderFromCharacter,
  ensureBuilderProgression,
  rerollBuilderHpRoll
} from './builder.js';
import {
  renderHome,
  renderBuilder,
  renderSheet,
  renderLibrary,
  renderDiceModal,
  renderPromptModal,
  renderItemPickerModal,
  renderLevelUpModal
} from './render.js';

const appEl = document.getElementById('app');
const modalEl = document.getElementById('modal');
const importCharacterFileEl = document.getElementById('import-character-file');
const importLibraryFileEl = document.getElementById('import-library-file');
const avatarFileEl = document.getElementById('character-avatar-file');

const state = {
  view: 'home',
  data: null,
  characters: loadCharacters(),
  builder: null,
  activeCharacter: null,
  customLibrary: loadCustomLibrary(),
  diceLog: loadDiceLog(),
  modalContext: null,
  validation: { errors: [], warnings: [], bio: { spent: 0, budget: 0, remaining: 0 } },
  sheetTab: 'overview',
  sheetHeaderCollapsed: typeof window !== 'undefined' ? window.matchMedia('(max-width: 720px)').matches : false
};

async function loadData() {
  const names = [
    'config.json',
    'attribute_bonus_chart.json',
    'hand_to_hand.json',
    'physical_skill_effects.json',
    'skills.json',
    'programs.json',
    'backgrounds.json',
    'statuses.json',
    'items.json',
    'wp_bonuses.json',
    'animals.json',
    'templates.json'
  ];

  const entries = await Promise.all(names.map(async (name) => {
    const response = await fetch(`./data/${name}`);
    if (!response.ok) throw new Error(`Failed to load ${name}. Run this app through a local web server or GitHub Pages.`);
    return [name.replace('.json', ''), await response.json()];
  }));

  const loaded = Object.fromEntries(entries);
  loaded.customLibrary = state.customLibrary;
  loaded.templates = loaded.templates || [];
  loaded.allAnimals = [...(loaded.animals || []), ...(state.customLibrary.animals || [])].sort((a, b) => a.name.localeCompare(b.name));
  loaded.allItems = [...(loaded.items || []), ...(state.customLibrary.items || [])].sort((a, b) => a.name.localeCompare(b.name));
  loaded.allStatuses = [...(loaded.statuses || []), ...(state.customLibrary.statuses || [])].sort((a, b) => (a.label || '').localeCompare(b.label || ''));
  loaded.physicalSkillNames = Object.keys(loaded.physical_skill_effects || {}).sort((a, b) => a.localeCompare(b));
  loaded.wpStrikeBonus = (wpName, level) => wpStrikeBonus(loaded.wp_bonuses || {}, wpName, level);
  state.data = loaded;
}

function refreshMergedData() {
  state.data.customLibrary = state.customLibrary;
  state.data.allAnimals = [...(state.data.animals || []), ...(state.customLibrary.animals || [])].sort((a, b) => a.name.localeCompare(b.name));
  state.data.allItems = [...(state.data.items || []), ...(state.customLibrary.items || [])].sort((a, b) => a.name.localeCompare(b.name));
  state.data.allStatuses = [...(state.data.statuses || []), ...(state.customLibrary.statuses || [])].sort((a, b) => (a.label || '').localeCompare(b.label || ''));
}

function pushHistory(character) {
  if (!character.history) character.history = { undoStack: [], redoStack: [] };
  const snapshot = deepClone({ ...character, history: { undoStack: [], redoStack: [] } });
  character.history.undoStack = character.history.undoStack || [];
  character.history.undoStack.unshift(snapshot);
  character.history.undoStack = character.history.undoStack.slice(0, state.data.config.maxUndo || 100);
  character.history.redoStack = [];
}

function setByPath(target, path, rawValue, type = 'text', checked = false) {
  const keys = path.split('.');
  let cursor = target;
  for (let i = 0; i < keys.length - 1; i += 1) {
    const key = keys[i];
    if (cursor[key] == null) cursor[key] = {};
    cursor = cursor[key];
  }
  const last = keys.at(-1);
  let value = rawValue;
  if (type === 'checkbox') value = checked;
  if (type === 'number') value = rawValue === '' ? 0 : Number(rawValue);
  cursor[last] = value;
}

function getByPath(target, path, fallback = undefined) {
  const keys = String(path || '').split('.').filter(Boolean);
  let cursor = target;
  for (const key of keys) {
    if (cursor == null || !(key in cursor)) return fallback;
    cursor = cursor[key];
  }
  return cursor;
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function maxActionsFor(character) {
  return Math.max(0, Number(character?.combat?.actionsPerMelee ?? character?.combat?.actionsRemaining ?? 0));
}

function resetMeleeState(character) {
  character.combat = character.combat || {};
  character.combat.actionsPerMelee = maxActionsFor(character);
  character.combat.actionsRemaining = maxActionsFor(character);
}

function resetCombatState(character) {
  resetMeleeState(character);
  character.combat.currentInitiative = '';
}

function adjustResource(character, path, delta, maxPath = null) {
  const current = Number(getByPath(character, path, 0) || 0);
  const maxValue = maxPath ? Number(getByPath(character, maxPath, current) || current) : Number.POSITIVE_INFINITY;
  const next = clamp(current + delta, 0, maxValue);
  setByPath(character, path, next, 'number');
}

function setResourceToMax(character, path, maxPath) {
  const maxValue = Number(getByPath(character, maxPath, 0) || 0);
  setByPath(character, path, maxValue, 'number');
}

function normalizeD6(value) {
  const number = Number(value || 0);
  return number >= 1 && number <= 6 ? number : rollDiceString('1d6').total;
}

function ensureCharacterProgression(character, targetLevel = character.level) {
  const level = Math.max(1, Number(targetLevel || character.level || 1));
  character.progression = character.progression || { baseHpRoll: rollDiceString('1d6').total, levelHpRolls: [] };
  character.progression.baseHpRoll = normalizeD6(character.progression.baseHpRoll);
  character.progression.levelHpRolls = Array.isArray(character.progression.levelHpRolls) ? character.progression.levelHpRolls : [];
  while (character.progression.levelHpRolls.length < Math.max(0, level - 1)) {
    character.progression.levelHpRolls.push(rollDiceString('1d6').total);
  }
  character.progression.levelHpRolls = character.progression.levelHpRolls.map((value) => normalizeD6(value));
  return character.progression;
}

function resolveSkillMeta(skillEntry) {
  if (!skillEntry?.name) return skillEntry || {};
  const catalogSkill = state.data.skills.find((skill) => skill.name === skillEntry.name) || {};
  return {
    ...catalogSkill,
    ...skillEntry,
    base: skillEntry?.base ?? catalogSkill.base ?? null,
    perLevel: skillEntry?.perLevel ?? catalogSkill.perLevel ?? null,
    twoTrack: skillEntry?.twoTrack ?? catalogSkill.twoTrack ?? false,
    secondaryBase: skillEntry?.secondaryBase ?? catalogSkill.secondaryBase ?? null,
    category: skillEntry?.category || catalogSkill.category || 'Misc'
  };
}

function recalculateSkillList(skills, level, scholasticBonus, iqBonus, isSecondary) {
  return (skills || []).map((skillEntry) => {
    const meta = resolveSkillMeta(skillEntry);
    if (meta.base == null) return { ...skillEntry, ...meta };
    return {
      ...skillEntry,
      ...meta,
      percent: getSkillPercent(meta, level, isSecondary ? 0 : scholasticBonus, iqBonus, isSecondary)
    };
  });
}

function getEquippedArmorAr(character) {
  const items = character.inventory?.carried || [];
  const itemMap = new Map(state.data.allItems.map((item) => [item.id, item]));
  return items.reduce((maxAr, entry) => {
    if (!entry?.equipped) return maxAr;
    const item = itemMap.get(entry.itemId);
    return Math.max(maxAr, Number(item?.ar || entry.arOverride || 0));
  }, 0);
}

function recalculateCharacterDerived(character, { hpGain = 0, refillActions = false } = {}) {
  if (!state.data || !character) return;
  const previousHp = Number(character.health?.hp || 0);
  const previousActions = Number(character.combat?.actionsRemaining || 0);
  const level = Math.max(1, Number(character.level || 1));
  const background = state.data.backgrounds.find((row) => row.id === character.backgroundId) || {};
  const attrs = character.attributes || {};
  const attrCombat = calculateCombatAttributeBonuses(state.data.attribute_bonus_chart, attrs);
  const hand = resolveHandToHand(state.data.hand_to_hand, character.combat?.handToHandStyle || 'basic', level);
  const physical = accumulatePhysicalSkillBonuses(character.skills?.physical || [], state.data.physical_skill_effects);
  const scholasticBonus = Number(background.scholasticBonus || character.education?.scholasticBonus || 0);
  const iqBonus = Number(attrCombat.iqSkillBonus || 0);

  character.skills = character.skills || {};
  character.skills.automatic = recalculateSkillList(character.skills.automatic, level, scholasticBonus, iqBonus, false);
  character.skills.scholastic = recalculateSkillList(character.skills.scholastic, level, scholasticBonus, iqBonus, false);
  character.skills.secondary = recalculateSkillList(character.skills.secondary, level, 0, iqBonus, true);

  character.combat = character.combat || {};
  character.combat.actionsPerMelee = Math.max(0, 2 + hand.attacks + physical.attacks + Number(character.combat.manualBonusAttacks || 0) + Number(background.extraAttacks || 0));
  character.combat.actionsRemaining = refillActions ? character.combat.actionsPerMelee : clamp(previousActions, 0, character.combat.actionsPerMelee);
  character.combat.strike = attrCombat.strike + hand.strike + physical.strike + Number(character.combat.manualStrike || 0);
  character.combat.parry = attrCombat.parry + hand.parry + physical.parry + Number(character.combat.manualParry || 0);
  character.combat.dodge = attrCombat.dodge + hand.dodge + physical.dodge + Number(character.combat.manualDodge || 0);
  character.combat.damage = attrCombat.damage + hand.damage + physical.damage + Number(character.combat.manualDamage || 0);
  character.combat.roll = hand.roll + physical.roll + Number(character.combat.manualRoll || 0);
  character.combat.pullPunch = hand.pullPunch + Number(character.combat.manualPullPunch || 0);
  character.combat.bodyBlockStrike = physical.bodyBlockStrike || 0;
  character.combat.bodyBlockDamage = physical.bodyBlockDamage || '1D4';
  character.combat.kickDamage = hand.kickDamage || '1D6';
  character.combat.underwaterDodge = physical.underwaterDodge || 0;
  character.combat.special = [...new Set([...(hand.special || []), ...(physical.special || [])])];

  character.derived = character.derived || {};
  const carry = calculateCarryStats(attrs.ps);
  const carriedWeight = totalCarriedWeight(character.inventory?.carried || [], state.data.allItems);
  character.derived.iqSkillBonus = iqBonus;
  character.derived.carry = carry;
  character.derived.speedYardsPerMinute = calculateSpeedYardsPerMinute(attrs.spd);
  character.derived.carriedWeight = carriedWeight;
  character.derived.encumbered = carriedWeight > carry.carry;
  character.derived.effectiveAr = Math.max(Number(character.health?.ar || 0), getEquippedArmorAr(character));

  if (character.progression || character.builderSnapshot?.progression) {
    ensureCharacterProgression(character, level);
    const hpMax = Number(attrs.pe || 0)
      + Number(character.progression.baseHpRoll || 0)
      + character.progression.levelHpRolls.slice(0, Math.max(0, level - 1)).reduce((sum, value) => sum + Number(value || 0), 0);
    character.health.maxHp = hpMax;
    character.health.hp = clamp(previousHp + Number(hpGain || 0), 0, hpMax);
  } else if (hpGain) {
    character.health.maxHp = Number(character.health.maxHp || 0) + Number(hpGain || 0);
    character.health.hp = clamp(previousHp + Number(hpGain || 0), 0, Number(character.health.maxHp || 0));
  } else {
    character.health.hp = clamp(previousHp, 0, Number(character.health.maxHp || previousHp));
  }

  character.health.sdc = clamp(Number(character.health.sdc || 0), 0, Number(character.health.maxSdc || character.health.sdc || 0));
}

function applyLevelChange(character, newLevel, rolls = []) {
  const currentLevel = Math.max(1, Number(character.level || 1));
  const targetLevel = Math.max(1, Number(newLevel || currentLevel));
  if (targetLevel === currentLevel) return;

  if (targetLevel > currentLevel) {
    ensureCharacterProgression(character, targetLevel);
    let hpGain = 0;
    for (let levelIndex = currentLevel; levelIndex < targetLevel; levelIndex += 1) {
      const suppliedRoll = normalizeD6(rolls[levelIndex - currentLevel] || character.progression.levelHpRolls[levelIndex - 1] || rollDiceString('1d6').total);
      character.progression.levelHpRolls[levelIndex - 1] = suppliedRoll;
      hpGain += suppliedRoll;
    }
    character.level = targetLevel;
    recalculateCharacterDerived(character, { hpGain, refillActions: true });
    return;
  }

  character.level = targetLevel;
  if (character.progression?.levelHpRolls) {
    character.progression.levelHpRolls = character.progression.levelHpRolls.slice(0, Math.max(0, targetLevel - 1));
  }
  recalculateCharacterDerived(character, { hpGain: 0, refillActions: true });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error || new Error('Could not read file.'));
    reader.readAsDataURL(file);
  });
}

function currentCharacterRecord() {
  return state.characters.find((character) => character.id === state.activeCharacter?.id);
}

function saveAllCharacters() {
  saveCharacters(state.characters);
}

function upsertActiveCharacter(character) {
  character.updatedAt = new Date().toISOString();
  const index = state.characters.findIndex((item) => item.id === character.id);
  if (index >= 0) state.characters[index] = character;
  else state.characters.unshift(character);
  state.activeCharacter = character;
  saveAllCharacters();
}

function render() {
  if (!state.data) {
    appEl.innerHTML = `<section class="section"><h2>Loading…</h2></section>`;
    return;
  }
  if (state.view === 'builder') {
    state.validation = validateBuilder(state.builder, state.data);
    appEl.innerHTML = renderBuilder(state, state.data);
  } else if (state.view === 'sheet') {
    appEl.innerHTML = renderSheet(state, state.data);
  } else if (state.view === 'library') {
    appEl.innerHTML = renderLibrary(state, state.data);
  } else {
    appEl.innerHTML = renderHome(state, state.data);
  }
}

function openModal(html, context = null) {
  state.modalContext = context;
  modalEl.innerHTML = html;
  modalEl.showModal();
}

function closeModal() {
  modalEl.close();
  modalEl.innerHTML = '';
  state.modalContext = null;
}

function resetBuilder() {
  state.builder = createEmptyBuilder(state.data);
  ensureBuilderProgression(state.builder);
  state.validation = validateBuilder(state.builder, state.data);
}

function openCharacter(id) {
  const character = state.characters.find((item) => item.id === id);
  if (!character) return;
  state.activeCharacter = deepClone(character);
  state.sheetTab = 'overview';
  state.sheetHeaderCollapsed = typeof window !== 'undefined' ? window.matchMedia('(max-width: 720px)').matches : state.sheetHeaderCollapsed;
  recalculateCharacterDerived(state.activeCharacter, { hpGain: 0, refillActions: false });
  state.view = 'sheet';
  render();
}

function editCharacter(id) {
  const character = state.characters.find((item) => item.id === id);
  if (!character) return;
  state.builder = builderFromCharacter(deepClone(character), state.data);
  state.view = 'builder';
  render();
}

function updateBuilderField(path, value, type = 'text', checked = false) {
  setByPath(state.builder, path, value, type, checked);
  if (path === 'animalId') {
    const animal = state.data.allAnimals.find((item) => item.id === value);
    if (animal) state.builder.growthStepCurrent = animal.sizeLevel || state.builder.growthStepCurrent;
  }
  if (path === 'backgroundId') {
    ensureProgramSlots();
  }
  if (path === 'level' || path.startsWith('progression.')) {
    ensureBuilderProgression(state.builder);
  }
  render();
}

function updateCharacterField(path, value, type = 'text', checked = false) {
  pushHistory(state.activeCharacter);
  const previousLevel = Number(state.activeCharacter.level || 1);
  setByPath(state.activeCharacter, path, value, type, checked);

  if (path === 'level') {
    applyLevelChange(state.activeCharacter, Number(state.activeCharacter.level || previousLevel));
  } else {
    if (path === 'health.hp') {
      state.activeCharacter.health.hp = clamp(Number(state.activeCharacter.health.hp || 0), 0, Number(state.activeCharacter.health.maxHp || state.activeCharacter.health.hp || 0));
    }
    if (path === 'health.sdc') {
      state.activeCharacter.health.sdc = clamp(Number(state.activeCharacter.health.sdc || 0), 0, Number(state.activeCharacter.health.maxSdc || state.activeCharacter.health.sdc || 0));
    }
    if (path === 'combat.actionsRemaining') {
      state.activeCharacter.combat.actionsRemaining = clamp(Number(state.activeCharacter.combat.actionsRemaining || 0), 0, maxActionsFor(state.activeCharacter));
    }
    if (path === 'combat.actionsPerMelee') {
      state.activeCharacter.combat.actionsPerMelee = Math.max(0, Number(state.activeCharacter.combat.actionsPerMelee || 0));
      state.activeCharacter.combat.actionsRemaining = clamp(Number(state.activeCharacter.combat.actionsRemaining || 0), 0, maxActionsFor(state.activeCharacter));
    }

    const needsRecalc = path.startsWith('attributes.')
      || path === 'combat.handToHandStyle'
      || path.startsWith('combat.manual')
      || path === 'health.ar'
      || path === 'backgroundId';

    if (needsRecalc) {
      recalculateCharacterDerived(state.activeCharacter, { hpGain: 0, refillActions: false });
    }
  }

  upsertActiveCharacter(state.activeCharacter);
  render();
}


function toggleListValue(list, value) {
  const index = list.indexOf(value);
  if (index >= 0) list.splice(index, 1);
  else list.push(value);
}

function ensureProgramSlots() {
  const bg = state.data.backgrounds.find((b) => b.id === state.builder.backgroundId);
  const needed = Number(bg?.programSelections || 0);
  state.builder.skills.scholasticPrograms = state.builder.skills.scholasticPrograms || [];
  while (state.builder.skills.scholasticPrograms.length < needed) {
    state.builder.skills.scholasticPrograms.push({ programId: '', picks: [] });
  }
  if (state.builder.skills.scholasticPrograms.length > needed) {
    state.builder.skills.scholasticPrograms = state.builder.skills.scholasticPrograms.slice(0, needed);
  }
}

function saveBuilderToCharacter() {
  const validation = validateBuilder(state.builder, state.data);
  state.validation = validation;
  if (validation.errors.length && !state.builder.gmOverride) {
    openModal(renderPromptModal({
      title: 'Rules validation failed',
      body: `<div class="notice bad">${validation.errors.map((error) => `<div>• ${error}</div>`).join('')}</div><p class="muted">Turn on GM Override in the builder if you want to save anyway.</p>`,
      primaryLabel: 'Close',
      action: 'close-modal',
      cancelLabel: 'Close'
    }));
    return;
  }
  ensureBuilderProgression(state.builder);
  const character = resolveBuilderToCharacter(state.builder, state.data);
  const existing = state.characters.find((item) => item.id === character.id);
  if (existing?.history) character.history = existing.history;
  recalculateCharacterDerived(character, { hpGain: 0, refillActions: true });
  upsertActiveCharacter(character);
  state.sheetHeaderCollapsed = typeof window !== 'undefined' ? window.matchMedia('(max-width: 720px)').matches : state.sheetHeaderCollapsed;
  state.view = 'sheet';
  render();
}

function exportCharacterById(id) {
  const character = state.characters.find((item) => item.id === id);
  if (!character) return;
  downloadJson(`${slugify(character.name || 'character')}.json`, character);
}

function promptItemPicker(location) {
  openModal(renderItemPickerModal(state.data.allItems, location), { type: 'item-picker', location });
}

function addItemToTarget(location, itemId, target = state.view === 'builder' ? state.builder.inventory : state.activeCharacter.inventory) {
  const list = target[location] || (target[location] = []);
  list.push({
    id: uid('item'),
    itemId,
    qty: 1,
    equipped: false,
    questItem: false,
    notes: ''
  });
}

function saveCustomAnimal() {
  try {
    const powers = (document.getElementById('custom-animal-powers').value || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const [cost, name, effect] = line.split('|');
      return { cost: Number(cost || 0), name: name?.trim() || 'Power', effect: effect?.trim() || '' };
    });
    const naturalWeapons = (document.getElementById('custom-animal-weapons').value || '').split('\n').map((line) => line.trim()).filter(Boolean).map((line) => {
      const [cost, name, damage] = line.split('|');
      return { cost: Number(cost || 0), name: name?.trim() || 'Natural Weapon', damage: damage?.trim() || '' };
    });
    const bonuses = JSON.parse(document.getElementById('custom-animal-bonuses').value || '{}');
    const animal = {
      id: uid('animal'),
      name: document.getElementById('custom-animal-name').value.trim(),
      category: document.getElementById('custom-animal-category').value.trim() || 'Custom',
      sizeLevel: Number(document.getElementById('custom-animal-size').value || 1),
      totalBioE: Number(document.getElementById('custom-animal-bioe').value || 0),
      length: document.getElementById('custom-animal-length').value.trim(),
      weight: document.getElementById('custom-animal-weight').value.trim(),
      build: document.getElementById('custom-animal-build').value.trim(),
      attributeBonuses: bonuses,
      featureCosts: {
        hands: [{ label: 'None', cost: 0 }, { label: 'Partial', cost: 5 }, { label: 'Full', cost: 10 }],
        biped: [{ label: 'None', cost: 0 }, { label: 'Partial', cost: 5 }, { label: 'Full', cost: 10 }],
        speech: [{ label: 'None', cost: 0 }, { label: 'Partial', cost: 5 }, { label: 'Full', cost: 10 }],
        looks: [{ label: 'None', cost: 0 }, { label: 'Partial', cost: 5 }, { label: 'Full', cost: 10 }]
      },
      powers,
      naturalWeapons,
      notes: 'Custom animal'
    };
    if (!animal.name) throw new Error('Name is required.');
    state.customLibrary.animals.unshift(animal);
    saveCustomLibrary(state.customLibrary);
    refreshMergedData();
    render();
  } catch (error) {
    openModal(renderPromptModal({ title: 'Could not save animal', body: `<div class="notice bad">${error.message}</div>`, primaryLabel: 'Close', action: 'close-modal', cancelLabel: 'Close' }));
  }
}

function saveCustomItem() {
  const item = {
    id: uid('item'),
    name: document.getElementById('custom-item-name').value.trim(),
    category: document.getElementById('custom-item-category').value.trim() || 'Custom',
    cost: Number(document.getElementById('custom-item-cost').value || 0),
    weight: Number(document.getElementById('custom-item-weight').value || 0),
    damage: document.getElementById('custom-item-damage').value.trim(),
    wp: document.getElementById('custom-item-wp').value.trim(),
    slots: (document.getElementById('custom-item-slots').value || '').split(',').map((item) => item.trim()).filter(Boolean),
    tags: (document.getElementById('custom-item-tags').value || '').split(',').map((item) => item.trim()).filter(Boolean)
  };
  if (!item.name) {
    openModal(renderPromptModal({ title: 'Could not save item', body: '<div class="notice bad">Item name is required.</div>', primaryLabel: 'Close', action: 'close-modal', cancelLabel: 'Close' }));
    return;
  }
  state.customLibrary.items.unshift(item);
  saveCustomLibrary(state.customLibrary);
  refreshMergedData();
  render();
}

function saveCustomStatus() {
  const status = {
    id: uid('status'),
    label: document.getElementById('custom-status-label').value.trim(),
    category: document.getElementById('custom-status-category').value.trim() || 'custom'
  };
  if (!status.label) {
    openModal(renderPromptModal({ title: 'Could not save status', body: '<div class="notice bad">Status label is required.</div>', primaryLabel: 'Close', action: 'close-modal', cancelLabel: 'Close' }));
    return;
  }
  state.customLibrary.statuses.unshift(status);
  saveCustomLibrary(state.customLibrary);
  refreshMergedData();
  render();
}

function deleteCustomEntry(type, index) {
  state.customLibrary[type].splice(index, 1);
  saveCustomLibrary(state.customLibrary);
  refreshMergedData();
  render();
}

function logDice(label, result) {
  const detail = result.rolls?.length ? `${result.rolls.join(', ')}${result.modifier ? ` ${result.modifier > 0 ? '+' : ''}${result.modifier}` : ''}` : 'direct';
  state.diceLog.unshift({ label, total: result.total, detail, at: Date.now() });
  state.diceLog = state.diceLog.slice(0, 30);
  saveDiceLog(state.diceLog);
}

function openDiceModal() {
  openModal(renderDiceModal(state.diceLog), { type: 'dice' });
}

function scrollToId(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action } = button.dataset;

  if (action === 'home') {
    state.view = 'home';
    state.activeCharacter = null;
    render();
    return;
  }
  if (action === 'new-character') {
    resetBuilder();
    state.view = 'builder';
    render();
    return;
  }
  if (action === 'open-character') {
    openCharacter(button.dataset.id);
    return;
  }
  if (action === 'edit-character' || action === 'open-character-builder') {
    editCharacter(button.dataset.id || state.activeCharacter?.id);
    return;
  }
  if (action === 'delete-character') {
    state.characters = state.characters.filter((item) => item.id !== button.dataset.id);
    saveAllCharacters();
    render();
    return;
  }
  if (action === 'use-template') {
    const template = state.data.templates.find((item) => item.id === button.dataset.id);
    if (!template) return;
    const character = createCharacterFromTemplate(template);
    upsertActiveCharacter(character);
    state.sheetTab = 'overview';
    state.view = 'sheet';
    render();
    return;
  }
  if (action === 'scroll-templates') { scrollToId('templates-anchor'); return; }
  if (action === 'scroll-recent') { scrollToId('recent-anchor'); return; }
  if (action === 'randomize-attributes') {
    state.builder = rollAllAttributes(state.builder);
    render();
    return;
  }
  if (action === 'randomize-animal') {
    state.builder = randomizeAnimal(state.builder, state.data);
    render();
    return;
  }
  if (action === 'apply-starting-money') {
    state.builder = applyBackgroundMoney(state.builder, state.data);
    render();
    return;
  }
  if (action === 'toggle-gm-override') {
    state.builder.gmOverride = !state.builder.gmOverride;
    render();
    return;
  }
  if (action === 'toggle-team') {
    state.builder.team.enabled = !state.builder.team.enabled;
    render();
    return;
  }
  if (action === 'builder-program') {
    ensureProgramSlots();
    state.builder.skills.scholasticPrograms[Number(button.dataset.index)] = { programId: button.value, picks: [] };
    render();
    return;
  }
  if (action === 'builder-program-pick') {
    ensureProgramSlots();
    const slot = state.builder.skills.scholasticPrograms[Number(button.dataset.index)] || { programId: '', picks: [] };
    slot.picks = slot.picks || [];
    toggleListValue(slot.picks, button.value);
    state.builder.skills.scholasticPrograms[Number(button.dataset.index)] = slot;
    render();
    return;
  }
  if (action === 'toggle-builder-power') {
    toggleListValue(state.builder.features.selectedPowers, button.value);
    render();
    return;
  }
  if (action === 'toggle-builder-natural-weapon') {
    toggleListValue(state.builder.features.selectedNaturalWeapons, button.value);
    render();
    return;
  }
  if (action === 'toggle-builder-physical-skill') {
    toggleListValue(state.builder.combat.physicalSkills, button.value);
    render();
    return;
  }
  if (action === 'builder-secondary-skill') {
    toggleListValue(state.builder.skills.secondarySkills, button.value);
    render();
    return;
  }
  if (action === 'reroll-builder-base-hp') {
    rerollBuilderHpRoll(state.builder, -1);
    render();
    return;
  }
  if (action === 'reroll-builder-level-hp') {
    rerollBuilderHpRoll(state.builder, Number(button.dataset.index || 0));
    render();
    return;
  }
  if (action === 'toggle-sheet-header') {
    state.sheetHeaderCollapsed = !state.sheetHeaderCollapsed;
    render();
    return;
  }
  if (action === 'open-level-up') {
    openModal(renderLevelUpModal(state.activeCharacter, rollDiceString('1d6').total), { type: 'level-up' });
    return;
  }
  if (action === 'reroll-level-up-roll') {
    const input = document.getElementById('level-up-roll');
    if (input) input.value = String(rollDiceString('1d6').total);
    return;
  }
  if (action === 'apply-level-up') {
    const input = document.getElementById('level-up-roll');
    const hpRoll = normalizeD6(input?.value || rollDiceString('1d6').total);
    pushHistory(state.activeCharacter);
    applyLevelChange(state.activeCharacter, Number(state.activeCharacter.level || 1) + 1, [hpRoll]);
    upsertActiveCharacter(state.activeCharacter);
    closeModal();
    render();
    return;
  }
  if (action === 'save-builder') {
    saveBuilderToCharacter();
    return;
  }
  if (action === 'export-character') {
    exportCharacterById(button.dataset.id);
    return;
  }
  if (action === 'export-active-character') {
    downloadJson(`${slugify(state.activeCharacter.name || 'character')}.json`, state.activeCharacter);
    return;
  }
  if (action === 'save-character') {
    upsertActiveCharacter(state.activeCharacter);
    render();
    return;
  }
  if (action === 'set-sheet-tab') {
    state.sheetTab = button.dataset.tab || 'overview';
    render();
    return;
  }
  if (action === 'undo') {
    const record = currentCharacterRecord() || state.activeCharacter;
    if (!record?.history?.undoStack?.length) return;
    const current = deepClone({ ...state.activeCharacter, history: { undoStack: [], redoStack: [] } });
    const previous = record.history.undoStack.shift();
    record.history.redoStack = record.history.redoStack || [];
    record.history.redoStack.unshift(current);
    state.activeCharacter = previous;
    state.activeCharacter.history = record.history;
    upsertActiveCharacter(state.activeCharacter);
    render();
    return;
  }
  if (action === 'redo') {
    const record = currentCharacterRecord() || state.activeCharacter;
    if (!record?.history?.redoStack?.length) return;
    const current = deepClone({ ...state.activeCharacter, history: { undoStack: [], redoStack: [] } });
    const next = record.history.redoStack.shift();
    record.history.undoStack = record.history.undoStack || [];
    record.history.undoStack.unshift(current);
    state.activeCharacter = next;
    state.activeCharacter.history = record.history;
    upsertActiveCharacter(state.activeCharacter);
    render();
    return;
  }
  if (action === 'reset-melee') {
    pushHistory(state.activeCharacter);
    resetMeleeState(state.activeCharacter);
    upsertActiveCharacter(state.activeCharacter);
    render();
    return;
  }
  if (action === 'spend-action') {
    pushHistory(state.activeCharacter);
    state.activeCharacter.combat.actionsRemaining = clamp(Number(state.activeCharacter.combat.actionsRemaining || 0) - 1, 0, maxActionsFor(state.activeCharacter));
    upsertActiveCharacter(state.activeCharacter);
    render();
    return;
  }
  if (action === 'reset-combat') {
    pushHistory(state.activeCharacter);
    resetCombatState(state.activeCharacter);
    upsertActiveCharacter(state.activeCharacter);
    render();
    return;
  }
  if (action === 'full-heal') {
    pushHistory(state.activeCharacter);
    setResourceToMax(state.activeCharacter, 'health.hp', 'health.maxHp');
    setResourceToMax(state.activeCharacter, 'health.sdc', 'health.maxSdc');
    upsertActiveCharacter(state.activeCharacter);
    render();
    return;
  }
  if (action === 'adjust-resource') {
    pushHistory(state.activeCharacter);
    const resource = button.dataset.resource;
    const delta = Number(button.dataset.delta || 0);
    if (resource === 'hp') adjustResource(state.activeCharacter, 'health.hp', delta, 'health.maxHp');
    if (resource === 'sdc') adjustResource(state.activeCharacter, 'health.sdc', delta, 'health.maxSdc');
    if (resource === 'actions') adjustResource(state.activeCharacter, 'combat.actionsRemaining', delta, 'combat.actionsPerMelee');
    upsertActiveCharacter(state.activeCharacter);
    render();
    return;
  }
  if (action === 'resource-to-max') {
    pushHistory(state.activeCharacter);
    const resource = button.dataset.resource;
    if (resource === 'hp') setResourceToMax(state.activeCharacter, 'health.hp', 'health.maxHp');
    if (resource === 'sdc') setResourceToMax(state.activeCharacter, 'health.sdc', 'health.maxSdc');
    if (resource === 'actions') setResourceToMax(state.activeCharacter, 'combat.actionsRemaining', 'combat.actionsPerMelee');
    upsertActiveCharacter(state.activeCharacter);
    render();
    return;
  }
  if (action === 'open-avatar-upload') {
    avatarFileEl?.click();
    return;
  }
  if (action === 'remove-avatar') {
    pushHistory(state.activeCharacter);
    delete state.activeCharacter.avatarDataUrl;
    upsertActiveCharacter(state.activeCharacter);
    render();
    return;
  }
  if (action === 'char-status') {
    pushHistory(state.activeCharacter);
    toggleListValue(state.activeCharacter.statuses, button.value);
    upsertActiveCharacter(state.activeCharacter);
    render();
    return;
  }
  if (action === 'char-add-carried-item') { promptItemPicker('carried'); return; }
  if (action === 'char-add-stash-item') { promptItemPicker('stash'); return; }
  if (action === 'builder-add-item') { promptItemPicker('carried'); return; }
  if (action === 'builder-add-stash-item') { promptItemPicker('stash'); return; }
  if (action === 'pick-item') {
    if (state.view === 'builder') addItemToTarget(button.dataset.location, button.dataset.id, state.builder.inventory);
    else {
      pushHistory(state.activeCharacter);
      addItemToTarget(button.dataset.location, button.dataset.id, state.activeCharacter.inventory);
      recalculateCharacterDerived(state.activeCharacter, { hpGain: 0, refillActions: false });
      upsertActiveCharacter(state.activeCharacter);
    }
    closeModal();
    render();
    return;
  }
  if (action === 'char-delete-item') {
    pushHistory(state.activeCharacter);
    state.activeCharacter.inventory[button.dataset.location].splice(Number(button.dataset.index), 1);
    recalculateCharacterDerived(state.activeCharacter, { hpGain: 0, refillActions: false });
    upsertActiveCharacter(state.activeCharacter);
    render();
    return;
  }
  if (action === 'char-item-equipped') {
    return;
  }
  if (action === 'char-item-quest') {
    return;
  }
  if (action === 'char-delete-skill') {
    pushHistory(state.activeCharacter);
    state.activeCharacter.skills[button.dataset.section].splice(Number(button.dataset.index), 1);
    upsertActiveCharacter(state.activeCharacter);
    render();
    return;
  }
  if (action === 'add-manual-skill') {
    pushHistory(state.activeCharacter);
    state.activeCharacter.skills.manual.push({ id: uid('skill'), name: 'New Manual Skill', category: 'Manual', percent: 0, fromProgram: 'Manual' });
    upsertActiveCharacter(state.activeCharacter);
    render();
    return;
  }
  if (action === 'nav-builder') { resetBuilder(); state.view = 'builder'; render(); return; }
  if (action === 'nav-home') { state.view = 'home'; render(); return; }
  if (action === 'nav-library') { state.view = 'library'; render(); return; }
  if (action === 'open-dice') { openDiceModal(); return; }
  if (action === 'close-modal') { closeModal(); return; }
  if (action === 'roll-dice') {
    const result = rollDiceString(button.dataset.roll);
    logDice(button.dataset.roll.toUpperCase(), result);
    openDiceModal();
    return;
  }
  if (action === 'roll-custom-dice') {
    const value = document.getElementById('custom-roll-input').value;
    const result = rollDiceString(value);
    logDice(value, result);
    openDiceModal();
    return;
  }
  if (action === 'print-sheet') { window.print(); return; }
  if (action === 'open-import-character') { importCharacterFileEl.click(); return; }
  if (action === 'open-import-library') { importLibraryFileEl.click(); return; }
  if (action === 'export-library') { downloadJson('strangeness-tracker-library.json', state.customLibrary); return; }
  if (action === 'save-custom-animal') { saveCustomAnimal(); return; }
  if (action === 'save-custom-item') { saveCustomItem(); return; }
  if (action === 'save-custom-status') { saveCustomStatus(); return; }
  if (action === 'delete-custom-animal') { deleteCustomEntry('animals', Number(button.dataset.index)); return; }
  if (action === 'delete-custom-item') { deleteCustomEntry('items', Number(button.dataset.index)); return; }
  if (action === 'delete-custom-status') { deleteCustomEntry('statuses', Number(button.dataset.index)); return; }
});

document.addEventListener('change', (event) => {
  const target = event.target;
  if (target.matches('[data-builder-field]')) {
    ensureProgramSlots();
    updateBuilderField(target.dataset.builderField, target.value, target.type, target.checked);
    return;
  }
  if (target.matches('[data-char-field]')) {
    updateCharacterField(target.dataset.charField, target.value, target.type, target.checked);
    return;
  }
  if (target.matches('[data-action="builder-program"]')) {
    ensureProgramSlots();
    state.builder.skills.scholasticPrograms[Number(target.dataset.index)] = { programId: target.value, picks: [] };
    render();
    return;
  }
  if (target.matches('[data-action="builder-program-pick"]')) {
    ensureProgramSlots();
    const slot = state.builder.skills.scholasticPrograms[Number(target.dataset.index)] || { programId: '', picks: [] };
    slot.picks = slot.picks || [];
    toggleListValue(slot.picks, target.value);
    state.builder.skills.scholasticPrograms[Number(target.dataset.index)] = slot;
    render();
    return;
  }
  if (target.matches('[data-action="toggle-builder-power"]')) {
    toggleListValue(state.builder.features.selectedPowers, target.value);
    render();
    return;
  }
  if (target.matches('[data-action="toggle-builder-natural-weapon"]')) {
    toggleListValue(state.builder.features.selectedNaturalWeapons, target.value);
    render();
    return;
  }
  if (target.matches('[data-action="toggle-builder-physical-skill"]')) {
    toggleListValue(state.builder.combat.physicalSkills, target.value);
    render();
    return;
  }
  if (target.matches('[data-action="builder-secondary-skill"]')) {
    toggleListValue(state.builder.skills.secondarySkills, target.value);
    render();
    return;
  }
  if (target.matches('[data-action="char-item-equipped"]')) {
    pushHistory(state.activeCharacter);
    state.activeCharacter.inventory[target.dataset.location][Number(target.dataset.index)].equipped = target.checked;
    upsertActiveCharacter(state.activeCharacter);
    render();
    return;
  }
  if (target.matches('[data-action="char-item-quest"]')) {
    pushHistory(state.activeCharacter);
    state.activeCharacter.inventory[target.dataset.location][Number(target.dataset.index)].questItem = target.checked;
    upsertActiveCharacter(state.activeCharacter);
    render();
    return;
  }
  if (target.matches('[data-action="char-item-qty"]')) {
    pushHistory(state.activeCharacter);
    state.activeCharacter.inventory[target.dataset.location][Number(target.dataset.index)].qty = Number(target.value || 1);
    recalculateCharacterDerived(state.activeCharacter, { hpGain: 0, refillActions: false });
    upsertActiveCharacter(state.activeCharacter);
    render();
    return;
  }
  if (target.matches('[data-action="char-item-weight"]')) {
    pushHistory(state.activeCharacter);
    state.activeCharacter.inventory[target.dataset.location][Number(target.dataset.index)].weightOverride = Number(target.value || 0);
    recalculateCharacterDerived(state.activeCharacter, { hpGain: 0, refillActions: false });
    upsertActiveCharacter(state.activeCharacter);
    render();
    return;
  }
  if (target.matches('[data-action="char-item-cost"]')) {
    pushHistory(state.activeCharacter);
    state.activeCharacter.inventory[target.dataset.location][Number(target.dataset.index)].costOverride = Number(target.value || 0);
    upsertActiveCharacter(state.activeCharacter);
    render();
    return;
  }
  if (target.matches('[data-action="char-item-notes"]')) {
    pushHistory(state.activeCharacter);
    state.activeCharacter.inventory[target.dataset.location][Number(target.dataset.index)].notes = target.value;
    upsertActiveCharacter(state.activeCharacter);
    render();
    return;
  }
  if (target.matches('[data-action="char-skill-percent"]')) {
    pushHistory(state.activeCharacter);
    state.activeCharacter.skills[target.dataset.section][Number(target.dataset.index)].percent = target.value;
    upsertActiveCharacter(state.activeCharacter);
    render();
  }
});

document.getElementById('nav-home').addEventListener('click', () => { state.view = 'home'; render(); });
document.getElementById('nav-builder').addEventListener('click', () => { resetBuilder(); state.view = 'builder'; render(); });
document.getElementById('nav-library').addEventListener('click', () => { state.view = 'library'; render(); });
document.getElementById('open-dice').addEventListener('click', openDiceModal);

importCharacterFileEl.addEventListener('change', async () => {
  const file = importCharacterFileEl.files?.[0];
  if (!file) return;
  try {
    const character = await readJsonFile(file);
    character.id = character.id || uid('char');
    character.history = character.history || { undoStack: [], redoStack: [] };
    recalculateCharacterDerived(character, { hpGain: 0, refillActions: false });
    upsertActiveCharacter(character);
    state.sheetTab = 'overview';
    state.sheetHeaderCollapsed = typeof window !== 'undefined' ? window.matchMedia('(max-width: 720px)').matches : state.sheetHeaderCollapsed;
    state.view = 'sheet';
    render();
  } catch (error) {
    openModal(renderPromptModal({ title: 'Import failed', body: `<div class="notice bad">${error.message}</div>`, primaryLabel: 'Close', action: 'close-modal', cancelLabel: 'Close' }));
  } finally {
    importCharacterFileEl.value = '';
  }
});

importLibraryFileEl.addEventListener('change', async () => {
  const file = importLibraryFileEl.files?.[0];
  if (!file) return;
  try {
    const imported = await readJsonFile(file);
    state.customLibrary = {
      animals: imported.animals || [],
      items: imported.items || [],
      statuses: imported.statuses || []
    };
    saveCustomLibrary(state.customLibrary);
    refreshMergedData();
    render();
  } catch (error) {
    openModal(renderPromptModal({ title: 'Library import failed', body: `<div class="notice bad">${error.message}</div>`, primaryLabel: 'Close', action: 'close-modal', cancelLabel: 'Close' }));
  } finally {
    importLibraryFileEl.value = '';
  }
});

avatarFileEl?.addEventListener('change', async () => {
  const file = avatarFileEl.files?.[0];
  if (!file || !state.activeCharacter) return;
  try {
    const dataUrl = await readFileAsDataUrl(file);
    pushHistory(state.activeCharacter);
    state.activeCharacter.avatarDataUrl = dataUrl;
    recalculateCharacterDerived(state.activeCharacter, { hpGain: 0, refillActions: false });
    upsertActiveCharacter(state.activeCharacter);
    render();
  } catch (error) {
    openModal(renderPromptModal({ title: 'Avatar import failed', body: `<div class="notice bad">${error.message}</div>`, primaryLabel: 'Close', action: 'close-modal', cancelLabel: 'Close' }));
  } finally {
    avatarFileEl.value = '';
  }
});

async function start() {
  try {
    await loadData();
    resetBuilder();
    render();
  } catch (error) {
    appEl.innerHTML = `
      <section class="section">
        <h2>Could not load data</h2>
        <div class="notice bad">${error.message}</div>
        <p class="muted">Open this app through GitHub Pages or a local web server. Opening index.html directly from file:// usually blocks JSON loading.</p>
        <div class="code-block">python -m http.server 8000</div>
      </section>
    `;
  }
}

start();
