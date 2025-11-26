// ===== Общие функции =====

const STORAGE_KEY = "ai_interviews_storage";
const RECRUITER_KEY = "RECRUITER-2025"; // код доступа рекрутера к панели

function loadInterviews() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (e) {
    console.error("Error loading interviews", e);
    return [];
  }
}

function saveInterviews(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function generateId() {
  return "i_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function generateCandidateCode() {
  const num = Math.floor(100000 + Math.random() * 900000);
  return "CAND-" + num;
}

// формат даты
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

// ===== Главная (index.html) =====

function initLanding() {
  const recruiterInput = document.getElementById("recruiterKeyInput");
  const recruiterBtn = document.getElementById("recruiterLoginBtn");
  const recruiterError = document.getElementById("recruiterError");

  const candidateInput = document.getElementById("candidateCodeInput");
  const candidateBtn = document.getElementById("candidateLoginBtn");
  const candidateError = document.getElementById("candidateError");

  recruiterBtn.addEventListener("click", () => {
    const val = recruiterInput.value.trim();
    if (val === RECRUITER_KEY) {
      window.location.href = "recruiter.html";
    } else {
      recruiterError.textContent = "Неверный код доступа рекрутера.";
    }
  });

  candidateBtn.addEventListener("click", () => {
    const code = candidateInput.value.trim();
    if (!code) {
      candidateError.textContent = "Введите код кандидата.";
      return;
    }
    const interviews = loadInterviews();
    const found = interviews.find((i) => i.candidateCode === code);
    if (!found) {
      candidateError.textContent = "Интервью с таким кодом не найдено.";
      return;
    }
    const url = `candidate-report.html?id=${encodeURIComponent(found.id)}&code=${encodeURIComponent(code)}`;
    window.location.href = url;
  });
}

// ===== Рекрутер (recruiter.html) =====

function initRecruiter() {
  const form = document.getElementById("createInterviewForm");
  const tableBody = document.querySelector("#interviewTable tbody");
  const interviewCount = document.getElementById("interviewCount");
  const generatedBlock = document.getElementById("generatedBlock");
  const generatedLink = document.getElementById("generatedLink");
  const generatedCode = document.getElementById("generatedCode");
  const quotaLink = document.querySelector(".quota-link");
  const copyHint = document.getElementById("copyHint");

  function renderTable() {
    const interviews = loadInterviews();
    interviewCount.textContent = interviews.length.toString();
    tableBody.innerHTML = "";

    interviews.forEach((interview) => {
      const tr = document.createElement("tr");
      tr.dataset.id = interview.id;

      const tdName = document.createElement("td");
      tdName.textContent = interview.candidateName;

      const tdRole = document.createElement("td");
      tdRole.textContent = `${interview.role} (${interview.level})`;

      const tdStatus = document.createElement("td");
      tdStatus.textContent = interview.status || "Ожидает";

      const tdCode = document.createElement("td");
      tdCode.textContent = interview.candidateCode;

      tr.appendChild(tdName);
      tr.appendChild(tdRole);
      tr.appendChild(tdStatus);
      tr.appendChild(tdCode);

      tr.addEventListener("click", () => {
        const link = buildCandidateLink(interview);
        navigator.clipboard
          .writeText(link)
          .then(() => {
            copyHint.textContent = "Ссылка скопирована в буфер обмена.";
          })
          .catch(() => {
            copyHint.textContent = "Не удалось скопировать ссылку.";
          });
      });

      tableBody.appendChild(tr);
    });
  }

  function buildCandidateLink(interview) {
    const base = window.location.origin + window.location.pathname.replace("recruiter.html", "");
    const normalizedBase = base.endsWith("/") ? base : base + "/";
    const langParam = interview.language || "any";
    return (
      normalizedBase +
      "candidate.html?id=" +
      encodeURIComponent(interview.id) +
      "&code=" +
      encodeURIComponent(interview.candidateCode) +
      "&lang=" +
      encodeURIComponent(langParam)
    );
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const formData = new FormData(form);
    const candidateName = formData.get("candidateName").toString().trim();
    const role = formData.get("role").toString().trim();
    const level = formData.get("level").toString();
    const format = formData.get("format").toString();
    const notes = formData.get("notes").toString().trim();
    const language = (formData.get("language") || "any").toString();

    if (!candidateName || !role) return;

    const interviews = loadInterviews();
    const id = generateId();
    const candidateCode = generateCandidateCode();

    const interview = {
      id,
      candidateName,
      role,
      level,
      format,
      language, // язык, выбранный рекрутером (или any)
      notes,
      status: "Ожидает",
      candidateCode,
      createdAt: Date.now(),
      finishedAt: null,
      messages: [],
    };

    interviews.push(interview);
    saveInterviews(interviews);

    const link = buildCandidateLink(interview);
    generatedBlock.classList.remove("hidden");
    generatedLink.textContent = link;
    generatedCode.textContent = candidateCode;

    renderTable();
    form.reset();
  });

  quotaLink.addEventListener("click", () => {
    if (confirm("Точно очистить все интервью (localStorage)?")) {
      saveInterviews([]);
      renderTable();
    }
  });

  renderTable();
}

