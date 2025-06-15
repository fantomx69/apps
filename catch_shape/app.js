let score = 0;
let intervalId = null;
let gameTime = 60;
let countdownId = null;
let shapeDuration = 1000;
let isPlaying = false; // Nuovo stato per il gioco

const gameArea = document.getElementById("gameArea");
const scoreDisplay = document.getElementById("score");
const togglePlayBtn = document.getElementById("togglePlayBtn"); // Riferimento al nuovo bottone
const resetBtn = document.getElementById("resetBtn");
const timerDisplay = document.getElementById("timer");

function getRandomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function createShape() {
  const shape = document.createElement("div");
  const size = getRandomInt(30, 100);
  const shapeType = Math.random() > 0.5 ? "circle" : "square";
  const color = `rgb(${getRandomInt(0,255)}, ${getRandomInt(0,255)}, ${getRandomInt(0,255)})`;

  shape.classList.add("shape", shapeType);
  shape.style.backgroundColor = color;
  shape.style.width = `${size}px`;
  shape.style.height = `${size}px`;
  shape.style.top = `${getRandomInt(0, gameArea.clientHeight - size)}px`;
  shape.style.left = `${getRandomInt(0, gameArea.clientWidth - size)}px`;

  shape.addEventListener("click", () => {
    score++;
    updateScore();
    if (gameArea.contains(shape)) {
      gameArea.removeChild(shape);
    }
  });

  gameArea.innerHTML = "";
  gameArea.appendChild(shape);

  setTimeout(() => {
    if (gameArea.contains(shape)) {
      gameArea.removeChild(shape);
    }
  }, shapeDuration);
}

function updateScore() {
  scoreDisplay.textContent = `Punteggio: ${score}`;
}

function updateTimer() {
  gameTime--;
  timerDisplay.textContent = `Tempo: ${gameTime}s`;
  if (shapeDuration > 500) shapeDuration -= 10;
  if (gameTime <= 0) {
    stopGame(); // Usa la nuova funzione stopGame
  }
}

function startGame() {
  if (!isPlaying) {
    intervalId = setInterval(createShape, 1500);
    countdownId = setInterval(updateTimer, 1000);
    togglePlayBtn.textContent = "Ferma";
    isPlaying = true;
  }
}

function stopGame() {
  clearInterval(intervalId);
  clearInterval(countdownId);
  intervalId = null;
  countdownId = null;
  gameArea.innerHTML = "";
  togglePlayBtn.textContent = "Avvia";
  isPlaying = false;
  if (gameTime <= 0) { // Messaggio di fine gioco solo se il tempo è scaduto
    alert("Tempo scaduto! Il tuo punteggio è: " + score);
  }
}

function togglePlay() {
  if (isPlaying) {
    stopGame();
  } else {
    startGame();
  }
}

togglePlayBtn.addEventListener("click", togglePlay);

resetBtn.addEventListener("click", () => {
  stopGame(); // Ferma il gioco prima del reset
  score = 0;
  gameTime = 60;
  shapeDuration = 1000;
  updateScore();
  timerDisplay.textContent = `Tempo: ${gameTime}s`;
  gameArea.innerHTML = "";
});