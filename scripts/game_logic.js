// Logic for generating the daily target ship locations.
// Positions seeded from the date, they change once a day but stay the same for all players.
const BOARD_ROWS = 7;
const BOARD_COLUMNS = 7;
const DAILY_GROUP_SIZES = [2, 2, 3, 4]; // Ship sizes.

// Get a string key in the format "YYYY-MM-DD".
function getDateKey(date = new Date()) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

// Hash a string to a seed number. Uses the FNV-1a hash algorithm.
function hashStringToSeed(value) {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

// Create a seeded random number generator using the Mulberry32 algorithm.
function createRandomNumberGenerator(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state += 0x6d2b79f5;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Give each tile its own unique number.
function getTileIndex(row, column, columnCount = BOARD_COLUMNS) {
  return row * columnCount + column;
}

// Choose random start tile for each ship from all currently empty tiles.
function pickRandomItem(items, random) {
  const randomIndex = Math.floor(random() * items.length);
  return items[randomIndex];
}

// Determine position of ship in a straight line from starter tile
function buildLineTiles(startRow, startColumn, size, orientation, columnCount) {
  const lineTiles = [];

  for (let offset = 0; offset < size; offset += 1) {
    const row = orientation === "vertical" ? startRow + offset : startRow;
    const column = orientation === "horizontal" ? startColumn + offset : startColumn;

    lineTiles.push({
      row,
      column,
      index: getTileIndex(row, column, columnCount),
    });
  }

  return lineTiles;
}

// Check if allocated tiles are already occupied by another ship
function canPlaceLine(lineTiles, occupiedTiles) {
  return lineTiles.every((tile) => !occupiedTiles.has(tile.index));
}

// Make sure ship position is straight, on the board and not overlapping another ship
function buildValidLinePlacements(size, occupiedTiles, rowCount, columnCount) {
  const validPlacements = [];
  const orientations = ["horizontal", "vertical"];

  orientations.forEach((orientation) => {
    for (let row = 0; row < rowCount; row += 1) {
      for (let column = 0; column < columnCount; column += 1) {
        const endRow = orientation === "vertical" ? row + size - 1 : row;
        const endColumn = orientation === "horizontal" ? column + size - 1 : column;

        if (endRow >= rowCount || endColumn >= columnCount) {
          continue;
        }

        const lineTiles = buildLineTiles(
          row,
          column,
          size,
          orientation,
          columnCount,
        );

        if (canPlaceLine(lineTiles, occupiedTiles)) {
          validPlacements.push(lineTiles);
        }
      }
    }
  });

  return validPlacements;
}

// Choose locations of ships from valid options 
function generateStraightShip(size, occupiedTiles, random, rowCount, columnCount) {
  const validPlacements = buildValidLinePlacements(
    size,
    occupiedTiles,
    rowCount,
    columnCount,
  );

  if (validPlacements.length === 0) {
    return null;
  }

  return pickRandomItem(validPlacements, random);
}

// Returns the daily 4 groups of target locations as straight, non-overlapping ships.
function getDailyTargetLocations(date = new Date()) {
  const dateKey = getDateKey(date);
  const seed = hashStringToSeed(`armadle:${dateKey}`);
  const random = createRandomNumberGenerator(seed);

  for (let attempt = 0; attempt < 200; attempt += 1) {
    const occupiedTiles = new Set();
    const dailyLocations = [];
    let failedToPlaceGroup = false;

    for (const size of DAILY_GROUP_SIZES) {
      const groupTiles = generateStraightShip(
        size,
        occupiedTiles,
        random,
        BOARD_ROWS,
        BOARD_COLUMNS,
      );

      if (!groupTiles) {
        failedToPlaceGroup = true;
        break;
      }

      groupTiles.forEach((tile) => {
        occupiedTiles.add(tile.index);
      });

      dailyLocations.push({
        size,
        tiles: groupTiles,
      });
    }

    if (!failedToPlaceGroup) {
      return dailyLocations;
    }
  }

  throw new Error("Unable to generate a valid set of daily target locations.");
}

window.ArmadleGameLogic = {
  getDailyTargetLocations,
};
