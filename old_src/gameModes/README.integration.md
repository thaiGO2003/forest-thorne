# Game Modes — Integration Guide

## Using Game Modes in Your Application

### Starting a Game with a Specific Mode

To start a game with a specific game mode, retrieve it from the registry and pass it to your scenes:

```javascript
import GameModeRegistry from './gameModes/GameModeRegistry.js'

// In your main game initialization or menu scene
const gameMode = GameModeRegistry.get('EndlessPvEClassic')

// Start the game with this mode
this.scene.start('PlanningScene', { gameMode })
```

### Accessing Mode Configuration in Scenes

In your Phaser scenes, access the game mode configuration from the scene data:

```javascript
class PlanningScene extends Phaser.Scene {
  init(data) {
    this.gameMode = data.gameMode
    
    // Use the configuration
    this.player.gold = this.gameMode.startingGold
    this.player.hp = this.gameMode.startingHP
    
    // Check which systems are enabled
    if (this.gameMode.enabledSystems.shop) {
      this.initializeShop()
    }
    
    if (this.gameMode.enabledSystems.crafting) {
      this.initializeCrafting()
    }
  }
  
  calculateRoundGold(round) {
    // Use the mode's gold scaling function
    return this.gameMode.goldScaling(round)
  }
}
```

### Listing Available Modes

To show players all available game modes (e.g., in a menu):

```javascript
import GameModeRegistry from './gameModes/GameModeRegistry.js'

// Get all registered modes
const allModes = GameModeRegistry.getAll()

// Display them in your UI
allModes.forEach(mode => {
  console.log(`${mode.name}: ${mode.description}`)
  // Create UI buttons, menu items, etc.
})
```

### Checking if a Mode Exists

Before using a mode, you can check if it's registered:

```javascript
import GameModeRegistry from './gameModes/GameModeRegistry.js'

if (GameModeRegistry.has('ENDLESS')) {
  const endlessMode = GameModeRegistry.get('ENDLESS')
  // Use the mode
} else {
  console.warn('Endless mode not available')
}
```

## Validation and Error Handling

### Automatic Validation

When you register a game mode, it's automatically validated:

```javascript
const result = GameModeRegistry.register(MyMode)

if (!result.success) {
  console.error('Failed to register mode:', result.error)
  // Handle the error appropriately
}
```

### Manual Validation

You can validate a configuration before registering:

```javascript
import { validateGameModeConfig } from './GameModeConfig.js'

const validation = validateGameModeConfig(MyMode)

if (!validation.valid) {
  console.error('Configuration errors:')
  validation.errors.forEach(error => {
    console.error(`  - ${error}`)
  })
} else {
  GameModeRegistry.register(MyMode)
}
```

### Common Validation Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "id is required" | Missing or empty ID | Provide a non-empty string as first parameter |
| "name is required" | Missing or empty name | Add a `name` property to config |
| "startingGold must be >= 0" | Negative starting gold | Use 0 or positive number |
| "startingHP must be > 0" | Zero or negative HP | Use positive number |
| "scenes array must not be empty" | Empty scenes array | Provide at least one scene name |
| "goldScaling must be a function" | Not a function | Provide a function: `(round) => number` |
| "goldScaling must return a non-negative number" | Function returns negative | Ensure function always returns >= 0 |
| "aiDifficulty must be one of: EASY, MEDIUM, HARD" | Invalid difficulty | Use `AI_DIFFICULTY.EASY/MEDIUM/HARD` |

## Integration with Game Systems

### Shop System Integration

The shop system respects the `enabledSystems.shop` flag:

```javascript
// In your planning scene
if (this.gameMode.enabledSystems.shop) {
  // Initialize and show shop UI
  this.shopSystem = new ShopSystem()
  this.showShopUI()
} else {
  // Hide shop UI or show alternative
  this.hideShopUI()
}
```

### AI System Integration

The AI system uses the mode's difficulty and scaling:

```javascript
// In your combat scene
import { AISystem } from '../systems/AISystem.js'

// Generate enemies based on mode configuration
const enemyStrength = this.gameMode.enemyScaling(this.currentRound)
const enemies = AISystem.generateEnemyTeam(
  this.currentRound,
  enemyStrength,
  this.gameMode.aiDifficulty
)
```

### Lose Condition Integration

Check the lose condition to determine when the game ends:

```javascript
// After combat
if (this.player.hp <= 0) {
  if (this.gameMode.loseCondition === LOSE_CONDITION.NO_HEARTS) {
    this.gameOver()
  }
}

// Or for single loss mode
if (combatResult.winner === 'enemy') {
  if (this.gameMode.loseCondition === LOSE_CONDITION.SINGLE_LOSS) {
    this.gameOver()
  }
}
```

## Testing Game Modes

### Unit Testing

Create tests for your game mode configuration:

```javascript
import { describe, it, expect } from 'vitest'
import MyCustomMode from '../src/gameModes/MyCustomMode.js'
import { validateGameModeConfig } from '../src/gameModes/GameModeConfig.js'

describe('MyCustomMode', () => {
  it('should have valid configuration', () => {
    const validation = validateGameModeConfig(MyCustomMode)
    expect(validation.valid).toBe(true)
    expect(validation.errors).toHaveLength(0)
  })
  
  it('should have correct starting resources', () => {
    expect(MyCustomMode.startingGold).toBe(15)
    expect(MyCustomMode.startingHP).toBe(5)
  })
  
  it('should scale gold correctly', () => {
    expect(MyCustomMode.goldScaling(1)).toBe(11)
    expect(MyCustomMode.goldScaling(5)).toBe(17)
    expect(MyCustomMode.goldScaling(10)).toBe(25)
  })
  
  it('should scale enemies correctly', () => {
    expect(MyCustomMode.enemyScaling(1)).toBe(2)
    expect(MyCustomMode.enemyScaling(5)).toBe(10)
    expect(MyCustomMode.enemyScaling(10)).toBe(20)
  })
})
```

