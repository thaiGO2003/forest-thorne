# Game Modes — Testing, Advanced Topics & Reference

## Testing Your Game Mode

### 1. Import Your Mode

In your main game file or test file, import your mode:

```javascript
import MyCustomMode from './gameModes/MyCustomMode.js'
```

### 2. Verify Registration

Check that your mode is registered:

```javascript
import GameModeRegistry from './gameModes/GameModeRegistry.js'

const mode = GameModeRegistry.get('MY_CUSTOM_MODE')
console.log('Mode registered:', mode.name)
```

### 3. Test in Game

Start the game with your mode:

```javascript
// In your scene initialization
const gameMode = GameModeRegistry.get('MY_CUSTOM_MODE')
this.scene.start('PlanningScene', { gameMode })
```

### 4. Verify Scaling

Test that your scaling functions work as expected:

```javascript
// Test gold scaling
for (let round = 1; round <= 10; round++) {
  const gold = MyCustomMode.goldScaling(round)
  console.log(`Round ${round}: ${gold} gold`)
}

// Test enemy scaling
for (let round = 1; round <= 10; round++) {
  const strength = MyCustomMode.enemyScaling(round)
  console.log(`Round ${round}: ${strength}x enemy strength`)
}
```

### 5. Playtest

The most important test is actually playing your mode:

- Does it feel balanced?
- Is it fun?
- Is the difficulty curve appropriate?
- Do the starting resources feel right?
- Does the scaling feel fair?

## Advanced Topics

### Custom Scene Flow

You can specify a custom scene flow:

```javascript
scenes: ['LoadingScene', 'CustomMenuScene', 'PlanningScene', 'CustomCombatScene']
```

Note: Custom scenes must be implemented separately.

### Dynamic Scaling

Create more complex scaling functions:

```javascript
goldScaling: (round) => {
  // Different scaling for early, mid, and late game
  if (round <= 5) {
    return 10 + round  // Early game: linear
  } else if (round <= 15) {
    return 15 + round * 2  // Mid game: faster
  } else {
    return 45 + round * 3  // Late game: very fast
  }
}
```

### Conditional System Enabling

You can enable/disable systems based on your mode's theme:

```javascript
// Minimalist mode: only shop
enabledSystems: {
  shop: true,
  crafting: false,
  augments: false,
  pvp: false
}

// Everything mode: all systems
enabledSystems: {
  shop: true,
  crafting: true,
  augments: true,
  pvp: true  // If implemented
}
```

## Troubleshooting

### "Invalid config" Error

Check the validation errors:

```javascript
const result = validateGameModeConfig(MyMode)
console.log(result.errors)
```

Common issues:
- Missing required fields (id, name, description)
- Negative numbers for startingGold or startingHP
- Invalid lose condition or AI difficulty
- Scaling functions that don't return numbers

### Mode Not Appearing

Make sure you:
1. Called `GameModeRegistry.register(MyMode)`
2. Imported your mode file somewhere in your app
3. Used a unique ID

### Scaling Feels Wrong

Test your scaling functions with different round numbers:

```javascript
// Print scaling for rounds 1-20
for (let i = 1; i <= 20; i++) {
  console.log(`Round ${i}: Gold=${MyMode.goldScaling(i)}, Enemy=${MyMode.enemyScaling(i)}`)
}
```

## Reference

### Complete Configuration Template

```javascript
import { createGameModeConfig, LOSE_CONDITION, AI_DIFFICULTY } from './GameModeConfig.js'
import GameModeRegistry from './GameModeRegistry.js'

const MyMode = createGameModeConfig('MY_MODE_ID', {
  // Display information
  name: 'My Mode Name',
  description: 'Detailed description of what makes this mode unique',
  
  // Scene configuration
  scenes: ['LoadingScene', 'MainMenuScene', 'PlanningScene', 'CombatScene'],
  
  // Starting resources
  startingGold: 10,
  startingHP: 3,
  
  // Game rules
  loseCondition: LOSE_CONDITION.NO_HEARTS,
  
  // Systems
  enabledSystems: {
    shop: true,
    crafting: true,
    augments: true,
    pvp: false
  },
  
  // AI configuration
  aiDifficulty: AI_DIFFICULTY.MEDIUM,
  
  // Scaling functions
  goldScaling: (round) => 10,
  enemyScaling: (round) => round
})

GameModeRegistry.register(MyMode)

export default MyMode
```