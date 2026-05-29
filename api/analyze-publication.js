import OpenAI from "openai";
import * as cheerio from "cheerio";
import { createClient } from "@supabase/supabase-js";

const deepseek = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: "https://api.deepseek.com",
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function cleanText(text = "") {
  return String(text)
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function stripHtml(value = "") {
  return cleanText(
    String(value)
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/p>/gi, "\n")
      .replace(/<\/div>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  );
}

function decodeHtmlEntities(text = "") {
  return String(text)
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#039;/gi, "'")
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function cleanArticleText(text = "") {
  let cleaned = decodeHtmlEntities(cleanText(text));

  const cutMarkers = [
    "Deixe seu comentário",
    "O autor da mensagem",
    "Leia as Regras de Uso",
    "Retorno de mídia",
    "Unique visitors",
    "Audiência online",
    "Sobre a Sinopress",
    "Privacidade",
    "Fale com a Sinopress",
    "Ajuda",
    "Sair(",
    "Sair (",
  ];

  for (const marker of cutMarkers) {
    const index = cleaned.toLowerCase().indexOf(marker.toLowerCase());
    if (index > 0) {
      cleaned = cleaned.slice(0, index).trim();
    }
  }

  const noisePatterns = [
    /^suas decisões baseadas em dados/i,
    /^ver fonte$/i,
    /^ver texto$/i,
    /^sentimento$/i,
    /^retorno de mídia/i,
    /^unique visitors/i,
    /^audiência online/i,
    /^sobre a sinopress/i,
    /^privacidade/i,
    /^ajuda$/i,
    /^sair\s*\(\d+\)/i,
  ];

  return cleaned
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((line) => !noisePatterns.some((pattern) => pattern.test(line)))
    .join("\n")
    .trim();
}

function scoreTextCandidate(text = "") {
  const lower = text.toLowerCase();
  let score = 0;

  if (text.length > 500) score += 10;
  if (text.length > 1200) score += 10;
  if (text.length > 1800) score += 6;

  if (lower.includes("do uol")) score += 6;
  if (lower.includes("em são paulo")) score += 5;
  if (lower.includes("imagem:")) score += 4;
  if (lower.includes("pagbank")) score += 4;
  if (lower.includes("lucro")) score += 3;
  if (lower.includes("reportagem")) score += 2;
  if (lower.includes("portfolio de crédito") || lower.includes("portfólio de crédito")) score += 5;

  if (lower.includes("retorno de mídia")) score -= 8;
  if (lower.includes("unique visitors")) score -= 8;
  if (lower.includes("sobre a sinopress")) score -= 8;
  if (lower.includes("suas decisões baseadas")) score -= 6;

  return score;
}

function extractLongStringsFromScript(scriptText = "") {
  const results = [];
  const regexes = [
    /"([^"]{120,})"/g,
    /'([^']{120,})'/g,
    /`([^`]{120,})`/g,
  ];

  for (const regex of regexes) {
    let match;

    while ((match = regex.exec(scriptText)) !== null) {
      const value = match[1];

      if (
        /pagbank/i.test(value) ||
        /do uol/i.test(value) ||
        /lucro/i.test(value) ||
        /reportagem/i.test(value)
      ) {
        results.push(value);
      }
    }
  }

  return results;
}

function extractCandidateTextsFromHtml(html) {
  const $ = cheerio.load(html, { decodeEntities: true });

  const candidates = [];

  const title =
    cleanText($("h1").first().text()) ||
    cleanText($("title").first().text());

  const selectors = [
    ".modal",
    ".modal-content",
    ".modal-body",
    "[role='dialog']",
    "#texto",
    "#conteudo",
    "#textoMateria",
    "#texto_materia",
    "#materia",
    ".texto",
    ".textoMateria",
    ".texto_materia",
    ".conteudo",
    ".content",
    ".materia",
    ".noticia",
    "article",
    "main",
    "body",
  ];

  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const raw = $(el).text();
      const text = cleanArticleText(raw);

      if (text.length > 120) {
        candidates.push({
          source: `selector:${selector}`,
          text,
          length: text.length,
          score: scoreTextCandidate(text),
        });
      }
    });
  }

  $("[data-texto], [data-content], [data-conteudo], [data-materia], [data-original-title], [title]").each((_, el) => {
    const attrs = el.attribs || {};

    for (const [name, value] of Object.entries(attrs)) {
      if (!value) continue;

      const attrName = String(name).toLowerCase();
      const rawValue = String(value);

      if (
        attrName.includes("texto") ||
        attrName.includes("content") ||
        attrName.includes("conteudo") ||
        attrName.includes("materia") ||
        rawValue.toLowerCase().includes("pagbank") ||
        rawValue.toLowerCase().includes("do uol")
      ) {
        const text = cleanArticleText(stripHtml(rawValue));

        if (text.length > 120) {
          candidates.push({
            source: `attribute:${name}`,
            text,
            length: text.length,
            score: scoreTextCandidate(text),
          });
        }
      }
    }
  });

  $("script").each((index, el) => {
    const scriptText = $(el).html() || "";

    if (
      /pagbank/i.test(scriptText) ||
      /do uol/i.test(scriptText) ||
      /ver texto/i.test(scriptText) ||
      /clipping/i.test(scriptText)
    ) {
      const extractedFromStrings = extractLongStringsFromScript(scriptText);

      for (const item of extractedFromStrings) {
        const text = cleanArticleText(stripHtml(item));

        if (text.length > 120) {
          candidates.push({
            source: `script:${index}`,
            text,
            length: text.length,
            score: scoreTextCandidate(text),
          });
        }
      }
    }
  });

  const unique = [];
  const seen = new Set();

  for (const candidate of candidates) {
    const key = candidate.text.slice(0, 250);

    if (!seen.has(key)) {
      seen.add(key);
      unique.push(candidate);
    }
  }

  unique.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.length - a.length;
  });

  return {
    title,
    candidates: unique,
  };
}

function extractUrlsFromText(text = "", baseUrl) {
  const urls = new Set();

  const patterns = [
    /(?:href|src)\s*=\s*["']([^"']+)["']/gi,
    /["']([^"']+\.(?:php|html|aspx|jsp)(?:\?[^"']*)?)["']/gi,
    /["']((?:\/|\.\/|\.\.\/)[^"']*(?:texto|clipping|materia|noticia|detalhe|conteudo)[^"']*)["']/gi,
    /(https?:\/\/[^\s"'<>]+(?:texto|clipping|materia|noticia|detalhe|conteudo)[^\s"'<>]*)/gi,
  ];

  for (const pattern of patterns) {
    let match;

    while ((match = pattern.exec(text)) !== null) {
      const candidate = match[1] || match[0];

      try {
        urls.add(new URL(candidate, baseUrl).toString());
      } catch {
        // ignora URL inválida
      }
    }
  }

  return Array.from(urls);
}

function findCandidateUrls(html, baseUrl) {
  const $ = cheerio.load(html);
  const candidates = new Set();

  const keywords = [
    "ver texto",
    "texto",
    "clipping",
    "materia",
    "matéria",
    "noticia",
    "notícia",
    "detalhe",
    "visualizar",
    "conteudo",
    "conteúdo",
  ];

  $("a[href], iframe[src], frame[src]").each((_, el) => {
    const href = $(el).attr("href") || $(el).attr("src");
    const label = cleanText($(el).text()).toLowerCase();
    const raw = `${href || ""} ${label}`.toLowerCase();

    if (href && keywords.some((keyword) => raw.includes(keyword))) {
      try {
        candidates.add(new URL(href, baseUrl).toString());
      } catch {
        // ignora URL inválida
      }
    }
  });

  $("[onclick]").each((_, el) => {
    const onclick = $(el).attr("onclick") || "";
    const lower = onclick.toLowerCase();

    if (keywords.some((keyword) => lower.includes(keyword)) || lower.includes("clip")) {
      const urls = extractUrlsFromText(onclick, baseUrl);
      urls.forEach((candidateUrl) => candidates.add(candidateUrl));
    }
  });

  $("script").each((_, el) => {
    const scriptText = $(el).html() || "";
    const lower = scriptText.toLowerCase();

    if (keywords.some((keyword) => lower.includes(keyword)) || lower.includes("clip")) {
      const urls = extractUrlsFromText(scriptText, baseUrl);
      urls.forEach((candidateUrl) => candidates.add(candidateUrl));
    }
  });

  return Array.from(candidates).filter((candidateUrl) => {
    try {
      const parsed = new URL(candidateUrl);
      return parsed.hostname.includes("sinopress") || parsed.hostname === new URL(baseUrl).hostname;
    } catch {
      return false;
    }
  });
}

async function fetchText(url, referer = "") {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; PRDashboardBot/1.0)",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      Referer: referer || url,
    },
  });

  const text = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    url,
    text,
    contentType: response.headers.get("content-type") || "",
  };
}

async function extractTextFromUrl(url) {
  const initial = await fetchText(url);

  if (!initial.ok) {
    throw new Error(`Erro ao acessar o link: HTTP ${initial.status}`);
  }

  const initialExtraction = extractCandidateTextsFromHtml(initial.text);
  const candidateUrls = findCandidateUrls(initial.text, url);

  const attempts = [
    {
      url,
      status: initial.status,
      contentType: initial.contentType,
      method: "initial_html",
      candidateCount: initialExtraction.candidates.length,
      topCandidateLength: initialExtraction.candidates[0]?.length || 0,
      topCandidateScore: initialExtraction.candidates[0]?.score || 0,
    },
  ];

  const allCandidates = [...initialExtraction.candidates];

  for (const candidateUrl of candidateUrls.slice(0, 12)) {
    try {
      const fetched = await fetchText(candidateUrl, url);

      attempts.push({
        url: candidateUrl,
        status: fetched.status,
        contentType: fetched.contentType,
        method: "candidate_url",
      });

      if (!fetched.ok) continue;

      const extraction = extractCandidateTextsFromHtml(fetched.text);

      attempts[attempts.length - 1].candidateCount = extraction.candidates.length;
      attempts[attempts.length - 1].topCandidateLength = extraction.candidates[0]?.length || 0;
      attempts[attempts.length - 1].topCandidateScore = extraction.candidates[0]?.score || 0;

      allCandidates.push(
        ...extraction.candidates.map((candidate) => ({
          ...candidate,
          source: `${candidate.source} | url:${candidateUrl}`,
        }))
      );
    } catch (error) {
      attempts.push({
        url: candidateUrl,
        method: "candidate_url",
        error: error.message,
      });
    }
  }

  allCandidates.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.length - a.length;
  });

  const best = allCandidates[0];

  const debug = {
    htmlLength: initial.text.length,
    hasVerTexto: /ver texto/i.test(initial.text),
    hasPagBank: /pagbank/i.test(initial.text),
    hasDoUol: /do uol/i.test(initial.text),
    hasLucro: /lucro/i.test(initial.text),
    hasModal: /modal/i.test(initial.text),
    candidateUrls,
    attempts,
    topCandidates: allCandidates.slice(0, 5).map((candidate) => ({
      source: candidate.source,
      length: candidate.length,
      score: candidate.score,
      preview: candidate.text.slice(0, 500),
    })),
  };

  if (!best) {
    return {
      title: initialExtraction.title,
      body: "",
      textLength: 0,
      preview: "",
      sourceUrl: url,
      extractionMethod: "no_candidate_found",
      diagnostics: debug,
    };
  }

  return {
    title: initialExtraction.title,
    body: best.text,
    textLength: best.text.length,
    preview: best.text.slice(0, 1000),
    sourceUrl: url,
    extractionMethod: best.source,
    diagnostics: debug,
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
- Use evidências curtas copiadas literalmente do texto analisado.
- As evidências devem ser trechos reais do texto, sem reescrever, resumir ou inventar.
- Não use reticências internas nas evidências.
- Se precisar encurtar uma evidência, escolha um trecho menor, mas literal.
- confidence deve variar de 0 a 1.
`;
}

