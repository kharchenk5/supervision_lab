const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");

loadEnvFile();

const PORT = Number(process.env.PORT || 4173);
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-5.5";
const ROOT_DIR = __dirname;

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
};

const systemPrompt = `Ты ИИ-агент Supervision Lab для психолога, психотерапевта или супервизора.

Задача: помогать специалисту структурировать транскрибацию сессии или супервизионного материала.

Жесткие ограничения:
- не ставь диагнозы;
- не заменяй супервизию;
- не принимай клинические решения за специалиста;
- не назначай лечение, терапевтический план или кризисное вмешательство;
- формулируй выводы как гипотезы и материал для профессионального размышления.

Пиши на русском языке. Будь бережным, точным и профессиональным. Не выдумывай факты, которых нет в материале. Если данных недостаточно, прямо укажи это.`;

const responseSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    blocks: {
      type: "array",
      minItems: 7,
      maxItems: 7,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          accent: { type: "string" },
          body: { type: "string" },
          items: {
            type: "array",
            minItems: 0,
            maxItems: 5,
            items: { type: "string" },
          },
        },
        required: ["title", "accent", "body", "items"],
      },
    },
  },
  required: ["blocks"],
};

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/api/analyze") {
      await handleAnalyze(request, response);
      return;
    }

    if (request.method === "GET" || request.method === "HEAD") {
      serveStaticFile(request, response);
      return;
    }

    sendJson(response, 405, { error: "Метод не поддерживается." });
  } catch (error) {
    sendJson(response, 500, { error: "Внутренняя ошибка сервера." });
  }
});

server.listen(PORT, () => {
  console.log(`Supervision Lab is running at http://localhost:${PORT}`);
});

async function handleAnalyze(request, response) {
  const body = await readJsonBody(request);
  const transcript = String(body.transcript || "").trim();

  if (!transcript) {
    sendJson(response, 400, { error: "Вставьте транскрибацию для анализа." });
    return;
  }

  if (transcript.length > 60000) {
    sendJson(response, 413, { error: "Текст слишком длинный для MVP. Попробуйте фрагмент до 60 000 символов." });
    return;
  }

  if (!OPENAI_API_KEY) {
    sendJson(response, 200, createDemoAnalysis(transcript, "Демо-режим: OpenAI API ключ не задан."));
    return;
  }

  const aiResponse = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      instructions: systemPrompt,
      input: `Проанализируй этот материал и верни 7 блоков: краткое резюме, ключевые темы, эмоциональная динамика, динамика отношений, интервенции специалиста, возможные гипотезы, вопросы для супервизии.\n\nМатериал:\n${transcript}`,
      text: {
        format: {
          type: "json_schema",
          name: "supervision_analysis",
          schema: responseSchema,
          strict: true,
        },
      },
    }),
  });

  const payload = await aiResponse.json().catch(() => ({}));

  if (!aiResponse.ok) {
    const message = payload.error?.message || "OpenAI API вернул ошибку.";
    sendJson(response, 200, createDemoAnalysis(transcript, getDemoReason(message)));
    return;
  }

  try {
    const outputText = extractOutputText(payload);
    const analysis = JSON.parse(outputText);
    sendJson(response, 200, analysis);
  } catch (error) {
    sendJson(response, 200, createDemoAnalysis(transcript, "Демо-режим: не удалось разобрать ответ ИИ."));
  }
}

function getDemoReason(message) {
  const normalized = message.toLowerCase();

  if (normalized.includes("quota") || normalized.includes("billing") || normalized.includes("limit")) {
    return "Демо-режим: лимит OpenAI сейчас недоступен, поэтому показан локальный пример анализа.";
  }

  if (normalized.includes("api key") || normalized.includes("authentication") || normalized.includes("unauthorized")) {
    return "Демо-режим: ключ OpenAI не подключен или не прошел проверку.";
  }

  return "Демо-режим: OpenAI API сейчас недоступен, поэтому показан локальный пример анализа.";
}

