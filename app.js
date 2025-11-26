// ===== API =====
const API = "http://localhost:3000/api";

// получить все интервью
async function loadInterviews() {
  const r = await fetch(`${API}/interviews`);
  return await r.json();
}

// получить одно интервью кандидата
async function loadInterview(id, code) {
  const r = await fetch(`${API}/interview?id=${encodeURIComponent(id)}&code=${encodeURIComponent(code)}`);
  return await r.json();
}

// сохранить интервью
async function saveInterview(interview) {
  await fetch(`${API}/interviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(interview),
  });
}

// сохранить сообщение
async function saveMessage(interviewId, sender, text) {
  await fetch(`${API}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ interviewId, sender, text }),
  });
}

// загрузить сообщения
async function loadMessages(interviewId) {
  const r = await fetch(`${API}/messages?interviewId=${encodeURIComponent(interviewId)}`);
  return await r.json();
}

// ===== Константы и утилиты =====
const RECRUITER_KEY = "RECRUITER-2025";

function generateId() {
  return "i_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function generateCandidateCode() {
  const num = Math.floor(100000 + Math.random() * 900000);
  return "CAND-" + num;
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleString();
}

// ===== Инициализация страниц =====
document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  if (page === "landing") initLanding();
  if (page === "recruiter") initRecruiter();
  if (page === "candidate") initCandidate();
  if (page === "candidateReport") initCandidateReport();
});

// ===== Главная =====
function initLanding() {
  const recruiterInput = document.getElementById("recruiterKeyInput");
  const recruiterBtn = document.getElementById("recruiterLoginBtn");
  const recruiterError = document.getElementById("recruiterError");

  const candidateInput = document.getElementById("candidateCodeInput");
  const candidateBtn = document.getElementById("candidateLoginBtn");
  const candidateError = document.getElementById("candidateError");

  recruiterBtn.addEventListener("click", () => {
    const val = recruiterInput.value.trim();
    if (val === RECRUITER_KEY) window.location.href = "recruiter.html";
    else recruiterError.textContent = "Неверный код доступа рекрутера.";
  });

  candidateBtn.addEventListener("click", async () => {
    const code = candidateInput.value.trim();
    if (!code) {
      candidateError.textContent = "Введите код кандидата.";
      return;
    }
    const interviews = await loadInterviews();
    const found = interviews.find((i) => i.candidate_code === code || i.candidateCode === code);
    if (!found) {
      candidateError.textContent = "Интервью с таким кодом не найдено.";
      return;
    }
    const id = found.id;
    const url = `candidate-report.html?id=${encodeURIComponent(id)}&code=${encodeURIComponent(code)}`;
    window.location.href = url;
  });
}

// ===== Рекрутер =====
async function initRecruiter() {
  const form = document.getElementById("createInterviewForm");
  const tableBody = document.querySelector("#interviewTable tbody");
  const interviewCount = document.getElementById("interviewCount");
  const generatedBlock = document.getElementById("generatedBlock");
  const generatedLink = document.getElementById("generatedLink");
  const generatedCode = document.getElementById("generatedCode");
  const copyHint = document.getElementById("copyHint");

  async function renderTable() {
    const interviews = await loadInterviews();
    interviewCount.textContent = interviews.length.toString();
    tableBody.innerHTML = "";

    interviews.forEach((interview) => {
      const tr = document.createElement("tr");

      const tdName = document.createElement("td");
      tdName.textContent = interview.candidate_name || interview.candidateName;

      const tdRole = document.createElement("td");
      tdRole.textContent = `${interview.role} (${interview.level})`;

      const tdStatus = document.createElement("td");
      tdStatus.textContent = interview.status || "Ожидает";

      const tdCode = document.createElement("td");
      tdCode.textContent = interview.candidate_code || interview.candidateCode;

      tr.append(tdName, tdRole, tdStatus, tdCode);

      tr.addEventListener("click", () => {
        const link = buildCandidateLink(interview);
        navigator.clipboard.writeText(link).then(
          () => (copyHint.textContent = "Ссылка скопирована."),
          () => (copyHint.textContent = "Не удалось скопировать.")
        );
      });

      tableBody.appendChild(tr);
    });
  }

  function buildCandidateLink(interview) {
    const base = window.location.origin + window.location.pathname.replace("recruiter.html", "");
    const normalizedBase = base.endsWith("/") ? base : base + "/";
    const langParam = interview.language || "any";
    const code = interview.candidate_code || interview.candidateCode;
    return (
      normalizedBase +
      "candidate.html?id=" +
      encodeURIComponent(interview.id) +
      "&code=" +
      encodeURIComponent(code) +
      "&lang=" +
      encodeURIComponent(langParam)
    );
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const formData = new FormData(form);

    const interview = {
      id: generateId(),
      candidateName: formData.get("candidateName").toString().trim(),
      role: formData.get("role").toString().trim(),
      level: formData.get("level").toString(),
      format: formData.get("format").toString(),
      notes: formData.get("notes").toString().trim(),
      language: (formData.get("language") || "any").toString(),
      status: "Ожидает",
      candidateCode: generateCandidateCode(),
      createdAt: Date.now(),
      finishedAt: null
    };

    if (!interview.candidateName || !interview.role) return;

    await saveInterview(interview);

    const link = buildCandidateLink(interview);
    generatedBlock.classList.remove("hidden");
    generatedLink.textContent = link;
    generatedCode.textContent = interview.candidateCode;

    await renderTable();
    form.reset();
  });

  await renderTable();
}

