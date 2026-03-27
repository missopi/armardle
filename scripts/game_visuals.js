const THEME_STORAGE_KEY = "armadle-game-theme";
const SINGLE_SHOT_FIRE_STORAGE_KEY = "armadle-single-shot-fire";

const tiles = Array.from(document.querySelectorAll(".game-tile"));
const gameBoard = document.querySelector(".game-board");

// Arrays of ship tiles
const getFleetShips = (selector) =>
  Array.from(document.querySelectorAll(`${selector} .ship`)).map((ship) =>
    Array.from(ship.querySelectorAll(".ship-tile")),
  );

const mineFleetShips = getFleetShips(".fleet-mine");
const targetFleetShips = getFleetShips(".fleet-target");

const dailyLocations = window.ArmadleGameLogic.getDailyTargetLocations(); // Ship locations for that day.

// Flatten ship arrays into single array.
const shipTileIndexes = new Set(
  dailyLocations.flatMap((ship) => ship.tiles.map((tile) => tile.index)),
);
const targetFleetShipsByDailyShip = [];
const firedTileIndexes = new Set(); // Array to store shots fired tile indexes.
const TILE_FLIP_DURATION_MS = 200;
const TILE_FLIP_STATE_SWAP_MS = TILE_FLIP_DURATION_MS / 2;
const gameStatusMessage = document.getElementById("game-status-message");
const shareResultsContainer = document.getElementById("share-results-container");

let selectedTile = null;
let activeMissShipIndex = null;
let hasHandledGameOver = false;
let isSingleShotFireEnabled = false;

// Filter for my ships that are alive
function getAliveMineTiles(shipTiles) {
  return shipTiles.filter((tile) => tile.dataset.state === "alive");
}

// filter for target ships that are not found
function getNotFoundTargetTiles(shipTiles) {
  return shipTiles.filter((tile) => tile.dataset.state === "not-found");
}

function isGameOver() {
  return getGameOutcome() !== null;
}

function disableGameBoard() {
  if (!gameBoard) {
    return;
  }

  gameBoard.classList.add("is-disabled");
  gameBoard.setAttribute("aria-disabled", "true");

  tiles.forEach((tile) => {
    tile.setAttribute("aria-disabled", "true");
    tile.setAttribute("tabindex", "-1");
  });

  clearSelectedTile();
}

function getGameOutcome() {
  const areAllTargetShipsFound = targetFleetShips.every(
    (shipTiles) => getNotFoundTargetTiles(shipTiles).length === 0,
  );
  const areAllMineShipsLost = mineFleetShips.every(
    (shipTiles) => getAliveMineTiles(shipTiles).length === 0,
  );

  if (areAllTargetShipsFound) {
    return "won";
  }

  if (areAllMineShipsLost) {
    return "lost";
  }

  return null;
}

function revealRemainingTargetLocations() {
  dailyLocations.forEach((ship) => {
    ship.tiles.forEach((targetTile) => {
      if (firedTileIndexes.has(targetTile.index)) {
        return;
      }

      const boardTile = tiles[targetTile.index];

      if (!boardTile) {
        return;
      }

      boardTile.dataset.state = "revealed";
      boardTile.setAttribute("aria-label", `Tile ${targetTile.index + 1}, target location`);
    });
  });
}

function updateGameOverMessage(outcome) {
  if (!gameStatusMessage) {
    return;
  }

  if (outcome === "won") {
    gameStatusMessage.replaceChildren(
      createStatusMessageLine("Congratulations!", "game-status-message-primary"),
      createStatusMessageLine("You found today's target fleet.", "game-status-message-secondary"),
    );
    return;
  }

  gameStatusMessage.replaceChildren(
    createStatusMessageLine("Your fleet is gone.", "game-status-message-secondary"),
    createStatusMessageLine("Try again tomorrow.", "game-status-message-secondary"),
  );
}

function revealShareResults() {
  if (!shareResultsContainer) {
    return;
  }

  shareResultsContainer.classList.remove("hidden");
}

function createStatusMessageLine(text, className) {
  const messageLine = document.createElement("span");
  messageLine.className = className;
  messageLine.textContent = text;
  return messageLine;
}

function onGameOver() {
  if (hasHandledGameOver) {
    return;
  }

  const outcome = getGameOutcome();

  if (!outcome) {
    return;
  }

  hasHandledGameOver = true;

  if (outcome === "lost") {
    revealRemainingTargetLocations();
  }

  disableGameBoard();
  updateGameOverMessage(outcome);
  revealShareResults();
}

function setupTargetFleetShipMappings() {
  const targetShipsBySize = new Map();

  targetFleetShips.forEach((shipTiles) => {
    const size = shipTiles.length;
    const ships = targetShipsBySize.get(size) ?? [];
    ships.push(shipTiles);
    targetShipsBySize.set(size, ships);
  });

  dailyLocations.forEach((ship) => {
    const matchingShips = targetShipsBySize.get(ship.size);
    targetFleetShipsByDailyShip.push(matchingShips?.shift() ?? null);
  });
}

