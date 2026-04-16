import {
  ATTRIBUTE_KEYS,
  ALIGNMENTS,
  calculateCombatAttributeBonuses,
  calculateCarryStats,
  calculateSpeedYardsPerMinute,
  deepClone,
  getGrowthEffects,
  getSkillPercent,
  growthCost,
  parseMoneyFormula,
  resolveHandToHand,
  accumulatePhysicalSkillBonuses,
  totalCarriedWeight,
  uid,
  wpStrikeBonus
} from './rules.js';

export function createEmptyBuilder(data) {
  const defaultAnimal = data.animals.find((a) => a.id === 'turtle') || data.animals[0];
  const defaultBackground = data.backgrounds.find((b) => b.id === 'random_mutation') || data.backgrounds[0];
  return {
    id: uid('char'),
    name: '',
    alignment: 'Scrupulous',
    age: 15,
    sex: 'Male',
    level: 1,
    creationMode: 'random',
    gmOverride: false,
    initiative: '',
    team: {
      enabled: false,
      size: 1,
      manualSharedBonuses: { iq: 0, me: 0, ma: 0, ps: 0, pp: 0, pe: 0, pb: 0, spd: 0 }
    },
    attributes: { iq: 10, me: 10, ma: 10, ps: 10, pp: 10, pe: 10, pb: 10, spd: 10 },
    animalId: defaultAnimal?.id || '',
    backgroundId: defaultBackground?.id || '',
    categoryFilter: defaultAnimal?.category || 'Urban',
    growthStepCurrent: defaultAnimal?.sizeLevel || 6,
    features: {
      hands: 'Full',
      biped: 'Full',
      speech: 'Full',
      looks: 'None',
      selectedPowers: [],
      selectedNaturalWeapons: []
    },
    combat: {
      handToHandStyle: 'basic',
      physicalSkills: [],
      manualBonusAttacks: 0,
      manualStrike: 0,
      manualParry: 0,
      manualDodge: 0,
      manualDamage: 0,
      manualRoll: 0,
      manualPullPunch: 0,
      currentInitiative: ''
    },
    skills: {
      scholasticPrograms: [],
      secondarySkills: [],
      manualSkills: []
    },
    inventory: { money: 0, carried: [], stash: [] },
    health: { hp: 0, maxHp: 0, sdc: 0, maxSdc: 0, ar: 0 },
    statuses: [],
    notes: ''
  };
}

export function createCharacterFromTemplate(template) {
  const character = deepClone(template);
  character.id = uid('char');
  character.templateId = template.id;
  character.createdAt = new Date().toISOString();
  character.updatedAt = new Date().toISOString();
  character.history = { undoStack: [], redoStack: [] };
  character.meta = {
    source: 'template',
    name: template.name
  };
  if (!character.statuses) character.statuses = [];
  if (!character.inventory) character.inventory = { money: 0, carried: [], stash: [] };
  if (!character.notes) character.notes = '';
  return character;
}

export function rollAllAttributes(builder) {
  const next = deepClone(builder);
  ATTRIBUTE_KEYS.forEach((key) => {
    let total = roll3d6();
    if (total >= 16) total += rollD6();
    next.attributes[key] = total;
  });
  return next;
}

function roll3d6() {
  return rollD6() + rollD6() + rollD6();
}
function rollD6() {
  return 1 + Math.floor(Math.random() * 6);
}