// ===== Кандидат =====
async function initCandidate() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const code = params.get("code");
  const langFromUrl = params.get("lang") || "any";

  const subtitle = document.getElementById("candidateHeaderSubtitle");
  const timerEl = document.getElementById("interviewTimer");

  const setupScreen = document.getElementById("setupScreen");
  const interviewScreen = document.getElementById("interviewScreen");

  const cameraPreview = document.getElementById("cameraPreview");
  const liveVideo = document.getElementById("liveVideo");

  const aiAvatarPreview = document.getElementById("aiAvatarPreview");
  let selectedAvatar = "🤖";

  const langSelect = document.getElementById("candidateLangSelect");
  const langHint = document.getElementById("langHint");
  const codeLangLabel = document.getElementById("codeLangLabel");
  let currentLang = langFromUrl === "any" ? "python" : langFromUrl;

  const codeInput = document.getElementById("codeInput");
  const codeHighlight = document.getElementById("codeHighlight");
  const codeRunBtn = document.getElementById("codeRunBtn");
  const codeOutput = document.getElementById("codeOutput");

  const chatWindow = document.getElementById("chatWindow");
  const chatInput = document.getElementById("chatInput");
  const chatSendBtn = document.getElementById("chatSendBtn");

  const startInterviewBtn = document.getElementById("startInterviewBtn");

  if (!id || !code) {
    subtitle.textContent = "Ошибка: некорректная ссылка.";
    return;
  }

  const interview = await loadInterview(id, code);
  if (!interview) {
    subtitle.textContent = "Интервью не найдено.";
    return;
  }

  subtitle.textContent = `Интервью для ${interview.candidate_name || interview.candidateName} • ${interview.role} (${interview.level})`;

  if (langFromUrl === "any") {
    langHint.textContent = "Выбери язык.";
    langSelect.disabled = false;
    langSelect.value = "python";
    currentLang = "python";
  } else {
    langSelect.disabled = true;
    langSelect.value = langFromUrl;
    currentLang = langFromUrl;
    langHint.textContent = "Язык выбран рекрутером.";
  }

  function updateCodeLangHighlight() {
    codeHighlight.className = "code-highlight";
    if (currentLang === "python") codeHighlight.classList.add("language-python");
    else if (currentLang === "javascript") codeHighlight.classList.add("language-javascript");
    else codeHighlight.classList.add("language-plaintext");
    if (window.hljs) hljs.highlightElement(codeHighlight);
    codeLangLabel.textContent = `Язык: ${currentLang.toUpperCase()}`;
  }
  updateCodeLangHighlight();

  // таймер
  let secondsLeft = 20 * 60;
  setInterval(() => {
    const mm = String(Math.max(0, Math.floor(secondsLeft / 60))).padStart(2, "0");
    const ss = String(Math.max(0, secondsLeft % 60)).padStart(2, "0");
    timerEl.textContent = `${mm}:${ss}`;
    secondsLeft--;
  }, 1000);

  // чат
  async function renderMessages() {
    const messages = await loadMessages(interview.id);
    chatWindow.innerHTML = "";
    if (!messages.length) {
      await saveMessage(interview.id, "ai", "Привет! Расскажи о себе и опыте.");
    }
    const fresh = await loadMessages(interview.id);
    fresh.forEach((msg) => {
      const div = document.createElement("div");
      div.classList.add("chat-message");
      if (msg.sender === "candidate") div.classList.add("me");
      const inner = document.createElement("div");
      inner.textContent = msg.text;
      const meta = document.createElement("span");
      meta.classList.add("chat-meta");
      meta.textContent = `${msg.sender === "ai" ? "AI" : "Ты"} • ${new Date(msg.created_at).toLocaleTimeString()}`;
      div.append(inner, meta);
      chatWindow.appendChild(div);
    });
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  await renderMessages();

  chatSendBtn.addEventListener("click", async () => {
    const text = chatInput.value.trim();
    if (!text) return;
    await saveMessage(interview.id, "candidate", text);
    await saveMessage(interview.id, "ai", "Спасибо за ответ!");
    chatInput.value = "";
    await renderMessages();
  });

  // подсветка
  const syncHighlight = () => {
    codeHighlight.textContent = codeInput.value;
    if (window.hljs) hljs.highlightElement(codeHighlight);
  };
  codeInput.addEventListener("input", syncHighlight);
  syncHighlight();

  // запуск кода
  codeRunBtn.addEventListener("click", async () => {
    const codeText = codeInput.value.trim();
    if (!codeText) return;
    try {
      if (currentLang === "javascript") {
        const result = eval(codeText);
        codeOutput.textContent = result !== undefined ? String(result) : "JS выполнен.";
      } else if (currentLang === "python") {
        const pyodide = await pyodideReadyPromise;
        let captured = "";
        pyodide.setStdout({ batched: (s) => (captured += s) });
        let result;
        try { result = await pyodide.runPythonAsync(codeText); }
        finally { pyodide.setStdout(); }
        codeOutput.textContent = captured.trim() || (result !== undefined ? String(result) : "Python выполнен.");
      } else {
        codeOutput.textContent = "Поддержка только для Python и JS.";
      }
    } catch (err) {
      codeOutput.textContent = "Ошибка: " + err;
    }
  });

  // аватары
  document.querySelectorAll(".avatar-option").forEach((opt) => {
    opt.addEventListener("click", () => {
      document.querySelectorAll(".avatar-option").forEach((o) => o.classList.remove("active"));
      opt.classList.add("active");
      selectedAvatar = opt.dataset.avatar;
      aiAvatarPreview.textContent = selectedAvatar;
    });
  });

  // камера
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then((stream) => {
      cameraPreview.srcObject = stream;
      liveVideo.srcObject = stream;
    }).catch(() => {});
  }

  startInterviewBtn.addEventListener("click", async () => {
    if (langFromUrl === "any") {
      currentLang = langSelect.value;
      interview.language = currentLang;
    }
    updateCodeLangHighlight();
    setupScreen.classList.add("hidden");
    interviewScreen.classList.remove("hidden");
    aiAvatarPreview.textContent = selectedAvatar;
  });
}

