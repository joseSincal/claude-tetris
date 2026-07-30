'use strict';

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

const COLORS = [
  null,
  '#4dd0e1', // I - cyan
  '#ffd54f', // O - yellow
  '#ba68c8', // T - purple
  '#81c784', // S - green
  '#e57373', // Z - red
  '#64b5f6', // J - pale blue
  '#ffb74d', // L - orange
  '#90a4ae', // Tuerca - gris metálico
];

const PIECES = [
  null,
  [[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]], // I
  [[2,2],[2,2]],                               // O
  [[0,3,0],[3,3,3],[0,0,0]],                  // T
  [[0,4,4],[4,4,0],[0,0,0]],                  // S
  [[5,5,0],[0,5,5],[0,0,0]],                  // Z
  [[6,0,0],[6,6,6],[0,0,0]],                  // J
  [[0,0,7],[7,7,7],[0,0,0]],                  // L
  [[8,8,8],[8,0,8],[8,8,8]],                  // Tuerca (hueco central)
];

const LINE_SCORES = [0, 100, 300, 500, 800];

const PASTEL_COLORS = [
  null,
  '#a5d8ff', // I
  '#fff3bf', // O
  '#eebefa', // T
  '#b2f2bb', // S
  '#ffc9c9', // Z
  '#bac8ff', // J
  '#ffd8a8', // L
  '#dee2e6', // Tuerca
];

const SKINS = {
  retro: { label: 'Retro', colors: COLORS },
  neon: { label: 'Neon', colors: COLORS },
  pastel: { label: 'Pastel', colors: PASTEL_COLORS },
  pixel: { label: 'Pixel Art', colors: COLORS },
};

const canvas = document.getElementById('board');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('next-canvas');
const nextCtx = nextCanvas.getContext('2d');
const scoreEl = document.getElementById('score');
const linesEl = document.getElementById('lines');
const levelEl = document.getElementById('level');
const overlay = document.getElementById('overlay');
const gameoverView = document.getElementById('gameover-view');
const overlayTitle = document.getElementById('overlay-title');
const overlayScore = document.getElementById('overlay-score');
const restartBtn = document.getElementById('restart-btn');
const themeToggle = document.getElementById('theme-toggle');
const overlayHighscoreList = document.getElementById('overlay-highscore-list');
const nameEntry = document.getElementById('name-entry');
const playerNameInput = document.getElementById('player-name');
const saveNameBtn = document.getElementById('save-name-btn');
const startScreen = document.getElementById('start-screen');
const startHighscoreList = document.getElementById('start-highscore-list');
const startBestCombo = document.getElementById('start-best-combo');
const startMaxLines = document.getElementById('start-max-lines');
const playBtn = document.getElementById('play-btn');
const resetScoresBtn = document.getElementById('reset-scores-btn');
const skinSelect = document.getElementById('skin-select');

const pauseMenu = document.getElementById('pause-menu');
const pauseMainView = document.getElementById('pause-main-view');
const pauseControlsView = document.getElementById('pause-controls-view');
const resumeBtn = document.getElementById('resume-btn');
const pauseRestartBtn = document.getElementById('pause-restart-btn');
const controlsBtn = document.getElementById('controls-btn');
const backBtn = document.getElementById('back-btn');
const startLevelSelect = document.getElementById('start-level-select');

const THEME_KEY = 'tetris-theme';
const HIGHSCORES_KEY = 'tetris-highscores';
const STATS_KEY = 'tetris-stats';
const MAX_HIGHSCORES = 5;
const MAX_NAME_LENGTH = 12;
const SKIN_KEY = 'tetris-skin';
const START_LEVEL_KEY = 'tetris-start-level';

let board, current, next, score, lines, level, paused, gameOver, started, lastTime, dropAccum, dropInterval, animId;
let combo = 0, maxCombo = 0;
let pendingEntry = null;
let gridLineColor = '#22222e';
let currentSkin = 'retro';
let startLevel = 1;

