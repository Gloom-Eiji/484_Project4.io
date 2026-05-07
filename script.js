// ---- Audio Objects (keyboard sound effects) ----
const sndClick   = new Audio('soundreality-button-4-214382.mp3');   // correct key
const sndBuzz    = new Audio('logicallism-incorrect-buzzer-374194.mp3'); // wrong key
const sndSuccess = new Audio('dragon-studio-correct-472358.mp3');   // test complete

sndBuzz.volume = 0.4;


//audio effects functions:
function playClick() {
  sndClick.currentTime = 0;
  sndClick.play().catch(() => {});
}

function playBuzz() {
  sndBuzz.currentTime = 0;
  sndBuzz.play().catch(() => {});
}

function playSuccess() {
  sndSuccess.currentTime = 0;
  sndSuccess.play().catch(() => {});
}

// ---- Text pool for random selection ----
const textPool = [
  "The quick brown fox jumps over the lazy dog near the riverbank.",
  "Bright sunlight filtered through the tall pine trees on the mountain trail.",
  "She typed furiously, her fingers barely keeping up with her racing thoughts.",
  "Every great journey begins with a single step toward the unknown horizon.",
  "The old clock on the wall ticked steadily through the quiet afternoon."
];

// ---- DOM refs ----
const testWrapper  = document.querySelector('.test-wrapper');
const testArea     = document.querySelector('#test-area');
const originP      = document.querySelector('#origin-text p');
const resetBtn     = document.querySelector('#reset');
const timerEl      = document.querySelector('.timer');
const wpmDisplay   = document.querySelector('#wpm-display');
const errDisplay   = document.querySelector('#err-display');
const scoresList   = document.querySelector('#scores-list');
const canvas       = document.querySelector('#particle-canvas');
const ctx          = canvas.getContext('2d');

// ---- State ----
let originText = '';
let timerInterval = null;
let startTime = null;
let running = false;
let errorCount = 0;
let lastWasError = false;  // track if current position has an active error
let particles = [];

// ---- Helpers ----
function pad(n) {
  return n < 10 ? '0' + n : '' + n;
}

// ---- Timer ----
function updateTimer() {
  const elapsed = Date.now() - startTime;
  const mins = Math.floor(elapsed / 60000);
  const secs = Math.floor((elapsed % 60000) / 1000);
  const hundredths = Math.floor((elapsed % 1000) / 10);
  timerEl.textContent = `${pad(mins)}:${pad(secs)}:${pad(hundredths)}`;
}

function startTimer() {
  startTime = Date.now();
  running = true;
  timerInterval = setInterval(updateTimer, 50);
}

function stopTimer() {
  clearInterval(timerInterval);
  running = false;
}

function elapsedSeconds() {
  return (Date.now() - startTime) / 1000;
}

// ---- WPM ----
function calcWPM(charCount, seconds) {
  if (seconds <= 0) return 0;
  return Math.round((charCount / 5) / (seconds / 60));
}

// ---- Letter span builder (text animation) ----
function buildLetterSpans(text) {
  originP.innerHTML = '';
  for (let i = 0; i < text.length; i++) {
    const span = document.createElement('span');
    span.classList.add('char');
    // Spaces are nbsp so they render correctly
    span.textContent = text[i] === ' ' ? '\u00A0' : text[i];
    span.dataset.index = i;
    // Assign random spin values for ragdoll fall animation
    const spinA = (Math.random() * 30 - 15).toFixed(1) + 'deg';
    const spinB = (Math.random() * 50 - 25).toFixed(1) + 'deg';
    const spinC = (Math.random() * 70 - 35).toFixed(1) + 'deg';
    span.style.setProperty('--spin',  spinA);
    span.style.setProperty('--spin2', spinB);
    span.style.setProperty('--spin3', spinC);
    originP.appendChild(span);
  }
}

function getCharSpan(index) {
  return originP.querySelector(`.char[data-index="${index}"]`);
}

// ---- Particle system for disintegration (text animation) ----
function resizeCanvas() {
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;
}

resizeCanvas();
window.addEventListener('resize', resizeCanvas);

function spawnParticles(x, y, color) {
  for (let i = 0; i < 10; i++) {
    particles.push({
      x, y,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.8) * 5,
      alpha: 1,
      radius: Math.random() * 3 + 1,
      color
    });
  }
}

function animateParticles() { // disentigration animation loop
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  particles = particles.filter(p => p.alpha > 0.02);
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += 0.18; // gravity
    p.alpha -= 0.025;
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  requestAnimationFrame(animateParticles);
}

animateParticles();

