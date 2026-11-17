const canvas = document.querySelector("#confetti-canvas");
const ctx = canvas.getContext("2d");
const musicButton = document.querySelector("#music-button");
const musicLabel = document.querySelector("#music-label");
const revealButton = document.querySelector("#reveal-button");
const birthdayCard = document.querySelector("#birthday-card");

const confettiColors = ["#ffe66d", "#ff59c7", "#70dcff", "#a979ff", "#ff9d5c"];
let confettiPieces = [];
let animationFrame = null;
let audioContext = null;
let activeOscillators = new Set();
let phraseTimer = null;
let isPlaying = false;

function resizeCanvas() {
  const scale = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * scale;
  canvas.height = window.innerHeight * scale;
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  ctx.setTransform(scale, 0, 0, scale, 0, 0);
}

function burstConfetti(amount = 120) {
  const originX = window.innerWidth / 2;
  const originY = window.innerHeight * 0.43;

  for (let i = 0; i < amount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 3 + Math.random() * 8;

    confettiPieces.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 4,
      gravity: 0.12 + Math.random() * 0.08,
      rotation: Math.random() * Math.PI,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
      width: 5 + Math.random() * 7,
      height: 7 + Math.random() * 10,
      color: confettiColors[Math.floor(Math.random() * confettiColors.length)],
      life: 130 + Math.random() * 80
    });
  }

  if (!animationFrame) {
    animateConfetti();
  }
}

function animateConfetti() {
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

  confettiPieces = confettiPieces.filter((piece) => piece.life > 0 && piece.y < window.innerHeight + 30);

  for (const piece of confettiPieces) {
    piece.x += piece.vx;
    piece.y += piece.vy;
    piece.vy += piece.gravity;
    piece.vx *= 0.99;
    piece.rotation += piece.rotationSpeed;
    piece.life -= 1;

    ctx.save();
    ctx.translate(piece.x, piece.y);
    ctx.rotate(piece.rotation);
    ctx.fillStyle = piece.color;
    ctx.fillRect(-piece.width / 2, -piece.height / 2, piece.width, piece.height);
    ctx.restore();
  }

  if (confettiPieces.length > 0) {
    animationFrame = requestAnimationFrame(animateConfetti);
  } else {
    ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
    animationFrame = null;
  }
}

window.addEventListener("resize", resizeCanvas);
resizeCanvas();

function getAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) {
      return null;
    }
    audioContext = new AudioContextClass();
  }
  return audioContext;
}

const noteFrequencies = {
  F4: 349.23,
  G4: 392.0,
  A4: 440.0,
  Bb4: 466.16,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  F5: 698.46,
  G5: 783.99
};

// Each entry is [note, beat length]. The melody loops while music is on.
const birthdayMelody = [
  ["C5", 0.75], ["C5", 0.25], ["D5", 1], ["C5", 1], ["F5", 1], ["E5", 2],
  ["C5", 0.75], ["C5", 0.25], ["D5", 1], ["C5", 1], ["G5", 1], ["F5", 2],
  ["C5", 0.75], ["C5", 0.25], ["C6", 1], ["A5", 1], ["F5", 1], ["E5", 1], ["D5", 2],
  ["Bb5", 0.75], ["Bb5", 0.25], ["A5", 1], ["F5", 1], ["G5", 1], ["F5", 2]
];

// Add the higher notes used in the familiar final phrases.
noteFrequencies.C6 = 1046.5;
noteFrequencies.A5 = 880.0;
noteFrequencies.Bb5 = 932.33;

const secondsPerBeat = 0.43;

function playPhrase() {
  if (!isPlaying || !audioContext) {
    return;
  }

  const startAt = audioContext.currentTime + 0.06;
  let offset = 0;

  for (const [note, beats] of birthdayMelody) {
    const duration = beats * secondsPerBeat;
    const frequency = noteFrequencies[note];

    if (frequency) {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      const noteStart = startAt + offset;
      const noteEnd = noteStart + duration * 0.88;

      oscillator.type = "sine";
      oscillator.frequency.setValueAtTime(frequency, noteStart);

      gain.gain.setValueAtTime(0.0001, noteStart);
      gain.gain.exponentialRampToValueAtTime(0.14, noteStart + 0.025);
      gain.gain.setValueAtTime(0.14, Math.max(noteStart + 0.03, noteEnd - 0.06));
      gain.gain.exponentialRampToValueAtTime(0.0001, noteEnd);

      oscillator.connect(gain);
      gain.connect(audioContext.destination);
      activeOscillators.add(oscillator);

      oscillator.addEventListener("ended", () => {
        activeOscillators.delete(oscillator);
        oscillator.disconnect();
        gain.disconnect();
      }, { once: true });

      oscillator.start(noteStart);
      oscillator.stop(noteEnd + 0.02);
    }

    offset += duration;
  }

  phraseTimer = window.setTimeout(playPhrase, offset * 1000 + 180);
}

async function startMusic() {
  const context = getAudioContext();
  if (!context) {
    musicLabel.textContent = "Audio unavailable";
    return;
  }

  if (context.state === "suspended") {
    await context.resume();
  }

  isPlaying = true;
  musicButton.classList.add("is-playing");
  musicButton.setAttribute("aria-pressed", "true");
  musicLabel.textContent = "Pause music";
  playPhrase();
}

function stopMusic() {
  isPlaying = false;
  window.clearTimeout(phraseTimer);
  phraseTimer = null;

  for (const oscillator of activeOscillators) {
    try {
      oscillator.stop();
    } catch {
      // The note may already have stopped naturally.
    }
  }

  activeOscillators.clear();
  musicButton.classList.remove("is-playing");
  musicButton.setAttribute("aria-pressed", "false");
  musicLabel.textContent = "Play music";
}

musicButton.addEventListener("click", () => {
  if (isPlaying) {
    stopMusic();
  } else {
    startMusic();
  }
});

revealButton.addEventListener("click", async () => {
  const isRevealed = birthdayCard.classList.toggle("is-visible");
  birthdayCard.setAttribute("aria-hidden", String(!isRevealed));

  if (isRevealed) {
    revealButton.innerHTML = '<span class="gift-icon" aria-hidden="true">💌</span><span>Your card is open!</span><span class="button-arrow" aria-hidden="true">♥</span>';
    burstConfetti(220);
    if (!isPlaying) {
      await startMusic();
    }
  } else {
    revealButton.innerHTML = '<span class="gift-icon" aria-hidden="true">🎁</span><span>Open your birthday card</span><span class="button-arrow" aria-hidden="true">↗</span>';
  }
});