function parseModelJson(content = "") {
  const raw = String(content || "").trim();

  try {
    return JSON.parse(raw);
  } catch {
    // tenta extrair JSON de markdown/texto
  }

  const jsonMatch = raw.match(/\{[\s\S]*\}/);

  if (!jsonMatch) {
    throw new Error("Nenhum objeto JSON encontrado na resposta.");
  }

  let candidate = jsonMatch[0]
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  candidate = candidate.replace(/,\s*([}\]])/g, "$1");

  return JSON.parse(candidate);
}

function calculateAiFinalFactor(analysis) {
  if (!analysis) return null;

  const presence = Number(analysis.presence?.factor ?? 0);
  const highlight = Number(analysis.highlight?.factor ?? 0);
  const protagonism = Number(analysis.protagonism?.factor ?? 0);
  const tone = Number(analysis.tone?.factor ?? 0);

  if (!presence || !highlight || !protagonism || !tone) return null;

  return presence * highlight * protagonism * tone;
}

function buildExtractionPayload(extracted) {
  return {
    title: extracted.title,
    textLength: extracted.textLength,
    preview: extracted.preview,
    fullText: extracted.body,
    sourceUrl: extracted.sourceUrl,
    extractionMethod: extracted.extractionMethod,
    diagnostics: extracted.diagnostics,
  };
}