// ===== Кандидат (candidate.html) =====

function initCandidate() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const code = params.get("code");
  const langFromUrl = params.get("lang") || "any"; // язык от рекрутера или 'any'

  const subtitle = document.getElementById("candidateHeaderSubtitle");
  const timerEl = document.getElementById("interviewTimer");

  // экраны
  const setupScreen = document.getElementById("setupScreen");
  const interviewScreen = document.getElementById("interviewScreen");

  // камера
  const cameraPreview = document.getElementById("cameraPreview");
  const liveVideo = document.getElementById("liveVideo");

  // аватар
  const aiAvatarPreview = document.getElementById("aiAvatarPreview");
  let selectedAvatar = "🤖";

  // выбор языка
  const langSelect = document.getElementById("candidateLangSelect");
  const langHint = document.getElementById("langHint");
  const codeLangLabel = document.getElementById("codeLangLabel");
  let currentLang = langFromUrl === "any" ? "python" : langFromUrl;

  // код-редактор
  const codeInput = document.getElementById("codeInput");
  const codeHighlight = document.getElementById("codeHighlight");
  const codeRunBtn = document.getElementById("codeRunBtn");
  const codeOutput = document.getElementById("codeOutput");

  // чат
  const chatWindow = document.getElementById("chatWindow");
  const chatInput = document.getElementById("chatInput");
  const chatSendBtn = document.getElementById("chatSendBtn");

  // кнопка старта
  const startInterviewBtn = document.getElementById("startInterviewBtn");

  if (!id || !code) {
    if (subtitle) subtitle.textContent = "Ошибка: некорректная ссылка на интервью.";
    disableAll();
    return;
  }

  let interviews = loadInterviews();
  let interview = interviews.find((i) => i.id === id && i.candidateCode === code);

  if (!interview) {
    if (subtitle) subtitle.textContent = "Интервью не найдено. Проверь ссылку.";
    disableAll();
    return;
  }

  if (subtitle) {
    subtitle.textContent = `Интервью для ${interview.candidateName} • ${interview.role} (${interview.level})`;
  }

  // --- выбор языка (кто решает: рекрутер или кандидат) ---
  if (langSelect) {
    if (langFromUrl === "any") {
      langHint.textContent = "Выбери язык, на котором будешь писать код.";
      langSelect.disabled = false;
      langSelect.value = "python";
      currentLang = "python";
    } else {
      langSelect.disabled = true;
      if (["python", "javascript", "cpp", "java"].includes(langFromUrl)) {
        langSelect.value = langFromUrl;
        currentLang = langFromUrl;
      }
      langHint.textContent = "Язык выбран рекрутером и не может быть изменён.";
    }
  }

  function updateCodeLangHighlight() {
    if (!codeHighlight) return;
    codeHighlight.className = "code-highlight";
    if (currentLang === "python") codeHighlight.classList.add("language-python");
    else if (currentLang === "javascript") codeHighlight.classList.add("language-javascript");
    else codeHighlight.classList.add("language-plaintext");
    if (window.hljs) {
      hljs.highlightElement(codeHighlight);
    }
    if (codeLangLabel) {
      codeLangLabel.textContent = `Язык: ${currentLang.toUpperCase()}`;
    }
  }

  updateCodeLangHighlight();

  // ---------- таймер (20 минут) ----------
  let secondsLeft = 20 * 60;
  const timerId = setInterval(() => {
    secondsLeft--;
    if (secondsLeft < 0) {
      clearInterval(timerId);
      if (timerEl) timerEl.textContent = "00:00";
      return;
    }
    const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
    const ss = String(secondsLeft % 60).padStart(2, "0");
    if (timerEl) timerEl.textContent = `${mm}:${ss}`;
  }, 1000);

  function updateInterview(list, updated) {
    return list.map((it) => (it.id === updated.id ? updated : it));
  }

  // ---------- чат (только текст, без кода) ----------
  function renderMessages() {
    if (!chatWindow) return;
    chatWindow.innerHTML = "";
    if (!interview.messages || interview.messages.length === 0) {
      addSystemMessage("Привет! Я AI-собеседник. Расскажи немного о себе и опыте.");
      return;
    }
    interview.messages.forEach((msg) => {
      const div = document.createElement("div");
      div.classList.add("chat-message");
      if (msg.from === "candidate") div.classList.add("me");
      const inner = document.createElement("div");
      inner.textContent = msg.text;
      const meta = document.createElement("span");
      meta.classList.add("chat-meta");
      meta.textContent = `${msg.from === "ai" ? "AI" : "Ты"} • ${msg.time}`;
      div.appendChild(inner);
      div.appendChild(meta);
      chatWindow.appendChild(div);
    });
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  function addSystemMessage(text) {
    const now = new Date().toLocaleTimeString();
    if (!interview.messages) interview.messages = [];
    interview.messages.push({
      from: "ai",
      text,
      time: now,
    });
    interviews = updateInterview(interviews, interview);
    saveInterviews(interviews);
    renderMessages();
  }

  renderMessages();

  if (chatSendBtn && chatInput) {
    chatSendBtn.addEventListener("click", () => {
      const text = chatInput.value.trim();
      if (!text) return;
      const now = new Date().toLocaleTimeString();
      if (!interview.messages) interview.messages = [];
      interview.messages.push({
        from: "candidate",
        text,
        time: now,
        isCode: false,
      });
      interview.messages.push({
        from: "ai",
        text: "Спасибо за ответ! В реальной системе здесь бы был ответ модели.",
        time: now,
      });

      interviews = updateInterview(interviews, interview);
      saveInterviews(interviews);
      chatInput.value = "";
      renderMessages();
    });

    chatInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        chatSendBtn.click();
      }
    });
  }

  // ---------- синхронизация textarea -> подсвеченный блок ----------
  if (codeInput && codeHighlight) {
    const syncHighlight = () => {
      codeHighlight.textContent = codeInput.value;
      if (window.hljs) hljs.highlightElement(codeHighlight);
    };
    codeInput.addEventListener("input", syncHighlight);
    syncHighlight();
  }

  // ---------- “Запустить код”: только запуск + вывод результата, без чата ----------
  if (codeRunBtn && codeInput && codeOutput) {
    codeRunBtn.addEventListener("click", async () => {
      const codeText = codeInput.value.trim();
      if (!codeText) return;

      try {
        if (currentLang === "javascript") {
          // простое выполнение JS
          const result = eval(codeText);
          codeOutput.textContent =
            result !== undefined ? String(result) : "Код JavaScript выполнен.";
        } else if (currentLang === "python") {
          // выполняем Python и ловим print()
          codeOutput.textContent = "Выполняем Python-код...";
          const pyodide = await pyodideReadyPromise;

          let captured = "";
          // перехватываем stdout Pyodide
          pyodide.setStdout({
            batched: (s) => {
              captured += s;
            },
          });

          let result;
          try {
            result = await pyodide.runPythonAsync(codeText);
          } finally {
            // возвращаем stdout по умолчанию
            pyodide.setStdout();
          }

          if (captured.trim()) {
            // если что-то напечатали через print()
            codeOutput.textContent = captured;
          } else if (result !== undefined) {
            // если есть возвращаемое значение
            codeOutput.textContent = String(result);
          } else {
            codeOutput.textContent = "Код Python выполнен.";
          }
        } else {
          codeOutput.textContent =
            "Реальный запуск сейчас поддерживается только для Python и JavaScript.";
        }
      } catch (err) {
        codeOutput.textContent = "Ошибка при выполнении кода: " + err;
      }
    });
  }


  // ---------- выбор аватара ----------
  document.querySelectorAll(".avatar-option").forEach((opt) => {
    opt.addEventListener("click", () => {
      document.querySelectorAll(".avatar-option").forEach((o) => o.classList.remove("active"));
      opt.classList.add("active");
      selectedAvatar = opt.dataset.avatar;
      if (aiAvatarPreview) {
        aiAvatarPreview.textContent = selectedAvatar;
      }
    });
  });

  // ---------- включаем камеру ----------
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices
      .getUserMedia({ video: true, audio: false })
      .then((stream) => {
        if (cameraPreview) cameraPreview.srcObject = stream;
        if (liveVideo) liveVideo.srcObject = stream;
      })
      .catch((err) => {
        console.warn("Camera access denied", err);
      });
  }

  // ---------- кнопка “Начать интервью” ----------
  if (startInterviewBtn && setupScreen && interviewScreen) {
    startInterviewBtn.addEventListener("click", () => {
      if (langFromUrl === "any" && langSelect) {
        currentLang = langSelect.value;
        interview.language = currentLang;
        interviews = updateInterview(interviews, interview);
        saveInterviews(interviews);
      }
      updateCodeLangHighlight();
      setupScreen.classList.add("hidden");
      interviewScreen.classList.remove("hidden");
      if (aiAvatarPreview) aiAvatarPreview.textContent = selectedAvatar;
    });
  }

  function disableAll() {
    if (chatInput) chatInput.disabled = true;
    if (chatSendBtn) chatSendBtn.disabled = true;
    if (codeInput) codeInput.disabled = true;
    if (codeRunBtn) codeRunBtn.disabled = true;
    if (startInterviewBtn) startInterviewBtn.disabled = true;
    if (langSelect) langSelect.disabled = true;
  }
}