// Get absolute position of a span for particle spawning
function getSpanCenter(span) {
  const rect = span.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

// ---- Text animation: mark correct, ragdoll fall + particles ----
function markCharCorrect(index) {
  const span = getCharSpan(index);
  if (!span || span.classList.contains('fall')) return;
  span.classList.remove('wrong');
  span.classList.add('correct');

  // Ragdoll fall after brief green moment (text animation)
  setTimeout(() => {
    const pos = getSpanCenter(span);
    span.classList.add('fall');
    spawnParticles(pos.x, pos.y, '#06d6a0');
    // Remove span after animation completes
    setTimeout(() => span.remove(), 600);
  }, 180);
}

// ---- Text animation: shake wrong char red until corrected ----
function markCharWrong(index) {
  // Remove wrong from previous span if different index
  document.querySelectorAll('#origin-text .char.wrong').forEach(s => {
    if (parseInt(s.dataset.index) !== index) s.classList.remove('wrong');
  });
  const span = getCharSpan(index);
  if (!span) return;
  span.classList.remove('correct');
  // Re-trigger shake by cloning trick
  span.classList.remove('wrong');
  void span.offsetWidth; // reflow
  span.classList.add('wrong');
}

function clearCharWrong(index) {
  const span = getCharSpan(index);
  if (span) span.classList.remove('wrong');
}

// ---- Match checking ----
function checkInput() {
  const typed = testArea.value;
  const len   = typed.length;

  // Start timer on first keystroke
  if (!running && len > 0) startTimer();

  // If cleared, reset state
  if (len === 0) {
    testWrapper.className = 'test-wrapper';
    wpmDisplay.textContent = '—';
    return;
  }

  const currentChar = typed[len - 1];
  const expectedChar = originText[len - 1];

  if (currentChar === expectedChar) {
    // Correct key — play click sound (keyboard sound effects)
    if (lastWasError) {
      clearCharWrong(len - 1);
      lastWasError = false;
    } else {
      playClick();
    }
    markCharCorrect(len - 1);
    testWrapper.className = 'test-wrapper typing';
  } else {
    // Wrong key — play buzz sound (keyboard sound effects)
    if (!lastWasError) {
      errorCount++;
      errDisplay.textContent = errorCount;
      playBuzz();
    }
    lastWasError = true;
    markCharWrong(len - 1);
    testWrapper.className = 'test-wrapper error';
  }

  // Live WPM
  if (running) {
    const wpm = calcWPM(len, elapsedSeconds());
    wpmDisplay.textContent = wpm;
  }

  // Check completion — only on exact match
  if (typed === originText) {
    finishTest();
  }
}

// ---- Completion ----
function finishTest() {
  stopTimer();
  testWrapper.className = 'test-wrapper done';
  testArea.disabled = true;

  // Play success sound (keyboard sound effects — completion)
  playSuccess();

  // Flash remaining spans green then ragdoll all (text animation)
  document.querySelectorAll('#origin-text .char').forEach((span, i) => {
    setTimeout(() => {
      span.classList.add('correct');
      setTimeout(() => {
        const pos = getSpanCenter(span);
        span.classList.add('fall');
        spawnParticles(pos.x, pos.y, '#06d6a0');
        setTimeout(() => span.remove(), 600);
      }, 100 + i * 20);
    }, i * 15);
  });

  const secs = elapsedSeconds();
  const wpm  = calcWPM(originText.length, secs);
  wpmDisplay.textContent = wpm;

  saveScore(secs, wpm);
}

// ---- Local Storage scores ----
function loadScores() {
  try { return JSON.parse(localStorage.getItem('typeit_scores')) || []; }
  catch { return []; }
}

function saveScore(secs, wpm) {
  let scores = loadScores();
  scores.push({ secs: +secs.toFixed(2), wpm });
  scores.sort((a, b) => a.secs - b.secs);
  scores = scores.slice(0, 3);
  localStorage.setItem('typeit_scores', JSON.stringify(scores));
  renderScores(scores);
}

function renderScores(scores) {
  scoresList.innerHTML = '';
  if (!scores.length) return;
  scores.forEach((s, i) => {
    const li = document.createElement('li');
    li.dataset.rank = i + 1;
    const mins = Math.floor(s.secs / 60);
    const secs = (s.secs % 60).toFixed(2);
    li.textContent = `${pad(mins)}:${pad(Math.floor(secs))} — ${s.wpm} wpm`;
    scoresList.appendChild(li);
  });
}

// ---- Reset ----
function reset() {
  stopTimer();
  clearInterval(timerInterval);
  timerEl.textContent = '00:00:00';
  wpmDisplay.textContent = '—';
  errDisplay.textContent = '0';
  errorCount = 0;
  lastWasError = false;
  running = false;
  startTime = null;
  testArea.value = '';
  testArea.disabled = false;
  testWrapper.className = 'test-wrapper';

  // Pick random text
  originText = textPool[Math.floor(Math.random() * textPool.length)];
  buildLetterSpans(originText);

  testArea.focus();
}

// ---- Event listeners ----
testArea.addEventListener('input', checkInput);
resetBtn.addEventListener('click', reset);

// ---- Init ----
reset();
renderScores(loadScores());
