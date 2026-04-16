export const ALIGNMENTS = [
  'Principled',
  'Scrupulous',
  'Unprincipled',
  'Anarchist',
  'Miscreant',
  'Aberrant',
  'Diabolic'
];

export const ATTRIBUTE_KEYS = ['iq', 'me', 'ma', 'ps', 'pp', 'pe', 'pb', 'spd'];

export const GROWTH_STEPS = {
  1: { weightRange: '0-1 lbs', bioE: 0, iq: -8, ps: -12, pe: -4, spd: 7, sdc: 5 },
  2: { weightRange: 'to 5 lbs', bioE: 5, iq: -6, ps: -6, pe: -2, spd: 5, sdc: 10 },
  3: { weightRange: 'to 10 lbs', bioE: 10, iq: -4, ps: -3, pe: -1, spd: 3, sdc: 15 },
  4: { weightRange: 'to 20 lbs', bioE: 15, iq: -2, ps: -2, pe: 0, spd: 0, sdc: 20 },
  5: { weightRange: 'to 40 lbs', bioE: 20, iq: 0, ps: -1, pe: 0, spd: 0, sdc: 25 },
  6: { weightRange: 'to 75 lbs', bioE: 25, iq: 0, ps: 0, pe: 0, spd: 0, sdc: 30 },
  7: { weightRange: 'to 100 lbs', bioE: 30, iq: 0, ps: 1, pe: 0, spd: 0, sdc: 30 },
  8: { weightRange: 'to 150 lbs', bioE: 35, iq: 0, ps: 2, pe: 0, spd: 0, sdc: 35 },
  9: { weightRange: 'to 175 lbs', bioE: 40, iq: 0, ps: 3, pe: 1, spd: 0, sdc: 35 },
  10: { weightRange: 'to 200 lbs', bioE: 45, iq: 0, ps: 4, pe: 2, spd: 0, sdc: 35 },
  11: { weightRange: 'to 250 lbs', bioE: 50, iq: 0, ps: 5, pe: 3, spd: -1, sdc: 40 },
  12: { weightRange: 'to 300 lbs', bioE: 55, iq: 0, ps: 6, pe: 4, spd: -2, sdc: 40 },
  13: { weightRange: 'to 350 lbs', bioE: 60, iq: 0, ps: 7, pe: 5, spd: -3, sdc: 45 },
  14: { weightRange: 'to 400 lbs', bioE: 65, iq: 0, ps: 8, pe: 6, spd: -4, sdc: 50 },
  15: { weightRange: 'to 500 lbs', bioE: 70, iq: 0, ps: 9, pe: 7, spd: -5, sdc: 55 },
  16: { weightRange: 'to 600 lbs', bioE: 75, iq: 0, ps: 10, pe: 8, spd: -6, sdc: 60 },
  17: { weightRange: 'to 800 lbs', bioE: 80, iq: 0, ps: 11, pe: 9, spd: -7, sdc: 65 },
  18: { weightRange: 'to 1000 lbs', bioE: 85, iq: 0, ps: 12, pe: 10, spd: -8, sdc: 70 },
  19: { weightRange: 'to 1500 lbs', bioE: 90, iq: 0, ps: 13, pe: 11, spd: -9, sdc: 75 },
  20: { weightRange: 'to 2500 lbs', bioE: 95, iq: 0, ps: 14, pe: 12, spd: -10, sdc: 80 }
};

