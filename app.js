"use strict";

/* ================= Налаштування (стан гри) ================= */
const settings = {
  modes: ["add"],          // обрані типи вправ
  answerType: "input",     // input | choice | random
  count: 10,               // 0 = без ліміту
  range: 1000,             // максимальне число: 20 | 100 | 1000
  timer: 0,                // секунд на приклад; 0 = вимкнено
  sound: true,             // звукові ефекти
  voice: true,             // голосове заохочення
};

const state = {
  current: null,           // поточний приклад {text, answer}
  index: 0,
  score: 0,
  streak: 0,
  correct: 0,
  answered: false,
};

let MAX = 1000;            // максимальний результат / межа (задається діапазоном)

/* ================= Утиліти ================= */
const rnd = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* ================= Звук (Web Audio API) ================= */
let audioCtx = null;

function initAudio() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      audioCtx = null;
    }
  }
  if (audioCtx && audioCtx.state === "suspended") audioCtx.resume();
}

function beep(freq, startAt, dur, type = "sine", gain = 0.15) {
  if (!settings.sound || !audioCtx) return;
  const t0 = audioCtx.currentTime + startAt;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(audioCtx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.03);
}

const soundCorrect = () => { beep(660, 0, 0.15); beep(990, 0.12, 0.22); };
const soundWrong = () => { beep(196, 0, 0.32, "sawtooth", 0.12); };
const soundTimeout = () => { beep(440, 0, 0.16, "triangle"); beep(260, 0.15, 0.28, "triangle"); };
const soundTick = () => { beep(880, 0, 0.05, "square", 0.06); };

/* ================= Голос (синтез мовлення) ================= */
const PRAISES = [
  "Молодчинка!", "Ти супер!", "Розумничка!", "Так тримати!",
  "Чудово виходить!", "Оце так серія!", "Ти найкращий!", "Неймовірно!",
];

let ukVoice = null;

function loadVoices() {
  if (!("speechSynthesis" in window)) return;
  const voices = speechSynthesis.getVoices();
  ukVoice = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("uk"))
    || voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("ru"))
    || null;
}

if ("speechSynthesis" in window) {
  loadVoices();
  speechSynthesis.onvoiceschanged = loadVoices;
}

function speak(text) {
  if (!settings.voice || !("speechSynthesis" in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "uk-UA";
    if (ukVoice) u.voice = ukVoice;
    u.rate = 1.0;
    u.pitch = 1.15;
    speechSynthesis.speak(u);
  } catch (e) { /* ігноруємо, якщо не підтримується */ }
}

const praise = () => speak(pick(PRAISES));

/* ================= Генератори прикладів =================
   Кожен генератор повертає { text, answer } з цілою відповіддю
   і всіма проміжними результатами в межах 0..1000. */

function genAdd() {
  const a = rnd(1, MAX - 1);
  const b = rnd(1, MAX - a);
  return { text: `${a} + ${b}`, answer: a + b };
}

function genSub() {
  const a = rnd(2, MAX);
  const b = rnd(1, a);
  return { text: `${a} − ${b}`, answer: a - b };
}

function genMul() {
  // тримаємо добуток у межах діапазону, зручні для дитини множники
  const aMax = Math.max(2, Math.min(30, Math.floor(MAX / 2)));
  const a = rnd(2, aMax);
  const bMax = Math.max(2, Math.min(30, Math.floor(MAX / a)));
  const b = rnd(2, bMax);
  return { text: `${a} × ${b}`, answer: a * b };
}

function genDiv() {
  // спершу будуємо ділення без остачі: (b × c) : b
  const b = rnd(2, Math.max(2, Math.min(20, Math.floor(MAX / 2))));
  const c = rnd(2, Math.max(2, Math.min(20, Math.floor(MAX / b))));
  const a = b * c;
  return { text: `${a} : ${b}`, answer: c };
}

// Таблиця множення: множники 1..10
function genTable() {
  const a = rnd(1, 10);
  const b = rnd(1, 10);
  return { text: `${a} × ${b}`, answer: a * b };
}

/* ---- Складні приклади (комбіновані вирази) ---- */
function genExpr() {
  const templates = [exprDivPlusMul, exprMulMinusDiv, exprDistribPlus, exprDistribMinus, exprDivPlusNum];
  return pick(templates)();
}

// a : b + c × d
function exprDivPlusMul() {
  const b = rnd(2, 10);
  const c = rnd(2, 10);
  const q = rnd(2, 12);
  const a = b * q;                    // a : b = q
  const d = rnd(2, Math.min(10, Math.floor((MAX - q) / c)));
  const answer = q + c * d;
  return { text: `${a} : ${b} + ${c} × ${d}`, answer };
}

// a × b − c : d  (результат ≥ 0)
function exprMulMinusDiv() {
  const a = rnd(2, 15);
  const b = rnd(2, Math.min(15, Math.floor(MAX / a)));
  const mul = a * b;
  const d = rnd(2, 10);
  const qMax = Math.min(12, Math.floor(mul / d)); // щоб результат був ≥ 0
  const q = rnd(1, Math.max(1, qMax));
  const c = d * q;
  const answer = mul - q;
  return { text: `${a} × ${b} − ${c} : ${d}`, answer };
}

// a × (b + c)
function exprDistribPlus() {
  const a = rnd(2, 20);
  const sumMax = Math.floor(MAX / a);
  const b = rnd(1, Math.max(1, sumMax - 1));
  const c = rnd(1, Math.max(1, sumMax - b));
  const answer = a * (b + c);
  return { text: `${a} × (${b} + ${c})`, answer };
}

// a × (b − c)
function exprDistribMinus() {
  const a = rnd(2, 20);
  const diffMax = Math.floor(MAX / a);
  const b = rnd(2, Math.max(2, diffMax));
  const c = rnd(1, b - 1);
  const answer = a * (b - c);
  return { text: `${a} × (${b} − ${c})`, answer };
}

// a : b + c
function exprDivPlusNum() {
  const b = rnd(2, 12);
  const q = rnd(2, 20);
  const a = b * q;
  const c = rnd(1, MAX - q);
  const answer = q + c;
  return { text: `${a} : ${b} + ${c}`, answer };
}

const GENERATORS = {
  add: genAdd,
  sub: genSub,
  mul: genMul,
  div: genDiv,
  table: genTable,
  expr: genExpr,
};

// перевірка, що всі числа у прикладі та відповідь у межах діапазону
function isValid(q) {
  if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > MAX) return false;
  const nums = q.text.match(/\d+/g) || [];
  return nums.every((n) => Number(n) <= MAX);
}

