const THEME_STORAGE_KEY = "armadle-game-theme";

const tiles = Array.from(document.querySelectorAll(".game-tile"));
const gameBoard = document.querySelector(".game-board");

// Array of fleet-mine ship tiles
const mineFleetShips = Array.from(document.querySelectorAll(".fleet-mine .ship")).map(
  (ship) => Array.from(ship.querySelectorAll(".ship-tile")),
);

// Array of fleet-target ship tiles
const targetFleetShips = Array.from(document.querySelectorAll(".fleet-target .ship")).map(
  (ship) => Array.from(ship.querySelectorAll(".ship-tile")),
);

const dailyLocations = window.ArmadleGameLogic.getDailyTargetLocations(); // Ship locations for that day.

// Flatten ship arrays into single array.
const shipTileIndexes = new Set(
  dailyLocations.flatMap((ship) => ship.tiles.map((tile) => tile.index)),
);
const firedTileIndexes = new Set(); // Array to store shots fired tile indexes.
const TILE_FLIP_DURATION_MS = 200;
const TILE_FLIP_STATE_SWAP_MS = TILE_FLIP_DURATION_MS / 2;

let selectedTile = null;
let activeMissShipIndex = null;

// Filter for my ships that are alive
function getAliveMineTiles(shipTiles) {
  return shipTiles.filter((tile) => tile.dataset.state === "alive");
}

// filter for target ships that are not found
function getNotFoundTargetTiles(shipTiles) {
  return shipTiles.filter((tile) => tile.dataset.state === "not-found");
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
    }
  }, TILE_FLIP_STATE_SWAP_MS);

  window.setTimeout(() => {
    tile.classList.remove("is-firing");
  }, TILE_FLIP_DURATION_MS);

  clearSelectedTile();
}

// Fire at selected tile if tile is already selected
function activateTile(tile) {
  if (isTileLocked(tile)) {
    clearSelectedTile();
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
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}

// Setup for the settings menu modal
function setupSettingsMenu() {
  const settingsMenu = document.querySelector(".settings-menu");
  const settingsButton = document.getElementById("settings-cog-button");
  const settingsCloseButton = document.getElementById("settings-close-button");
  const settingsDropdown = document.getElementById("settings-dropdown");
  const darkModeToggle = document.getElementById("dark-mode-toggle");
  let lastTrigger = null;

  if (
    !settingsMenu ||
    !settingsButton ||
    !settingsCloseButton ||
    !settingsDropdown ||
    !darkModeToggle
  ) {
    return;
  }

  const startingTheme = getPreferredTheme();
  applyTheme(startingTheme);
  darkModeToggle.checked = startingTheme === "dark";

  const setMenuState = (isOpen) => {
    settingsDropdown.classList.toggle("hidden", !isOpen);
    settingsButton.setAttribute("aria-expanded", String(isOpen));
    settingsDropdown.setAttribute("aria-hidden", String(!isOpen));

    if (isOpen) {
      lastTrigger = settingsButton;
      settingsCloseButton.focus();
    } else if (lastTrigger === settingsButton) {
      settingsButton.focus();
    }
  };

  settingsButton.addEventListener("click", () => {
    const isCurrentlyOpen = !settingsDropdown.classList.contains("hidden");
    setMenuState(!isCurrentlyOpen);
  });

  settingsCloseButton.addEventListener("click", () => {
    setMenuState(false);
  });

  darkModeToggle.addEventListener("change", () => {
    applyTheme(darkModeToggle.checked ? "dark" : "light");
  });

  document.addEventListener("click", (event) => {
    const clickedInsideMenu = settingsMenu.contains(event.target);
    if (!clickedInsideMenu) {
      setMenuState(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setMenuState(false);
      settingsButton.focus();
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  setupSettingsMenu();
});
