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

const dictionaries = {
  emotions: {
    "тревога": ["тревог", "страх", "боюсь", "паник", "напряж"],
    "злость": ["злю", "злость", "раздраж", "ярост"],
    "вина": ["вина", "винов", "стыд"],
    "печаль": ["груст", "печаль", "плак", "одинок"],
    "усталость": ["устал", "выгор", "нет сил"],
  },
  themes: {
    "границы": ["границ", "отказать", "нельзя", "должен", "должна"],
    "отношения": ["отнош", "контакт", "близ", "отверг", "партнер"],
    "самооценка": ["не справ", "плох", "недостат", "ценност"],
    "избегание": ["отклады", "молчу", "избег", "не говор"],
    "контроль": ["контрол", "провер", "идеально"],
  },
  interventions: {
    "уточняющие вопросы": ["что", "как", "когда", "почему"],
    "отражение чувств": ["похоже", "звучит", "слышно", "чувств"],
    "фокус на процессе": ["между нами", "сейчас", "в сессии", "в контакте"],
    "гипотеза": ["может быть", "возможно", "как будто"],
  },
};

function countWords(text) {
  const matches = text.trim().match(/[A-Za-zА-Яа-яЁё0-9-]+/g);
  return matches ? matches.length : 0;
}

function findMatches(text, group) {
  const normalized = text.toLowerCase();
  return Object.entries(group)
    .filter(([, needles]) => needles.some((needle) => normalized.includes(needle)))
    .map(([label]) => label);
}

function getSpeakerStats(text) {
  const clientLines = (text.match(/(^|\n)\s*(клиент|пациент|супервизант)\s*:/gi) || []).length;
  const specialistLines = (text.match(/(^|\n)\s*(психолог|терапевт|супервизор|специалист)\s*:/gi) || []).length;
  return { clientLines, specialistLines };
}

function buildList(items, fallback) {
  const values = items.length ? items : fallback;
  return `<ul>${values.map((item) => `<li>${item}</li>`).join("")}</ul>`;
}

function analyzeTranscript(text) {
  const words = countWords(text);
  const sentences = text.split(/[.!?]+/).map((item) => item.trim()).filter(Boolean);
  const emotions = findMatches(text, dictionaries.emotions);
  const themes = findMatches(text, dictionaries.themes);
  const interventions = findMatches(text, dictionaries.interventions);
  const { clientLines, specialistLines } = getSpeakerStats(text);
  const hasDialogue = clientLines > 0 && specialistLines > 0;

  return [
    {
      title: "Краткое резюме",
      accent: "#1f5d7a",
      body: `Материал содержит примерно ${words} слов и ${sentences.length} смысловых фрагментов. ${hasDialogue ? "В тексте виден диалог клиента и специалиста." : "Текст можно дополнительно разметить по ролям, чтобы анализ стал точнее."}`,
    },
    {
      title: "Ключевые темы",
      accent: "#3d7258",
      body: buildList(
        themes.map((theme) => `В материале заметна тема: ${theme}.`),
        ["Повторяющиеся темы пока не выделены автоматически. Отметьте их вручную после первичного прочтения."]
      ),
    },
    {
      title: "Эмоциональная динамика",
      accent: "#9f4f45",
      body: buildList(
        emotions.map((emotion) => `Возможный эмоциональный акцент: ${emotion}.`),
        ["Явные эмоциональные маркеры не обнаружены. Стоит проверить тон, паузы и изменения напряжения по ходу сессии."]
      ),
    },
    {
      title: "Динамика отношений",
      accent: "#b88034",
      body: hasDialogue
        ? "Материал можно рассматривать через качество контакта: где появляется сближение, где возникает осторожность, сопротивление или поиск поддержки."
        : "Для оценки отношений полезно добавить реплики обеих сторон и отметить, где меняется контакт между участниками.",
    },
    {
      title: "Интервенции специалиста",
      accent: "#1f5d7a",
      body: buildList(
        interventions.map((item) => `Возможный тип интервенции: ${item}.`),
        ["Интервенции пока не распознаны. Можно отдельно отметить вопросы, отражения, интерпретации и фокус на процессе."]
      ),
    },
    {
      title: "Гипотезы",
      accent: "#3d7258",
      body: buildList(
        [
          themes.includes("избегание") ? "Избегание может быть способом краткосрочно снизить напряжение, но поддерживать проблему в долгую." : "",
          emotions.includes("вина") ? "Вина может конкурировать с выражением злости или потребностей." : "",
          themes.includes("отношения") ? "Тема контакта и риска отвержения может быть центральной для дальнейшего исследования." : "",
        ].filter(Boolean),
        ["Гипотезы требуют проверки в супервизии и не являются готовыми клиническими выводами."]
      ),
    },
    {
      title: "Вопросы для супервизии",
      accent: "#9f4f45",
      body: buildList([
        "Где специалисту было сложнее всего сохранять позицию наблюдения?",
        "Какие чувства клиента могли отразиться в реакции специалиста?",
        "Что важно уточнить на следующей встрече, не превращая гипотезу в диагноз?",
      ]),
    },
  ];
}

function renderAnalysis(blocks) {
  analysisOutput.innerHTML = blocks
    .map(
      (block) => `
        <article class="analysis-block" style="--accent: ${block.accent}">
          <h3>${block.title}</h3>
          ${block.body.startsWith("<ul>") ? block.body : `<p>${block.body}</p>`}
        </article>
      `
    )
    .join("");

  lastAnalysisText = blocks
    .map((block) => `${block.title}\n${block.body.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()}`)
    .join("\n\n");

  emptyState.hidden = true;
  analysisOutput.hidden = false;
  copyButton.disabled = false;
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

analyzeButton.addEventListener("click", () => {
  const text = transcriptInput.value.trim();
  if (!text) {
    transcriptInput.focus();
    transcriptInput.setAttribute("placeholder", "Сначала вставьте текст для анализа...");
    return;
  }

  renderAnalysis(analyzeTranscript(text));
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