export function randomizeAnimal(builder, data) {
  const byCategory = {
    Urban: [
      { min: 1, max: 25, ids: ['dog_mongrel'] },
      { min: 26, max: 45, ids: ['cat_domestic'] },
      { min: 46, max: 55, ids: ['rodent_mouse', 'rodent_rat'] },
      { min: 61, max: 65, ids: ['squirrel'] },
      { min: 66, max: 75, ids: ['sparrow'] },
      { min: 76, max: 83, ids: ['pigeon'] },
      { min: 86, max: 88, ids: ['bat'] },
      { min: 89, max: 92, ids: ['turtle'] },
      { min: 93, max: 96, ids: ['frog'] },
      { min: 97, max: 100, ids: ['monkey'] }
    ],
    Rural: [
      { min: 1, max: 10, ids: ['dog_mongrel'] },
      { min: 11, max: 15, ids: ['cat_domestic'] },
      { min: 26, max: 35, ids: ['pig'] },
      { min: 36, max: 45, ids: ['chicken'] },
      { min: 46, max: 50, ids: ['duck'] },
      { min: 51, max: 60, ids: ['horse'] },
      { min: 61, max: 70, ids: ['rabbit'] },
      { min: 71, max: 80, ids: ['rodent_mouse'] },
      { min: 81, max: 85, ids: ['sheep'] },
      { min: 86, max: 90, ids: ['goat'] },
      { min: 95, max: 100, ids: ['bat'] }
    ],
    Wild: [
      { min: 1, max: 5, ids: ['wolf'] },
      { min: 6, max: 10, ids: ['coyote'] },
      { min: 11, max: 15, ids: ['fox'] },
      { min: 16, max: 20, ids: ['badger'] },
      { min: 21, max: 25, ids: ['bear_black'] },
      { min: 26, max: 27, ids: ['bear_grizzly'] },
      { min: 53, max: 55, ids: ['beaver'] },
      { min: 61, max: 65, ids: ['raccoon'] },
      { min: 71, max: 75, ids: ['skunk'] },
      { min: 89, max: 95, ids: ['deer'] },
      { min: 100, max: 100, ids: ['boar'] }
    ],
    Zoo: [
      { min: 11, max: 15, ids: ['feline_tiger'] },
      { min: 16, max: 20, ids: ['feline_jaguar'] },
      { min: 51, max: 60, ids: ['elephant'] },
      { min: 61, max: 65, ids: ['apes_chimp'] },
      { min: 66, max: 70, ids: ['apes_orangutan'] },
      { min: 71, max: 75, ids: ['apes_gorilla'] },
      { min: 76, max: 85, ids: ['monkey'] },
      { min: 91, max: 95, ids: ['camel'] }
    ]
  };

  const categoryRoll = 1 + Math.floor(Math.random() * 100);
  const category = categoryRoll <= 35 ? 'Urban' : categoryRoll <= 50 ? 'Rural' : categoryRoll <= 75 ? 'Wild' : categoryRoll <= 85 ? 'Wild Birds' : 'Zoo';
  const next = deepClone(builder);
  next.categoryFilter = category === 'Wild Birds' ? 'Urban' : category;
  const roll = 1 + Math.floor(Math.random() * 100);
  const table = byCategory[next.categoryFilter] || [];
  const picked = table.find((row) => roll >= row.min && roll <= row.max)?.ids?.[0] || next.animalId;
  if (picked && data.animals.some((a) => a.id === picked)) {
    next.animalId = picked;
    next.growthStepCurrent = data.animals.find((a) => a.id === picked)?.sizeLevel || next.growthStepCurrent;
  }
  return next;
}

export function applyBackgroundMoney(builder, data) {
  const bg = data.backgrounds.find((b) => b.id === builder.backgroundId);
  const next = deepClone(builder);
  next.inventory.money = bg?.moneyFormula ? parseMoneyFormula(bg.moneyFormula) : next.inventory.money;
  return next;
}

export function resolvedAnimal(builder, data) {
  return data.animals.find((a) => a.id === builder.animalId) || data.animals[0] || null;
}

function featureCost(options, chosenLabel) {
  const selected = options?.find((opt) => opt.label === chosenLabel) || options?.find((opt) => opt.label?.startsWith(chosenLabel)) || { cost: 0 };
  return Number(selected.cost || 0);
}

function selectedEffectValue(effectText, key) {
  if (!effectText) return null;
  const arMatch = /A\.R\.\s*:?\s*(\d+)/i.exec(effectText);
  const sdcMatch = /S\.D\.C\.\s*\+?\s*:?[\s+]*(\d+)/i.exec(effectText.replace(/\+/g, ' +'));
  if (key === 'ar') return arMatch ? Number(arMatch[1]) : null;
  if (key === 'sdc') return sdcMatch ? Number(sdcMatch[1]) : null;
  return null;
}

function resolveProgramSkills(selection, data, level, scholasticBonus, iqBonus) {
  if (!selection?.programId) return [];
  const program = data.programs.find((p) => p.id === selection.programId);
  if (!program) return [];
  const collected = [];
  const addSkill = (name) => {
    const skill = data.skills.find((s) => s.name === name);
    collected.push({
      id: uid('skill'),
      name,
      type: 'scholastic',
      percent: getSkillPercent(skill, level, scholasticBonus, iqBonus, false),
      base: skill?.base ?? null,
      perLevel: skill?.perLevel ?? null,
      category: skill?.category || 'Misc',
      fromProgram: program.label
    });
  };
  (program.fixed || program.skills || []).forEach(addSkill);
  (selection.picks || []).forEach(addSkill);
  return collected;
}