function updateGridLineColor() {
  gridLineColor = getComputedStyle(document.documentElement).getPropertyValue('--grid-line').trim();
}

function loadHighscores() {
  try {
    const raw = localStorage.getItem(HIGHSCORES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(entry => entry && typeof entry === 'object' && Number.isFinite(Number(entry.score)));
  } catch {
    return [];
  }
}

function saveHighscores(list) {
  localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(list));
}

function qualifiesForHighscore(points, list) {
  if (points <= 0) return false;
  if (list.length < MAX_HIGHSCORES) return true;
  return points > list[list.length - 1].score;
}

function addHighscore(name, statsEntry) {
  const list = loadHighscores();
  const entry = {
    name,
    score: statsEntry.score,
    lines: statsEntry.lines,
    level: statsEntry.level,
    combo: statsEntry.combo,
    date: new Date().toISOString(),
  };
  list.push(entry);
  list.sort((a, b) => b.score - a.score);
  list.length = Math.min(list.length, MAX_HIGHSCORES);
  saveHighscores(list);
  return { list, entry };
}

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || typeof parsed !== 'object') return { bestCombo: 0, maxLines: 0 };
    return {
      bestCombo: Number(parsed.bestCombo) || 0,
      maxLines: Number(parsed.maxLines) || 0,
    };
  } catch {
    return { bestCombo: 0, maxLines: 0 };
  }
}

function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function updateGlobalStats(comboValue, linesValue) {
  const stats = loadStats();
  stats.bestCombo = Math.max(stats.bestCombo, comboValue);
  stats.maxLines = Math.max(stats.maxLines, linesValue);
  saveStats(stats);
  return stats;
}

function renderHighscoresList(container, list, highlightEntry) {
  container.textContent = '';
  if (list.length === 0) {
    const li = document.createElement('li');
    li.className = 'highscore-empty';
    li.textContent = 'Sin puntuaciones aún';
    container.appendChild(li);
    return;
  }
  list.forEach((entry, i) => {
    const li = document.createElement('li');
    li.className = 'highscore-row';
    if (highlightEntry && entry === highlightEntry) {
      li.classList.add('highscore-highlight');
    }
    const rank = document.createElement('span');
    rank.className = 'hs-rank';
    rank.textContent = `${i + 1}.`;
    const name = document.createElement('span');
    name.className = 'hs-name';
    name.textContent = entry && entry.name ? String(entry.name) : 'Jugador';
    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'hs-score';
    scoreSpan.textContent = (Number(entry && entry.score) || 0).toLocaleString();
    li.append(rank, name, scoreSpan);
    container.appendChild(li);
  });
}

function renderStartScreenStats() {
  const list = loadHighscores();
  renderHighscoresList(startHighscoreList, list, null);
  const stats = loadStats();
  startBestCombo.textContent = stats.bestCombo;
  startMaxLines.textContent = stats.maxLines;
}

function submitHighscoreName() {
  if (!pendingEntry) return;
  const raw = playerNameInput.value.trim().slice(0, MAX_NAME_LENGTH);
  const name = raw || 'Jugador';
  const { list, entry } = addHighscore(name, pendingEntry);
  pendingEntry = null;
  nameEntry.classList.add('hidden');
  renderHighscoresList(overlayHighscoreList, list, list.includes(entry) ? entry : null);
  renderStartScreenStats();
}

saveNameBtn.addEventListener('click', submitHighscoreName);
playerNameInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    submitHighscoreName();
  }
});

playBtn.addEventListener('click', () => {
  startScreen.classList.add('hidden');
  init();
});

resetScoresBtn.addEventListener('click', () => {
  if (confirm('¿Seguro que quieres borrar todos los récords?')) {
    localStorage.removeItem(HIGHSCORES_KEY);
    renderStartScreenStats();
  }
});

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  updateGridLineColor();
  themeToggle.checked = theme === 'light';
  if (current) draw();
}

