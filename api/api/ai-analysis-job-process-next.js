import { createClient } from "@supabase/supabase-js"; 

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

function getPublicationId(publication) {
  return String(
    publication.numero_publicacao ||
      publication.numeroPublicacao ||
      publication.publication_id ||
      publication.id_publicacao ||
      publication.id ||
      ""
  ).trim();
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
  return Array.isArray(data?.evidence) && data.evidence.length > 0;
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
    .order("created_at", { ascending: true })
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

function parseRawContent(rawContent) {
  if (!rawContent) return null;

  if (typeof rawContent === "object") return rawContent;

  try {
    return JSON.parse(rawContent);
  } catch {
    return null;
  }
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
    updatePayload.started_at = now;
  }

  const { error } = await supabase
    .from("ai_analysis_jobs")
    .update(updatePayload)
    .eq("id", jobId);

  if (error) {
    throw new Error(`Erro ao atualizar contadores do job: ${error.message}`);
  }
}

export default async function handler(req, res) {
  let processingItem = null;

  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Use GET ou POST.",
      });
    }

    const input = getInput(req);

    const jobId = String(input.jobId || "").trim();
    const forceReanalyze = String(input.forceReanalyze || "false") === "true";

    if (!jobId) {
      return res.status(400).json({
        ok: false,
        error: "jobId é obrigatório.",
      });
    }

    const job = await getJob(jobId);

    if (job.status === "completed") {
      const counts = await getCounts(jobId);

      return res.status(200).json({
        ok: true,
        done: true,
        message: "Job já está completo.",
        jobId,
        counts,
      });
    }

    await releaseStaleProcessingItems(jobId);

    const pendingItem = await getNextPendingItem(jobId);

    if (!pendingItem) {
      const counts = await getCounts(jobId);
      await syncJobCounters(jobId, counts);

      return res.status(200).json({
        ok: true,
        done: true,
        message: "Não há itens pendentes para processar.",
        jobId,
        counts,
      });
    }

    processingItem = await markItemProcessing(pendingItem);

    if (!processingItem) {
      const counts = await getCounts(jobId);

      return res.status(409).json({
        ok: false,
        error: "Outro processo capturou este item antes. Tente novamente.",
        jobId,
        counts,
      });
    }

    const publication = await getPublication(processingItem.publication_id);
    const client = await getClientData(job.client_id);

    let responseData = null;
    let aiAnalysis = null;

    if (!forceReanalyze) {
      aiAnalysis = await getLatestAiAnalysis(publication.id);
      responseData = parseRawContent(aiAnalysis?.raw_content);
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
    const qualiValue = quality.validForQuali
      ? Number(calculateQualiFromAnalysis(analysis).toFixed(2))
      : null;

    const finalStatus = quality.validForQuali ? "valid" : "invalid";

    const finishedItem = await finishItem({
      item: processingItem,
      status: finalStatus,
      validForQuali: quality.validForQuali,
      reason: quality.reason,
      aiAnalysisId: aiAnalysis?.id || null,
      qualiValue,
      responseData,
    });

    const counts = await getCounts(jobId);
    await syncJobCounters(jobId, counts);

    return res.status(200).json({
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
    });
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

    return res.status(500).json({
      ok: false,
      error: error.message || "Erro inesperado ao processar próximo item da fila IA.",
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}
