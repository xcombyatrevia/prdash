import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PROMPT_VERSION = "reputation_v2";
const STALE_PROCESSING_MINUTES = 10;

const QUALI_WEIGHTS = {
  publicationTone: 0.25,
  brandProtagonism: 0.2,
  keyMessageAdherence: 0.2,
  brandValuesAdherence: 0.15,
  reputationalContext: 0.1,
  reputationalRisk: 0.1,
};

function getInput(req) {
  return req.method === "POST" ? req.body || {} : req.query || {};
}

function getAction(input) {
  return String(input.action || "").trim();
}

function clampScore(value) {
  const number = Number(value || 0);

  if (Number.isNaN(number)) return 0;
  if (number < 0) return 0;
  if (number > 100) return 100;

  return number;
}

function getPublicationUrl(publication) {
  return String(
    publication.url ||
      publication.link ||
      publication.link_materia ||
      publication.raw_data?.url ||
      publication.raw_data?.link ||
      ""
  ).trim();
}

function getPublicationTitle(publication) {
  return (
    publication.titulo ||
    publication.title ||
    publication.nome ||
    publication.raw_data?.titulo ||
    "Publicação sem título"
  );
}

function getPublicationVehicleName(publication) {
  return (
    publication.veiculo ||
    publication.vehicle ||
    publication.nome_veiculo ||
    publication.nomeVeiculo ||
    publication.raw_data?.veiculo ||
    ""
  );
}

function getPublicationNumber(publication) {
  return (
    publication.numero_publicacao ||
    publication.numeroPublicacao ||
    publication.raw_data?.numero_publicacao ||
    null
  );
}

function getReputationAnalysisFromResponse(data) {
  return data?.reputationAnalysis || data?.analysis || null;
}

function hasCompleteReputationAnalysis(analysis) {
  if (!analysis) return false;

  const required = [
    "publicationTone",
    "brandProtagonism",
    "keyMessageAdherence",
    "brandValuesAdherence",
    "reputationalContext",
    "reputationalRisk",
    "spokespersonPresence",
    "titleOrSubtitleMention",
  ];

  return required.every((key) => {
    const item = analysis[key];
    const score = Number(item?.score);

    return item && !Number.isNaN(score);
  });
}

