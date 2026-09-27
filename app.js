const FOCUS_SECONDS = 25 * 60;
const STORAGE_GOALS = "julie-focus-goals";
const STORAGE_NOTES = "julie-focus-notes";
const PROGRESS_FIELDS = [
  { id: "progress-create", key: "create", name: "创造" },
  { id: "progress-grow", key: "grow", name: "成长" },
  { id: "progress-life", key: "life", name: "生活" },
];

const progressInputs = Object.fromEntries(
  PROGRESS_FIELDS.map((field) => [field.key, document.getElementById(field.id)])
);
const saveProgressBtn = document.getElementById("save-progress");
const progressStatus = document.getElementById("progress-status");
const progressHistory = document.getElementById("progress-history");
const timeDisplay = document.getElementById("time-display");
const timerStatus = document.getElementById("timer-status");
const startBtn = document.getElementById("start-btn");
const resetBtn = document.getElementById("reset-btn");
const ringProgress = document.getElementById("ring-progress");
const noteForm = document.getElementById("note-form");
const noteText = document.getElementById("note-text");
const noteList = document.getElementById("note-list");

const ringLength = 2 * Math.PI * 52;
let remaining = FOCUS_SECONDS;
let ticking = false;
let timerId = null;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate() {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(new Date());
}

function formatTime(total) {
  const minutes = String(Math.floor(total / 60)).padStart(2, "0");
  const seconds = String(total % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function emptyProgress() {
  return { create: "", grow: "", life: "" };
}

function normalizeProgress(value) {
  if (!value) return emptyProgress();
  if (Array.isArray(value)) {
    return {
      create: value[0] || "",
      grow: value[1] || "",
      life: value[2] || "",
    };
  }
  return {
    create: value.create || "",
    grow: value.grow || "",
    life: value.life || "",
    savedAt: value.savedAt || "",
  };
}

function readAllProgress() {
  return JSON.parse(localStorage.getItem(STORAGE_GOALS) || "{}");
}

function currentProgressFromInputs() {
  return {
    create: progressInputs.create.value.trim(),
    grow: progressInputs.grow.value.trim(),
    life: progressInputs.life.value.trim(),
  };
}

function hasAnyProgress(record) {
  return Boolean(record.create || record.grow || record.life);
}

function formatSavedAt(savedAt) {
  if (!savedAt) return "";
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(savedAt));
}

function formatHistoryDate(dateKey) {
  const date = new Date(`${dateKey}T00:00:00`);
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

function renderHistory() {
  const saved = readAllProgress();
  const today = todayKey();
  const days = Object.keys(saved)
    .filter((key) => key !== today && hasAnyProgress(normalizeProgress(saved[key])))
    .sort()
    .reverse()
    .slice(0, 5);

  progressHistory.innerHTML = "";
  if (days.length === 0) {
    progressHistory.hidden = true;
    return;
  }

  const title = document.createElement("h3");
  title.textContent = "最近几天的记录";
  progressHistory.appendChild(title);

  days.forEach((key) => {
    const record = normalizeProgress(saved[key]);
    const article = document.createElement("article");
    const heading = document.createElement("strong");
    heading.textContent = formatHistoryDate(key);
    article.appendChild(heading);

    PROGRESS_FIELDS.forEach((field) => {
      if (!record[field.key]) return;
      const line = document.createElement("p");
      line.textContent = `${field.name}：${record[field.key]}`;
      article.appendChild(line);
    });

    progressHistory.appendChild(article);
  });

  progressHistory.hidden = false;
}

function loadProgress() {
  const todayRecord = normalizeProgress(readAllProgress()[todayKey()]);
  PROGRESS_FIELDS.forEach((field) => {
    progressInputs[field.key].value = todayRecord[field.key];
  });

  if (todayRecord.savedAt && hasAnyProgress(todayRecord)) {
    progressStatus.textContent = `今天的记录已保存 · ${formatSavedAt(todayRecord.savedAt)}`;
  } else {
    progressStatus.textContent = "写下今天的推进点后点保存，第二天会是空白新的一天。";
  }

  renderHistory();
}

function saveProgress() {
  const saved = readAllProgress();
  const record = {
    ...currentProgressFromInputs(),
    savedAt: new Date().toISOString(),
  };
  saved[todayKey()] = record;
  localStorage.setItem(STORAGE_GOALS, JSON.stringify(saved));

  if (hasAnyProgress(record)) {
    progressStatus.textContent = `今天的记录已保存 · ${formatSavedAt(record.savedAt)}`;
  } else {
    progressStatus.textContent = "还没有填写内容。写下一件事后再保存。";
  }

  renderHistory();
}

function updateTimerView() {
  timeDisplay.textContent = formatTime(remaining);
  ringProgress.style.strokeDasharray = String(ringLength);
  ringProgress.style.strokeDashoffset = String(
    ringLength * (1 - remaining / FOCUS_SECONDS)
  );
}

function finishTimer() {
  ticking = false;
  clearInterval(timerId);
  remaining = 0;
  updateTimerView();
  timerStatus.textContent = "本轮完成，休息一下";
  startBtn.textContent = "再来一轮";
  if (navigator.vibrate) navigator.vibrate([200, 80, 200]);
}

function tick() {
  remaining -= 1;
  updateTimerView();
  if (remaining <= 0) finishTimer();
}

function toggleTimer() {
  if (remaining <= 0) {
    remaining = FOCUS_SECONDS;
    updateTimerView();
  }

  ticking = !ticking;
  startBtn.textContent = ticking ? "暂停" : "继续";
  timerStatus.textContent = ticking ? "正在专注" : "已暂停";

  if (ticking) {
    timerId = setInterval(tick, 1000);
  } else {
    clearInterval(timerId);
  }
}

function resetTimer() {
  ticking = false;
  clearInterval(timerId);
  remaining = FOCUS_SECONDS;
  startBtn.textContent = "开始专注";
  timerStatus.textContent = "准备开始";
  updateTimerView();
}

function loadNotes() {
  const notes = JSON.parse(localStorage.getItem(STORAGE_NOTES) || "[]");
  noteList.innerHTML = "";

  if (notes.length === 0) {
    noteList.innerHTML = '<li class="note-meta">还没有灵感，先记下第一条吧。</li>';
    return;
  }

  notes.forEach((note) => {
    const item = document.createElement("li");
    const meta = document.createElement("div");
    const label = document.createElement("span");
    const remove = document.createElement("button");
    const body = document.createElement("p");

    meta.className = "note-meta";
    label.textContent = `${note.type} · ${note.time}`;
    remove.type = "button";
    remove.dataset.id = note.id;
    remove.textContent = "删除";
    body.textContent = note.text;

    meta.append(label, remove);
    item.append(meta, body);
    noteList.appendChild(item);
  });
}

function addNote(event) {
  event.preventDefault();
  const type = document.querySelector('input[name="note-type"]:checked').value;
  const text = noteText.value.trim();
  if (!text) return;

  const notes = JSON.parse(localStorage.getItem(STORAGE_NOTES) || "[]");
  notes.unshift({
    id: Date.now().toString(),
    type,
    text,
    time: new Intl.DateTimeFormat("zh-CN", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date()),
  });
  localStorage.setItem(STORAGE_NOTES, JSON.stringify(notes));
  noteText.value = "";
  loadNotes();
}

function deleteNote(event) {
  const button = event.target.closest("button[data-id]");
  if (!button) return;
  const notes = JSON.parse(localStorage.getItem(STORAGE_NOTES) || "[]").filter(
    (note) => note.id !== button.dataset.id
  );
  localStorage.setItem(STORAGE_NOTES, JSON.stringify(notes));
  loadNotes();
}

document.getElementById("today-label").textContent = formatDate();
saveProgressBtn.addEventListener("click", saveProgress);
startBtn.addEventListener("click", toggleTimer);
resetBtn.addEventListener("click", resetTimer);
noteForm.addEventListener("submit", addNote);
noteList.addEventListener("click", deleteNote);

loadProgress();
loadNotes();
updateTimerView();
