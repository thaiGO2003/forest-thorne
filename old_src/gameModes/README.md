# Game Modes Documentation

This directory contains the game mode system documentation, split into manageable sections:

## Documentation Index

| File | Contents |
|------|----------|
| [README.overview.md](README.overview.md) | Overview, Quick Start, Step-by-Step Guide, Configuration Options, Examples, Best Practices |
| [README.modes.md](README.modes.md) | Testing Your Mode, Advanced Topics, Troubleshooting, Complete Reference Template |
| [README.integration.md](README.integration.md) | Using Game Modes in App, Validation & Error Handling, System Integration, Unit/Integration Testing, Performance, Migration Guide, Quick Reference |

## Quick Start

See [README.overview.md](README.overview.md#quick-start) for minimal setup.

## Files in This Directory

```
src/gameModes/
├── GameModeConfig.js           # Core configuration interface and validation
├── GameModeRegistry.js         # Registry for managing modes
├── EndlessPvEClassicMode.js    # Default PVE mode
├── EndlessMode.js              # Endless challenge mode
├── PVPMode.js                  # PVP mode (stub)
├── README.md                   # This hub file
├── README.overview.md          # Docs: overview & getting started
├── README.modes.md             # Docs: testing & advanced topics
├── README.integration.md      # Docs: integration & migration
└── YourMode.js                 # Your custom mode
```
