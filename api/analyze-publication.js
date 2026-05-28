import OpenAI from "openai";
import * as cheerio from "cheerio";
import chromium from "@sparticuz/chromium";
import { chromium as playwrightChromium } from "playwright-core";

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

function cleanText(text = "") {
  return String(text)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s+\n/g, "\n\n")
    .trim();
}

function cleanArticleText(text = "") {
  let cleaned = String(text || "")
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  // Corta comentários e rodapé da página quando aparecem dentro do modal.
  const cutMarkers = [
    "Deixe seu comentário",
    "O autor da mensagem",
    "Leia as Regras de Uso",
    "Sobre a Sinopress",
    "Privacidade",
    "Fale com a Sinopress",
  ];

  for (const marker of cutMarkers) {
    const index = cleaned.toLowerCase().indexOf(marker.toLowerCase());
    if (index > 0) {
      cleaned = cleaned.slice(0, index).trim();
    }
  }

  const noisePatterns = [
    /^Suas decisões baseadas em dados.*$/i,
    /^Sair\s*\(\d+\).*$/i,
    /^Ver fonte$/i,
    /^Sentimento$/i,
    /^Retorno de mídia.*$/i,
    /^Unique visitors.*$/i,
    /^Audiência online.*$/i,
    /^Sobre a Sinopress.*$/i,
    /^Privacidade.*$/i,
    /^Ajuda$/i,
    /^ver texto$/i,
  ];

  const lines = cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !noisePatterns.some((pattern) => pattern.test(line)));

  return lines.join("\n").trim();
}

function extractTextFromHtml(html, sourceUrl = "") {
  const $ = cheerio.load(html);

  $("script, style, nav, footer, header, iframe, noscript").remove();

  const title =
    cleanText($("h1").first().text()) ||
    cleanText($("title").first().text());

  const selectors = [
    ".modal.show",
    ".modal-content",
    ".modal-body",
    "[role='dialog']",
    "#texto",
    "#conteudo",
    ".texto",
    ".conteudo",
    ".content",
    ".materia",
    ".noticia",
    "article",
    "main",
    "body",
  ];

  const chunks = [];

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const text = cleanArticleText($(el).text());
      if (text.length > 120) chunks.push(text);
    });
  }

  const uniqueChunks = Array.from(new Set(chunks)).sort(
    (a, b) => b.length - a.length
  );

  const body = uniqueChunks[0] || "";

  return {
    title,
    body,
    textLength: body.length,
    preview: body.slice(0, 700),
    sourceUrl,
    extractionMethod: "html",
  };
}

async function extractTextWithBrowser(url) {
  let browser;

  try {
    browser = await playwrightChromium.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
    });

    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      viewport: {
        width: 1366,
        height: 900,
      },
    });

    await page.goto(url, {
      waitUntil: "networkidle",
      timeout: 30000,
    });

    // Tenta clicar no botão/link "ver texto".
    const clickSelectors = [
      "text=/ver texto/i",
      "text=/Ver texto/i",
      "text=/VER TEXTO/i",
      "button:has-text('ver texto')",
      "a:has-text('ver texto')",
    ];

    let clicked = false;

    for (const selector of clickSelectors) {
      try {
        const locator = page.locator(selector).first();
        await locator.click({ timeout: 5000 });
        clicked = true;
        break;
      } catch {
        // tenta o próximo seletor
      }
    }

    if (!clicked) {
      // Fallback: procura qualquer elemento visível cujo texto contenha "ver texto".
      await page.evaluate(() => {
        const elements = Array.from(document.querySelectorAll("a, button, div, span"));
        const target = elements.find((el) =>
          String(el.innerText || "").toLowerCase().includes("ver texto")
        );
        if (target) target.click();
      });
    }

    await page.waitForTimeout(1500);

    const result = await page.evaluate(() => {
      function visibleText(el) {
        if (!el) return "";
        const style = window.getComputedStyle(el);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.opacity === "0"
        ) {
          return "";
        }
        return el.innerText || "";
      }

      const title =
        document.querySelector("h1")?.innerText ||
        document.querySelector("title")?.innerText ||
        "";

      const candidates = [
        ...Array.from(document.querySelectorAll(".modal.show")),
        ...Array.from(document.querySelectorAll(".modal-content")),
        ...Array.from(document.querySelectorAll(".modal-body")),
        ...Array.from(document.querySelectorAll("[role='dialog']")),
        ...Array.from(document.querySelectorAll(".bootbox")),
        ...Array.from(document.querySelectorAll(".swal2-container")),
        document.body,
      ]
        .filter(Boolean)
        .map((el) => ({
          text: visibleText(el),
          html: el.innerHTML || "",
        }))
        .filter((item) => item.text && item.text.length > 100)
        .sort((a, b) => b.text.length - a.text.length);

      return {
        title,
        text: candidates[0]?.text || "",
        html: candidates[0]?.html || "",
        candidateCount: candidates.length,
      };
    });

    const body = cleanArticleText(result.text);

    return {
      title: cleanText(result.title),
      body,
      textLength: body.length,
      preview: body.slice(0, 700),
      sourceUrl: url,
      extractionMethod: clicked ? "browser_click_ver_texto" : "browser_fallback",
      diagnostics: {
        candidateCount: result.candidateCount,
        clicked,
      },
    };
  } finally {
    if (browser) await browser.close();
  }
}