function initTheme() {
  const saved = localStorage.getItem(THEME_KEY);
  applyTheme(saved === 'light' ? 'light' : 'dark');
}

themeToggle.addEventListener('change', () => {
  const theme = themeToggle.checked ? 'light' : 'dark';
  localStorage.setItem(THEME_KEY, theme);
  applyTheme(theme);
});

function applySkin(skin) {
  currentSkin = SKINS[skin] ? skin : 'retro';
  document.documentElement.dataset.skin = currentSkin;
  if (skinSelect) skinSelect.value = currentSkin;
  // el atributo data-skin puede cambiar --grid-line (ej. Neon), hay que releerlo
  updateGridLineColor();
  if (current) draw();
  if (next) drawNext();
}

function initSkin() {
  const saved = localStorage.getItem(SKIN_KEY);
  applySkin(saved && SKINS[saved] ? saved : 'retro');
}

if (skinSelect) {
  skinSelect.addEventListener('change', () => {
    localStorage.setItem(SKIN_KEY, skinSelect.value);
    applySkin(skinSelect.value);
  });
}

function applyStartLevel(value) {
  startLevel = value;
  startLevelSelect.value = String(value);
  localStorage.setItem(START_LEVEL_KEY, String(value));
}

function initStartLevel() {
  const saved = parseInt(localStorage.getItem(START_LEVEL_KEY), 10);
  const value = (Number.isInteger(saved) && saved >= 1 && saved <= 10) ? saved : 1;
  applyStartLevel(value);
}

startLevelSelect.addEventListener('change', () => {
  const value = parseInt(startLevelSelect.value, 10) || 1;
  applyStartLevel(value);
});

function createBoard() {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

function randomPiece() {
  const type = Math.floor(Math.random() * 8) + 1;
  const shape = PIECES[type].map(row => [...row]);
  return { type, shape, x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2), y: 0 };
}

function collide(shape, ox, oy) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

function rotateCW(shape) {
  const rows = shape.length, cols = shape[0].length;
  const result = Array.from({ length: cols }, () => new Array(rows).fill(0));
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++)
      result[c][rows - 1 - r] = shape[r][c];
  return result;
}

function tryRotate() {
  const rotated = rotateCW(current.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(rotated, current.x + kick, current.y)) {
      current.shape = rotated;
      current.x += kick;
      return;
    }
  }
}

function merge() {
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        board[current.y + r][current.x + c] = current.shape[r][c];
}

function clearLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every(v => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  if (cleared) {
    lines += cleared;
    score += (LINE_SCORES[cleared] || 0) * level;
    level = Math.floor(lines / 10) + 1;
    dropInterval = Math.max(100, 1000 - (level - 1) * 90);
    updateHUD();
  }
  return cleared;
}

function ghostY() {
  let gy = current.y;
  while (!collide(current.shape, current.x, gy + 1)) gy++;
  return gy;
}

function hardDrop() {
  const gy = ghostY();
  score += (gy - current.y) * 2;
  current.y = gy;
  lockPiece();
}

function softDrop() {
  if (!collide(current.shape, current.x, current.y + 1)) {
    current.y++;
    score += 1;
    updateHUD();
  } else {
    lockPiece();
  }
}

function lockPiece() {
  merge();
  const cleared = clearLines();
  if (cleared > 0) {
    combo++;
    maxCombo = Math.max(maxCombo, combo);
  } else {
    combo = 0;
  }
  spawn();
}

function spawn() {
  current = next;
  next = randomPiece();
  if (collide(current.shape, current.x, current.y)) {
    endGame();
    return;
  }
  drawNext();
}

function updateHUD() {
  scoreEl.textContent = score.toLocaleString();
  linesEl.textContent = lines;
  levelEl.textContent = level;
}

