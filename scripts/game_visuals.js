const tiles = Array.from(document.querySelectorAll(".game-tile"));
const gameBoard = document.querySelector(".game-board");

const dailyLocations = window.ArmadleGameLogic.getDailyTargetLocations(); // Ship locations for that day.

// Flatten ship arrays into single array.
const shipTileIndexes = new Set(
  dailyLocations.flatMap((ship) => ship.tiles.map((tile) => tile.index)),
);
const firedTileIndexes = new Set(); // Array to store shots fired tile indexes.

let selectedTile = null;

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

  const tileIndex = Number(selectedTile.dataset.index);

  if (firedTileIndexes.has(tileIndex)) {
    return;
  }

  const shotResult = shipTileIndexes.has(tileIndex) ? "hit" : "miss";
  firedTileIndexes.add(tileIndex);
  selectedTile.dataset.state = shotResult;
  selectedTile.setAttribute("aria-label", `Tile ${tileIndex + 1}, ${shotResult}`);
  selectedTile.setAttribute("aria-disabled", "true");
  selectedTile.setAttribute("tabindex", "-1");

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
