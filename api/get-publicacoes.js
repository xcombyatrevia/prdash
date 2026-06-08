import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CLIENT_OPTIONS = {
  cliente_x: "Cliente X",
  cliente_y: "Cliente Y",
  cliente_z: "Cliente Z",
  cliente_u: "Cliente U",
  cliente_v: "Cliente V",
};

function toNumber(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeDate(value) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toISOString().slice(0, 10);
}

function formatDateBR(value) {
  if (!value) return "";

  const normalized = normalizeDate(value);

  if (!normalized || !normalized.includes("-")) {
    return normalized;
  }

  const [year, month, day] = normalized.split("-");

  return `${day}/${month}/${year}`;
}

function mapPublication(row) {
  const dataPublicacao = normalizeDate(row.data_publicacao);

  return {
    id: row.id,
    databaseId: row.id,
    numeroPublicacao: row.numero_publicacao,

    clientId: row.client_id,

    titulo: row.titulo || "",
    title: row.titulo || "",

    veiculo: row.veiculo || "",
    vehicle: row.veiculo || "",

    assunto: row.assunto || "",
    subject: row.assunto || "",

    cidade: row.cidade || "",
    city: row.cidade || "",

    uf: row.uf || "",
    state: row.uf || "",

    data_publicacao: dataPublicacao,
    dataPublicacao,
    publicationDate: dataPublicacao,
    publicationDateBR: formatDateBR(row.data_publicacao),

    data_insercao: normalizeDate(row.data_insercao),
    insertionDate: normalizeDate(row.data_insercao),

    secao: row.secao || "",
    section: row.secao || "",

    cm: toNumber(row.cm),
    centimetragem: toNumber(row.cm),

    tempo: row.tempo || "",
    duration: row.tempo || "",

    retorno_midia: toNumber(row.retorno_midia),
    retornoMidia: toNumber(row.retorno_midia),
    valuation: toNumber(row.retorno_midia),

    tipo_midia: row.tipo_midia || "",
    tipoMidia: row.tipo_midia || "",
    mediaType: row.tipo_midia || "",

    tiragem: row.tiragem || "",

    unique_visitors: toNumber(row.unique_visitors),
    uniqueVisitors: toNumber(row.unique_visitors),

    audiencia: toNumber(row.audiencia),
    audience: toNumber(row.audiencia),
    alcance: toNumber(row.audiencia),

    tier: row.tier || "",

    sentimento: row.sentimento || "",
    sentiment: row.sentimento || "",

    url: row.url || "",
    link: row.url || "",

    origem_arquivo: row.origem_arquivo || "",
    linha_original: row.linha_original || null,

    rawData: row.raw_data || {},
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({
        ok: false,
        error: "Use GET.",
      });
    }

    const clientId = String(req.query.clientId || "cliente_x").trim();

    if (!CLIENT_OPTIONS[clientId]) {
      return res.status(400).json({
        ok: false,
        error: "Cliente inválido.",
      });
    }

    const { data, error } = await supabase
      .from("publicacoes")
      .select("*")
      .eq("client_id", clientId)
      .order("data_publicacao", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      return res.status(500).json({
        ok: false,
        error: error.message,
        details: error,
      });
    }

    const publications = (data || []).map(mapPublication);

    return res.status(200).json({
      ok: true,
      source: "supabase",
      clientId,
      count: publications.length,
      publications,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "Erro inesperado ao buscar publicações.",
      stack: error.stack || null,
    });
  }
}
