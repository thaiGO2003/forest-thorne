---
inclusion: always
---

# Unit rework / new concept sheets (Forest Throne)

When the user sends a concept sheet that maps onto an existing catalog unit with a different role:

- Change only the **role** (and the display name if the sheet names it differently) plus the **visual**:
  bespoke rig in `src/units/roster/`, registry entry, rig test.
- Do **not** retune stats, tier/level, star scaling, rage costs or skill numbers. The user adjusts those later.
- Skill/VFX panels on the sheet only guide the visual (rig, animation, VFX look), not new numbers.
- Do not design new engine mechanics unless the user explicitly asks for them.
- Keep the catalog id so existing saves still resolve.
- Keep replies and tool usage short to save tokens: no long design proposals for these reworks.
- Do not run `python3`; use Node or the file tools for JSON/text edits.
