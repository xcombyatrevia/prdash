import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getInput(req) {
  return req.method === "POST" ? req.body || {} : req.query || {};
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

async function getCounts(jobId) {
  const { data, error } = await supabase
    .from("ai_analysis_job_items")
    .select("status, valid_for_quali")
    .eq("job_id", jobId);

  if (error) {
    throw new Error(`Erro ao buscar itens do job: ${error.message}`);
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

async function syncJobCounters(jobId, counts) {
  let statusUpdate = null;

  if (counts.totalItems > 0 && counts.processedItems >= counts.totalItems) {
    statusUpdate = "completed";
  }

  const updatePayload = {
    total_items: counts.totalItems,
    processed_items: counts.processedItems,
    valid_items: counts.validItems,
    invalid_items: counts.invalidItems,
    error_items: counts.errorItems,
    updated_at: new Date().toISOString(),
  };

  if (statusUpdate) {
    updatePayload.status = statusUpdate;
    updatePayload.finished_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from("ai_analysis_jobs")
    .update(updatePayload)
    .eq("id", jobId);

  if (error) {
    throw new Error(`Erro ao sincronizar contadores do job: ${error.message}`);
  }
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
    const jobId = String(input.jobId || "").trim();

    if (!jobId) {
      return res.status(400).json({
        ok: false,
        error: "jobId é obrigatório.",
      });
    }

    const job = await getJob(jobId);
    const counts = await getCounts(jobId);

    await syncJobCounters(jobId, counts);

    const refreshedJob = await getJob(jobId);
    const recentItems = await getRecentItems(jobId);

    return res.status(200).json({
      ok: true,
      job: {
        id: refreshedJob.id,
        clientId: refreshedJob.client_id,
        startDate: refreshedJob.start_date,
        endDate: refreshedJob.end_date,
        status: refreshedJob.status,
        promptVersion: refreshedJob.prompt_version,
        totalItems: refreshedJob.total_items,
        processedItems: refreshedJob.processed_items,
        validItems: refreshedJob.valid_items,
        invalidItems: refreshedJob.invalid_items,
        errorItems: refreshedJob.error_items,
        createdAt: refreshedJob.created_at,
        startedAt: refreshedJob.started_at,
        finishedAt: refreshedJob.finished_at,
        updatedAt: refreshedJob.updated_at,
      },
      counts,
      recentItems,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "Erro inesperado ao consultar status da fila IA.",
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}
