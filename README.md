# Strangeness Tracker 1984

Mobile-first browser app for building and managing **Teenage Mutant Ninja Turtles & Other Strangeness** characters.

## What is included

- Character library home screen
- New character builder with:
  - random or manual generation
  - strict rules flow with GM override toggle
  - BIO-E spending
  - background / education / skills handling
  - team character support
- Live character sheet with:
  - HP / S.D.C. tracking
  - attacks per melee and actions remaining
  - initiative entry
  - status tracking
  - inventory, equipped gear, stash, quest item flags
  - encumbrance / carry weight display
  - notes tab
- Built-in templates:
  - Raphael
  - Leonardo
  - Donatello
  - Michaelangelo
  - Splinter
  - April O'Neil
  - Baxter Stockman
  - Casey Jones
- Local save support using browser storage
- Undo / redo history on character sheets
- JSON import / export
- Printable character sheet layout for browser **Print / Save as PDF**
- Guided custom library forms for:
  - animals
  - items
  - statuses
- JSON data packs for future expansion

## Important note about the included data

This starter build includes a **curated starter catalog**, not a complete transcription of the whole book.

Included out of the box:
- 33 starter animals
- 37 starter items / weapons / armor / gear entries
- 16 statuses
- 102 skills / proficiencies / related entries
- 8 templates

The app is designed so you can expand these through:
1. the in-app custom library forms, and/or
2. editing the JSON files in `/data`

## Run locally

Because the app loads JSON files with `fetch()`, do **not** open `index.html` directly from `file://`.

Use a local web server instead.

### Python

```bash
cd /path/to/strangeness-tracker-1984
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Folder structure

```text
strangeness-tracker-1984/
  index.html
  README.md
  css/
    styles.css
  js/
    main.js
    builder.js
    render.js
    rules.js
    storage.js
  data/
    config.json
    animals.json
    items.json
    statuses.json
    templates.json
    skills.json
    programs.json
    backgrounds.json
    hand_to_hand.json
    physical_skill_effects.json
    attribute_bonus_chart.json
    wp_bonuses.json
  assets/
```

## Exporting PDFs

Use the **Print Sheet** button on a character page, then choose **Save as PDF** in your browser / mobile print dialog.

## GitHub Pages

This project is static and can be hosted privately on GitHub Pages.

## Suggestions for your next expansion pass

- Add the rest of the animal catalog into `animals.json`
- Add the rest of the equipment tables into `items.json`
- Expand weapon proficiency tables and modern weapon data
- Add the remaining book character templates
- Add more status effects and optional recovery results