function nextQuestion() {
  let pool = settings.modes.slice();
  if (settings.modes.includes("advanced")) {
    pool = ["add", "sub", "mul", "div", "table", "expr"];
  }
  if (pool.length === 0) pool = ["add"];
  const mode = pick(pool);

  // таблиця множення завжди 1..10 (не залежить від діапазону)
  if (mode === "table") return genTable();

  // для решти режимів гарантуємо відповідність діапазону,
  // інакше пробуємо ще раз, а на крайній випадок — просте додавання
  for (let i = 0; i < 40; i++) {
    const q = GENERATORS[mode]();
    if (isValid(q)) return q;
  }
  return genAdd();
}

/* ================= Варіанти відповіді ================= */
function buildChoices(answer) {
  const options = new Set([answer]);
  let guard = 0;
  while (options.size < 4 && guard < 50) {
    guard++;
    const delta = rnd(1, 10) * (Math.random() < 0.5 ? -1 : 1);
    const cand = answer + delta;
    if (cand >= 0 && cand !== answer) options.add(cand);
  }
  // добиваємо, якщо не вистачило
  let extra = 1;
  while (options.size < 4) {
    if (answer + extra >= 0) options.add(answer + extra);
    extra++;
  }
  return shuffle([...options]);
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ================= DOM ================= */
const el = (id) => document.getElementById(id);
const setupScreen = el("setup");
const gameScreen = el("game");
const resultScreen = el("result");

const questionEl = el("question");
const inputArea = el("inputArea");
const choiceArea = el("choiceArea");
const answerInput = el("answerInput");
const feedbackEl = el("feedback");

/* ----- Обробники екрана налаштувань ----- */
el("modeChips").addEventListener("click", (e) => {
  const chip = e.target.closest(".chip");
  if (!chip) return;
  const mode = chip.dataset.mode;
  if (mode === "advanced") {
    // просунутий — ексклюзивний режим
    document.querySelectorAll("#modeChips .chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
  } else {
    el("modeChips").querySelector('[data-mode="advanced"]').classList.remove("active");
    chip.classList.toggle("active");
    // не даємо лишитись без жодного вибору
    if (!document.querySelector("#modeChips .chip.active")) chip.classList.add("active");
  }
});

function singleSelect(containerId) {
  el(containerId).addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    el(containerId).querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
    chip.classList.add("active");
  });
}
singleSelect("answerChips");
singleSelect("countChips");
singleSelect("rangeChips");
singleSelect("timerChips");

// перемикач звуку
el("soundToggle").addEventListener("click", () => {
  const chip = el("soundToggle");
  settings.sound = !settings.sound;
  chip.classList.toggle("active", settings.sound);
  chip.textContent = settings.sound ? "🔊 Звук" : "🔇 Звук";
  if (settings.sound) initAudio();
});

// перемикач голосу заохочення
el("voiceToggle").addEventListener("click", () => {
  const chip = el("voiceToggle");
  settings.voice = !settings.voice;
  chip.classList.toggle("active", settings.voice);
  chip.textContent = settings.voice ? "�️ Голос заохочення" : "🔇 Голос вимкнено";
  if (settings.voice) speak("Привіт!"); // коротка проба голосу
});