### Integration Testing

Test that your mode works with the game systems:

```javascript
import { describe, it, expect } from 'vitest'
import GameModeRegistry from '../src/gameModes/GameModeRegistry.js'
import MyCustomMode from '../src/gameModes/MyCustomMode.js'

describe('MyCustomMode Integration', () => {
  it('should be registered in the registry', () => {
    expect(GameModeRegistry.has('MY_CUSTOM_MODE')).toBe(true)
  })
  
  it('should be retrievable from registry', () => {
    const mode = GameModeRegistry.get('MY_CUSTOM_MODE')
    expect(mode).toBeDefined()
    expect(mode.id).toBe('MY_CUSTOM_MODE')
    expect(mode.name).toBe('My Custom Mode')
  })
  
  it('should appear in all modes list', () => {
    const allModes = GameModeRegistry.getAll()
    const myMode = allModes.find(m => m.id === 'MY_CUSTOM_MODE')
    expect(myMode).toBeDefined()
  })
})
```

### Playtesting Checklist

When playtesting your game mode, verify:

- [ ] Starting resources feel appropriate
- [ ] AI difficulty matches expectations
- [ ] Gold scaling provides enough resources
- [ ] Enemy scaling creates appropriate challenge
- [ ] Lose condition triggers correctly
- [ ] Enabled systems work as expected
- [ ] Disabled systems are properly hidden
- [ ] Mode is fun and engaging
- [ ] Difficulty curve feels balanced
- [ ] Mode description accurately describes gameplay

## Performance Considerations

### Scaling Function Performance

Your scaling functions are called frequently, so keep them efficient:

```javascript
// Good: Simple calculation
goldScaling: (round) => 10 + round * 2

// Good: Cached complex calculation
const scalingCache = new Map()
goldScaling: (round) => {
  if (!scalingCache.has(round)) {
    scalingCache.set(round, complexCalculation(round))
  }
  return scalingCache.get(round)
}

// Bad: Expensive calculation every time
goldScaling: (round) => {
  let result = 0
  for (let i = 0; i < round * 1000; i++) {
    result += Math.random()
  }
  return result
}
```

### Memory Management

Game mode configurations are kept in memory, so:

- Keep descriptions concise
- Avoid storing large data structures in the config
- Use functions to generate data on-demand rather than storing it

## Migration Guide

### Updating Existing Code to Use Game Modes

If you have existing code that doesn't use game modes, here's how to migrate:

#### Before (Hardcoded Values)

```javascript
class PlanningScene extends Phaser.Scene {
  create() {
    this.player.gold = 10  // Hardcoded
    this.player.hp = 3     // Hardcoded
  }
  
  getRoundGold(round) {
    return 10  // Hardcoded
  }
}
```

#### After (Using Game Mode)

```javascript
class PlanningScene extends Phaser.Scene {
  init(data) {
    this.gameMode = data.gameMode || GameModeRegistry.get('EndlessPvEClassic')
  }
  
  create() {
    this.player.gold = this.gameMode.startingGold
    this.player.hp = this.gameMode.startingHP
  }
  
  getRoundGold(round) {
    return this.gameMode.goldScaling(round)
  }
}
```

## Need Help?

- Check existing modes (EndlessPvEClassicMode.js, EndlessMode.js) for examples
- Review GameModeConfig.js for detailed JSDoc comments
- Test your configuration with `validateGameModeConfig()`
- Start simple and iterate based on playtesting
- Look at the test files in `tests/gameModeConfig.test.js` and `tests/gameModeRegistry.test.js` for testing examples

## Quick Reference

### File Structure

```
src/gameModes/
├── GameModeConfig.js      # Core configuration interface and validation
├── GameModeRegistry.js    # Registry for managing modes
├── EndlessPvEClassicMode.js      # Default PVE mode
├── EndlessMode.js         # Endless challenge mode
├── PVPMode.js             # PVP mode (stub)
├── README.md              # This file
└── YourMode.js            # Your custom mode
```

### Essential Imports

```javascript
import { createGameModeConfig, LOSE_CONDITION, AI_DIFFICULTY } from './GameModeConfig.js'
import GameModeRegistry from './GameModeRegistry.js'
```

### Minimal Mode Template

```javascript
const MyMode = createGameModeConfig('MY_MODE', {
  name: 'My Mode',
  description: 'Description here'
})

GameModeRegistry.register(MyMode)
export default MyMode
```

### Full Mode Template

```javascript
const MyMode = createGameModeConfig('MY_MODE', {
  name: 'My Mode',
  description: 'Description here',
  startingGold: 10,
  startingHP: 3,
  loseCondition: LOSE_CONDITION.NO_HEARTS,
  aiDifficulty: AI_DIFFICULTY.MEDIUM,
  enabledSystems: {
    shop: true,
    crafting: true,
    augments: true,
    pvp: false
  },
  goldScaling: (round) => 10,
  enemyScaling: (round) => round
})

GameModeRegistry.register(MyMode)
export default MyMode
```

Happy game mode creating! 🎮