// Choose random ship tile (for simulating lost life).
function getRandomAliveMineShipIndex() {
  const aliveShipIndexes = mineFleetShips
    .map((shipTiles, index) => (getAliveMineTiles(shipTiles).length > 0 ? index : null))
    .filter((index) => index !== null);

  if (aliveShipIndexes.length === 0) {
    return null;
  }

  const randomShipOffset = Math.floor(Math.random() * aliveShipIndexes.length);
  return aliveShipIndexes[randomShipOffset];
}

// Set ship tile to life-lost so visually is greyed out.
function removeMineShipLife() {
  if (activeMissShipIndex === null || getAliveMineTiles(mineFleetShips[activeMissShipIndex]).length === 0) {
    activeMissShipIndex = getRandomAliveMineShipIndex();
  }

  if (activeMissShipIndex === null) {
    return;
  }

  const activeShipTiles = mineFleetShips[activeMissShipIndex];
  const aliveTiles = getAliveMineTiles(activeShipTiles);

  if (aliveTiles.length === 0) {
    activeMissShipIndex = null;
    return;
  }

  const tileToLose = aliveTiles[aliveTiles.length - 1];
  tileToLose.dataset.state = "life-lost";

  if (getAliveMineTiles(activeShipTiles).length === 0) {
    activeMissShipIndex = null;
  }
}

// Change ship tiles from not-found to found when hit is fired
function markFoundTargetTile(tileIndex) {
  const hitShipIndex = dailyLocations.findIndex((ship) =>
    ship.tiles.some((tile) => tile.index === tileIndex),
  );

  if (hitShipIndex === -1) {
    return;
  }

  const targetShipTiles = targetFleetShipsByDailyShip[hitShipIndex];

  if (!targetShipTiles) {
    return;
  }

  const notFoundTiles = getNotFoundTargetTiles(targetShipTiles);

  if (notFoundTiles.length === 0) {
    return;
  }

  notFoundTiles[0].dataset.state = "found";
}

// Reset current tile selection so it unhighlights.
function clearSelectedTile() {
  if (!selectedTile) {
    return;
  }

  selectedTile.classList.remove("is-selected");
  selectedTile.setAttribute("aria-pressed", "false");
  selectedTile = null;
}

// Check if tile has already been fired on.
function isTileLocked(tile) {
  return firedTileIndexes.has(Number(tile.dataset.index));
}

// Select or deselect a clicked tile.
function selectTile(tile) {
  if (isTileLocked(tile)) {
    clearSelectedTile();
    return;
  }

  clearSelectedTile();
  tile.classList.add("is-selected");
  tile.setAttribute("aria-pressed", "true");
  selectedTile = tile;
}

// Fire at selected tile and record if its a hit or miss.
function fireAtSelectedTile() {
  if (!selectedTile) {
    return;
  }

  if (isGameOver()) {
    onGameOver();
    return;
  }

  const tile = selectedTile;
  const tileIndex = Number(tile.dataset.index);

  if (firedTileIndexes.has(tileIndex)) {
    return;
  }

  const shotResult = shipTileIndexes.has(tileIndex) ? "hit" : "miss";
  firedTileIndexes.add(tileIndex);
  tile.classList.add("is-firing");
  tile.setAttribute("aria-disabled", "true");
  tile.setAttribute("tabindex", "-1");

  window.setTimeout(() => {
    tile.dataset.state = shotResult;
    tile.setAttribute("aria-label", `Tile ${tileIndex + 1}, ${shotResult}`);

    if (shotResult === "miss") {
      removeMineShipLife();
    } else {
      markFoundTargetTile(tileIndex);
    }

    if (isGameOver()) {
      onGameOver();
    }
  }, TILE_FLIP_STATE_SWAP_MS);

  window.setTimeout(() => {
    tile.classList.remove("is-firing");
  }, TILE_FLIP_DURATION_MS);

  clearSelectedTile();
}
// Implement a fire shot without needing to select tile first
function fireAtTile(tile) {
  if (!tile) {
    return;
  }

  selectTile(tile);
  fireAtSelectedTile();
}

setupTargetFleetShipMappings();

// Fire at selected tile if tile is already selected
function activateTile(tile) {
  if (isGameOver()) {
    onGameOver();
    return;
  }

  if (isTileLocked(tile)) {
    clearSelectedTile();
    return;
  }

  if (isSingleShotFireEnabled) {
    fireAtTile(tile);
    return;
  }

  if (selectedTile === tile) {
    fireAtSelectedTile();
    return;
  }

  selectTile(tile);
}

// Give each tile an ID and make accessible by mouse/keyboard.
tiles.forEach((tile, index) => {
  tile.dataset.index = String(index);
  tile.setAttribute("role", "button");
  tile.setAttribute("tabindex", "0");
  tile.setAttribute("aria-pressed", "false");
  tile.setAttribute("aria-disabled", "false");
  tile.setAttribute("aria-label", `Tile ${index + 1}`);

  tile.addEventListener("click", () => {
    activateTile(tile);
  });

  tile.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    activateTile(tile);
  });
});