function hasBrandMentionInAnalysis(analysis) {
  const text = [
    analysis?.publicationTone?.justification,
    analysis?.brandProtagonism?.justification,
    analysis?.keyMessageAdherence?.justification,
    analysis?.brandValuesAdherence?.justification,
    analysis?.reputationalContext?.justification,
    analysis?.reputationalRisk?.justification,
    analysis?.spokespersonPresence?.justification,
    analysis?.titleOrSubtitleMention?.justification,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const invalidSignals = [
    "marca não é mencionada",
    "marca nao e mencionada",
    "não menciona a marca",
    "nao menciona a marca",
    "não há menção",
    "nao ha mencao",
    "sem menção relevante",
    "sem mencao relevante",
    "não aparece",
    "nao aparece",
    "não é mencionada",
    "nao e mencionada",
  ];

  return !invalidSignals.some((signal) => text.includes(signal));
}

function hasUsableEvidence(data) {
  if (Array.isArray(data?.evidence) && data.evidence.length > 0) return true;
  if (Array.isArray(data?.raw_content?.evidence) && data.raw_content.evidence.length > 0) return true;

  return false;
}

function isTextExtractionLimited(data) {
  const text = [
    data?.summary?.overallReading,
    data?.summary?.mainRisk,
    data?.summary?.mainStrength,
    ...(Array.isArray(data?.evidence) ? data.evidence : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const limitedSignals = [
    "texto não pôde ser extraído",
    "texto nao pode ser extraido",
    "conteúdo não pôde ser extraído",
    "conteudo nao pode ser extraido",
    "pdf binário",
    "pdf binario",
    "dados binários",
    "dados binarios",
    "conteúdo ilegível",
    "conteudo ilegivel",
    "não foi possível extrair",
    "nao foi possivel extrair",
    "não pôde ser lido",
    "nao pode ser lido",
  ];

  return limitedSignals.some((signal) => text.includes(signal));
}

function classifyAiAnalysisQuality(data) {
  const analysis = getReputationAnalysisFromResponse(data);

  if (!hasCompleteReputationAnalysis(analysis)) {
    return {
      status: "incompleta",
      validForQuali: false,
      reason: "A análise não retornou os 8 indicadores completos.",
    };
  }

  if (isTextExtractionLimited(data)) {
    return {
      status: "texto_insuficiente",
      validForQuali: false,
      reason: "A análise foi baseada em texto insuficiente, ilegível ou não extraído.",
    };
  }

  if (!hasBrandMentionInAnalysis(analysis)) {
    return {
      status: "sem_mencao_marca",
      validForQuali: false,
      reason: "A análise indica que a marca não foi mencionada de forma relevante.",
    };
  }

  if (!hasUsableEvidence(data)) {
    return {
      status: "sem_evidencia",
      validForQuali: false,
      reason: "A análise não trouxe evidências literais para sustentar a leitura.",
    };
  }

  return {
    status: "valida",
    validForQuali: true,
    reason: "Análise completa e válida para cálculo do IER-Quali.",
  };
}

function calculateQualiFromAnalysis(analysis) {
  if (!hasCompleteReputationAnalysis(analysis)) return null;

  return (
    clampScore(analysis.publicationTone?.score) * QUALI_WEIGHTS.publicationTone +
    clampScore(analysis.brandProtagonism?.score) * QUALI_WEIGHTS.brandProtagonism +
    clampScore(analysis.keyMessageAdherence?.score) * QUALI_WEIGHTS.keyMessageAdherence +
    clampScore(analysis.brandValuesAdherence?.score) * QUALI_WEIGHTS.brandValuesAdherence +
    clampScore(analysis.reputationalContext?.score) * QUALI_WEIGHTS.reputationalContext +
    clampScore(analysis.reputationalRisk?.score) * QUALI_WEIGHTS.reputationalRisk
  );
}

function parseRawContent(rawContent) {
  if (!rawContent) return null;
  if (typeof rawContent === "object") return rawContent;

  try {
    return JSON.parse(rawContent);
  } catch {
    return null;
  }
}

function normalizeAiAnalysisRow(row) {
  if (!row) return null;

  const parsed = parseRawContent(row.raw_content);

  if (parsed) {
    return {
      ...parsed,
      evidence: parsed.evidence || row.evidence || [],
      aiAnalysisId: row.id,
      aiAnalysisStatus: row.status,
    };
  }

  return null;
}

async function getJob(jobId) {
  const { data, error } = await supabase
    .from("ai_analysis_jobs")
    .select("*")
    .eq("id", jobId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar job: ${error.message}`);
  }

  if (!data) {
    throw new Error("Job não encontrado.");
  }

  return data;
}

async function getClientData(clientId) {
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar cliente: ${error.message}`);
  }

  return data || null;
}

async function getCounts(jobId) {
  const { data, error } = await supabase
    .from("ai_analysis_job_items")
    .select("status")
    .eq("job_id", jobId);

  if (error) {
    throw new Error(`Erro ao contar itens do job: ${error.message}`);
  }

  const rows = data || [];

  const counts = {
    totalItems: rows.length,
    pendingItems: rows.filter((item) => item.status === "pending").length,
    processingItems: rows.filter((item) => item.status === "processing").length,
    validItems: rows.filter((item) => item.status === "valid").length,
    invalidItems: rows.filter((item) => item.status === "invalid").length,
    errorItems: rows.filter((item) => item.status === "error").length,
    skippedItems: rows.filter((item) => item.status === "skipped").length,
  };

  counts.processedItems =
    counts.validItems +
    counts.invalidItems +
    counts.errorItems +
    counts.skippedItems;

  counts.progress =
    counts.totalItems > 0
      ? Number(((counts.processedItems / counts.totalItems) * 100).toFixed(2))
      : 0;

  return counts;
}

async function syncJobCounters(jobId, counts) {
  const now = new Date().toISOString();

  const updatePayload = {
    total_items: counts.totalItems,
    processed_items: counts.processedItems,
    valid_items: counts.validItems,
    invalid_items: counts.invalidItems,
    error_items: counts.errorItems,
    updated_at: now,
  };

  if (counts.totalItems > 0 && counts.processedItems >= counts.totalItems) {
    updatePayload.status = "completed";
    updatePayload.finished_at = now;
  } else if (counts.processingItems > 0 || counts.pendingItems > 0) {
    updatePayload.status = "running";
    updatePayload.finished_at = null;
  }

  const { error } = await supabase
    .from("ai_analysis_jobs")
    .update(updatePayload)
    .eq("id", jobId);

  if (error) {
    throw new Error(`Erro ao sincronizar contadores do job: ${error.message}`);
  }
}

async function getRecentItems(jobId) {
  const { data, error } = await supabase
    .from("ai_analysis_job_items")
    .select(`
      id,
      publication_id,
      status,
      valid_for_quali,
      reason,
      attempts,
      quali_value,
      started_at,
      finished_at,
      updated_at,
      raw_data
    `)
    .eq("job_id", jobId)
    .order("updated_at", { ascending: false })
    .limit(20);

  if (error) {
    throw new Error(`Erro ao buscar itens recentes: ${error.message}`);
  }

  return data || [];
}

async function findReusableJob({ clientId, startDate, endDate }) {
  const { data, error } = await supabase
    .from("ai_analysis_jobs")
    .select("*")
    .eq("client_id", clientId)
    .eq("start_date", startDate)
    .eq("end_date", endDate)
    .eq("prompt_version", PROMPT_VERSION)
    .in("status", ["pending", "running", "paused", "error", "completed"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar job reutilizável: ${error.message}`);
  }

  return data || null;
}

async function getPublicationsForJob({ clientId, startDate, endDate }) {
  const { data, error } = await supabase
    .from("publicacoes")
    .select("id, client_id, numero_publicacao, titulo, veiculo, url, data_publicacao, raw_data")
    .eq("client_id", clientId)
    .gte("data_publicacao", startDate)
    .lte("data_publicacao", endDate)
    .order("data_publicacao", { ascending: true })
    .order("numero_publicacao", { ascending: true });

  if (error) {
    throw new Error(`Erro ao buscar publicações do recorte: ${error.message}`);
  }

  return (data || []).filter((publication) => getPublicationUrl(publication));
}

async function insertJobItems({ job, publications }) {
  if (!publications.length) return [];

  const rows = publications.map((publication) => ({
    job_id: job.id,
    publication_id: publication.id,
    client_id: job.client_id,
    status: "pending",
    valid_for_quali: null,
    reason: null,
    attempts: 0,
    ai_analysis_id: null,
    quali_value: null,
    started_at: null,
    finished_at: null,
    updated_at: new Date().toISOString(),
    raw_data: {
      url: getPublicationUrl(publication),
      title: getPublicationTitle(publication),
      vehicle: getPublicationVehicleName(publication),
      data_publicacao: publication.data_publicacao,
      numero_publicacao: getPublicationNumber(publication),
    },
  }));

  const inserted = [];

  for (let i = 0; i < rows.length; i += 300) {
    const chunk = rows.slice(i, i + 300);

    const { data, error } = await supabase
      .from("ai_analysis_job_items")
      .upsert(chunk, {
        onConflict: "job_id,publication_id",
        ignoreDuplicates: true,
      })
      .select("id");

    if (error) {
      throw new Error(`Erro ao inserir itens do job: ${error.message}`);
    }

    inserted.push(...(data || []));
  }

  return inserted;
}

async function createJobHandler(input) {
  const clientId = String(input.clientId || "").trim();
  const startDate = String(input.startDate || "").trim();
  const endDate = String(input.endDate || "").trim();
  const recreate = String(input.recreate || "false") === "true";

  if (!clientId) throw new Error("clientId é obrigatório.");
  if (!startDate) throw new Error("startDate é obrigatório.");
  if (!endDate) throw new Error("endDate é obrigatório.");

  const reusableJob = recreate
    ? null
    : await findReusableJob({ clientId, startDate, endDate });

  if (reusableJob) {
    const counts = await getCounts(reusableJob.id);
    await syncJobCounters(reusableJob.id, counts);
    const refreshedJob = await getJob(reusableJob.id);
    const recentItems = await getRecentItems(reusableJob.id);

    return {
      ok: true,
      reused: true,
      job: formatJob(refreshedJob),
      counts,
      recentItems,
    };
  }

  const publications = await getPublicationsForJob({
    clientId,
    startDate,
    endDate,
  });

  const { data: job, error: jobError } = await supabase
    .from("ai_analysis_jobs")
    .insert({
      client_id: clientId,
      start_date: startDate,
      end_date: endDate,
      status: "pending",
      total_items: publications.length,
      processed_items: 0,
      valid_items: 0,
      invalid_items: 0,
      error_items: 0,
      prompt_version: PROMPT_VERSION,
      raw_data: {
        created_by: "api/ai-analysis-job",
        action: "create",
      },
    })
    .select("*")
    .single();

  if (jobError) {
    throw new Error(`Erro ao criar job: ${jobError.message}`);
  }

  await insertJobItems({ job, publications });

  const counts = await getCounts(job.id);
  await syncJobCounters(job.id, counts);
  const refreshedJob = await getJob(job.id);
  const recentItems = await getRecentItems(job.id);

  return {
    ok: true,
    reused: false,
    job: formatJob(refreshedJob),
    counts,
    recentItems,
  };
}

function formatJob(job) {
  return {
    id: job.id,
    clientId: job.client_id,
    startDate: job.start_date,
    endDate: job.end_date,
    status: job.status,
    promptVersion: job.prompt_version,
    totalItems: job.total_items,
    processedItems: job.processed_items,
    validItems: job.valid_items,
    invalidItems: job.invalid_items,
    errorItems: job.error_items,
    createdAt: job.created_at,
    startedAt: job.started_at,
    finishedAt: job.finished_at,
    updatedAt: job.updated_at,
  };
}

async function statusHandler(input) {
  const jobId = String(input.jobId || "").trim();

  if (!jobId) {
    throw new Error("jobId é obrigatório.");
  }

  const job = await getJob(jobId);
  const counts = await getCounts(jobId);
  await syncJobCounters(jobId, counts);
  const refreshedJob = await getJob(jobId);
  const recentItems = await getRecentItems(jobId);

  return {
    ok: true,
    job: formatJob(refreshedJob),
    counts,
    recentItems,
  };
}

async function releaseStaleProcessingItems(jobId) {
  const cutoff = new Date(Date.now() - STALE_PROCESSING_MINUTES * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("ai_analysis_job_items")
    .update({
      status: "pending",
      reason: "Item voltou para pendente após processamento travado.",
      updated_at: new Date().toISOString(),
    })
    .eq("job_id", jobId)
    .eq("status", "processing")
    .lt("updated_at", cutoff);

  if (error) {
    throw new Error(`Erro ao liberar itens travados: ${error.message}`);
  }
}

async function getNextPendingItem(jobId) {
  const { data, error } = await supabase
    .from("ai_analysis_job_items")
    .select("*")
    .eq("job_id", jobId)
    .eq("status", "pending")
    .order("updated_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar próximo item pendente: ${error.message}`);
  }

  return data || null;
}

async function markItemProcessing(item) {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("ai_analysis_job_items")
    .update({
      status: "processing",
      attempts: Number(item.attempts || 0) + 1,
      started_at: item.started_at || now,
      updated_at: now,
      reason: null,
    })
    .eq("id", item.id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao marcar item como processing: ${error.message}`);
  }

  return data || null;
}

async function getPublication(publicationId) {
  const { data, error } = await supabase
    .from("publicacoes")
    .select("*")
    .eq("id", publicationId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar publicação: ${error.message}`);
  }

  if (!data) {
    throw new Error("Publicação não encontrada.");
  }

  return data;
}

async function getLatestAiAnalysis(publicationId) {
  const { data, error } = await supabase
    .from("ai_analyses")
    .select("id, publication_id, status, raw_content, evidence, created_at, updated_at")
    .eq("publication_id", String(publicationId))
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar análise IA em cache: ${error.message}`);
  }

  return data || null;
}

async function analyzePublicationThroughApi({
  req,
  publication,
  client,
  clientId,
  forceReanalyze,
}) {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;

  if (!host) {
    throw new Error("Host não encontrado para chamar /api/analyze-publication.");
  }

  const baseUrl = process.env.PUBLIC_APP_URL || `${protocol}://${host}`;

  const response = await fetch(`${baseUrl}/api/analyze-publication`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: getPublicationUrl(publication),
      clientId,
      publicationId: String(publication.id),
      clientName: client?.nome || client?.name || clientId,
      title: getPublicationTitle(publication),
      vehicle: getPublicationVehicleName(publication),
      forceReanalyze: Boolean(forceReanalyze),
    }),
  });

  const text = await response.text();

  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      error: "A API de análise não retornou JSON válido.",
      rawResponse: text,
    };
  }

  if (!response.ok) {
    throw new Error(data.error || data.message || `Erro HTTP ${response.status} na análise.`);
  }

  return data;
}