function drawBlock(context, x, y, colorIndex, size, alpha) {
  if (!colorIndex) return;
  const skin = SKINS[currentSkin] || SKINS.retro;
  const color = skin.colors[colorIndex];
  const px = x * size + 1;
  const py = y * size + 1;
  const s = size - 2;

  context.globalAlpha = alpha ?? 1;
  context.shadowBlur = 0;
  context.shadowColor = 'transparent';

  switch (currentSkin) {
    case 'neon': {
      context.shadowBlur = 10;
      context.shadowColor = color;
      context.fillStyle = color;
      context.fillRect(px, py, s, s);
      // reset shadow before the highlight so it doesn't bleed into it
      context.shadowBlur = 0;
      context.shadowColor = 'transparent';
      context.fillStyle = 'rgba(255,255,255,0.18)';
      context.fillRect(px, py, s, 3);
      break;
    }
    case 'pastel': {
      const radius = Math.min(6, s / 3);
      context.fillStyle = color;
      if (typeof context.roundRect === 'function') {
        context.beginPath();
        context.roundRect(px, py, s, s, radius);
        context.fill();
      } else {
        context.fillRect(px, py, s, s);
      }
      context.fillStyle = 'rgba(255,255,255,0.25)';
      context.fillRect(px + radius * 0.5, py, s - radius, Math.max(2, s * 0.3));
      break;
    }
    case 'pixel': {
      context.fillStyle = color;
      context.fillRect(px, py, s, s);
      // rejilla de puntos tipo pixel-art
      context.fillStyle = 'rgba(0,0,0,0.2)';
      const dot = Math.max(2, Math.floor(size / 8));
      for (let dy = 0; dy < s; dy += dot * 2) {
        for (let dx = 0; dx < s; dx += dot * 2) {
          context.fillRect(px + dx, py + dy, dot, dot);
        }
      }
      context.fillStyle = 'rgba(255,255,255,0.15)';
      context.fillRect(px, py, s, 2);
      break;
    }
    default: { // retro
      context.fillStyle = color;
      context.fillRect(px, py, s, s);
      context.fillStyle = 'rgba(255,255,255,0.12)';
      context.fillRect(px, py, s, 4);
      break;
    }
  }

  context.shadowBlur = 0;
  context.shadowColor = 'transparent';
  context.globalAlpha = 1;
}