function buildResponseFromSavedAnalysis(savedRow) {
  const analysis = {
    presence: {
      category: savedRow.presence_category,
      factor: Number(savedRow.presence_factor),
      justification: savedRow.presence_justification,
    },
    highlight: {
      category: savedRow.highlight_category,
      factor: Number(savedRow.highlight_factor),
      justification: savedRow.highlight_justification,
    },
    protagonism: {
      category: savedRow.protagonism_category,
      factor: Number(savedRow.protagonism_factor),
      justification: savedRow.protagonism_justification,
    },
    tone: {
      category: savedRow.tone_category,
      factor: Number(savedRow.tone_factor),
      justification: savedRow.tone_justification,
    },
    confidence: Number(savedRow.confidence),
    evidence: savedRow.evidence || [],
    status: savedRow.status,
  };

  return {
    status: "ok",
    source: "supabase_cache",
    extraction: {
      title: savedRow.extracted_title,
      textLength: savedRow.text_length,
      preview: String(savedRow.extracted_text || "").slice(0, 1000),
      fullText: savedRow.extracted_text,
      sourceUrl: savedRow.extraction_source_url,
      extractionMethod: savedRow.extraction_method,
      diagnostics: savedRow.diagnostics,
    },
    analysis,
    aiFinalFactor: Number(savedRow.ai_final_factor),
    debug: {
      rawContent: savedRow.raw_content,
      usage: {
        prompt_tokens: savedRow.prompt_tokens,
        completion_tokens: savedRow.completion_tokens,
        total_tokens: savedRow.total_tokens,
      },
      model: savedRow.model,
      aiFinalFactor: Number(savedRow.ai_final_factor),
      cachedFromSupabase: true,
      savedAt: savedRow.created_at,
    },
  };
}