// власна кількість прикладів: активуємо поле й гасимо чіпи
const customCount = el("customCount");
customCount.addEventListener("focus", selectCustomCount);
customCount.addEventListener("input", selectCustomCount);
function selectCustomCount() {
  if (customCount.value.trim() === "") return;
  el("countChips").querySelectorAll(".chip").forEach((c) => c.classList.remove("active"));
  customCount.classList.add("active");
}
// клік по будь-якому чіпу кількості вимикає власне поле
el("countChips").addEventListener("click", (e) => {
  if (e.target.closest(".chip")) customCount.classList.remove("active");
});

el("startBtn").addEventListener("click", startGame);
el("backBtn").addEventListener("click", goToMenu);
el("menuBtn").addEventListener("click", goToMenu);
el("againBtn").addEventListener("click", startGame);
el("checkBtn").addEventListener("click", checkInputAnswer);
answerInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    if (state.answered) nextRound();
    else checkInputAnswer();
  }
});

/* ================= Логіка гри ================= */
function readSettings() {
  settings.modes = [...document.querySelectorAll("#modeChips .chip.active")].map((c) => c.dataset.mode);
  settings.answerType = document.querySelector("#answerChips .chip.active").dataset.answer;

  if (customCount.classList.contains("active")) {
    let n = parseInt(customCount.value, 10);
    if (!Number.isFinite(n) || n < 1) n = 10;
    n = Math.min(n, 500);
    settings.count = n;
  } else {
    settings.count = parseInt(document.querySelector("#countChips .chip.active").dataset.count, 10);
  }

  settings.range = parseInt(document.querySelector("#rangeChips .chip.active").dataset.range, 10);
  settings.timer = parseInt(document.querySelector("#timerChips .chip.active").dataset.timer, 10);
  MAX = settings.range;
}

/* ----- Таймер ----- */
let timerId = null;
let timerDeadline = 0;
let lastTickSecond = -1;

function clearTimer() {
  if (timerId !== null) {
    clearInterval(timerId);
    timerId = null;
  }
}

function startTimer() {
  clearTimer();
  const wrap = el("timerWrap");
  const fill = el("timerFill");
  const text = el("timerText");

  if (settings.timer <= 0) {
    wrap.classList.add("hidden");
    return;
  }

  const total = settings.timer * 1000;
  timerDeadline = Date.now() + total;
  lastTickSecond = -1;
  wrap.classList.remove("hidden");
  fill.classList.remove("warn");
  text.classList.remove("warn");
  fill.style.width = "100%";
  text.textContent = "⏱ " + settings.timer;

  timerId = setInterval(() => {
    const remaining = Math.max(0, timerDeadline - Date.now());
    const ratio = remaining / total;
    fill.style.width = (ratio * 100) + "%";
    const secs = Math.ceil(remaining / 1000);
    text.textContent = "⏱ " + secs;

    const warn = ratio <= 0.33;
    fill.classList.toggle("warn", warn);
    text.classList.toggle("warn", warn);
    if (warn && secs !== lastTickSecond && secs > 0) {
      lastTickSecond = secs;
      soundTick();
    }

    if (remaining <= 0) {
      clearTimer();
      onTimeout();
    }
  }, 100);
}

function startGame() {
  readSettings();
  initAudio();
  state.index = 0;
  state.score = 0;
  state.streak = 0;
  state.correct = 0;
  show(gameScreen);
  nextRound();
}

function goToMenu() { clearTimer(); show(setupScreen); }

function show(screen) {
  [setupScreen, gameScreen, resultScreen].forEach((s) => s.classList.add("hidden"));
  screen.classList.remove("hidden");
}

function currentAnswerMode() {
  if (settings.answerType === "random") return Math.random() < 0.5 ? "input" : "choice";
  return settings.answerType;
}

function nextRound() {
  // кінець сесії?
  if (settings.count !== 0 && state.index >= settings.count) {
    return showResult();
  }

  state.answered = false;
  state.current = nextQuestion();
  state.index++;

  feedbackEl.textContent = "";
  feedbackEl.className = "feedback";
  questionEl.textContent = `${state.current.text} = ?`;

  updateStats();

  const mode = currentAnswerMode();
  if (mode === "input") {
    inputArea.classList.remove("hidden");
    choiceArea.classList.add("hidden");
    answerInput.value = "";
    answerInput.disabled = false;
    el("checkBtn").disabled = false;
    answerInput.focus();
  } else {
    inputArea.classList.add("hidden");
    choiceArea.classList.remove("hidden");
    renderChoices();
  }

  startTimer();
}