function createDemoAnalysis(transcript, reason) {
  const words = countWords(transcript);
  const sentences = transcript.split(/[.!?]+/).map((item) => item.trim()).filter(Boolean);
  const themes = findMatches(transcript, demoDictionaries.themes);
  const emotions = findMatches(transcript, demoDictionaries.emotions);
  const interventions = findMatches(transcript, demoDictionaries.interventions);
  const speakers = getSpeakerStats(transcript);
  const hasDialogue = speakers.clientLines > 0 && speakers.specialistLines > 0;

  return {
    mode: "demo",
    blocks: [
      {
        title: "Демо-режим",
        accent: "#b88034",
        body: reason,
        items: [
          "Это локальная демонстрация структуры анализа, а не полноценный ответ ИИ.",
          "Когда появится доступ к OpenAI API, этот же экран сможет возвращать настоящий анализ.",
        ],
      },
      {
        title: "Краткое резюме",
        accent: "#1f5d7a",
        body: `Материал содержит примерно ${words} слов и ${sentences.length} смысловых фрагментов. ${hasDialogue ? "В тексте виден диалог клиента и специалиста." : "Текст можно дополнительно разметить по ролям, чтобы обзор был точнее."}`,
        items: [],
      },
      {
        title: "Ключевые темы",
        accent: "#3d7258",
        body: "",
        items: buildDemoItems(
          themes.map((theme) => `В материале заметна тема: ${theme}.`),
          ["Повторяющиеся темы не выделены автоматически. В демо-режиме стоит вручную отметить главные смысловые линии."]
        ),
      },
      {
        title: "Эмоциональная динамика",
        accent: "#9f4f45",
        body: "",
        items: buildDemoItems(
          emotions.map((emotion) => `Возможный эмоциональный акцент: ${emotion}.`),
          ["Явные эмоциональные маркеры не обнаружены. Можно отдельно посмотреть тон, паузы и изменения напряжения."]
        ),
      },
      {
        title: "Динамика отношений",
        accent: "#b88034",
        body: hasDialogue
          ? "Материал можно рассматривать через качество контакта: где появляется сближение, где осторожность, сопротивление или поиск поддержки."
          : "Для оценки отношений полезно добавить реплики обеих сторон и отметить, где меняется контакт между участниками.",
        items: [],
      },
      {
        title: "Интервенции специалиста",
        accent: "#1f5d7a",
        body: "",
        items: buildDemoItems(
          interventions.map((item) => `Возможный тип интервенции: ${item}.`),
          ["Интервенции не распознаны демо-алгоритмом. Можно отдельно отметить вопросы, отражения и фокус на процессе."]
        ),
      },
      {
        title: "Возможные гипотезы",
        accent: "#3d7258",
        body: "",
        items: buildDemoItems(
          [
            themes.includes("избегание") ? "Избегание может быть способом краткосрочно снизить напряжение, но поддерживать проблему в долгую." : "",
            emotions.includes("вина") ? "Вина может конкурировать с выражением злости или потребностей." : "",
            themes.includes("отношения") ? "Тема контакта и риска отвержения может быть важной для дальнейшего исследования." : "",
          ].filter(Boolean),
          ["Гипотезы требуют проверки в супервизии и не являются готовыми клиническими выводами."]
        ),
      },
      {
        title: "Вопросы для супервизии",
        accent: "#9f4f45",
        body: "",
        items: [
          "Где специалисту было сложнее всего сохранять позицию наблюдения?",
          "Какие чувства клиента могли отразиться в реакции специалиста?",
          "Что важно уточнить на следующей встрече, не превращая гипотезу в диагноз?",
        ],
      },
    ],
  };
}

const demoDictionaries = {
  emotions: {
    тревога: ["тревог", "страх", "боюсь", "паник", "напряж"],
    злость: ["злю", "злость", "раздраж", "ярост"],
    вина: ["вина", "винов", "стыд"],
    печаль: ["груст", "печаль", "плак", "одинок"],
    усталость: ["устал", "выгор", "нет сил"],
  },
  themes: {
    границы: ["границ", "отказать", "нельзя", "должен", "должна"],
    отношения: ["отнош", "контакт", "близ", "отверг", "партнер"],
    самооценка: ["не справ", "плох", "недостат", "ценност"],
    избегание: ["отклады", "молчу", "избег", "не говор"],
    контроль: ["контрол", "провер", "идеально"],
  },
  interventions: {
    "уточняющие вопросы": ["что", "как", "когда", "почему"],
    "отражение чувств": ["похоже", "звучит", "слышно", "чувств"],
    "фокус на процессе": ["между нами", "сейчас", "в сессии", "в контакте"],
    гипотеза: ["может быть", "возможно", "как будто"],
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

function buildDemoItems(items, fallback) {
  return items.length ? items : fallback;
}

function serveStaticFile(request, response) {
  const requestedUrl = new URL(request.url, `http://localhost:${PORT}`);
  const safePath = path.normalize(decodeURIComponent(requestedUrl.pathname)).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(ROOT_DIR, safePath === "/" ? "index.html" : safePath);

  if (!filePath.startsWith(ROOT_DIR)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404);
      response.end("Not found");
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[path.extname(filePath)] || "application/octet-stream",
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    response.end(content);
  });
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let data = "";

    request.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        request.destroy();
        reject(new Error("Payload too large"));
      }
    });

    request.on("end", () => {
      try {
        resolve(data ? JSON.parse(data) : {});
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(payload));
}

function extractOutputText(payload) {
  if (payload.output_text) {
    return payload.output_text;
  }

  const content = payload.output?.flatMap((item) => item.content || []) || [];
  const textPart = content.find((item) => item.type === "output_text" && item.text);

  if (!textPart) {
    throw new Error("OpenAI API не вернул текст анализа.");
  }

  return textPart.text;
}

function loadEnvFile() {
  const envPath = path.join(__dirname, ".env");
  if (!fs.existsSync(envPath)) return;

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}