export function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function uid(prefix = 'id') {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}-${Date.now().toString(36)}`;
}

export function diceCount(str) {
  const match = /^(\d+)D(\d+)$/i.exec(String(str).trim());
  if (!match) return null;
  return { count: Number(match[1]), sides: Number(match[2]) };
}

export function rollDiceString(input) {
  const expr = String(input).trim().toUpperCase();
  if (!expr) {
    return { total: 0, rolls: [] };
  }
  if (expr === 'D%') {
    return { total: rollPercentile(), rolls: [] };
  }
  const mathMatch = expr.match(/^(\d*)D(\d+)([+-]\d+)?$/);
  if (!mathMatch) {
    return { total: Number(expr) || 0, rolls: [] };
  }
  const count = Number(mathMatch[1] || 1);
  const sides = Number(mathMatch[2]);
  const mod = Number(mathMatch[3] || 0);
  const rolls = Array.from({ length: count }, () => 1 + Math.floor(Math.random() * sides));
  return { total: rolls.reduce((a, b) => a + b, 0) + mod, rolls, modifier: mod };
}

export function rollPercentile() {
  const tens = Math.floor(Math.random() * 10);
  const ones = Math.floor(Math.random() * 10);
  const total = (tens * 10) + ones;
  return total === 0 ? 100 : total;
}

export function calculateIqBonus(chart, iq) {
  return (chart[String(iq)] || chart[iq] || {}).iqSkill || 0;
}

export function calculateCombatAttributeBonuses(chart, attrs) {
  const pp = chart[String(attrs.pp)] || chart[attrs.pp] || {};
  const spd = chart[String(attrs.spd)] || chart[attrs.spd] || {};
  const ps = chart[String(attrs.ps)] || chart[attrs.ps] || {};
  const pe = chart[String(attrs.pe)] || chart[attrs.pe] || {};
  const me = chart[String(attrs.me)] || chart[attrs.me] || {};
  return {
    strike: pp.ppCombat || 0,
    parry: pp.ppCombat || 0,
    dodge: (pp.ppCombat || 0) + (spd.spdDodge || 0),
    damage: ps.psDamage || 0,
    saveVsComa: pe.peSave || 0,
    saveVsPsionics: me.meSave || 0,
    iqSkillBonus: calculateIqBonus(chart, attrs.iq)
  };
}

export function calculateCarryStats(ps) {
  const value = Number(ps) || 0;
  if (value >= 24) {
    return { carry: value * 50, lift: value * 100 };
  }
  if (value >= 20) {
    return { carry: value * 30, lift: value * 60 };
  }
  if (value >= 15) {
    return { carry: value * 20, lift: value * 40 };
  }
  return { carry: value * 10, lift: value * 30 };
}

export function calculateSpeedYardsPerMinute(spd) {
  return (Number(spd) || 0) * 20;
}

export function growthCost(baseStep, currentStep) {
  return (Number(currentStep) - Number(baseStep)) * 5;
}

export function getGrowthEffects(step) {
  return GROWTH_STEPS[Number(step)] || GROWTH_STEPS[6];
}

export function parseMoneyFormula(formula) {
  if (!formula) return 0;
  const clean = formula.replace(/\s+/g, '').toUpperCase();
  const mult = clean.split('*');
  if (mult.length === 2) {
    return rollDiceString(mult[0]).total * Number(mult[1]);
  }
  return rollDiceString(clean).total;
}

export function resolveHandToHand(handData, styleId, level) {
  const style = handData[styleId] || handData.basic;
  const resolved = {
    label: style.label,
    attacks: 0,
    strike: 0,
    parry: 0,
    dodge: 0,
    damage: 0,
    roll: 0,
    pullPunch: 0,
    kickDamage: '1D6',
    special: [...(style.includes || [])]
  };
  for (let i = 1; i <= Number(level || 1); i += 1) {
    const step = style.levels[String(i)] || {};
    resolved.attacks += step.attacks || 0;
    resolved.strike += step.strike || 0;
    resolved.parry += step.parry || 0;
    resolved.dodge += step.dodge || 0;
    resolved.damage += step.damage || 0;
    resolved.roll += step.roll || 0;
    resolved.pullPunch += step.pullPunch || 0;
    if (step.kickDamage) resolved.kickDamage = step.kickDamage;
    if (step.special) resolved.special.push(...step.special);
  }
  return resolved;
}

export function accumulatePhysicalSkillBonuses(selectedSkills, physicalSkillEffects) {
  const out = {
    ps: 0,
    pp: 0,
    pe: 0,
    spd: 0,
    sdc: 0,
    attacks: 0,
    strike: 0,
    parry: 0,
    dodge: 0,
    roll: 0,
    bodyBlockStrike: 0,
    bodyBlockDamage: null,
    underwaterDodge: 0,
    special: []
  };
  for (const skillName of selectedSkills || []) {
    const effect = physicalSkillEffects[skillName];
    if (!effect) continue;
    out.ps += Number(effect.ps || 0);
    out.pp += averageDice(effect.ppDice);
    out.pe += Number(effect.pe || 0);
    out.spd += averageDice(effect.spdDice);
    out.sdc += Number(effect.sdcFlat || 0) + averageDice(effect.sdcDice);
    out.attacks += Number(effect.attacks || 0);
    out.strike += Number(effect.strike || 0);
    out.parry += Number(effect.parry || 0);
    out.dodge += Number(effect.dodge || 0);
    out.roll += Number(effect.roll || 0);
    out.bodyBlockStrike += Number(effect.bodyBlockStrike || 0);
    if (effect.bodyBlockDamage) out.bodyBlockDamage = effect.bodyBlockDamage;
    out.underwaterDodge += Number(effect.underwaterDodge || 0);
    if (effect.special) out.special.push(...effect.special);
  }
  return out;
}

function averageDice(str) {
  if (!str) return 0;
  const parsed = /^([0-9]+)D([0-9]+)$/i.exec(str);
  if (!parsed) return 0;
  const count = Number(parsed[1]);
  const sides = Number(parsed[2]);
  return Math.round(count * ((1 + sides) / 2));
}

export function getSkillPercent(skill, level, scholasticBonus = 0, iqBonus = 0, isSecondary = false) {
  if (!skill || skill.base == null) return null;
  if (skill.twoTrack) return `${Math.min(98, skill.base + ((level - 1) * skill.perLevel) + (isSecondary ? 0 : scholasticBonus) + iqBonus)}/${Math.min(98, (skill.secondaryBase || 0) + ((level - 1) * skill.perLevel) + (isSecondary ? 0 : scholasticBonus) + iqBonus)}`;
  return Math.min(98, skill.base + ((Number(level || 1) - 1) * (skill.perLevel || 0)) + (isSecondary ? 0 : scholasticBonus) + iqBonus);
}

export function wpStrikeBonus(wpBonuses, wpName, level) {
  const rows = wpBonuses[wpName] || [];
  return rows.reduce((sum, row) => (Number(level) >= row.level ? sum + (row.strike || 0) : sum), 0);
}

export function totalCarriedWeight(items = [], catalog = []) {
  const map = new Map(catalog.map((item) => [item.id, item]));
  return items.reduce((sum, entry) => {
    const item = map.get(entry.itemId);
    const weight = Number(entry.weightOverride ?? item?.weight ?? 0);
    return sum + (weight * Number(entry.qty || 1));
  }, 0);
}

export function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50);
}
