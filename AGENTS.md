# Repository Guidelines

## Project Structure & Module Organization

This repository contains NODO, a Spanish-language Three.js demo of an accessible parcel pickup center. `index.html` defines the interface; `src/main.js` handles rendering, navigation, keypad input, pickup state, and browser speech APIs. `src/style.css` contains responsive layouts and visual styles. Blender assets live in `public/models/`: the editable `.blend` scene and the exported `.glb` loaded by the browser. `scripts/create_models.py` generates the models through Blender's Python API.

## Build, Test, and Development Commands

- `npm install`: install dependencies using the committed lockfile.
- `npm run dev`: launch Vite on the local loopback interface.
- `npm run build`: create the production bundle in `dist/`.
- `npm run preview`: serve the production build for review.
- `npm test`: run navigation and ground-contact tests with Node's built-in test runner.

To regenerate assets, run `scripts/create_models.py` inside Blender, adjusting its `ROOT` path first. It creates a new scene; preserve unrelated Blender scenes and user work.

## Coding Style & Naming Conventions

Use JavaScript ES modules, two-space indentation, single-quoted strings, and descriptive camelCase identifiers. Use four-space indentation in Python. Keep visible copy and spoken instructions in Spanish. Preserve model names such as `DoorPivot_17`, `Package`, and `Key_OK`: runtime interaction depends on them. Use semantic HTML, accessible button labels, visible keyboard focus, and reduced-motion support. No formatter or linter is currently configured.

## Testing Guidelines

Run `npm test` and `npm run build` after behavior changes. Node tests in `tests/` cover navigation and cane contact; no coverage target is configured. Manually verify WASD movement, proximity-gated interactions, code `2026`, locker 17, collection, and reset. Check fullscreen entry/exit, silhouette vision, tactile-only terminal, distinct cane sounds, audio toggling, and microphone denial. Report browser-dependent limitations accurately.

## Commit & Pull Request Guidelines

The repository has no established commit history. Use short imperative subjects, for example `Add tactile route guidance`. Keep changes focused. Pull requests should describe user-visible behavior, list validation performed, and include screenshots for visual changes. Explain asset regeneration and any GLB size changes. Link relevant issues when available and distinguish simulated positioning from physical sensor integration.