// ===== Отчёт =====
async function initCandidateReport() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const code = params.get("code");
  const reportContent = document.getElementById("reportContent");
  const reportError = document.getElementById("reportError");

  if (!id || !code) {
    reportError.textContent = "Некорректная ссылка.";
    return;
  }

  const interview = await loadInterview(id, code);
  if (!interview) {
    reportError.textContent = "Интервью не найдено.";
    return;
  }

  const messages = await loadMessages(interview.id);
  const messagesCount = messages.filter((m) => m.sender === "candidate").length;

  reportContent.innerHTML = `
    <div><div class="report-field-label">Кандидат</div><div class="report-field-value">${interview.candidate_name || interview.candidateName}</div></div>
    <div><div class="report-field-label">Роль</div><div class="report-field-value">${interview.role} (${interview.level})</div></div>
    <div><div class="report-field-label">Статус</div><div class="report-field-value">${interview.status || "Ожидает"}</div></div>
    <div><div class="report-field-label">Создано</div><div class="report-field-value">${formatDate(interview.created_at || interview.createdAt)}</div></div>
    <div><div class="report-field-label">Ответов</div><div class="report-field-value">${messagesCount}</div></div>
    <div><div class="report-field-label">Комментарий</div><div class="report-field-value">${interview.notes || "—"}</div></div>
    ${interview.language ? `<div><div class="report-field-label">Язык</div><div class="report-field-value">${interview.language.toUpperCase()}</div></div>` : ""}
  `;
}