function resolveSecondarySkills(names, data, level, iqBonus) {
  return (names || []).map((name) => {
    const skill = data.skills.find((s) => s.name === name);
    return {
      id: uid('skill'),
      name,
      type: 'secondary',
      percent: getSkillPercent(skill, level, 0, iqBonus, true),
      base: skill?.base ?? null,
      perLevel: skill?.perLevel ?? null,
      category: skill?.category || 'Misc'
    };
  });
}

export function validateBuilder(builder, data) {
  const animal = resolvedAnimal(builder, data);
  const bg = data.backgrounds.find((b) => b.id === builder.backgroundId);
  const errors = [];
  const warnings = [];

  if (!builder.name.trim()) errors.push('Character name is required.');
  if (!animal) errors.push('Choose an animal.');

  const bio = calculateBioE(builder, data);
  if (bio.spent > bio.budget) errors.push(`BIO-E overspent: ${bio.spent} spent / ${bio.budget} budget.`);
  if (bio.spent < bio.budget) warnings.push(`BIO-E remaining: ${bio.budget - bio.spent}.`);

  if (bg?.secondarySelections && builder.skills.secondarySkills.length > bg.secondarySelections) {
    errors.push(`Too many secondary skills for selected background (${builder.skills.secondarySkills.length}/${bg.secondarySelections}).`);
  }
  if (bg?.programSelections && builder.skills.scholasticPrograms.filter((p) => p.programId).length > bg.programSelections) {
    errors.push(`Too many scholastic programs for selected background (${builder.skills.scholasticPrograms.filter((p) => p.programId).length}/${bg.programSelections}).`);
  }

  if ((builder.features.selectedPowers || []).some((id) => String(id).toLowerCase().includes('psionic')) && (Number(builder.attributes.me) < 12)) {
    errors.push('Characters need M.E. 12 or higher to purchase psionics.');
  }

  return { errors, warnings, bio };
}

export function calculateBioE(builder, data) {
  const animal = resolvedAnimal(builder, data);
  const growthBase = Number(animal?.sizeLevel || 6);
  const growthCurrent = Number(builder.growthStepCurrent || growthBase);
  const budget = Number(animal?.totalBioE || 0);
  const featureCosts = animal?.featureCosts || {};
  const spent =
    featureCost(featureCosts.hands, builder.features.hands) +
    featureCost(featureCosts.biped, builder.features.biped) +
    featureCost(featureCosts.speech, builder.features.speech) +
    featureCost(featureCosts.looks, builder.features.looks) +
    (builder.features.selectedPowers || []).reduce((sum, powerName) => {
      const power = (animal?.powers || []).find((p) => p.name === powerName);
      return sum + Number(power?.cost || 0);
    }, 0) +
    (builder.features.selectedNaturalWeapons || []).reduce((sum, weaponName) => {
      const weapon = (animal?.naturalWeapons || []).find((w) => w.name === weaponName);
      return sum + Number(weapon?.cost || 0);
    }, 0) +
    growthCost(growthBase, growthCurrent);
  return { budget, spent, remaining: budget - spent };
}