async function findSavedAnalysis({ url, publicationId }) {
  if (publicationId) {
    const { data, error } = await supabase
      .from("ai_analyses")
      .select("*")
      .eq("publication_id", publicationId)
      .maybeSingle();

    if (error) throw new Error(`Erro ao consultar Supabase por publication_id: ${error.message}`);
    if (data) return data;
  }

  const { data, error } = await supabase
    .from("ai_analyses")
    .select("*")
    .eq("url", url)
    .maybeSingle();

  if (error) throw new Error(`Erro ao consultar Supabase por URL: ${error.message}`);

  return data;
}

async function saveAnalysisToSupabase({
  url,
  clientId,
  publicationId,
  clientName,
  title,
  vehicle,
  extracted,
  analysis,
  aiFinalFactor,
  completion,
  rawContent,
}) {
  const payload = {
    client_id: clientId || "cliente_x",
    publication_id: publicationId || null,

    client_name_snapshot: clientName || "Cliente X",
    title_snapshot: title || null,
    vehicle_snapshot: vehicle || null,
    url,

    extracted_title: extracted.title || null,
    extracted_text: extracted.body || null,
    extraction_method: extracted.extractionMethod || null,
    extraction_source_url: extracted.sourceUrl || url,
    text_length: extracted.textLength || 0,

    presence_category: analysis.presence?.category || null,
    presence_factor: analysis.presence?.factor ?? null,

    highlight_category: analysis.highlight?.category || null,
    highlight_factor: analysis.highlight?.factor ?? null,

    protagonism_category: analysis.protagonism?.category || null,
    protagonism_factor: analysis.protagonism?.factor ?? null,

    tone_category: analysis.tone?.category || null,
    tone_factor: analysis.tone?.factor ?? null,

    ai_final_factor: aiFinalFactor,

    presence_justification: analysis.presence?.justification || null,
    highlight_justification: analysis.highlight?.justification || null,
    protagonism_justification: analysis.protagonism?.justification || null,
    tone_justification: analysis.tone?.justification || null,
    evidence: analysis.evidence || [],

    confidence: analysis.confidence ?? null,
    status: analysis.status || "analisado_por_texto",
    model: completion.model || null,
    prompt_tokens: completion.usage?.prompt_tokens || null,
    completion_tokens: completion.usage?.completion_tokens || null,
    total_tokens: completion.usage?.total_tokens || null,

    raw_content: rawContent || null,
    diagnostics: extracted.diagnostics || null,
  };

  const { data, error } = await supabase
    .from("ai_analyses")
    .upsert(payload, {
      onConflict: publicationId ? "publication_id" : "url",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Erro ao salvar análise no Supabase: ${error.message}`);
  }

  return data;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Use POST." });
    }

    const {
      url,
      clientId = "cliente_x",
      publicationId = "",
      clientName = "Cliente X",
      title = "",
      vehicle = "",
      debug = false,
      forceReanalyze = false,
    } = req.body || {};

    if (!url) {
      return res.status(400).json({ error: "URL obrigatória." });
    }

    if (!forceReanalyze && !debug) {
      const savedAnalysis = await findSavedAnalysis({ url, publicationId });

      if (savedAnalysis) {
        return res.status(200).json(buildResponseFromSavedAnalysis(savedAnalysis));
      }
    }

    const extracted = await extractTextFromUrl(url);

    if (debug) {
      return res.status(200).json({
        status: "debug_only",
        extraction: buildExtractionPayload(extracted),
        fullExtractedText: extracted.body,
      });
    }

    if (!extracted.body || extracted.body.length < 200) {
      return res.status(422).json({
        status: "conteudo_insuficiente",
        error:
          "Não foi possível extrair texto suficiente do link. Veja diagnostics para entender se o texto está em endpoint, script, iframe, imagem ou sessão.",
        extraction: buildExtractionPayload(extracted),
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
      model: "deepseek-chat",
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: userPrompt },
      ],
      response_format: { type: "json_object" },
      stream: false,
      max_tokens: 1200,
      temperature: 0.1,
    });

    const rawMessage = completion.choices?.[0]?.message || null;
    const content = rawMessage?.content || "";

    if (!content) {
      return res.status(502).json({
        error: "A DeepSeek retornou conteúdo vazio.",
        debug: {
          rawMessage,
          choices: completion.choices || [],
          usage: completion.usage || null,
          model: completion.model || null,
          id: completion.id || null,
          created: completion.created || null,
        },
        extraction: buildExtractionPayload(extracted),
      });
    }

    let analysis;

    try {
      analysis = parseModelJson(content);
    } catch (jsonError) {
      return res.status(502).json({
        error: "A DeepSeek retornou uma mensagem, mas ela não é JSON válido.",
        jsonError: jsonError.message,
        rawContent: content,
        debug: {
          rawMessage,
          choices: completion.choices || [],
          usage: completion.usage || null,
          model: completion.model || null,
          id: completion.id || null,
          created: completion.created || null,
        },
        extraction: buildExtractionPayload(extracted),
      });
    }

    const aiFinalFactor = calculateAiFinalFactor(analysis);

    let savedRow = null;

    try {
      savedRow = await saveAnalysisToSupabase({
        url,
        clientId,
        publicationId,
        clientName,
        title,
        vehicle,
        extracted,
        analysis,
        aiFinalFactor,
        completion,
        rawContent: content,
      });
    } catch (saveError) {
      return res.status(200).json({
        status: "ok",
        source: "deepseek_unsaved",
        warning: saveError.message,
        extraction: buildExtractionPayload(extracted),
        analysis,
        aiFinalFactor,
        debug: {
          rawContent: content,
          usage: completion.usage || null,
          model: completion.model || null,
          aiFinalFactor,
          saved: false,
        },
      });
    }

    return res.status(200).json({
      status: "ok",
      source: "deepseek_saved",
      savedAnalysisId: savedRow?.id,
      extraction: buildExtractionPayload(extracted),
      analysis,
      aiFinalFactor,
      debug: {
        rawContent: content,
        usage: completion.usage || null,
        model: completion.model || null,
        aiFinalFactor,
        saved: true,
        savedAnalysisId: savedRow?.id,
      },
    });
  } catch (error) {
    return res.status(500).json({
      error: error.message || "Erro inesperado na função.",
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}
