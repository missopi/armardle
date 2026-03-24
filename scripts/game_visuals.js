const tiles = document.querySelectorAll(".game-tile");
const gameBoard = document.querySelector(".game-board");

let selectedTile = null;

// Select each individual tile on the gameboard when clicked
tiles.forEach((tile, index) => {
  tile.setAttribute("role", "button");
  tile.setAttribute("tabindex", "0");
  tile.setAttribute("aria-pressed", "false");
  tile.setAttribute("aria-label", `Tile ${index + 1}`);

  tile.addEventListener("click", () => {
    if (selectedTile) {
      selectedTile.classList.remove("is-selected");
      selectedTile.setAttribute("aria-pressed", "false");
    }

    if (selectedTile === tile) {
      selectedTile = null;
      return;
    }

    tile.classList.add("is-selected");
    tile.setAttribute("aria-pressed", "true");
    selectedTile = tile;
  });

  tile.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    tile.click();
  });
});

// Deselect game tile
document.addEventListener("click", (event) => {
  if (!selectedTile || gameBoard?.contains(event.target)) {
    return;
  }

  selectedTile.classList.remove("is-selected");
  selectedTile.setAttribute("aria-pressed", "false");
  selectedTile = null;
});
