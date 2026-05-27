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
  const $ = cheerio.load(html);

  $("script, style, nav, footer, header, iframe, noscript").remove();

  const title =
    cleanText($("h1").first().text()) ||
    cleanText($("title").first().text());

  const paragraphs = [];

  $("article p, main p, .content p, .materia p, p").each((_, el) => {
    const text = cleanText($(el).text());
    if (text.length > 40) paragraphs.push(text);
  });

  const body = paragraphs.join("\n\n");

  return {
    title,
    body,
    textLength: body.length,
    preview: body.slice(0, 700),
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
