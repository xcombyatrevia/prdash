import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function emptyDashboardResponse(extra = {}) {
  return {
    ok: false,
    source: "supabase",
    clientId: null,
    client: null,
    publications: [],
    monthlyData: [],
    vehicles: [],
    rules: [],
    warnings: [],
    ...extra,
  };
}

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

function monthNameFromNumber(monthNumber) {
  const months = [
    "",
    "Janeiro",
    "Fevereiro",
    "Março",
    "Abril",
    "Maio",
    "Junho",
    "Julho",
    "Agosto",
    "Setembro",
    "Outubro",
    "Novembro",
    "Dezembro",
  ];

  return months[Number(monthNumber)] || "";
}

function mapClient(row) {
  if (!row) return null;

  return {
    id: row.id,
    nome: row.nome || row.id,
    name: row.nome || row.id,
    slug: row.slug || "",
    ativo: row.ativo === true,
    active: row.ativo === true,
    ordem: row.ordem ?? 0,
    description: row.descricao || "",
    descricao: row.descricao || "",
  };
}

function mapPublication(row) {
  const dataPublicacao = normalizeDate(row.data_publicacao);

  return {
    id: row.id,
    databaseId: row.id,
    publicationId: row.id,
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
    time: row.tempo || "",

    retorno_midia: toNumber(row.retorno_midia),
    retornoMidia: toNumber(row.retorno_midia),
    oldValuation: toNumber(row.retorno_midia),
    valuation: toNumber(row.retorno_midia),

    tipo_midia: row.tipo_midia || "",
    tipoMidia: row.tipo_midia || "",
    mediaType: row.tipo_midia || "",

    tiragem: row.tiragem || "",
    circulation: row.tiragem || "",

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
    raw: row.raw_data || row,
  };
}

function mapMonthly(row) {
  const monthNumber = Number(row.mes_numero || 0);
  const year = Number(row.ano || 0);
  const monthName = row.mes || monthNameFromNumber(monthNumber);
  const period = row.periodo || (monthName && year ? `${monthName}/${year}` : "");

  return {
    id: row.id,

    clientId: row.client_id,

    mes: monthName,
    month: monthName,
    monthName,

    mes_numero: monthNumber,
    monthNumber,

    ano: year,
    year,

    periodo: period,
    period,
    label: period || monthName,

    total_publicacoes: toNumber(row.total_publicacoes),
    publications: toNumber(row.total_publicacoes),
    totalPublications: toNumber(row.total_publicacoes),

    retorno_midia: toNumber(row.retorno_midia),
    retornoMidia: toNumber(row.retorno_midia),
    valuation: toNumber(row.retorno_midia),

    audiencia: toNumber(row.audiencia),
    audience: toNumber(row.audiencia),

    alcance: toNumber(row.alcance || row.audiencia),
    reach: toNumber(row.alcance || row.audiencia),

    rawData: row.raw_data || {},
    raw: row.raw_data || row,
  };
}

function mapVehicle(row) {
  return {
    id: row.id,

    clientId: row.client_id || null,
    isGlobal: !row.client_id,

    id_veiculo: row.id_veiculo || "",
    vehicleId: row.id_veiculo || "",

    nome: row.nome || "",
    name: row.nome || "",
    vehicle: row.nome || "",

    tipo_midia: row.tipo_midia || "",
    tipoMidia: row.tipo_midia || "",
    mediaType: row.tipo_midia || "",

    segmento: row.segmento || "",
    segment: row.segmento || "",

    praca: row.praca || "",
    market: row.praca || "",

    tier: row.tier || "",

    audiencia: toNumber(row.audiencia),
    audience: toNumber(row.audiencia),

    unique_visitors: toNumber(row.unique_visitors),
    uniqueVisitors: toNumber(row.unique_visitors),

    tiragem: row.tiragem || "",
    circulation: row.tiragem || "",

    cpm_ref: toNumber(row.cpm_ref),
    cpmRef: toNumber(row.cpm_ref),
    cpm: toNumber(row.cpm_ref),

    valor_pagina: toNumber(row.valor_pagina),
    valorPagina: toNumber(row.valor_pagina),
    pageValue: toNumber(row.valor_pagina),

    valor_cm: toNumber(row.valor_cm),
    valorCm: toNumber(row.valor_cm),
    cmValue: toNumber(row.valor_cm),

    valor_segundo: toNumber(row.valor_segundo),
    valorSegundo: toNumber(row.valor_segundo),
    value30s: toNumber(row.valor_segundo),

    regra: row.regra || "",
    rule: row.regra || "",

    fonte_data: row.fonte_data || "",
    fonteData: row.fonte_data || "",

    dados_atualizados: row.dados_atualizados || "",
    dadosAtualizados: row.dados_atualizados || "",

    ativo: row.ativo !== false,
    active: row.ativo !== false,

    rawData: row.raw_data || {},
    raw: row.raw_data || row,
  };
}