export function resolveBuilderToCharacter(builder, data) {
  const animal = resolvedAnimal(builder, data);
  const background = data.backgrounds.find((b) => b.id === builder.backgroundId) || null;
  const growth = getGrowthEffects(builder.growthStepCurrent || animal?.sizeLevel || 6);
  const iqBonus = (data.attribute_bonus_chart[String(builder.attributes.iq)] || {}).iqSkill || 0;
  const attrCombatBonuses = calculateCombatAttributeBonuses(data.attribute_bonus_chart, builder.attributes);
  const hand = resolveHandToHand(data.hand_to_hand, builder.combat.handToHandStyle, builder.level);
  const physical = accumulatePhysicalSkillBonuses(builder.combat.physicalSkills, data.physical_skill_effects);

  const animalAttrBonuses = animal?.attributeBonuses || {};
  const backgroundAttrBonuses = background?.attributeBonuses || {};

  const attributes = deepClone(builder.attributes);
  attributes.iq += Number(animalAttrBonuses.iq || 0) + Number(backgroundAttrBonuses.iq || 0) + Number(builder.team.manualSharedBonuses.iq || 0) + Number(growth.iq || 0);
  attributes.me += Number(animalAttrBonuses.me || 0) + Number(backgroundAttrBonuses.me || 0) + Number(builder.team.manualSharedBonuses.me || 0);
  attributes.ma += Number(animalAttrBonuses.ma || 0) + Number(backgroundAttrBonuses.ma || 0) + Number(builder.team.manualSharedBonuses.ma || 0);
  attributes.ps += Number(animalAttrBonuses.ps || 0) + Number(backgroundAttrBonuses.ps || 0) + Number(builder.team.manualSharedBonuses.ps || 0) + Number(growth.ps || 0) + Number(physical.ps || 0);
  attributes.pp += Number(animalAttrBonuses.pp || 0) + Number(backgroundAttrBonuses.pp || 0) + Number(builder.team.manualSharedBonuses.pp || 0) + Number(physical.pp || 0);
  attributes.pe += Number(animalAttrBonuses.pe || 0) + Number(backgroundAttrBonuses.pe || 0) + Number(builder.team.manualSharedBonuses.pe || 0) + Number(growth.pe || 0) + Number(physical.pe || 0);
  attributes.pb += Number(animalAttrBonuses.pb || 0) + Number(backgroundAttrBonuses.pb || 0) + Number(builder.team.manualSharedBonuses.pb || 0);
  attributes.spd += Number(animalAttrBonuses.spd || 0) + Number(backgroundAttrBonuses.spd || 0) + Number(builder.team.manualSharedBonuses.spd || 0) + Number(growth.spd || 0) + Number(physical.spd || 0);

  const combatFromAttrs = calculateCombatAttributeBonuses(data.attribute_bonus_chart, attributes);
  const strike = combatFromAttrs.strike + hand.strike + physical.strike + Number(builder.combat.manualStrike || 0);
  const parry = combatFromAttrs.parry + hand.parry + physical.parry + Number(builder.combat.manualParry || 0);
  const dodge = combatFromAttrs.dodge + hand.dodge + physical.dodge + Number(builder.combat.manualDodge || 0);
  const damage = combatFromAttrs.damage + hand.damage + physical.damage + Number(builder.combat.manualDamage || 0);
  const roll = hand.roll + physical.roll + Number(builder.combat.manualRoll || 0);
  const pullPunch = hand.pullPunch + Number(builder.combat.manualPullPunch || 0);
  const actionsPerMelee = 2 + hand.attacks + physical.attacks + Number(builder.combat.manualBonusAttacks || 0) + Number(background?.extraAttacks || 0);

  const naturalArmorEffects = (animal?.powers || [])
    .filter((p) => (builder.features.selectedPowers || []).includes(p.name) && /Natural Body Armour/i.test(p.name));
  const naturalAr = Math.max(0, ...naturalArmorEffects.map((p) => selectedEffectValue(p.effect, 'ar') || 0));
  const naturalSdcBonus = naturalArmorEffects.reduce((sum, p) => sum + Number(selectedEffectValue(p.effect, 'sdc') || 0), 0);

  const scholasticBonus = Number(background?.scholasticBonus || 0);
  const automaticSkills = ['Mathematics: Basic', 'Read/Write Native Language', 'Speaks Native Language']
    .concat(background?.automaticSkills || [])
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .map((name) => {
      const skill = data.skills.find((s) => s.name === name);
      return {
        id: uid('skill'),
        name,
        type: 'automatic',
        percent: getSkillPercent(skill, builder.level, scholasticBonus, iqBonus, false),
        base: skill?.base ?? null,
        perLevel: skill?.perLevel ?? null,
        category: skill?.category || 'Automatic'
      };
    });

  const scholasticSkills = (builder.skills.scholasticPrograms || []).flatMap((selection) =>
    resolveProgramSkills(selection, data, builder.level, scholasticBonus, iqBonus)
  );
  const secondarySkills = resolveSecondarySkills(builder.skills.secondarySkills, data, builder.level, iqBonus);
  const manualSkills = (builder.skills.manualSkills || []).map((skill) => ({ ...skill, id: skill.id || uid('skill') }));

  const carry = calculateCarryStats(attributes.ps);
  const carriedWeight = totalCarriedWeight(builder.inventory.carried, data.items);
  const hpMax = Number(builder.health.maxHp || builder.health.hp || 0) || (1 + Math.floor(Math.random() * 6) + Number(attributes.pe || 0));
  const sdcMax = Number(builder.health.maxSdc || builder.health.sdc || 0) || (Number(growth.sdc || 0) + Number(physical.sdc || 0) + naturalSdcBonus + Number(background?.attributeBonuses?.sdcFlat || 0));

  const character = {
    id: builder.id || uid('char'),
    templateId: null,
    name: builder.name.trim(),
    alignment: builder.alignment,
    age: builder.age,
    sex: builder.sex,
    level: Number(builder.level || 1),
    gmOverride: !!builder.gmOverride,
    initiative: builder.initiative,
    team: deepClone(builder.team),
    animalId: animal?.id || null,
    animalName: animal?.name || '',
    category: animal?.category || '',
    backgroundId: background?.id || null,
    backgroundLabel: background?.label || '',
    attributes,
    derived: {
      iqSkillBonus: iqBonus,
      carry,
      speedYardsPerMinute: calculateSpeedYardsPerMinute(attributes.spd),
      sizeStep: Number(builder.growthStepCurrent || animal?.sizeLevel || 6),
      weightRange: growth.weightRange,
      carriedWeight,
      encumbered: carriedWeight > carry.carry
    },
    features: deepClone(builder.features),
    combat: {
      handToHandStyle: builder.combat.handToHandStyle,
      actionsPerMelee,
      actionsRemaining: actionsPerMelee,
      strike,
      parry,
      dodge,
      damage,
      roll,
      pullPunch,
      bodyBlockStrike: physical.bodyBlockStrike || 0,
      bodyBlockDamage: physical.bodyBlockDamage || '1D4',
      kickDamage: hand.kickDamage || '1D6',
      underwaterDodge: physical.underwaterDodge || 0,
      special: [...new Set([...(hand.special || []), ...(physical.special || [])])],
      manualBonusAttacks: builder.combat.manualBonusAttacks,
      manualStrike: builder.combat.manualStrike,
      manualParry: builder.combat.manualParry,
      manualDodge: builder.combat.manualDodge,
      manualDamage: builder.combat.manualDamage,
      manualRoll: builder.combat.manualRoll,
      manualPullPunch: builder.combat.manualPullPunch,
      currentInitiative: builder.combat.currentInitiative || builder.initiative || ''
    },
    health: {
      hp: Number(builder.health.hp || hpMax),
      maxHp: hpMax,
      sdc: Number(builder.health.sdc || sdcMax),
      maxSdc: sdcMax,
      ar: Math.max(Number(builder.health.ar || 0), naturalAr)
    },
    skills: {
      automatic: automaticSkills,
      scholastic: scholasticSkills,
      secondary: secondarySkills,
      manual: manualSkills,
      physical: deepClone(builder.combat.physicalSkills),
      scholasticPrograms: deepClone(builder.skills.scholasticPrograms),
      secondaryNames: deepClone(builder.skills.secondarySkills)
    },
    inventory: deepClone(builder.inventory),
    statuses: deepClone(builder.statuses || []),
    notes: builder.notes || '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: { undoStack: [], redoStack: [] }
  };

  return character;
}

