# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Vanilla JS Tetris — no dependencies, no build step, no package.json. Three files only: `index.html`, `style.css`, `game.js`.

## Running / testing

There is no build, lint, or test tooling. To run the game, open `index.html` directly in a browser, or serve it with any static server (e.g. `npx serve .`, `python3 -m http.server 8000`). There are no automated tests — verify changes by playing the game in a browser.

## Architecture

All game logic lives in `game.js` (~300 lines), driven by a single `requestAnimationFrame` loop (`loop()`). State is held in module-level `let` variables (`board`, `current`, `next`, `score`, `lines`, `level`, `paused`, `gameOver`, `dropInterval`, etc.) rather than a class or state container — functions mutate these directly.

Key flow: `init()` creates the board and starts the loop → `loop()` accumulates elapsed time and drops the current piece every `dropInterval` ms, calling `lockPiece()` on collision → `lockPiece()` merges the piece into `board`, clears full lines, and calls `spawn()` → `spawn()` promotes `next` to `current`, generates a new `next`, and triggers `endGame()` if the new piece immediately collides.

Notable pieces:
- `board` is a `ROWS × COLS` matrix; each cell is `0` (empty) or a piece-type index `1–7` used to look up `COLORS`.
- Pieces (`PIECES`) are square matrices; rotation (`rotateCW`) is a transpose + row reversal, not a lookup table.
- `tryRotate()` implements basic wall kicks by retrying the rotation at x offsets `[0, -1, 1, -2, 2]`.
- `collide(shape, ox, oy)` is the single collision check used for movement, rotation, and ghost-piece projection.
- `ghostY()` projects the current piece straight down to compute the ghost-piece landing row; it's recomputed both in `draw()` and in `hardDrop()`.
- Scoring uses the classic table `LINE_SCORES = [0, 100, 300, 500, 800]` multiplied by `level`; level increases every 10 cleared lines, and `dropInterval` shrinks as `max(100, 1000 - (level-1)*90)`.

If you change `COLS`, `ROWS`, or `BLOCK` in `game.js`, also update the `<canvas id="board">` `width`/`height` in `index.html` to match (`COLS×BLOCK` by `ROWS×BLOCK`).