if (isGameOver()) {
  onGameOver();
}

// Clicking away deselects tile
document.addEventListener("click", (event) => {
  if (!selectedTile) {
    return;
  }

  const clickedEnabledTile =
    event.target instanceof Element
      ? event.target.closest('.game-tile[aria-disabled="false"]')
      : null;

  if (clickedEnabledTile) {
    return;
  }

  clearSelectedTile();
});

// Set up dark mode theme
function getPreferredTheme() {
  const savedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  if (savedTheme === "dark" || savedTheme === "light") {
    return savedTheme;
  }

  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

// Ascertain if single shot is currently on
function getSingleShotFirePreference() {
  return localStorage.getItem(SINGLE_SHOT_FIRE_STORAGE_KEY) === "true";
}

// Apply single shot mode
function applySingleShotFirePreference(isEnabled) {
  isSingleShotFireEnabled = isEnabled;
  localStorage.setItem(SINGLE_SHOT_FIRE_STORAGE_KEY, String(isEnabled));

  if (isEnabled) {
    clearSelectedTile();
  }
}

function setupToolbarDialog({
  containerSelector,
  buttonId,
  closeButtonId,
  dialogId,
  onOpen,
  onClose,
}) {
  const container = document.querySelector(containerSelector);
  const button = document.getElementById(buttonId);
  const closeButton = document.getElementById(closeButtonId);
  const dialog = document.getElementById(dialogId);
  let lastTrigger = null;

  if (!container || !button || !closeButton || !dialog) {
    return null;
  }

  const syncModalOpenState = () => {
    const hasOpenDialog = document.querySelector(
      ".how-to-dropdown:not(.hidden), .settings-dropdown:not(.hidden)"
    );
    document.body.classList.toggle("modal-open", Boolean(hasOpenDialog));
  };

  const setDialogState = (isOpen, options = {}) => {
    const { restoreFocus = true, trigger = null } = options;

    dialog.classList.toggle("hidden", !isOpen);
    button.setAttribute("aria-expanded", String(isOpen));
    dialog.setAttribute("aria-hidden", String(!isOpen));
    syncModalOpenState();

    if (isOpen) {
      lastTrigger = trigger;
      closeButton.focus();
      onOpen?.();
    } else {
      onClose?.();

      if (restoreFocus && lastTrigger === button) {
        button.focus();
      }

      lastTrigger = null;
    }
  };

  button.addEventListener("click", () => {
    const isCurrentlyOpen = !dialog.classList.contains("hidden");
    setDialogState(!isCurrentlyOpen, {
      trigger: !isCurrentlyOpen ? button : null,
    });
  });

  closeButton.addEventListener("click", () => {
    setDialogState(false);
  });

  document.addEventListener("click", (event) => {
    if (!container.contains(event.target)) {
      setDialogState(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setDialogState(false);
    }
  });

  return {
    close() {
      setDialogState(false);
    },
    open() {
      setDialogState(true, {
        restoreFocus: false,
      });
    },
  };
}

// Setup for the settings menu modal
function setupSettingsMenu(onOpen) {
  const darkModeToggle = document.getElementById("dark-mode-toggle");
  const singleShotToggle = document.getElementById("single-shot-toggle");

  if (!darkModeToggle || !singleShotToggle) {
    return;
  }

  const startingTheme = getPreferredTheme();
  applyTheme(startingTheme);
  darkModeToggle.checked = startingTheme === "dark";
  const startingSingleShotFirePreference = getSingleShotFirePreference();
  applySingleShotFirePreference(startingSingleShotFirePreference);
  singleShotToggle.checked = startingSingleShotFirePreference;

  darkModeToggle.addEventListener("change", () => {
    applyTheme(darkModeToggle.checked ? "dark" : "light");
  });

  singleShotToggle.addEventListener("change", () => {
    applySingleShotFirePreference(singleShotToggle.checked);
  });

  return setupToolbarDialog({
    containerSelector: ".settings-menu",
    buttonId: "settings-cog-button",
    closeButtonId: "settings-close-button",
    dialogId: "settings-dropdown",
    onOpen,
  });
}

function setupHowToModal(onOpen) {
  return setupToolbarDialog({
    containerSelector: ".how-to-modal",
    buttonId: "how-to-question-mark-button",
    closeButtonId: "how-to-close-button",
    dialogId: "how-to-dropdown",
    onOpen,
  });
}

document.addEventListener("DOMContentLoaded", () => {
  let settingsControls = null;
  let howToControls = null;

  settingsControls = setupSettingsMenu(() => {
    howToControls?.close();
  });

  howToControls = setupHowToModal(() => {
    settingsControls?.close();
  });

  howToControls?.open();
});