async function finishItem({
  item,
  status,
  validForQuali,
  reason,
  aiAnalysisId,
  qualiValue,
  responseData,
}) {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("ai_analysis_job_items")
    .update({
      status,
      valid_for_quali: validForQuali,
      reason,
      ai_analysis_id: aiAnalysisId || null,
      quali_value: qualiValue,
      finished_at: now,
      updated_at: now,
      raw_data: {
        ...(item.raw_data || {}),
        status_processamento: status,
        valid_for_quali: validForQuali,
        reason,
        ai_analysis_id: aiAnalysisId || null,
        quali_value: qualiValue,
        source: responseData?.source || null,
        summary: responseData?.summary || null,
        evidence_count: Array.isArray(responseData?.evidence) ? responseData.evidence.length : 0,
      },
    })
    .eq("id", item.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Erro ao finalizar item: ${error.message}`);
  }

  return data;
}

async function markItemError({ item, reason }) {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("ai_analysis_job_items")
    .update({
      status: "error",
      valid_for_quali: false,
      reason,
      finished_at: now,
      updated_at: now,
      raw_data: {
        ...(item.raw_data || {}),
        status_processamento: "error",
        valid_for_quali: false,
        reason,
      },
    })
    .eq("id", item.id)
    .select("*")
    .single();

  if (error) {
    throw new Error(`Erro ao marcar item como erro: ${error.message}`);
  }

  return data;
}

async function processNextHandler({ req, input }) {
  let processingItem = null;

  try {
    const jobId = String(input.jobId || "").trim();
    const forceReanalyze = String(input.forceReanalyze || "false") === "true";

    if (!jobId) {
      throw new Error("jobId é obrigatório.");
    }

    const job = await getJob(jobId);

    if (job.status === "completed") {
      const counts = await getCounts(jobId);

      return {
        ok: true,
        done: true,
        message: "Job já está completo.",
        jobId,
        counts,
      };
    }

    await releaseStaleProcessingItems(jobId);

    const pendingItem = await getNextPendingItem(jobId);

    if (!pendingItem) {
      const counts = await getCounts(jobId);
      await syncJobCounters(jobId, counts);

      return {
        ok: true,
        done: true,
        message: "Não há itens pendentes para processar.",
        jobId,
        counts,
      };
    }

    processingItem = await markItemProcessing(pendingItem);

    if (!processingItem) {
      const counts = await getCounts(jobId);

      return {
        ok: false,
        conflict: true,
        error: "Outro processo capturou este item antes. Tente novamente.",
        jobId,
        counts,
      };
    }

    const publication = await getPublication(processingItem.publication_id);
    const client = await getClientData(job.client_id);

    let responseData = null;
    let aiAnalysis = null;

    if (!forceReanalyze) {
      aiAnalysis = await getLatestAiAnalysis(publication.id);
      responseData = normalizeAiAnalysisRow(aiAnalysis);
    }

    if (!responseData) {
      responseData = await analyzePublicationThroughApi({
        req,
        publication,
        client,
        clientId: job.client_id,
        forceReanalyze,
      });

      aiAnalysis = await getLatestAiAnalysis(publication.id);
    }

    const analysis = getReputationAnalysisFromResponse(responseData);
    const quality = classifyAiAnalysisQuality(responseData);

    const qualiRaw = quality.validForQuali
      ? calculateQualiFromAnalysis(analysis)
      : null;

    const qualiValue =
      qualiRaw === null || qualiRaw === undefined
        ? null
        : Number(qualiRaw.toFixed(2));

    const finalStatus = quality.validForQuali ? "valid" : "invalid";

    const finishedItem = await finishItem({
      item: processingItem,
      status: finalStatus,
      validForQuali: quality.validForQuali,
      reason: quality.reason,
      aiAnalysisId: aiAnalysis?.id || responseData?.aiAnalysisId || null,
      qualiValue,
      responseData,
    });

    const counts = await getCounts(jobId);
    await syncJobCounters(jobId, counts);

    return {
      ok: true,
      done: false,
      jobId,
      processedItem: {
        id: finishedItem.id,
        publicationId: finishedItem.publication_id,
        status: finishedItem.status,
        validForQuali: finishedItem.valid_for_quali,
        reason: finishedItem.reason,
        attempts: finishedItem.attempts,
        qualiValue: finishedItem.quali_value,
        title: finishedItem.raw_data?.title,
        vehicle: finishedItem.raw_data?.vehicle,
        url: finishedItem.raw_data?.url,
      },
      counts,
    };
  } catch (error) {
    if (processingItem?.id) {
      try {
        await markItemError({
          item: processingItem,
          reason: error.message || "Erro inesperado ao processar item.",
        });
      } catch {
        // evita mascarar o erro original
      }
    }

    throw error;
  }
}

async function resetErrorsHandler(input) {
  const jobId = String(input.jobId || "").trim();

  if (!jobId) {
    throw new Error("jobId é obrigatório.");
  }

  const { data, error } = await supabase
    .from("ai_analysis_job_items")
    .update({
      status: "pending",
      valid_for_quali: null,
      reason: null,
      ai_analysis_id: null,
      quali_value: null,
      started_at: null,
      finished_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("job_id", jobId)
    .eq("status", "error")
    .select("id");

  if (error) {
    throw new Error(`Erro ao resetar itens com erro: ${error.message}`);
  }

  const counts = await getCounts(jobId);

  await supabase
    .from("ai_analysis_jobs")
    .update({
      status: "running",
      total_items: counts.totalItems,
      processed_items: counts.processedItems,
      valid_items: counts.validItems,
      invalid_items: counts.invalidItems,
      error_items: counts.errorItems,
      finished_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  return {
    ok: true,
    resetItems: data?.length || 0,
    counts,
  };
}

export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Use GET ou POST.",
      });
    }

    const input = getInput(req);
    const action = getAction(input);

    if (!action) {
      return res.status(400).json({
        ok: false,
        error: "Informe action=create, action=status, action=process-next ou action=reset-errors.",
      });
    }

    let result;

    if (action === "create") {
      result = await createJobHandler(input);
    } else if (action === "status") {
      result = await statusHandler(input);
    } else if (action === "process-next") {
      result = await processNextHandler({ req, input });
    } else if (action === "reset-errors") {
      result = await resetErrorsHandler(input);
    } else {
      return res.status(400).json({
        ok: false,
        error: `Action inválida: ${action}. Use create, status, process-next ou reset-errors.`,
      });
    }

    if (result?.conflict) {
      return res.status(409).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "Erro inesperado no endpoint ai-analysis-job.",
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}
