import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey);

const ALLOWED_EDITOR_DOMAINS = ["xcom.net.br"];

function sendJson(res, status, payload) {
  return res.status(status).json(payload);
}

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeMonth(value) {
  const month = normalizeString(value);

  if (month === "all") return "all";

  const number = Number(month);

  if (!number || number < 1 || number > 12) {
    throw new Error("Mês inválido.");
  }

  return String(number).padStart(2, "0");
}

function normalizeYear(value) {
  const year = Number(value);

  if (!year || year < 2000 || year > 2100) {
    throw new Error("Ano inválido.");
  }

  return year;
}

function normalizeStatus(value) {
  const status = normalizeString(value) || "publicado";

  if (!["rascunho", "publicado", "arquivado"].includes(status)) {
    throw new Error("Status inválido.");
  }

  return status;
}

function normalizeItens(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeString(item))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split("\n")
      .map((item) => normalizeString(item.replace(/^[-•]\s*/, "")))
      .filter(Boolean);
  }

  return [];
}

async function getAuthenticatedUser(req) {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    throw new Error("Usuário não autenticado.");
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);

  if (error || !data?.user) {
    throw new Error("Sessão inválida ou expirada.");
  }

  return data.user;
}

function assertEditorUser(user) {
  const email = String(user?.email || "").toLowerCase();
  const domain = email.split("@")[1];

  if (!email || !ALLOWED_EDITOR_DOMAINS.includes(domain)) {
    throw new Error("Usuário sem permissão para editar conteúdo editorial.");
  }
}

async function savePeriodAnalysis(body) {
  const clientId = normalizeString(body.client_id || body.clientId);
  const ano = normalizeYear(body.ano || body.year);
  const mes = normalizeMonth(body.mes || body.month);

  if (!clientId) {
    throw new Error("client_id é obrigatório.");
  }

  const payload = {
    client_id: clientId,
    ano,
    mes,
    leitura_geral_titulo: normalizeString(body.leitura_geral_titulo),
    leitura_geral_texto: normalizeString(body.leitura_geral_texto),
    valoracao_titulo: normalizeString(body.valoracao_titulo),
    valoracao_texto: normalizeString(body.valoracao_texto),
    alcance_titulo: normalizeString(body.alcance_titulo),
    alcance_texto: normalizeString(body.alcance_texto),
    quali_quanti_titulo: normalizeString(body.quali_quanti_titulo),
    quali_quanti_texto: normalizeString(body.quali_quanti_texto),
    status: normalizeStatus(body.status),
  };

  const { data, error } = await supabaseAdmin
    .from("analises_periodo")
    .upsert(payload, {
      onConflict: "client_id,ano,mes",
    })
    .select("*")
    .single();

  if (error) {
    throw new Error(`Erro ao salvar análises do período: ${error.message}`);
  }

  return data;
}

async function saveMonthBlock(body) {
  const id = normalizeString(body.id);
  const clientId = normalizeString(body.client_id || body.clientId);
  const ano = normalizeYear(body.ano || body.year);
  const mes = normalizeMonth(body.mes || body.month);
  const ordem = Number(body.ordem || body.order || 1);

  if (!clientId) {
    throw new Error("client_id é obrigatório.");
  }

  if (!ordem || ordem < 1) {
    throw new Error("Ordem inválida.");
  }

  const payload = {
    client_id: clientId,
    ano,
    mes,
    ordem,
    chapeu: normalizeString(body.chapeu),
    titulo: normalizeString(body.titulo),
    itens: normalizeItens(body.itens),
    status: normalizeStatus(body.status),
  };

  if (!payload.titulo) {
    throw new Error("Título é obrigatório.");
  }

  let query;

  if (id) {
    query = supabaseAdmin
      .from("tivemos_mes_blocos")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
  } else {
    query = supabaseAdmin
      .from("tivemos_mes_blocos")
      .insert(payload)
      .select("*")
      .single();
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao salvar bloco de Tivemos no mês: ${error.message}`);
  }

  return data;
}

async function savePressHighlight(body) {
  const id = normalizeString(body.id);
  const clientId = normalizeString(body.client_id || body.clientId);
  const ano = normalizeYear(body.ano || body.year);
  const mes = normalizeMonth(body.mes || body.month);
  const tipo = normalizeString(body.tipo || body.type).toLowerCase();
  const ordem = Number(body.ordem || body.order || 1);

  if (!clientId) {
    throw new Error("client_id é obrigatório.");
  }

  if (!["principal", "secundario"].includes(tipo)) {
    throw new Error("Tipo inválido. Use principal ou secundario.");
  }

  if (!ordem || ordem < 1) {
    throw new Error("Ordem inválida.");
  }

  const payload = {
    client_id: clientId,
    ano,
    mes,
    tipo,
    ordem,
    veiculo: normalizeString(body.veiculo),
    titulo: normalizeString(body.titulo),
    comentario: normalizeString(body.comentario),
    analise_texto: normalizeString(body.analise_texto),
    data_publicacao: normalizeString(body.data_publicacao) || null,
    url: normalizeString(body.url) || null,
    status: normalizeStatus(body.status),
  };

  if (!payload.titulo) {
    throw new Error("Título é obrigatório.");
  }

  let query;

  if (id) {
    query = supabaseAdmin
      .from("destaques_imprensa")
      .update(payload)
      .eq("id", id)
      .select("*")
      .single();
  } else {
    query = supabaseAdmin
      .from("destaques_imprensa")
      .insert(payload)
      .select("*")
      .single();
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao salvar destaque de imprensa: ${error.message}`);
  }

  return data;
}

async function deleteMonthBlock(body) {
  const id = normalizeString(body.id);

  if (!id) {
    throw new Error("ID é obrigatório para excluir bloco.");
  }

  const { error } = await supabaseAdmin
    .from("tivemos_mes_blocos")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`Erro ao excluir bloco: ${error.message}`);
  }

  return { id };
}

async function deletePressHighlight(body) {
  const id = normalizeString(body.id);

  if (!id) {
    throw new Error("ID é obrigatório para excluir destaque.");
  }

  const { error } = await supabaseAdmin
    .from("destaques_imprensa")
    .delete()
    .eq("id", id);

  if (error) {
    throw new Error(`Erro ao excluir destaque: ${error.message}`);
  }

  return { id };
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return sendJson(res, 405, {
      ok: false,
      error: "Método não permitido. Use POST.",
    });
  }

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return sendJson(res, 500, {
      ok: false,
      error: "Configuração Supabase ausente no servidor.",
    });
  }

  try {
    const user = await getAuthenticatedUser(req);
    assertEditorUser(user);

    const action = normalizeString(req.query.action);
    const body = req.body || {};

    let result;

    if (action === "save-period-analysis") {
      result = await savePeriodAnalysis(body);
    } else if (action === "save-month-block") {
      result = await saveMonthBlock(body);
    } else if (action === "save-press-highlight") {
      result = await savePressHighlight(body);
    } else if (action === "delete-month-block") {
      result = await deleteMonthBlock(body);
    } else if (action === "delete-press-highlight") {
      result = await deletePressHighlight(body);
    } else {
      throw new Error("Action inválida.");
    }

    return sendJson(res, 200, {
      ok: true,
      action,
      result,
    });
  } catch (error) {
    return sendJson(res, 400, {
      ok: false,
      error: error.message || "Erro inesperado ao salvar conteúdo editorial.",
    });
  }
}