function drawGrid() {
  ctx.strokeStyle = gridLineColor;
  ctx.lineWidth = 0.5;
  for (let c = 1; c < COLS; c++) {
    ctx.beginPath();
    ctx.moveTo(c * BLOCK, 0);
    ctx.lineTo(c * BLOCK, ROWS * BLOCK);
    ctx.stroke();
  }
  for (let r = 1; r < ROWS; r++) {
    ctx.beginPath();
    ctx.moveTo(0, r * BLOCK);
    ctx.lineTo(COLS * BLOCK, r * BLOCK);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // board
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      drawBlock(ctx, c, r, board[r][c], BLOCK);

  // ghost
  const gy = ghostY();
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      if (current.shape[r][c])
        drawBlock(ctx, current.x + c, gy + r, current.shape[r][c], BLOCK, 0.2);

  // current piece
  for (let r = 0; r < current.shape.length; r++)
    for (let c = 0; c < current.shape[r].length; c++)
      drawBlock(ctx, current.x + c, current.y + r, current.shape[r][c], BLOCK);
}

function drawNext() {
  const NB = 30;
  nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
  const shape = next.shape;
  const offX = Math.floor((4 - shape[0].length) / 2);
  const offY = Math.floor((4 - shape.length) / 2);
  for (let r = 0; r < shape.length; r++)
    for (let c = 0; c < shape[r].length; c++)
      drawBlock(nextCtx, offX + c, offY + r, shape[r][c], NB);
}

function endGame() {
  gameOver = true;
  cancelAnimationFrame(animId);
  updateGlobalStats(maxCombo, lines);
  pauseMenu.classList.add('hidden');
  gameoverView.classList.remove('hidden');
  overlayTitle.textContent = 'GAME OVER';
  overlayScore.textContent = `Puntuación: ${score.toLocaleString()}`;

  const list = loadHighscores();
  if (qualifiesForHighscore(score, list)) {
    pendingEntry = { score, lines, level, combo: maxCombo };
    nameEntry.classList.remove('hidden');
    playerNameInput.value = '';
    renderHighscoresList(overlayHighscoreList, list, null);
    setTimeout(() => playerNameInput.focus(), 0);
  } else {
    pendingEntry = null;
    nameEntry.classList.add('hidden');
    renderHighscoresList(overlayHighscoreList, list, null);
  }
  renderStartScreenStats();
  overlay.classList.remove('hidden');
}

function blurActiveElement() {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
}

function showPauseMainView() {
  pauseMainView.classList.remove('hidden');
  pauseControlsView.classList.add('hidden');
}

function showPauseControlsView() {
  pauseMainView.classList.add('hidden');
  pauseControlsView.classList.remove('hidden');
}

function openPauseMenu() {
  gameoverView.classList.add('hidden');
  pauseMenu.classList.remove('hidden');
  showPauseMainView();
  overlay.classList.remove('hidden');
}

function closePauseMenu() {
  overlay.classList.add('hidden');
  blurActiveElement();
}

function togglePause() {
  if (!started || gameOver) return;
  paused = !paused;
  if (!paused) {
    closePauseMenu();
    lastTime = performance.now();
    loop(lastTime);
  } else {
    cancelAnimationFrame(animId);
    openPauseMenu();
  }
}

function loop(ts) {
  const dt = ts - lastTime;
  lastTime = ts;
  dropAccum += dt;
  if (dropAccum >= dropInterval) {
    dropAccum = 0;
    if (!collide(current.shape, current.x, current.y + 1)) {
      current.y++;
    } else {
      lockPiece();
    }
  }
  draw();
  if (gameOver || paused) return;
  animId = requestAnimationFrame(loop);
}

function init() {
  blurActiveElement();
  board = createBoard();
  score = 0;
  lines = 0;
  level = startLevel;
  combo = 0;
  maxCombo = 0;
  paused = false;
  gameOver = false;
  started = true;
  pendingEntry = null;
  dropInterval = Math.max(100, 1000 - (startLevel - 1) * 90);
  dropAccum = 0;
  lastTime = performance.now();
  next = randomPiece();
  spawn();
  updateHUD();
  overlay.classList.add('hidden');
  cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

document.addEventListener('keydown', e => {
  if (e.code === 'KeyP') { togglePause(); return; }
  if (e.code === 'Escape') {
    if (!started || gameOver) return;
    if (paused) {
      if (!pauseControlsView.classList.contains('hidden')) {
        showPauseMainView();
      } else {
        togglePause();
      }
    }
    return;
  }
  if (!started || paused || gameOver) return;
  switch (e.code) {
    case 'ArrowLeft':
      if (!collide(current.shape, current.x - 1, current.y)) current.x--;
      break;
    case 'ArrowRight':
      if (!collide(current.shape, current.x + 1, current.y)) current.x++;
      break;
    case 'ArrowDown':
      softDrop();
      break;
    case 'ArrowUp':
    case 'KeyX':
      tryRotate();
      break;
    case 'Space':
      e.preventDefault();
      hardDrop();
      break;
  }
  updateHUD();
});

restartBtn.addEventListener('click', () => {
  overlay.classList.add('hidden');
  init();
});

resumeBtn.addEventListener('click', togglePause);
pauseRestartBtn.addEventListener('click', () => {
  paused = false;
  init();
});
controlsBtn.addEventListener('click', showPauseControlsView);
backBtn.addEventListener('click', showPauseMainView);

initTheme();
initSkin();
initStartLevel();
started = false;
renderStartScreenStats();
