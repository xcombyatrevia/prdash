import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function getInput(req) {
  return req.method === "POST" ? req.body || {} : req.query || {};
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
  const { error } = await supabase
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
    await syncJobCounters(jobId, counts);

    return res.status(200).json({
      ok: true,
      resetItems: data?.length || 0,
      counts,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "Erro inesperado ao resetar erros da fila IA.",
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}