export function builderFromCharacter(character, data) {
  const builder = createEmptyBuilder(data);
  builder.id = character.id;
  builder.name = character.name;
  builder.alignment = character.alignment;
  builder.age = character.age;
  builder.sex = character.sex;
  builder.level = character.level;
  builder.gmOverride = character.gmOverride;
  builder.initiative = character.initiative || '';
  builder.team = deepClone(character.team || builder.team);
  builder.attributes = deepClone(character.attributes || builder.attributes);
  builder.animalId = character.animalId || builder.animalId;
  builder.categoryFilter = character.category || builder.categoryFilter;
  builder.backgroundId = character.backgroundId || builder.backgroundId;
  builder.growthStepCurrent = character.derived?.sizeStep || builder.growthStepCurrent;
  builder.features = deepClone(character.features || builder.features);
  builder.combat.handToHandStyle = character.combat?.handToHandStyle || builder.combat.handToHandStyle;
  builder.combat.physicalSkills = deepClone(character.skills?.physical || []);
  builder.combat.currentInitiative = character.combat?.currentInitiative || '';
  builder.health = deepClone(character.health || builder.health);
  builder.inventory = deepClone(character.inventory || builder.inventory);
  builder.statuses = deepClone(character.statuses || []);
  builder.notes = character.notes || '';
  builder.skills.scholasticPrograms = deepClone(character.skills?.scholasticPrograms || []);
  builder.skills.secondarySkills = deepClone(character.skills?.secondaryNames || []);
  builder.skills.manualSkills = deepClone(character.skills?.manual || []);
  return builder;
}

export { ALIGNMENTS };