async function extractTextFromUrl(url) {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; PRDashboardBot/1.0)",
    },
  });

  if (!response.ok) {
    throw new Error(`Erro ao acessar o link: HTTP ${response.status}`);
  }

  const html = await response.text();
  const firstExtraction = extractTextFromHtml(html, url);

  // Para Sinopress, o texto bom costuma estar atrás do clique "ver texto".
  const shouldUseBrowser =
    firstExtraction.body.length < 1200 ||
    /sinopress/i.test(url) ||
    /ver texto/i.test(html) ||
    /Retorno de mídia/i.test(firstExtraction.body);

  if (shouldUseBrowser) {
    try {
      const browserExtraction = await extractTextWithBrowser(url);

      if (browserExtraction.body && browserExtraction.body.length >= 200) {
        return browserExtraction;
      }
    } catch (error) {
      return {
        ...firstExtraction,
        extractionMethod: "html_browser_failed",
        browserError: error.message,
      };
    }
  }

  return firstExtraction;
}

function buildSystemPrompt() {
  return `
Você é uma analista sênior de PR e clipping.

Sua tarefa é avaliar uma reportagem e classificar quatro critérios editoriais para cálculo de valoração:
1. proporção de presença do cliente
2. destaque
3. protagonismo
4. tom

Responda exclusivamente em JSON válido.
Não use markdown.
Não use comentários.
Não use texto antes ou depois do JSON.
Não use trailing commas.
Todas as propriedades precisam estar entre aspas duplas.

Use exatamente este formato:

{
  "presence": {
    "category": "",
    "factor": 0,
    "justification": ""
  },
  "highlight": {
    "category": "",
    "factor": 0,
    "justification": ""
  },
  "protagonism": {
    "category": "",
    "factor": 0,
    "justification": ""
  },
  "tone": {
    "category": "",
    "factor": 0,
    "justification": ""
  },
  "confidence": 0,
  "evidence": [],
  "status": "analisado_por_texto"
}

Escalas obrigatórias:

presence:
- "Presença total" = 1.00
- "Presença alta" = 0.80
- "Presença média" = 0.60
- "Presença baixa" = 0.30
- "Menção incidental" = 0.10

highlight:
- "Máximo destaque" = 1.30
- "Alto destaque" = 1.10
- "Destaque padrão" = 1.00
- "Baixo destaque" = 0.80
- "Sem destaque" = 0.60

protagonism:
- "Protagonista" = 1.00
- "Coprotagonista" = 0.80
- "Participante relevante" = 0.60
- "Coadjuvante" = 0.40
- "Figurante" = 0.20

tone:
- "Muito positivo" = 1.20
- "Positivo" = 1.00
- "Neutro" = 0.50
- "Sensível" = 0.30
- "Negativo" = 0.10

Critérios:
- Não seja generosa sem evidência.
- Se o cliente só aparece em lista, use presença baixa ou menção incidental.
- Se houver crise, reclamação, golpe, bloqueio, processo, condenação ou dano reputacional, o tom deve ser sensível ou negativo.
- Use evidências curtas retiradas do texto.
- confidence deve variar de 0 a 1.
`;
}


function parseModelJson(content = "") {
  const raw = String(content || "").trim();

  try {
    return JSON.parse(raw);
  } catch {
    // continua para tentativa de extração
  }

  const jsonMatch = raw.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error("Nenhum objeto JSON encontrado na resposta.");
  }

  let candidate = jsonMatch[0]
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  // Remove vírgulas sobrando antes de } ou ]
  candidate = candidate.replace(/,\s*([}\]])/g, "$1");

  return JSON.parse(candidate);
}



export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Use POST." });
  }

  try {
    const {
      url,
      clientName = "Cliente X",
      title = "",
      vehicle = "",
    } = req.body || {};

    if (!url) {
      return res.status(400).json({ error: "URL obrigatória." });
    }

    const extracted = await extractTextFromUrl(url);

    if (!extracted.body || extracted.body.length < 200) {
      return res.status(422).json({
        status: "conteudo_insuficiente",
        error:
          "Não foi possível extrair texto suficiente. A página pode depender de sessão, iframe, imagem ou JavaScript não acessível.",
        extraction: extracted,
      });
    }

    const userPrompt = `
Cliente analisado: ${clientName}
Veículo: ${vehicle}
Título informado na planilha: ${title}
Título extraído da página: ${extracted.title}

Texto da reportagem:
${extracted.body.slice(0, 18000)}
`;

    const completion = await deepseek.chat.completions.create({
      model: "deepseek-v4-pro",
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      stream: false,
      max_tokens: 1200,
    });

    const content = completion.choices?.[0]?.message?.content;
    
    if (!content) {
      return res.status(502).json({
        error: "A DeepSeek retornou conteúdo vazio.",
        rawCompletion: completion,
      });
    }
    
    let analysis;
    
    try {
      analysis = parseModelJson(content);
    } catch (jsonError) {
      return res.status(502).json({
        error: "A DeepSeek não retornou JSON válido.",
        jsonError: jsonError.message,
        rawContent: content,
      });
    }
    
    return res.status(200).json({
      status: "ok",
      extraction: {
        title: extracted.title,
        textLength: extracted.textLength,
        preview: extracted.preview,
        sourceUrl: extracted.sourceUrl,
        extractionMethod: extracted.extractionMethod,
        diagnostics: extracted.diagnostics,
      },
      analysis,
    });


  } catch (error) {
    return res.status(500).json({
      error: error.message || "Erro inesperado.",
    });
  }
}
