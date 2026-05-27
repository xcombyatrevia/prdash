import OpenAI from "openai";
import * as cheerio from "cheerio";

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

function cleanText(text = "") {
  return String(text)
    .replace(/\s+/g, " ")
    .replace(/\u00a0/g, " ")
    .trim();
}

function extractTextFromHtml(html, sourceUrl = "") {
  const $ = cheerio.load(html);

  $("script, style, nav, footer, header, iframe, noscript").remove();

  const title =
    cleanText($("h1").first().text()) ||
    cleanText($("title").first().text());

  const selectors = [
    "article",
    "main",
    ".modal",
    ".modal-body",
    ".texto",
    ".ver-texto",
    ".clipping",
    ".conteudo",
    ".content",
    ".materia",
    ".noticia",
    "#texto",
    "#conteudo",
    "body",
  ];

  const chunks = [];

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const text = cleanText($(el).text());
      if (text.length > 120) chunks.push(text);
    });
  }

  const uniqueChunks = Array.from(new Set(chunks))
    .sort((a, b) => b.length - a.length);

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

function findTextCandidateUrls(html, baseUrl) {
  const $ = cheerio.load(html);
  const candidates = new Set();

  const keywords = [
    "ver texto",
    "texto",
    "clipping",
    "materia",
    "matéria",
    "detalhe",
    "visualizar",
    "noticia",
    "notícia",
  ];

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    const label = cleanText($(el).text()).toLowerCase();
    const raw = `${href || ""} ${label}`.toLowerCase();

    if (keywords.some((keyword) => raw.includes(keyword))) {
      try {
        candidates.add(new URL(href, baseUrl).toString());
      } catch {
        // ignora href inválido
      }
    }
  });

  $("[onclick]").each((_, el) => {
    const onclick = $(el).attr("onclick") || "";
    const lower = onclick.toLowerCase();

    if (keywords.some((keyword) => lower.includes(keyword))) {
      const matches = onclick.match(/['"]([^'"]+\.(?:php|html|aspx|jsp)[^'"]*)['"]/gi) || [];

      for (const match of matches) {
        const cleaned = match.replace(/^['"]|['"]$/g, "");
        try {
          candidates.add(new URL(cleaned, baseUrl).toString());
        } catch {
          // ignora url inválida
        }
      }
    }
  });

  const urlMatches = html.match(/(?:href|src)=["']([^"']+)["']/gi) || [];

  for (const item of urlMatches) {
    const cleaned = item
      .replace(/^(href|src)=/i, "")
      .replace(/^["']|["']$/g, "");

    const lower = cleaned.toLowerCase();

    if (keywords.some((keyword) => lower.includes(keyword))) {
      try {
        candidates.add(new URL(cleaned, baseUrl).toString());
      } catch {
        // ignora url inválida
      }
    }
  }

  return Array.from(candidates);
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

  if (firstExtraction.body && firstExtraction.body.length >= 200) {
    return firstExtraction;
  }

  const candidates = findTextCandidateUrls(html, url);

  for (const candidateUrl of candidates.slice(0, 8)) {
    try {
      const candidateResponse = await fetch(candidateUrl, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; PRDashboardBot/1.0)",
          Referer: url,
        },
      });

      if (!candidateResponse.ok) continue;

      const candidateHtml = await candidateResponse.text();
      const candidateExtraction = extractTextFromHtml(candidateHtml, candidateUrl);

      if (candidateExtraction.body && candidateExtraction.body.length >= 200) {
        return {
          ...candidateExtraction,
          sourceUrl: candidateUrl,
          extractionMethod: "linked_candidate",
          candidates,
        };
      }
    } catch {
      // Ignora candidato quebrado e tenta o próximo.
    }
  }

  return {
    ...firstExtraction,
    extractionMethod: "insufficient_html",
    candidates,
    diagnostics: {
      htmlLength: html.length,
      hasVerTexto: /ver texto/i.test(html),
      hasTexto: /texto/i.test(html),
      hasIframe: /iframe/i.test(html),
      hasModal: /modal/i.test(html),
    },
  };
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
          "Não foi possível extrair texto suficiente. Pode ser imagem, paywall, bloqueio ou página da clipadora sem texto no HTML.",
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
      });
    }

    const analysis = JSON.parse(content);

    return res.status(200).json({
      status: "ok",
      extraction: {
        title: extracted.title,
        textLength: extracted.textLength,
        preview: extracted.preview,
      },
      analysis,
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Erro inesperado.",
    });
  }
}