function mapRule(row) {
  return {
    id: row.id,

    clientId: row.client_id || null,
    isGlobal: !row.client_id,

    nome: row.nome || "",
    name: row.nome || "",

    tipo_midia: row.tipo_midia || "",
    tipoMidia: row.tipo_midia || "",
    mediaType: row.tipo_midia || "",

    campo_base: row.campo_base || "",
    campoBase: row.campo_base || "",
    baseField: row.campo_base || "",

    operador: row.operador || "",
    operator: row.operador || "",

    valor_base: row.valor_base || "",
    valorBase: row.valor_base || "",
    baseValue: row.valor_base || "",

    multiplicador: toNumber(row.multiplicador, 1),
    multiplier: toNumber(row.multiplicador, 1),

    descricao: row.descricao || "",
    description: row.descricao || "",

    ativo: row.ativo !== false,
    active: row.ativo !== false,

    rawData: row.raw_data || {},
    raw: row.raw_data || row,
  };
}

async function getActiveClient(clientId) {
  const { data, error } = await supabase
    .from("clientes")
    .select("id, nome, slug, ativo, ordem, descricao")
    .eq("id", clientId)
    .eq("ativo", true)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao validar cliente: ${error.message}`);
  }

  return data || null;
}

async function fetchPublications(clientId) {
  const { data, error } = await supabase
    .from("publicacoes")
    .select("*")
    .eq("client_id", clientId)
    .order("data_publicacao", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar publicações: ${error.message}`);
  }

  return (data || []).map(mapPublication);
}

async function fetchMonthlyData(clientId) {
  const { data, error } = await supabase
    .from("dados_mensais")
    .select("*")
    .eq("client_id", clientId)
    .order("ano", { ascending: true })
    .order("mes_numero", { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar dados mensais: ${error.message}`);
  }

  return (data || []).map(mapMonthly);
}

async function fetchVehicles(clientId) {
  const { data, error } = await supabase
    .from("veiculos")
    .select("*")
    .eq("ativo", true)
    .or(`client_id.eq.${clientId},client_id.is.null`)
    .order("nome", { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar veículos: ${error.message}`);
  }

  return (data || []).map(mapVehicle);
}

async function fetchRules(clientId) {
  const { data, error } = await supabase
    .from("regras_valoracao")
    .select("*")
    .eq("ativo", true)
    .or(`client_id.eq.${clientId},client_id.is.null`)
    .order("nome", { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar regras de valoração: ${error.message}`);
  }

  return (data || []).map(mapRule);
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json(
        emptyDashboardResponse({
          error: "Use GET.",
        })
      );
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json(
        emptyDashboardResponse({
          error: "Variáveis do Supabase ausentes.",
        })
      );
    }

    const clientId = String(req.query.clientId || "").trim();

    if (!clientId) {
      return res.status(400).json(
        emptyDashboardResponse({
          error: "clientId obrigatório.",
        })
      );
    }

    const client = await getActiveClient(clientId);

    if (!client) {
      return res.status(404).json(
        emptyDashboardResponse({
          clientId,
          error: "Cliente não encontrado ou inativo.",
        })
      );
    }

    const [publications, monthlyData, vehicles, rules] = await Promise.all([
      fetchPublications(clientId),
      fetchMonthlyData(clientId),
      fetchVehicles(clientId),
      fetchRules(clientId),
    ]);

    const { data: periodAnalyses, error: periodAnalysesError } = await supabase
      .from("analises_periodo")
      .select("*")
      .eq("client_id", clientId)
      .eq("status", "publicado")
      .order("ano", { ascending: false })
      .order("mes", { ascending: true });
    
    if (periodAnalysesError) {
      throw new Error(`Erro ao carregar análises do período: ${periodAnalysesError.message}`);
    }

    
    return res.status(200).json({
      ok: true,
      source: "supabase",
      clientId,
      client: mapClient(client),

      counts: {
        publications: publications.length,
        monthlyData: monthlyData.length,
        vehicles: vehicles.length,
        rules: rules.length,
      },

      publications,
      monthlyData,
      vehicles,
      rules,
      periodAnalyses: periodAnalyses || [],

      warnings: [],
    });
  } catch (error) {
    return res.status(500).json(
      emptyDashboardResponse({
        error: error.message || "Erro inesperado ao buscar dados do dashboard.",
        stack: error.stack || null,
      })
    );
  }
}
