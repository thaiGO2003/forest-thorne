---
name: threejs-drag-drop
description: Implement robust Three.js drag-and-drop for units and board objects. Use for dragging animals between bench/board/shop targets, drag ghosts, world-space pointer following, placement highlighting, or drop validation.
---

# Drag and Drop

Treat drag as an explicit state machine: idle -> pressed -> dragging -> committed/cancelled.

## Start

- Raycast the draggable target on pointer down.
- Record pointer id, start screen position, source slot, and original transform.
- Enter dragging only after a small movement threshold unless UX explicitly starts immediately.
- Capture the pointer when dragging begins.

## Move

- Project onto a stable drag plane or board helper; do not use raw screen deltas as world coordinates.
- Keep the drag avatar visual separate from authoritative board state until drop commit.
- Show target validity with board/tile highlights, not ambiguous rings when the design calls for tile feedback.
- Preserve the unit/avatar image on any cursor-following drag indicator.

## Drop

- Resolve target once on pointer up.
- Validate occupancy, ownership, locked bench state, shop/sell zones, and board rules through existing domain APIs.
- Commit one state mutation, otherwise animate/snap back.
- Always clear capture, highlights, and drag ghost on cancel, pointercancel, scene transition, or modal close.

## Forest Throne

Do not let the DOM shop panel accidentally block intended sell/drop zones; decide explicitly whether a panel is a valid target. Keep placement preview and combat target preview as separate concepts.
