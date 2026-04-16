import { ALIGNMENTS } from './builder.js';
import { totalCarriedWeight } from './rules.js';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function optionList(options, selected) {
  return options.map((value) => `<option value="${escapeHtml(value)}" ${selected === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('');
}

function animalOptions(animals, categoryFilter, selectedId) {
  const filtered = animals.filter((a) => !categoryFilter || a.category === categoryFilter);
  return filtered.map((animal) => `<option value="${animal.id}" ${selectedId === animal.id ? 'selected' : ''}>${escapeHtml(animal.name)}</option>`).join('');
}

function featureSelect(label, key, options, selected) {
  const normalized = [{ label: 'None', cost: 0 }, ...(options || [])]
    .filter((opt, idx, arr) => idx === arr.findIndex((row) => row.label === opt.label));
  return `
    <label class="field">
      <span>${escapeHtml(label)}</span>
      <select data-builder-field="features.${key}">
        ${normalized.map((opt) => `<option value="${escapeHtml(opt.label)}" ${selected === opt.label ? 'selected' : ''}>${escapeHtml(opt.label)}${opt.cost ? ` (${opt.cost} BIO-E)` : ''}</option>`).join('')}
      </select>
    </label>
  `;
}

function checkGroup({ title, items, selected = [], action, className = '' }) {
  if (!items?.length) return '';
  return `
    <div class="fieldset ${className}">
      <div class="section-title"><h4>${escapeHtml(title)}</h4></div>
      <div class="inline-checks">
        ${items.map((item) => {
          const label = item.name || item.label || item;
          const value = item.name || item.label || item;
          const extra = item.cost ? ` (${item.cost})` : item.effect ? ` — ${item.effect}` : item.damage ? ` — ${item.damage}` : '';
          return `
            <label class="check-chip">
              <input type="checkbox" data-action="${action}" value="${escapeHtml(value)}" ${selected.includes(value) ? 'checked' : ''} />
              <span>${escapeHtml(label)}${escapeHtml(extra)}</span>
            </label>
          `;
        }).join('')}
      </div>
    </div>
  `;
}

function renderProgramSelection(slot, idx, programs) {
  const chosen = programs.find((p) => p.id === slot?.programId);
  return `
    <div class="option-box">
      <label class="field">
        <span>Scholastic program ${idx + 1}</span>
        <select data-action="builder-program" data-index="${idx}">
          <option value="">Choose program</option>
          ${programs.map((program) => `<option value="${program.id}" ${program.id === slot?.programId ? 'selected' : ''}>${escapeHtml(program.label)}</option>`).join('')}
        </select>
      </label>
      ${chosen ? renderProgramPicks(chosen, slot?.picks || [], idx) : ''}
    </div>
  `;
}

function renderProgramPicks(program, selected, idx) {
  if (program.type === 'fixed') {
    return `<p class="muted small">Adds: ${escapeHtml((program.skills || []).join(', '))}</p>`;
  }
  const pool = program.pool || [];
  const fixed = program.fixed?.length ? `<p class="muted small">Always adds: ${escapeHtml(program.fixed.join(', '))}</p>` : '';
  return `
    ${fixed}
    <p class="muted small">Pick ${program.choose || 0}</p>
    <div class="inline-checks">
      ${pool.map((name) => `
        <label class="check-chip">
          <input type="checkbox" data-action="builder-program-pick" data-index="${idx}" value="${escapeHtml(name)}" ${selected.includes(name) ? 'checked' : ''} />
          <span>${escapeHtml(name)}</span>
        </label>
      `).join('')}
    </div>
  `;
}

function renderRecentCharacters(characters) {
  if (!characters.length) {
    return `<div class="notice">No saved characters yet.</div>`;
  }
  return `<div class="list">${characters.map((character) => `
    <div class="list-item">
      <div class="list-item-header">
        <div>
          <strong>${escapeHtml(character.name)}</strong>
          <div class="muted small">${escapeHtml(character.animalName || 'Human / Template')} · Level ${escapeHtml(character.level)} · ${escapeHtml(character.alignment || '—')}</div>
          <div class="muted tiny">Updated ${new Date(character.updatedAt || character.createdAt || Date.now()).toLocaleString()}</div>
        </div>
        <div class="btn-row">
          <button class="btn btn-secondary" data-action="open-character" data-id="${character.id}">Open</button>
          <button class="btn" data-action="edit-character" data-id="${character.id}">Edit</button>
          <button class="btn" data-action="export-character" data-id="${character.id}">JSON</button>
          <button class="btn btn-danger" data-action="delete-character" data-id="${character.id}">Delete</button>
        </div>
      </div>
    </div>
  `).join('')}</div>`;
}

export function renderHome(state, data) {
  const recent = renderRecentCharacters(state.characters);
  const templates = data.templates.map((template) => `
    <div class="hero-card">
      <h3>${escapeHtml(template.name)}</h3>
      <p>${escapeHtml(template.animalId ? 'Built-in template' : 'Character sheet template')}</p>
      <div class="stat-pills">
        <span class="pill">Lvl ${escapeHtml(template.level)}</span>
        <span class="pill">${escapeHtml(template.alignment)}</span>
      </div>
      <div class="btn-row" style="margin-top:10px;">
        <button class="btn btn-secondary" data-action="use-template" data-id="${template.id}">Use template</button>
      </div>
    </div>
  `).join('');

  return `
    <div class="home-grid">
      <section class="section">
        <div class="section-title">
          <div>
            <div class="kicker">Start here</div>
            <h2>Character library</h2>
          </div>
          <div class="btn-row">
            <button class="btn btn-primary" data-action="new-character">New Character</button>
            <button class="btn" data-action="open-import-character">Import JSON</button>
          </div>
        </div>

        <div class="feature-grid">
          <div class="hero-card">
            <h3>New Character</h3>
            <p>Guided builder with strict rules and GM override.</p>
            <button class="btn btn-primary" data-action="new-character">Start builder</button>
          </div>
          <div class="hero-card">
            <h3>Use Template</h3>
            <p>Load one of the built-in sheets from the book section.</p>
            <button class="btn" data-action="scroll-templates">Jump to templates</button>
          </div>
          <div class="hero-card">
            <h3>Import JSON</h3>
            <p>Bring in a previously exported character file.</p>
            <button class="btn" data-action="open-import-character">Import</button>
          </div>
          <div class="hero-card">
            <h3>Recent Characters</h3>
            <p>Open and keep tracking your current roster locally.</p>
            <button class="btn" data-action="scroll-recent">Jump to recent</button>
          </div>
        </div>

        <div id="recent-anchor" style="margin-top: 16px;"></div>
        <div class="section-title" style="margin-top:12px;"><h3>Recent characters</h3></div>
        ${recent}
      </section>

      <section class="section" id="templates-anchor">
        <div class="section-title">
          <div>
            <div class="kicker">Built-in</div>
            <h2>Templates</h2>
          </div>
        </div>
        <div class="list">${templates}</div>
        <div class="notice warn" style="margin-top:12px;">
          The shipped catalog is a starter library plus built-in templates. You can extend animals, items, and statuses in the Library view and export/import that custom library as JSON.
        </div>
      </section>
    </div>
  `;
}

export function renderBuilder(state, data) {
  const builder = state.builder;
  const animal = data.allAnimals.find((item) => item.id === builder.animalId) || null;
  const background = data.backgrounds.find((item) => item.id === builder.backgroundId) || null;
  const validation = state.validation || { errors: [], warnings: [], bio: { spent: 0, budget: 0, remaining: 0 } };
  const categoryOptions = [...new Set(data.allAnimals.map((a) => a.category))];
  const backgroundLabelOptions = data.backgrounds.map((b) => ({ id: b.id, label: b.label }));
  const skillsAll = data.skills.map((skill) => skill.name).sort((a, b) => a.localeCompare(b));
  const secondaryRemaining = Math.max(0, Number(background?.secondarySelections || 0) - builder.skills.secondarySkills.length);
  const programSlots = Array.from({ length: Number(background?.programSelections || 0) }, (_, idx) => builder.skills.scholasticPrograms[idx] || { programId: '', picks: [] });

  return `
    <section class="section">
      <div class="section-title">
        <div>
          <div class="kicker">Builder</div>
          <h2>Create character</h2>
        </div>
        <div class="btn-row">
          <button class="btn" data-action="home">Cancel</button>
          <button class="btn btn-secondary" data-action="randomize-attributes">Roll attributes</button>
          <button class="btn" data-action="randomize-animal">Random animal</button>
          <button class="btn" data-action="apply-starting-money">Roll money</button>
          <button class="btn btn-primary" data-action="save-builder">Save character</button>
        </div>
      </div>

      ${validation.errors.length ? `<div class="notice bad">${validation.errors.map((e) => `<div>• ${escapeHtml(e)}</div>`).join('')}</div>` : `<div class="notice good">Rules check passed.</div>`}
      ${validation.warnings.length ? `<div class="notice warn">${validation.warnings.map((w) => `<div>• ${escapeHtml(w)}</div>`).join('')}</div>` : ''}

      <div class="summary-grid" style="margin-top:12px;">
        <div class="summary-card"><div class="muted tiny">BIO-E</div><div class="value">${validation.bio.spent}/${validation.bio.budget}</div><div class="muted tiny">Remaining ${validation.bio.remaining}</div></div>
        <div class="summary-card"><div class="muted tiny">Background</div><div class="value" style="font-size:1rem;">${escapeHtml(background?.label || '—')}</div></div>
        <div class="summary-card"><div class="muted tiny">Animal</div><div class="value" style="font-size:1rem;">${escapeHtml(animal?.name || '—')}</div></div>
        <div class="summary-card"><div class="muted tiny">GM Override</div><div class="value" style="font-size:1rem;">${builder.gmOverride ? 'ON' : 'OFF'}</div><button class="btn" data-action="toggle-gm-override">Toggle</button></div>
      </div>

      <div class="grid" style="margin-top:12px;">
        <div class="builder-step">
          <div class="section-title"><h3><span class="step-number">1</span>Basics</h3></div>
          <div class="grid grid-3">
            <label class="field"><span>Name</span><input type="text" data-builder-field="name" value="${escapeHtml(builder.name)}" /></label>
            <label class="field"><span>Alignment</span><select data-builder-field="alignment">${optionList(ALIGNMENTS, builder.alignment)}</select></label>
            <label class="field"><span>Creation mode</span><select data-builder-field="creationMode">${optionList(['random', 'manual'], builder.creationMode)}</select></label>
            <label class="field"><span>Age</span><input type="number" data-builder-field="age" value="${escapeHtml(builder.age)}" /></label>
            <label class="field"><span>Sex</span><input type="text" data-builder-field="sex" value="${escapeHtml(builder.sex)}" /></label>
            <label class="field"><span>Level</span><input type="number" min="1" max="15" data-builder-field="level" value="${escapeHtml(builder.level)}" /></label>
          </div>
          <div class="grid grid-3" style="margin-top:10px;">
            <label class="check-chip"><input type="checkbox" data-action="toggle-team" ${builder.team.enabled ? 'checked' : ''} /><span>Team character mode</span></label>
            <label class="field"><span>Team size</span><input type="number" min="1" max="12" data-builder-field="team.size" value="${escapeHtml(builder.team.size)}" ${builder.team.enabled ? '' : 'disabled'} /></label>
            <label class="field"><span>Initiative note</span><input type="text" data-builder-field="initiative" value="${escapeHtml(builder.initiative)}" placeholder="Manual entry if desired" /></label>
          </div>
        </div>

        <div class="builder-step">
          <div class="section-title"><h3><span class="step-number">1A</span>Level progression</h3></div>
          <div class="option-box">
            <div class="muted small">Hit points follow the book: P.E. + 1D6 at level 1, then +1D6 for each additional level.</div>
            <div class="grid grid-4" style="margin-top:10px;">
              <label class="field">
                <span>Base HP roll</span>
                <div class="btn-row">
                  <input type="number" min="1" max="6" data-builder-field="progression.baseHpRoll" value="${escapeHtml(builder.progression?.baseHpRoll || 1)}" />
                  <button class="btn" type="button" data-action="reroll-builder-base-hp">Reroll</button>
                </div>
              </label>
              ${(builder.progression?.levelHpRolls || []).map((roll, idx) => `
                <label class="field">
                  <span>Level ${idx + 2} HP roll</span>
                  <div class="btn-row">
                    <input type="number" min="1" max="6" data-builder-field="progression.levelHpRolls.${idx}" value="${escapeHtml(roll)}" />
                    <button class="btn" type="button" data-action="reroll-builder-level-hp" data-index="${idx}">Reroll</button>
                  </div>
                </label>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="builder-step">
          <div class="section-title"><h3><span class="step-number">2</span>Attributes</h3></div>
          <div class="grid grid-4">
            ${['iq','me','ma','ps','pp','pe','pb','spd'].map((key) => `
              <label class="field"><span>${key.toUpperCase()}</span><input type="number" data-builder-field="attributes.${key}" value="${escapeHtml(builder.attributes[key])}" /></label>
            `).join('')}
          </div>
          <p class="muted small" style="margin-top:8px;">Random mode follows 3D6 per attribute, plus 1D6 more on exceptional 16-18 rolls.</p>
        </div>

        <div class="builder-step">
          <div class="section-title"><h3><span class="step-number">3</span>Animal and background</h3></div>
          <div class="grid grid-3">
            <label class="field"><span>Category</span><select data-builder-field="categoryFilter"><option value="">All</option>${optionList(categoryOptions, builder.categoryFilter)}</select></label>
            <label class="field"><span>Animal</span><select data-builder-field="animalId">${animalOptions(data.allAnimals, builder.categoryFilter, builder.animalId)}</select></label>
            <label class="field"><span>Growth step</span><input type="number" min="1" max="20" data-builder-field="growthStepCurrent" value="${escapeHtml(builder.growthStepCurrent)}" /></label>
          </div>
          <div class="grid grid-2" style="margin-top:10px;">
            <label class="field"><span>Background</span>
              <select data-builder-field="backgroundId">
                ${backgroundLabelOptions.map((item) => `<option value="${item.id}" ${builder.backgroundId === item.id ? 'selected' : ''}>${escapeHtml(item.label)}</option>`).join('')}
              </select>
            </label>
            <div class="option-box">
              <div class="muted small">Animal notes</div>
              <div>${escapeHtml(animal?.notes || '—')}</div>
              <div class="muted tiny" style="margin-top:6px;">Size ${escapeHtml(animal?.sizeLevel || '—')} · Weight ${escapeHtml(animal?.weight || '—')} · Build ${escapeHtml(animal?.build || '—')}</div>
            </div>
          </div>
        </div>

        <div class="builder-step">
          <div class="section-title"><h3><span class="step-number">4</span>BIO-E spending</h3></div>
          <div class="grid grid-4">
            ${featureSelect('Hands', 'hands', animal?.featureCosts?.hands || [], builder.features.hands)}
            ${featureSelect('Biped', 'biped', animal?.featureCosts?.biped || [], builder.features.biped)}
            ${featureSelect('Speech', 'speech', animal?.featureCosts?.speech || [], builder.features.speech)}
            ${featureSelect('Looks', 'looks', animal?.featureCosts?.looks || [], builder.features.looks)}
          </div>
          ${checkGroup({ title: 'Animal powers', items: animal?.powers || [], selected: builder.features.selectedPowers, action: 'toggle-builder-power' })}
          ${checkGroup({ title: 'Natural weapons', items: animal?.naturalWeapons || [], selected: builder.features.selectedNaturalWeapons, action: 'toggle-builder-natural-weapon' })}
        </div>

        <div class="builder-step">
          <div class="section-title"><h3><span class="step-number">5</span>Combat and skills</h3></div>
          <div class="grid grid-3">
            <label class="field"><span>Hand to hand style</span>
              <select data-builder-field="combat.handToHandStyle">
                <option value="basic" ${builder.combat.handToHandStyle === 'basic' ? 'selected' : ''}>Hand to Hand Basic</option>
                <option value="expert" ${builder.combat.handToHandStyle === 'expert' ? 'selected' : ''}>Hand to Hand Expert</option>
                <option value="martial_arts" ${builder.combat.handToHandStyle === 'martial_arts' ? 'selected' : ''}>Hand to Hand Martial Arts</option>
                <option value="ninjitsu" ${builder.combat.handToHandStyle === 'ninjitsu' ? 'selected' : ''}>Hand to Hand Ninjitsu</option>
                <option value="assassin" ${builder.combat.handToHandStyle === 'assassin' ? 'selected' : ''}>Hand to Hand Assassin</option>
              </select>
            </label>
            <label class="field"><span>Manual bonus attacks</span><input type="number" data-builder-field="combat.manualBonusAttacks" value="${escapeHtml(builder.combat.manualBonusAttacks)}" /></label>
            <label class="field"><span>Manual strike adj.</span><input type="number" data-builder-field="combat.manualStrike" value="${escapeHtml(builder.combat.manualStrike)}" /></label>
          </div>

          ${checkGroup({ title: 'Physical skills', items: data.physicalSkillNames, selected: builder.combat.physicalSkills, action: 'toggle-builder-physical-skill' })}

          ${Number(background?.programSelections || 0) ? `
            <div class="fieldset">
              <div class="section-title"><h4>Scholastic programs</h4><span class="muted small">${background.programSelections} slot(s)</span></div>
              <div class="grid grid-2">
                ${programSlots.map((slot, idx) => renderProgramSelection(slot, idx, data.programs)).join('')}
              </div>
            </div>
          ` : ''}

          <div class="fieldset">
            <div class="section-title"><h4>Secondary skills</h4><span class="muted small">Remaining: ${secondaryRemaining}</span></div>
            <div class="inline-checks">
              ${skillsAll.map((name) => `
                <label class="check-chip">
                  <input type="checkbox" data-action="builder-secondary-skill" value="${escapeHtml(name)}" ${builder.skills.secondarySkills.includes(name) ? 'checked' : ''} />
                  <span>${escapeHtml(name)}</span>
                </label>
              `).join('')}
            </div>
          </div>
        </div>

        <div class="builder-step">
          <div class="section-title"><h3><span class="step-number">6</span>Inventory and notes</h3></div>
          <div class="grid grid-3">
            <label class="field"><span>Money</span><input type="number" data-builder-field="inventory.money" value="${escapeHtml(builder.inventory.money)}" /></label>
            <div class="option-box">
              <div class="muted small">Quick add from catalog</div>
              <div class="btn-row" style="margin-top:8px;">
                <button class="btn" data-action="builder-add-item">Add carried item</button>
                <button class="btn" data-action="builder-add-stash-item">Add stash item</button>
              </div>
            </div>
            <div class="option-box">
              <div class="muted small">Current carried</div>
              <div>${(builder.inventory.carried || []).length} item entries</div>
              <div class="muted tiny">Tracked weight uses item weight × qty.</div>
            </div>
          </div>
          <label class="field" style="margin-top:10px;"><span>Notes</span><textarea data-builder-field="notes">${escapeHtml(builder.notes)}</textarea></label>
        </div>
      </div>
    </section>
  `;
}

function skillRows(skills, section) {
  if (!skills?.length) {
    return `<tr><td colspan="5" class="muted">No ${section} skills.</td></tr>`;
  }
  return skills.map((skill, idx) => `
    <tr>
      <td>${escapeHtml(skill.name)}</td>
      <td>${escapeHtml(skill.category || '—')}</td>
      <td><input type="text" value="${escapeHtml(skill.percent ?? '')}" data-action="char-skill-percent" data-section="${section}" data-index="${idx}" /></td>
      <td>${escapeHtml(skill.fromProgram || '—')}</td>
      <td><button class="btn btn-danger" data-action="char-delete-skill" data-section="${section}" data-index="${idx}">Remove</button></td>
    </tr>
  `).join('');
}

function inventoryRows(entries, data, location) {
  if (!entries?.length) {
    return `<tr><td colspan="8" class="muted">No items in ${location}.</td></tr>`;
  }
  const itemMap = new Map(data.allItems.map((item) => [item.id, item]));
  return entries.map((entry, idx) => {
    const item = itemMap.get(entry.itemId);
    const weight = Number(entry.weightOverride ?? item?.weight ?? 0);
    const cost = Number(entry.costOverride ?? item?.cost ?? 0);
    const cls = `${entry.equipped ? 'equipped' : ''} ${entry.questItem ? 'quest' : ''}`;
    return `
      <tr class="${cls}">
        <td>${escapeHtml(item?.name || entry.name || 'Custom Item')}</td>
        <td>${escapeHtml(item?.category || entry.category || '—')}</td>
        <td><input type="number" min="1" value="${escapeHtml(entry.qty || 1)}" data-action="char-item-qty" data-location="${location}" data-index="${idx}" /></td>
        <td><input type="number" value="${escapeHtml(weight)}" data-action="char-item-weight" data-location="${location}" data-index="${idx}" /></td>
        <td><input type="number" value="${escapeHtml(cost)}" data-action="char-item-cost" data-location="${location}" data-index="${idx}" /></td>
        <td>
          <label class="check-chip"><input type="checkbox" data-action="char-item-equipped" data-location="${location}" data-index="${idx}" ${entry.equipped ? 'checked' : ''} /><span>Equipped</span></label>
          <label class="check-chip"><input type="checkbox" data-action="char-item-quest" data-location="${location}" data-index="${idx}" ${entry.questItem ? 'checked' : ''} /><span>Quest</span></label>
        </td>
        <td><input type="text" value="${escapeHtml(entry.notes || '')}" data-action="char-item-notes" data-location="${location}" data-index="${idx}" /></td>
        <td><button class="btn btn-danger" data-action="char-delete-item" data-location="${location}" data-index="${idx}">Delete</button></td>
      </tr>
    `;
  }).join('');
}


function attackCards(character, data) {
  const itemMap = new Map(data.allItems.map((item) => [item.id, item]));
  const equipped = (character.inventory?.carried || []).filter((entry) => entry.equipped);
  const cards = equipped.map((entry) => {
    const item = itemMap.get(entry.itemId);
    const strikeBonus = item?.wp ? data.wpStrikeBonus(item.wp, character.level) : 0;
    return `
      <div class="item-card">
        <strong>${escapeHtml(item?.name || entry.name || 'Equipped item')}</strong>
        <div class="muted small">Damage: ${escapeHtml(item?.damage || entry.damageOverride || '—')}</div>
        <div class="muted small">Roll: d20 + ${character.combat.strike + strikeBonus} to strike</div>
        <div class="muted small">WP: ${escapeHtml(item?.wp || '—')}</div>
      </div>
    `;
  });
  cards.unshift(`
    <div class="item-card">
      <strong>Unarmed / base combat</strong>
      <div class="muted small">Strike d20 + ${character.combat.strike}</div>
      <div class="muted small">Parry d20 + ${character.combat.parry}</div>
      <div class="muted small">Dodge d20 + ${character.combat.dodge}</div>
      <div class="muted small">Damage bonus +${character.combat.damage}</div>
    </div>
  `);
  return cards.join('');
}

function getInitials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean).slice(0, 2);
  if (!parts.length) return 'ST';
  return parts.map((part) => part[0]?.toUpperCase() || '').join('');
}

function renderSheetTabButton(id, label, activeTab) {
  return `<button class="tab ${activeTab === id ? 'active' : ''}" data-action="set-sheet-tab" data-tab="${id}">${escapeHtml(label)}</button>`;
}

function renderMiniMeter({ label, current, max, resource, extraLabel = '' }) {
  const maxText = max != null ? `/${escapeHtml(max)}` : '';
  return `
    <div class="mini-meter">
      <div class="mini-meter-label">${escapeHtml(label)}</div>
      <div class="mini-meter-value">${escapeHtml(current)}${maxText}</div>
      ${extraLabel ? `<div class="mini-meter-sub">${escapeHtml(extraLabel)}</div>` : ''}
      ${resource ? `
        <div class="mini-meter-controls no-print">
          <button class="mini-btn" data-action="adjust-resource" data-resource="${resource}" data-delta="-1">−</button>
          <button class="mini-btn" data-action="adjust-resource" data-resource="${resource}" data-delta="1">+</button>
          <button class="mini-btn mini-btn-wide" data-action="resource-to-max" data-resource="${resource}">Max</button>
        </div>
      ` : ''}
    </div>
  `;
}

function renderSheetPanel(id, activeTab, title, content) {
  return `
    <section class="sheet-panel ${activeTab === id ? 'active' : ''}" data-tab-panel="${id}">
      <div class="section-title"><h3>${escapeHtml(title)}</h3></div>
      ${content}
    </section>
  `;
}

function renderCombatGuide(character) {
  const helpers = [
    { label: 'Strike', detail: `Roll d20 + ${character.combat.strike}` },
    { label: 'Parry', detail: `Roll d20 + ${character.combat.parry}` },
    { label: 'Dodge', detail: `Roll d20 + ${character.combat.dodge}` },
    { label: 'Roll with punch/fall', detail: `Roll d20 + ${character.combat.roll}` },
    { label: 'Pull punch', detail: `Roll d20 + ${character.combat.pullPunch}` },
    { label: 'Body block / tackle', detail: `Strike d20 + ${character.combat.bodyBlockStrike || 0} · Damage ${escapeHtml(character.combat.bodyBlockDamage || '1D4')}` },
    { label: 'Kick', detail: `Base kick damage ${escapeHtml(character.combat.kickDamage || '1D6')} + ${character.combat.damage}` },
    { label: 'Damage bonus', detail: `Add +${character.combat.damage} where applicable` }
  ];
  return helpers.map((entry) => `
    <div class="item-card">
      <strong>${escapeHtml(entry.label)}</strong>
      <div class="muted small">${escapeHtml(entry.detail)}</div>
    </div>
  `).join('');
}

export function renderSheet(state, data) {
  const character = state.activeCharacter;
  const activeTab = state.sheetTab || 'overview';
  const carriedWeight = totalCarriedWeight(character.inventory?.carried || [], data.allItems);
  const carryCapacity = Number(character.derived?.carry?.carry || 0);
  const encumbered = carriedWeight > carryCapacity;
  const allStatuses = data.allStatuses;
  const activeStatuses = allStatuses.filter((status) => character.statuses.includes(status.id));

  const effectiveAr = Number(character.derived?.effectiveAr ?? character.health.ar ?? 0);
  const header = `
    <div class="sheet-toolbar no-print">
      <div class="btn-row">
        <button class="btn" data-action="home">Home</button>
        <button class="btn" data-action="open-character-builder" data-id="${character.id}">Edit in builder</button>
        <button class="btn" data-action="open-level-up">Level Up</button>
        <button class="btn" data-action="undo">Undo</button>
        <button class="btn" data-action="redo">Redo</button>
        <button class="btn" data-action="save-character">Save</button>
        <button class="btn" data-action="export-active-character">JSON</button>
        <button class="btn btn-secondary" data-action="print-sheet">Print / PDF</button>
      </div>
    </div>

    <div class="sheet-hero ${state.sheetHeaderCollapsed ? 'collapsed' : ''}">
      <div class="sheet-hero-top no-print">
        <div class="sheet-hero-topline">
          <div>
            <div class="kicker">Character sheet</div>
            <h2>${escapeHtml(character.name)}</h2>
            <div class="muted small">${escapeHtml(character.animalName || 'Human / template')} · Level ${escapeHtml(character.level)} · ${escapeHtml(character.alignment || '—')}</div>
          </div>
          <button class="btn btn-ghost" data-action="toggle-sheet-header">${state.sheetHeaderCollapsed ? 'Show header' : 'Hide header'}</button>
        </div>
      </div>

      <div class="sheet-hero-body">
        <div class="sheet-avatar-card">
          <div class="avatar-frame">
            ${character.avatarDataUrl
              ? `<img src="${escapeHtml(character.avatarDataUrl)}" alt="${escapeHtml(character.name)} avatar" class="avatar-image" />`
              : `<div class="avatar-placeholder">${escapeHtml(getInitials(character.name))}</div>`}
          </div>
          <div class="btn-row no-print sheet-avatar-actions">
            <button class="btn" data-action="open-avatar-upload">Upload</button>
            ${character.avatarDataUrl ? `<button class="btn btn-danger" data-action="remove-avatar">Remove</button>` : ''}
          </div>
        </div>

        <div class="sheet-hero-main">
          <div class="sheet-status-summary">
            ${activeStatuses.length
              ? activeStatuses.map((status) => `<span class="pill warn">${escapeHtml(status.label)}</span>`).join('')
              : '<span class="pill">No active conditions</span>'}
          </div>

          <div class="sheet-mini-grid">
            <div class="mini-meter"><div class="mini-meter-label">A.R.</div><div class="mini-meter-value">${escapeHtml(effectiveAr || 0)}</div></div>
            ${renderMiniMeter({ label: 'HP', current: character.health.hp, max: character.health.maxHp, resource: 'hp' })}
            ${renderMiniMeter({ label: 'S.D.C.', current: character.health.sdc, max: character.health.maxSdc, resource: 'sdc' })}
            ${renderMiniMeter({ label: 'Actions', current: character.combat.actionsRemaining, max: character.combat.actionsPerMelee, resource: 'actions', extraLabel: character.combat.currentInitiative ? `Init ${character.combat.currentInitiative}` : '' })}
            <div class="mini-meter">
              <div class="mini-meter-label">Carry</div>
              <div class="mini-meter-value">${escapeHtml(carriedWeight)}/${escapeHtml(carryCapacity)}</div>
              <div class="mini-meter-sub ${encumbered ? 'text-bad' : ''}">${encumbered ? 'Encumbered' : 'Within limit'}</div>
            </div>
          </div>

          <div class="btn-row no-print sheet-quick-actions">
            <button class="btn" data-action="spend-action">Use 1 action</button>
            <button class="btn" data-action="reset-melee">Reset melee</button>
            <button class="btn" data-action="reset-combat">Reset combat</button>
            <button class="btn btn-secondary" data-action="full-heal">Full heal</button>
          </div>
        </div>
      </div>
    </div>

    <div class="sheet-tabs no-print">
      ${renderSheetTabButton('overview', 'Overview', activeTab)}
      ${renderSheetTabButton('combat', 'Actions / Combat', activeTab)}
      ${renderSheetTabButton('skills', 'Skills', activeTab)}
      ${renderSheetTabButton('inventory', 'Inventory', activeTab)}
      ${renderSheetTabButton('notes', 'Notes', activeTab)}
    </div>
  `;

  const overviewContent = `
    <div class="grid">
      <div class="builder-step">
        <div class="section-title"><h4>Core details</h4></div>
        <div class="grid grid-4">
          <label class="field"><span>Name</span><input type="text" data-char-field="name" value="${escapeHtml(character.name)}" /></label>
          <label class="field"><span>Alignment</span><select data-char-field="alignment">${optionList(ALIGNMENTS, character.alignment)}</select></label>
          <label class="field"><span>Age</span><input type="number" data-char-field="age" value="${escapeHtml(character.age)}" /></label>
          <label class="field"><span>Sex</span><input type="text" data-char-field="sex" value="${escapeHtml(character.sex)}" /></label>
          <label class="field"><span>Level</span><input type="number" min="1" max="15" data-char-field="level" value="${escapeHtml(character.level)}" /></label>
          <div class="option-box no-print"><div class="muted small">Need the app to handle the next level for you?</div><div class="btn-row" style="margin-top:8px;"><button class="btn" data-action="open-level-up">Level Up</button></div></div>
          <label class="field"><span>Money</span><input type="number" data-char-field="inventory.money" value="${escapeHtml(character.inventory.money || 0)}" /></label>
          <label class="field"><span>Initiative</span><input type="text" data-char-field="combat.currentInitiative" value="${escapeHtml(character.combat.currentInitiative || '')}" /></label>
          <label class="check-chip"><input type="checkbox" data-char-field="gmOverride" ${character.gmOverride ? 'checked' : ''} /><span>GM Override</span></label>
        </div>
      </div>

      <div class="builder-step">
        <div class="section-title"><h4>Attributes</h4></div>
        <div class="grid grid-4">
          ${['iq','me','ma','ps','pp','pe','pb','spd'].map((key) => `
            <label class="field"><span>${key.toUpperCase()}</span><input type="number" data-char-field="attributes.${key}" value="${escapeHtml(character.attributes[key])}" /></label>
          `).join('')}
        </div>
      </div>

      <div class="builder-step">
        <div class="section-title"><h4>Health, capacity, and conditions</h4></div>
        <div class="grid grid-4">
          <label class="field"><span>HP current</span><input type="number" data-char-field="health.hp" value="${escapeHtml(character.health.hp)}" /></label>
          <label class="field"><span>HP max</span><input type="number" data-char-field="health.maxHp" value="${escapeHtml(character.health.maxHp)}" /></label>
          <label class="field"><span>S.D.C. current</span><input type="number" data-char-field="health.sdc" value="${escapeHtml(character.health.sdc)}" /></label>
          <label class="field"><span>S.D.C. max</span><input type="number" data-char-field="health.maxSdc" value="${escapeHtml(character.health.maxSdc)}" /></label>
          <label class="field"><span>A.R.</span><input type="number" data-char-field="health.ar" value="${escapeHtml(character.health.ar)}" /></label>
          <label class="field"><span>Carry capacity</span><input type="number" data-char-field="derived.carry.carry" value="${escapeHtml(character.derived?.carry?.carry || 0)}" /></label>
          <label class="field"><span>Lift capacity</span><input type="number" data-char-field="derived.carry.lift" value="${escapeHtml(character.derived?.carry?.lift || 0)}" /></label>
          <label class="field"><span>Speed yards / minute</span><input type="number" data-char-field="derived.speedYardsPerMinute" value="${escapeHtml(character.derived?.speedYardsPerMinute || 0)}" /></label>
        </div>
        <div class="inline-checks" style="margin-top:10px;">
          ${allStatuses.map((status) => `
            <label class="check-chip">
              <input type="checkbox" data-action="char-status" value="${escapeHtml(status.id)}" ${character.statuses.includes(status.id) ? 'checked' : ''} />
              <span>${escapeHtml(status.label)}</span>
            </label>
          `).join('')}
        </div>
      </div>
    </div>
  `;

  const combatContent = `
    <div class="grid">
      <div class="builder-step">
        <div class="section-title"><h4>Round and melee controls</h4><div class="btn-row no-print"><button class="btn" data-action="spend-action">Use 1 action</button><button class="btn" data-action="reset-melee">Reset melee</button><button class="btn" data-action="reset-combat">Reset combat</button></div></div>
        <div class="grid grid-4">
          <label class="field"><span>Actions per melee</span><input type="number" data-char-field="combat.actionsPerMelee" value="${escapeHtml(character.combat.actionsPerMelee)}" /></label>
          <label class="field"><span>Actions remaining</span><input type="number" data-char-field="combat.actionsRemaining" value="${escapeHtml(character.combat.actionsRemaining)}" /></label>
          <label class="field"><span>Initiative</span><input type="text" data-char-field="combat.currentInitiative" value="${escapeHtml(character.combat.currentInitiative || '')}" /></label>
          <label class="field"><span>Hand to hand style</span><input type="text" data-char-field="combat.handToHandStyle" value="${escapeHtml(character.combat.handToHandStyle || '')}" /></label>
        </div>
      </div>

      <div class="builder-step">
        <div class="section-title"><h4>Combat helper</h4></div>
        <div class="grid grid-4">
          <label class="field"><span>Strike bonus</span><input type="number" data-char-field="combat.strike" value="${escapeHtml(character.combat.strike)}" /></label>
          <label class="field"><span>Parry bonus</span><input type="number" data-char-field="combat.parry" value="${escapeHtml(character.combat.parry)}" /></label>
          <label class="field"><span>Dodge bonus</span><input type="number" data-char-field="combat.dodge" value="${escapeHtml(character.combat.dodge)}" /></label>
          <label class="field"><span>Damage bonus</span><input type="number" data-char-field="combat.damage" value="${escapeHtml(character.combat.damage)}" /></label>
          <label class="field"><span>Roll with punch/fall</span><input type="number" data-char-field="combat.roll" value="${escapeHtml(character.combat.roll)}" /></label>
          <label class="field"><span>Pull punch</span><input type="number" data-char-field="combat.pullPunch" value="${escapeHtml(character.combat.pullPunch)}" /></label>
          <label class="field"><span>Kick damage</span><input type="text" data-char-field="combat.kickDamage" value="${escapeHtml(character.combat.kickDamage || '')}" /></label>
          <label class="field"><span>Body block damage</span><input type="text" data-char-field="combat.bodyBlockDamage" value="${escapeHtml(character.combat.bodyBlockDamage || '')}" /></label>
        </div>
      </div>

      <div class="builder-step">
        <div class="section-title"><h4>Action guide</h4></div>
        <div class="grid grid-3">
          ${renderCombatGuide(character)}
        </div>
      </div>

      <div class="builder-step">
        <div class="section-title"><h4>Equipped attack helper</h4></div>
        <div class="grid grid-3">
          ${attackCards(character, data)}
        </div>
        ${character.combat.special?.length ? `<div class="notice" style="margin-top:10px;">${character.combat.special.map((s) => `<div>• ${escapeHtml(s)}</div>`).join('')}</div>` : ''}
      </div>
    </div>
  `;

  const skillsContent = `
    <div class="grid">
      <div class="builder-step">
        <div class="section-title"><h4>Skills</h4><div class="btn-row no-print"><button class="btn" data-action="add-manual-skill">Add manual skill</button></div></div>
        <div class="table-wrap"><table><thead><tr><th>Automatic skill</th><th>Category</th><th>%</th><th>Source</th><th>Action</th></tr></thead><tbody>${skillRows(character.skills.automatic, 'automatic')}</tbody></table></div>
        <div class="table-wrap" style="margin-top:10px;"><table><thead><tr><th>Scholastic skill</th><th>Category</th><th>%</th><th>Program</th><th>Action</th></tr></thead><tbody>${skillRows(character.skills.scholastic, 'scholastic')}</tbody></table></div>
        <div class="table-wrap" style="margin-top:10px;"><table><thead><tr><th>Secondary skill</th><th>Category</th><th>%</th><th>Source</th><th>Action</th></tr></thead><tbody>${skillRows(character.skills.secondary, 'secondary')}</tbody></table></div>
        <div class="table-wrap" style="margin-top:10px;"><table><thead><tr><th>Manual skill</th><th>Category</th><th>%</th><th>Source</th><th>Action</th></tr></thead><tbody>${skillRows(character.skills.manual, 'manual')}</tbody></table></div>
      </div>
    </div>
  `;

  const inventoryContent = `
    <div class="grid">
      <div class="builder-step">
        <div class="section-title"><h4>Inventory summary</h4><div class="stat-pills"><span class="pill ${encumbered ? 'bad' : 'good'}">Weight ${escapeHtml(carriedWeight)}/${escapeHtml(carryCapacity)}</span></div></div>
        <div class="grid grid-4">
          <label class="field"><span>Money</span><input type="number" data-char-field="inventory.money" value="${escapeHtml(character.inventory.money || 0)}" /></label>
          <label class="field"><span>Carry capacity</span><input type="number" data-char-field="derived.carry.carry" value="${escapeHtml(character.derived?.carry?.carry || 0)}" /></label>
          <label class="field"><span>Lift capacity</span><input type="number" data-char-field="derived.carry.lift" value="${escapeHtml(character.derived?.carry?.lift || 0)}" /></label>
          <div class="option-box"><div class="muted small">Encumbrance</div><div>${encumbered ? 'Character is over carry capacity.' : 'Character is within carry capacity.'}</div></div>
        </div>
      </div>

      <div class="builder-step">
        <div class="section-title"><h4>Inventory</h4><div class="btn-row no-print"><button class="btn" data-action="char-add-carried-item">Add carried</button><button class="btn" data-action="char-add-stash-item">Add stash</button></div></div>
        <div class="table-wrap"><table><thead><tr><th>Carried item</th><th>Category</th><th>Qty</th><th>Weight</th><th>Cost</th><th>Flags</th><th>Notes</th><th>Action</th></tr></thead><tbody>${inventoryRows(character.inventory?.carried || [], data, 'carried')}</tbody></table></div>
        <div class="table-wrap" style="margin-top:10px;"><table><thead><tr><th>Stash item</th><th>Category</th><th>Qty</th><th>Weight</th><th>Cost</th><th>Flags</th><th>Notes</th><th>Action</th></tr></thead><tbody>${inventoryRows(character.inventory?.stash || [], data, 'stash')}</tbody></table></div>
      </div>
    </div>
  `;

  const notesContent = `
    <div class="grid">
      <div class="builder-step">
        <div class="section-title"><h4>Notes</h4></div>
        <label class="field"><span>Character / campaign notes</span><textarea data-char-field="notes">${escapeHtml(character.notes || '')}</textarea></label>
      </div>
    </div>
  `;

  return `
    <section class="section sheet-screen">
      <div class="sheet-sticky-stack">
        ${header}
      </div>
      <div class="sheet-panels">
        ${renderSheetPanel('overview', activeTab, 'Overview', overviewContent)}
        ${renderSheetPanel('combat', activeTab, 'Actions / Combat', combatContent)}
        ${renderSheetPanel('skills', activeTab, 'Skills', skillsContent)}
        ${renderSheetPanel('inventory', activeTab, 'Inventory', inventoryContent)}
        ${renderSheetPanel('notes', activeTab, 'Notes', notesContent)}
      </div>
    </section>
  `;
}

export function renderLibrary(state, data) {
  const customLibrary = data.customLibrary || state.customLibrary || { animals: [], items: [], statuses: [] };
  return `
    <section class="section">
      <div class="section-title">
        <div>
          <div class="kicker">Custom library</div>
          <h2>Animals, items, and statuses</h2>
        </div>
        <div class="btn-row">
          <button class="btn" data-action="home">Home</button>
          <button class="btn" data-action="open-import-library">Import library JSON</button>
          <button class="btn btn-secondary" data-action="export-library">Export library JSON</button>
        </div>
      </div>

      <div class="grid grid-3">
        <div class="builder-step">
          <div class="section-title"><h3>Add custom animal</h3></div>
          <div class="grid">
            <label class="field"><span>Name</span><input type="text" id="custom-animal-name" /></label>
            <label class="field"><span>Category</span><input type="text" id="custom-animal-category" placeholder="Urban / Rural / Wild / Zoo" /></label>
            <label class="field"><span>Size level</span><input type="number" id="custom-animal-size" min="1" max="20" /></label>
            <label class="field"><span>Total BIO-E</span><input type="number" id="custom-animal-bioe" /></label>
            <label class="field"><span>Length</span><input type="text" id="custom-animal-length" /></label>
            <label class="field"><span>Weight</span><input type="text" id="custom-animal-weight" /></label>
            <label class="field"><span>Build</span><input type="text" id="custom-animal-build" /></label>
            <label class="field"><span>Attribute bonuses JSON</span><textarea id="custom-animal-bonuses" placeholder='{"ps":2,"pp":1}'></textarea></label>
            <label class="field"><span>Powers lines</span><textarea id="custom-animal-powers" placeholder="5|Advanced Hearing|+ hearing\n10|Flight|160mph"></textarea></label>
            <label class="field"><span>Natural weapons lines</span><textarea id="custom-animal-weapons" placeholder="5|Claws|1D6"></textarea></label>
            <button class="btn btn-primary" data-action="save-custom-animal">Save animal</button>
          </div>
        </div>

        <div class="builder-step">
          <div class="section-title"><h3>Add custom item</h3></div>
          <div class="grid">
            <label class="field"><span>Name</span><input type="text" id="custom-item-name" /></label>
            <label class="field"><span>Category</span><input type="text" id="custom-item-category" /></label>
            <label class="field"><span>Cost</span><input type="number" id="custom-item-cost" /></label>
            <label class="field"><span>Weight</span><input type="number" step="0.1" id="custom-item-weight" /></label>
            <label class="field"><span>Damage</span><input type="text" id="custom-item-damage" /></label>
            <label class="field"><span>W.P.</span><input type="text" id="custom-item-wp" /></label>
            <label class="field"><span>Slots CSV</span><input type="text" id="custom-item-slots" placeholder="mainHand,offHand" /></label>
            <label class="field"><span>Tags CSV</span><input type="text" id="custom-item-tags" placeholder="weapon,custom" /></label>
            <button class="btn btn-primary" data-action="save-custom-item">Save item</button>
          </div>
        </div>

        <div class="builder-step">
          <div class="section-title"><h3>Add custom status</h3></div>
          <div class="grid">
            <label class="field"><span>Label</span><input type="text" id="custom-status-label" /></label>
            <label class="field"><span>Category</span><input type="text" id="custom-status-category" /></label>
            <button class="btn btn-primary" data-action="save-custom-status">Save status</button>
          </div>
        </div>
      </div>

      <div class="grid grid-3" style="margin-top:12px;">
        <div class="builder-step">
          <div class="section-title"><h3>Custom animals</h3></div>
          <div class="list">${(customLibrary.animals || []).map((entry, idx) => `<div class="list-item"><div class="list-item-header"><div><strong>${escapeHtml(entry.name)}</strong><div class="muted small">${escapeHtml(entry.category || '—')} · BIO-E ${escapeHtml(entry.totalBioE || 0)}</div></div><button class="btn btn-danger" data-action="delete-custom-animal" data-index="${idx}">Delete</button></div></div>`).join('') || '<div class="notice">No custom animals yet.</div>'}</div>
        </div>
        <div class="builder-step">
          <div class="section-title"><h3>Custom items</h3></div>
          <div class="list">${(customLibrary.items || []).map((entry, idx) => `<div class="list-item"><div class="list-item-header"><div><strong>${escapeHtml(entry.name)}</strong><div class="muted small">${escapeHtml(entry.category || '—')} · ${escapeHtml(entry.damage || '—')}</div></div><button class="btn btn-danger" data-action="delete-custom-item" data-index="${idx}">Delete</button></div></div>`).join('') || '<div class="notice">No custom items yet.</div>'}</div>
        </div>
        <div class="builder-step">
          <div class="section-title"><h3>Custom statuses</h3></div>
          <div class="list">${(customLibrary.statuses || []).map((entry, idx) => `<div class="list-item"><div class="list-item-header"><div><strong>${escapeHtml(entry.label)}</strong><div class="muted small">${escapeHtml(entry.category || '—')}</div></div><button class="btn btn-danger" data-action="delete-custom-status" data-index="${idx}">Delete</button></div></div>`).join('') || '<div class="notice">No custom statuses yet.</div>'}</div>
        </div>
      </div>
    </section>
  `;
}

export function renderDiceModal(log) {
  return `
    <div class="modal-inner">
      <div class="modal-header">
        <div>
          <div class="kicker">Dice</div>
          <h3>Quick roller</h3>
        </div>
        <button class="btn" data-action="close-modal">Close</button>
      </div>
      <div class="dice-grid">
        ${['d20','d100','3d6','1d6','2d6','1d8','1d10','1d4'].map((die) => `<button class="btn dice-btn" data-action="roll-dice" data-roll="${die}">${die.toUpperCase()}</button>`).join('')}
      </div>
      <label class="field"><span>Custom roll</span><input type="text" id="custom-roll-input" placeholder="Example: 2d6+3" /></label>
      <div class="btn-row"><button class="btn btn-secondary" data-action="roll-custom-dice">Roll custom</button></div>
      <div class="section-title"><h4>Recent rolls</h4></div>
      <div class="roll-log">${(log || []).map((entry) => `<div class="list-item"><strong>${escapeHtml(entry.label)}</strong> = ${escapeHtml(entry.total)} <div class="muted tiny">${escapeHtml(entry.detail)}</div></div>`).join('') || '<div class="notice">No rolls yet.</div>'}</div>
    </div>
  `;
}

export function renderLevelUpModal(character, suggestedRoll = 1) {
  return `
    <div class="modal-inner">
      <div class="modal-header">
        <div>
          <div class="kicker">Progression</div>
          <h3>Level up ${escapeHtml(character.name || 'character')}</h3>
        </div>
        <button class="btn btn-ghost" data-action="close-modal">Close</button>
      </div>
      <div class="notice">Level ${escapeHtml(character.level)} → Level ${escapeHtml(Number(character.level || 1) + 1)}. The book adds 1D6 hit points on each new level, while skills and hand-to-hand bonuses advance with the new level.</div>
      <div class="grid grid-2">
        <label class="field"><span>HP roll for next level</span><input id="level-up-roll" type="number" min="1" max="6" value="${escapeHtml(suggestedRoll)}" /></label>
        <div class="option-box"><div class="muted small">Need a fresh roll?</div><div class="btn-row" style="margin-top:8px;"><button class="btn" data-action="reroll-level-up-roll">Reroll D6</button></div></div>
      </div>
      <div class="btn-row">
        <button class="btn btn-secondary" data-action="apply-level-up">Apply level up</button>
        <button class="btn" data-action="close-modal">Cancel</button>
      </div>
    </div>
  `;
}

export function renderPromptModal({ title, body, primaryLabel = 'OK', action = 'modal-confirm', cancelLabel = 'Cancel' }) {
  return `
    <div class="modal-inner">
      <div class="modal-header"><h3>${escapeHtml(title)}</h3><button class="btn" data-action="close-modal">Close</button></div>
      <div>${body}</div>
      <div class="btn-row">
        <button class="btn btn-secondary" data-action="${action}">${escapeHtml(primaryLabel)}</button>
        <button class="btn" data-action="close-modal">${escapeHtml(cancelLabel)}</button>
      </div>
    </div>
  `;
}

export function renderItemPickerModal(items, location) {
  return `
    <div class="modal-inner">
      <div class="modal-header"><h3>Add ${escapeHtml(location)}</h3><button class="btn" data-action="close-modal">Close</button></div>
      <div class="list" style="max-height:60vh; overflow:auto;">
        ${items.map((item) => `
          <div class="list-item">
            <div class="list-item-header">
              <div>
                <strong>${escapeHtml(item.name)}</strong>
                <div class="muted small">${escapeHtml(item.category || '—')} · Cost ${escapeHtml(item.cost ?? '—')} · Weight ${escapeHtml(item.weight ?? '—')} ${item.damage ? `· Damage ${escapeHtml(item.damage)}` : ''}</div>
              </div>
              <button class="btn btn-secondary" data-action="pick-item" data-location="${escapeHtml(location)}" data-id="${escapeHtml(item.id)}">Add</button>
            </div>
          </div>
        `).join('')}
      </div>
      <div class="notice">Tip: custom items from the Library view also appear here.</div>
    </div>
  `;
}