// ===== Отчёт кандидата (candidate-report.html) =====

function initCandidateReport() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  const code = params.get("code");
  const reportContent = document.getElementById("reportContent");
  const reportError = document.getElementById("reportError");

  if (!id || !code) {
    reportError.textContent = "Некорректная ссылка на отчёт.";
    return;
  }

  const interviews = loadInterviews();
  const interview = interviews.find((i) => i.id === id && i.candidateCode === code);
  if (!interview) {
    reportError.textContent = "Интервью не найдено. Возможно, данные были очищены.";
    return;
  }

  const messagesCount = interview.messages ? interview.messages.filter((m) => m.from === "candidate").length : 0;

  reportContent.innerHTML = `
    <div>
      <div class="report-field-label">Кандидат</div>
      <div class="report-field-value">${interview.candidateName}</div>
    </div>
    <div>
      <div class="report-field-label">Роль и уровень</div>
      <div class="report-field-value">${interview.role} (${interview.level})</div>
    </div>
    <div>
      <div class="report-field-label">Статус интервью</div>
      <div class="report-field-value">${interview.status || "Ожидает"}</div>
    </div>
    <div>
      <div class="report-field-label">Создано</div>
      <div class="report-field-value">${formatDate(interview.createdAt)}</div>
    </div>
    ${
      interview.finishedAt
        ? `<div>
             <div class="report-field-label">Завершено</div>
             <div class="report-field-value">${formatDate(interview.finishedAt)}</div>
           </div>`
        : ""
    }
    <div>
      <div class="report-field-label">Количество твоих ответов</div>
      <div class="report-field-value">${messagesCount}</div>
    </div>
    <div>
      <div class="report-field-label">Комментарий рекрутера</div>
      <div class="report-field-value">${interview.notes || "Комментарий не указан."}</div>
    </div>
    ${
      interview.language
        ? `<div>
             <div class="report-field-label">Язык для кода</div>
             <div class="report-field-value">${interview.language.toUpperCase()}</div>
           </div>`
        : ""
    }
  `;
}
