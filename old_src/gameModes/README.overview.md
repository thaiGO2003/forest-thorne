# Game Modes Documentation

This directory contains the game mode system, which allows you to create different game modes with unique rules, difficulty settings, and progression systems.

## Table of Contents

- [Overview](#overview)
- [Quick Start](#quick-start)
- [Step-by-Step Guide](#step-by-step-guide)
- [Configuration Options](#configuration-options)
- [Examples](#examples)
- [Best Practices](#best-practices)
- [Using Game Modes in Your Application](#using-game-modes-in-your-application)
- [Validation and Error Handling](#validation-and-error-handling)
- [Integration with Game Systems](#integration-with-game-systems)
- [Testing Game Modes](#testing-game-modes)
- [Performance Considerations](#performance-considerations)
- [Migration Guide](#migration-guide)
- [Quick Reference](#quick-reference)

## Overview

The game mode system provides a flexible way to create different gameplay experiences by configuring:
- Starting resources (gold, HP)
- Win/lose conditions
- AI difficulty
- Enabled systems (shop, crafting, augments, PVP)
- Progression scaling (gold per round, enemy strength)
- Scene flow

Each game mode is defined by a `GameModeConfig` object that specifies all these parameters.

## Quick Start

Here's the minimal code to create a new game mode:

```javascript
import { createGameModeConfig, LOSE_CONDITION, AI_DIFFICULTY } from './GameModeConfig.js'
import GameModeRegistry from './GameModeRegistry.js'

const MyMode = createGameModeConfig('MY_MODE', {
  name: 'My Custom Mode',
  description: 'A brief description of what makes this mode unique',
  startingGold: 10,
  startingHP: 3,
  aiDifficulty: AI_DIFFICULTY.MEDIUM
})

GameModeRegistry.register(MyMode)

export default MyMode
```

That's it! Your game mode is now registered and ready to use.

## Step-by-Step Guide

### Step 1: Create a New File

Create a new file in `src/gameModes/` with a descriptive name:

```
src/gameModes/MyCustomMode.js
```

### Step 2: Import Required Dependencies

At the top of your file, import the necessary functions and enums:

```javascript
import { createGameModeConfig, LOSE_CONDITION, AI_DIFFICULTY } from './GameModeConfig.js'
import GameModeRegistry from './GameModeRegistry.js'
```

### Step 3: Define Your Configuration

Use `createGameModeConfig()` to create your game mode configuration. The first parameter is a unique ID (use UPPER_SNAKE_CASE), and the second is your configuration object:

```javascript
const MyCustomMode = createGameModeConfig('MY_CUSTOM_MODE', {
  // Your configuration here
})
```

### Step 4: Configure Basic Properties

Set the display name and description:

```javascript
const MyCustomMode = createGameModeConfig('MY_CUSTOM_MODE', {
  name: 'My Custom Mode',
  description: 'A detailed description that explains what makes this mode unique and interesting to players.',
  
  // More config...
})
```

### Step 5: Set Starting Resources

Define how much gold and HP players start with:

```javascript
const MyCustomMode = createGameModeConfig('MY_CUSTOM_MODE', {
  name: 'My Custom Mode',
  description: '...',
  
  startingGold: 15,  // Players start with 15 gold
  startingHP: 5,     // Players start with 5 HP/hearts
  
  // More config...
})
```

### Step 6: Configure Game Rules

Set the lose condition and AI difficulty:

```javascript
const MyCustomMode = createGameModeConfig('MY_CUSTOM_MODE', {
  name: 'My Custom Mode',
  description: '...',
  startingGold: 15,
  startingHP: 5,
  
  loseCondition: LOSE_CONDITION.NO_HEARTS,  // Lose when HP reaches 0
  aiDifficulty: AI_DIFFICULTY.HARD,         // Face hard AI opponents
  
  // More config...
})
```

### Step 7: Enable/Disable Systems

Choose which game systems are available in your mode:

```javascript
const MyCustomMode = createGameModeConfig('MY_CUSTOM_MODE', {
  name: 'My Custom Mode',
  description: '...',
  startingGold: 15,
  startingHP: 5,
  loseCondition: LOSE_CONDITION.NO_HEARTS,
  aiDifficulty: AI_DIFFICULTY.HARD,
  
  enabledSystems: {
    shop: true,      // Shop is available
    crafting: true,  // Crafting is available
    augments: true,  // Augments are available
    pvp: false       // PVP is not available
  },
  
  // More config...
})
```

### Step 8: Define Scaling Functions

Create functions that determine how gold and enemy strength scale with round number:

```javascript
const MyCustomMode = createGameModeConfig('MY_CUSTOM_MODE', {
  name: 'My Custom Mode',
  description: '...',
  startingGold: 15,
  startingHP: 5,
  loseCondition: LOSE_CONDITION.NO_HEARTS,
  aiDifficulty: AI_DIFFICULTY.HARD,
  enabledSystems: {
    shop: true,
    crafting: true,
    augments: true,
    pvp: false
  },
  
  // Gold scaling: how much gold players get per round
  goldScaling: (round) => {
    return 10 + Math.floor(round * 1.5)
    // Round 1: 11 gold, Round 2: 13 gold, Round 3: 14 gold, etc.
  },
  
  // Enemy scaling: multiplier for enemy strength
  enemyScaling: (round) => {
    return Math.floor(round * 2)
    // Round 1: 2x, Round 2: 4x, Round 3: 6x, etc.
  }
})
```

### Step 9: Register Your Mode

Register your game mode so it can be used:

```javascript
GameModeRegistry.register(MyCustomMode)
```

### Step 10: Export Your Mode

Export your mode so it can be imported elsewhere:

```javascript
export default MyCustomMode
```

### Step 11: Complete Example

Here's what your complete file should look like:

```javascript
import { createGameModeConfig, LOSE_CONDITION, AI_DIFFICULTY } from './GameModeConfig.js'
import GameModeRegistry from './GameModeRegistry.js'

const MyCustomMode = createGameModeConfig('MY_CUSTOM_MODE', {
  name: 'My Custom Mode',
  description: 'A challenging mode with aggressive scaling and hard AI opponents.',
  
  startingGold: 15,
  startingHP: 5,
  
  loseCondition: LOSE_CONDITION.NO_HEARTS,
  aiDifficulty: AI_DIFFICULTY.HARD,
  
  enabledSystems: {
    shop: true,
    crafting: true,
    augments: true,
    pvp: false
  },
  
  goldScaling: (round) => 10 + Math.floor(round * 1.5),
  enemyScaling: (round) => Math.floor(round * 2)
})

GameModeRegistry.register(MyCustomMode)

export default MyCustomMode
```

## Configuration Options

### Required Options

These options must be provided (though `createGameModeConfig` provides defaults):

| Option | Type | Description |
|--------|------|-------------|
| `id` | `string` | Unique identifier (first parameter to `createGameModeConfig`) |
| `name` | `string` | Display name shown to players |
| `description` | `string` | Description of the game mode |

### Optional Options (with defaults)

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `scenes` | `string[]` | `['LoadingScene', 'MainMenuScene', 'PlanningScene', 'CombatScene']` | Array of scene names to use |
| `startingGold` | `number` | `10` | Initial gold amount (must be >= 0) |
| `startingHP` | `number` | `3` | Initial HP/hearts (must be > 0) |
| `loseCondition` | `string` | `LOSE_CONDITION.NO_HEARTS` | When the player loses |
| `enabledSystems` | `object` | See below | Which systems are enabled |
| `aiDifficulty` | `string` | `AI_DIFFICULTY.MEDIUM` | AI opponent difficulty |
| `goldScaling` | `function` | `(round) => 10` | Gold per round function |
| `enemyScaling` | `function` | `(round) => round` | Enemy strength multiplier function |

### Enabled Systems Default

```javascript
{
  shop: true,
  crafting: true,
  augments: true,
  pvp: false
}
```

### Lose Condition Options

```javascript
LOSE_CONDITION.NO_HEARTS     // Lose when HP reaches 0 (default)
LOSE_CONDITION.SINGLE_LOSS   // Lose on first combat defeat
LOSE_CONDITION.TIME_LIMIT    // Lose when time runs out
```

### AI Difficulty Options

```javascript
AI_DIFFICULTY.EASY    // Easier AI opponents
AI_DIFFICULTY.MEDIUM  // Standard AI opponents (default)
AI_DIFFICULTY.HARD    // Challenging AI opponents
```

## Examples

### Example 1: Easy Mode for Beginners

```javascript
import { createGameModeConfig, LOSE_CONDITION, AI_DIFFICULTY } from './GameModeConfig.js'
import GameModeRegistry from './GameModeRegistry.js'

const EasyMode = createGameModeConfig('EASY_MODE', {
  name: 'Easy Mode',
  description: 'Perfect for learning the game. Start with extra resources and face easier opponents.',
  
  // Extra starting resources
  startingGold: 20,
  startingHP: 10,
  
  // Easy AI
  aiDifficulty: AI_DIFFICULTY.EASY,
  
  // Generous gold scaling
  goldScaling: (round) => 15 + round,
  
  // Gentle enemy scaling
  enemyScaling: (round) => Math.floor(round * 0.8)
})

GameModeRegistry.register(EasyMode)
export default EasyMode
```

### Example 2: Speed Run Mode

```javascript
import { createGameModeConfig, LOSE_CONDITION, AI_DIFFICULTY } from './GameModeConfig.js'
import GameModeRegistry from './GameModeRegistry.js'

const SpeedRunMode = createGameModeConfig('SPEED_RUN', {
  name: 'Speed Run',
  description: 'Race against time! You have one life - make it count.',
  
  // Standard starting resources
  startingGold: 10,
  startingHP: 1,  // Only 1 HP!
  
  // Lose on first defeat
  loseCondition: LOSE_CONDITION.SINGLE_LOSS,
  
  // Hard AI for challenge
  aiDifficulty: AI_DIFFICULTY.HARD,
  
  // Lots of gold to build quickly
  goldScaling: (round) => 20 + round * 2,
  
  // Fast enemy scaling
  enemyScaling: (round) => Math.floor(round * 3)
})

GameModeRegistry.register(SpeedRunMode)
export default SpeedRunMode
```

### Example 3: Crafting-Only Mode

```javascript
import { createGameModeConfig, LOSE_CONDITION, AI_DIFFICULTY } from './GameModeConfig.js'
import GameModeRegistry from './GameModeRegistry.js'

const CraftingOnlyMode = createGameModeConfig('CRAFTING_ONLY', {
  name: 'Crafting Challenge',
  description: 'No shop! Build your team entirely through crafting and augments.',
  
  startingGold: 50,  // Extra gold since no shop
  startingHP: 5,
  
  // Disable shop, enable crafting and augments
  enabledSystems: {
    shop: false,      // No shop!
    crafting: true,   // Crafting is key
    augments: true,   // Augments available
    pvp: false
  },
  
  aiDifficulty: AI_DIFFICULTY.MEDIUM,
  
  // More gold since shop is disabled
  goldScaling: (round) => 20 + round * 2,
  
  enemyScaling: (round) => round
})

GameModeRegistry.register(CraftingOnlyMode)
export default CraftingOnlyMode
```

### Example 4: Exponential Scaling Mode

```javascript
import { createGameModeConfig, LOSE_CONDITION, AI_DIFFICULTY } from './GameModeConfig.js'
import GameModeRegistry from './GameModeRegistry.js'

const ExponentialMode = createGameModeConfig('EXPONENTIAL', {
  name: 'Exponential Chaos',
  description: 'Everything scales exponentially. How long can you survive?',
  
  startingGold: 25,
  startingHP: 10,
  
  aiDifficulty: AI_DIFFICULTY.HARD,
  
  // Exponential gold scaling
  goldScaling: (round) => {
    return Math.floor(10 * Math.pow(1.2, round))
    // Round 1: 12, Round 2: 14, Round 3: 17, Round 5: 24, Round 10: 61
  },
  
  // Exponential enemy scaling
  enemyScaling: (round) => {
    return Math.floor(Math.pow(1.5, round))
    // Round 1: 1, Round 2: 2, Round 3: 3, Round 5: 7, Round 10: 57
  }
})

GameModeRegistry.register(ExponentialMode)
export default ExponentialMode
```

## Best Practices

### 1. Choose a Descriptive ID

Use UPPER_SNAKE_CASE for IDs and make them descriptive:

```javascript
// Good
'ENDLESS_MODE'
'SPEED_RUN'
'CRAFTING_ONLY'

// Bad
'mode1'
'test'
'new'
```

### 2. Write Clear Descriptions

Help players understand what makes your mode unique:

```javascript
// Good
description: 'Survive as long as possible against increasingly difficult enemies. Start with more resources but face aggressive scaling and HARD AI opponents.'

// Bad
description: 'Hard mode'
```

### 3. Balance Starting Resources with Difficulty

If you increase difficulty, consider giving players more starting resources:

```javascript
// Balanced: Hard AI but extra resources
{
  startingGold: 15,
  startingHP: 5,
  aiDifficulty: AI_DIFFICULTY.HARD
}
```

### 4. Test Your Scaling Functions

Make sure your scaling functions return reasonable values:

```javascript
// Test your functions
goldScaling: (round) => {
  const gold = 10 + Math.floor(round * 1.5)
  console.log(`Round ${round}: ${gold} gold`)
  return gold
}
```

### 5. Consider the Player Experience

Think about what makes your mode fun and unique:

- **Too Easy**: Players get bored
- **Too Hard**: Players get frustrated
- **Just Right**: Players feel challenged but capable

### 6. Use Comments to Explain Your Choices

```javascript
// Aggressive gold scaling to help players keep up with enemy strength
goldScaling: (round) => 10 + Math.floor(round * 2),

// Exponential enemy scaling creates increasing pressure
enemyScaling: (round) => Math.floor(Math.pow(1.3, round))
```