function renderChoices() {
  choiceArea.innerHTML = "";
  const options = buildChoices(state.current.answer);
  options.forEach((opt) => {
    const btn = document.createElement("button");
    btn.className = "choice-btn";
    btn.textContent = opt;
    btn.addEventListener("click", () => handleChoice(btn, opt, options));
    choiceArea.appendChild(btn);
  });
}

function handleChoice(btn, value, options) {
  if (state.answered) return;
  const correct = value === state.current.answer;
  if (correct) {
    btn.classList.add("correct");
    onCorrect();
  } else {
    btn.classList.add("wrong");
    // підсвітити правильну
    [...choiceArea.children].forEach((b) => {
      if (Number(b.textContent) === state.current.answer) b.classList.add("correct");
    });
    onWrong();
  }
  [...choiceArea.children].forEach((b) => (b.disabled = true));
  scheduleNext();
}

function checkInputAnswer() {
  if (state.answered) return;
  const raw = answerInput.value.trim();
  if (raw === "") {
    answerInput.classList.add("shake");
    setTimeout(() => answerInput.classList.remove("shake"), 400);
    return;
  }
  const value = Number(raw);
  if (value === state.current.answer) {
    onCorrect();
  } else {
    onWrong();
  }
  answerInput.disabled = true;
  el("checkBtn").disabled = true;
  scheduleNext();
}

function onCorrect() {
  clearTimer();
  soundCorrect();
  state.answered = true;
  state.correct++;
  state.streak++;
  const bonus = 10 + Math.min(state.streak, 10);
  state.score += bonus;
  const msgs = ["Правильно! 🎉", "Супер! 👏", "Молодець! ⭐", "Так тримати! 🔥", "Точно! ✅"];
  feedbackEl.textContent = pick(msgs) + (state.streak >= 3 ? ` (+${bonus})` : "");
  feedbackEl.className = "feedback good bounce";
  // голосове заохочення за кожні 3 правильні поспіль
  if (state.streak > 0 && state.streak % 3 === 0) praise();
  updateStats();
}

function onWrong() {
  clearTimer();
  soundWrong();
  state.answered = true;
  state.streak = 0;
  feedbackEl.textContent = `Правильна відповідь: ${state.current.answer}`;
  feedbackEl.className = "feedback bad shake";
  updateStats();
}

function onTimeout() {
  if (state.answered) return;
  soundTimeout();
  state.answered = true;
  state.streak = 0;
  // блокуємо поля введення / варіанти
  answerInput.disabled = true;
  el("checkBtn").disabled = true;
  [...choiceArea.children].forEach((b) => {
    b.disabled = true;
    if (Number(b.textContent) === state.current.answer) b.classList.add("correct");
  });
  feedbackEl.textContent = `⏱ Час вийшов! Відповідь: ${state.current.answer}`;
  feedbackEl.className = "feedback bad shake";
  updateStats();
  scheduleNext();
}

function scheduleNext() {
  const delay = state.streak === 0 ? 1600 : 900; // при помилці показуємо довше
  setTimeout(nextRound, delay);
}

function updateStats() {
  el("score").textContent = state.score;
  el("streak").textContent = state.streak;
  if (settings.count === 0) {
    el("progress").textContent = `№ ${state.index}`;
    el("progressFill").style.width = "100%";
  } else {
    el("progress").textContent = `${Math.min(state.index, settings.count)} / ${settings.count}`;
    el("progressFill").style.width = `${(Math.min(state.index, settings.count) / settings.count) * 100}%`;
  }
}

function showResult() {
  show(resultScreen);
  const total = state.index - 1 >= 0 ? state.index : 0;
  const answeredTotal = settings.count === 0 ? state.index - 1 : settings.count;
  const percent = answeredTotal > 0 ? Math.round((state.correct / answeredTotal) * 100) : 0;

  el("finalCorrect").textContent = state.correct;
  el("finalTotal").textContent = answeredTotal;
  el("finalPercent").textContent = percent + "%";

  let emoji = "🎉", text = "Молодець!";
  if (percent >= 90) { emoji = "🏆"; text = "Неймовірно! Ти чемпіон!"; }
  else if (percent >= 70) { emoji = "🎉"; text = "Чудова робота!"; }
  else if (percent >= 50) { emoji = "💪"; text = "Добре, продовжуй тренуватись!"; }
  else { emoji = "🌱"; text = "Тренуйся ще — усе вийде!"; }
  el("resultEmoji").textContent = emoji;
  el("resultText").textContent = text;

  // озвучуємо підсумок
  if (percent >= 90) speak("Вітаю! Ти справжній чемпіон!");
  else if (percent >= 70) speak("Молодчинка! Чудова робота!");
  else if (percent >= 50) speak("Добре! Тренуйся ще, і буде супер!");
  else speak("Не засмучуйся, спробуй ще раз. У тебе все вийде!");
}
