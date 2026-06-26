const transcriptInput = document.querySelector("#transcript");
const wordCount = document.querySelector("#word-count");
const analyzeButton = document.querySelector("#analyze-button");
const sampleButton = document.querySelector("#sample-button");
const clearButton = document.querySelector("#clear-button");
const copyButton = document.querySelector("#copy-button");
const emptyState = document.querySelector("#empty-state");
const analysisOutput = document.querySelector("#analysis-output");

let lastAnalysisText = "";

const sampleTranscript = `Клиент: Я снова заметил, что откладываю важные разговоры. Как будто если я промолчу, напряжение само исчезнет.
Психолог: Похоже, молчание помогает временно снизить тревогу, но потом делает ситуацию тяжелее.
Клиент: Да. Я злюсь, но сразу думаю, что злиться нельзя. Потом чувствую вину.
Психолог: Сейчас звучат злость, вина и страх потерять контакт. Что из этого сильнее прямо сейчас?
Клиент: Наверное, страх. Я боюсь, что если скажу прямо, меня отвергнут.
Психолог: Это важная точка. Можно посмотреть, как этот страх появляется между нами в сессии?`;

function countWords(text) {
  const matches = text.trim().match(/[A-Za-zА-Яа-яЁё0-9-]+/g);
  return matches ? matches.length : 0;
}

function renderAnalysis(blocks) {
  analysisOutput.innerHTML = blocks
    .map(
      (block) => `
        <article class="analysis-block" style="--accent: ${block.accent}">
          <h3>${block.title}</h3>
          ${renderBlockContent(block)}
        </article>
      `
    )
    .join("");

  lastAnalysisText = blocks
    .map((block) => `${block.title}\n${blockToText(block)}`)
    .join("\n\n");

  emptyState.hidden = true;
  analysisOutput.hidden = false;
  copyButton.disabled = false;
}

function renderBlockContent(block) {
  if (Array.isArray(block.items) && block.items.length) {
    return `<ul>${block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`;
  }

  return `<p>${escapeHtml(block.body || "")}</p>`;
}

function blockToText(block) {
  if (Array.isArray(block.items) && block.items.length) {
    return block.items.map((item) => `- ${item}`).join("\n");
  }

  return block.body || "";
}

function renderStatus(message, tone = "neutral") {
  analysisOutput.innerHTML = `
    <article class="analysis-block ${tone}" style="--accent: ${tone === "error" ? "#9f4f45" : "#1f5d7a"}">
      <h3>${tone === "error" ? "Не удалось выполнить анализ" : "ИИ-агент работает"}</h3>
      <p>${escapeHtml(message)}</p>
    </article>
  `;
  emptyState.hidden = true;
  analysisOutput.hidden = false;
  copyButton.disabled = true;
}

function setAnalyzing(isAnalyzing) {
  analyzeButton.disabled = isAnalyzing;
  analyzeButton.classList.toggle("is-loading", isAnalyzing);
  analyzeButton.querySelector("span")?.remove();

  if (isAnalyzing) {
    analyzeButton.insertAdjacentHTML("beforeend", "<span>Анализирую...</span>");
  } else {
    analyzeButton.insertAdjacentHTML("beforeend", "<span>Проанализировать</span>");
  }
}

async function requestAiAnalysis(transcript) {
  const response = await fetch("/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transcript }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Сервер анализа вернул ошибку.");
  }

  if (!Array.isArray(payload.blocks)) {
    throw new Error("ИИ-агент вернул неожиданный формат ответа.");
  }

  return payload.blocks;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function updateWordCount() {
  wordCount.textContent = countWords(transcriptInput.value);
}

transcriptInput.addEventListener("input", updateWordCount);

sampleButton.addEventListener("click", () => {
  transcriptInput.value = sampleTranscript;
  updateWordCount();
  transcriptInput.focus();
});

clearButton.addEventListener("click", () => {
  transcriptInput.value = "";
  analysisOutput.innerHTML = "";
  lastAnalysisText = "";
  copyButton.disabled = true;
  analysisOutput.hidden = true;
  emptyState.hidden = false;
  updateWordCount();
  transcriptInput.focus();
});

analyzeButton.addEventListener("click", async () => {
  const text = transcriptInput.value.trim();
  if (!text) {
    transcriptInput.focus();
    transcriptInput.setAttribute("placeholder", "Сначала вставьте текст для анализа...");
    return;
  }

  setAnalyzing(true);
  renderStatus("Сейчас подготовлю структурированный обзор без диагнозов и клинических решений.");

  try {
    const blocks = await requestAiAnalysis(text);
    renderAnalysis(blocks);
  } catch (error) {
    renderStatus(error.message, "error");
  } finally {
    setAnalyzing(false);
  }
});

copyButton.addEventListener("click", async () => {
  if (!lastAnalysisText) return;

  await navigator.clipboard.writeText(lastAnalysisText);
  copyButton.title = "Скопировано";
  setTimeout(() => {
    copyButton.title = "Скопировать анализ";
  }, 1400);
});

updateWordCount();
