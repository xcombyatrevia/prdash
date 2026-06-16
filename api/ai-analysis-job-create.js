import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const PROMPT_VERSION = "reputation_v2";

function getInput(req) {
  return req.method === "POST" ? req.body || {} : req.query || {};
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

function getPublicationVehicle(publication) {
  return (
    publication.veiculo ||
    publication.vehicle ||
    publication.nome_veiculo ||
    publication.nomeVeiculo ||
    publication.raw_data?.veiculo ||
    ""
  );
}

async function findReusableJob({ clientId, startDate, endDate }) {
  const { data, error } = await supabase
    .from("ai_analysis_jobs")
    .select("*")
    .eq("client_id", clientId)
    .eq("start_date", startDate)
    .eq("end_date", endDate)
    .eq("prompt_version", PROMPT_VERSION)
    .in("status", ["pending", "running", "paused", "error"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar job existente: ${error.message}`);
  }

  return data || null;
}

async function getJobCounts(jobId) {
  const { data, error } = await supabase
    .from("ai_analysis_job_items")
    .select("status")
    .eq("job_id", jobId);

  if (error) {
    throw new Error(`Erro ao contar itens do job: ${error.message}`);
  }

  const rows = data || [];

  return {
    totalItems: rows.length,
    processedItems: rows.filter((item) =>
      ["valid", "invalid", "error", "skipped"].includes(item.status)
    ).length,
    validItems: rows.filter((item) => item.status === "valid").length,
    invalidItems: rows.filter((item) => item.status === "invalid").length,
    errorItems: rows.filter((item) => item.status === "error").length,
    pendingItems: rows.filter((item) => item.status === "pending").length,
    processingItems: rows.filter((item) => item.status === "processing").length,
  };
}

async function syncJobCounters(jobId) {
  const counts = await getJobCounts(jobId);

  const { error } = await supabase
    .from("ai_analysis_jobs")
    .update({
      total_items: counts.totalItems,
      processed_items: counts.processedItems,
      valid_items: counts.validItems,
      invalid_items: counts.invalidItems,
      error_items: counts.errorItems,
      updated_at: new Date().toISOString(),
    })
    .eq("id", jobId);

  if (error) {
    throw new Error(`Erro ao atualizar contadores do job: ${error.message}`);
  }

  return counts;
}

async function chunkInsertItems(items, chunkSize = 300) {
  let inserted = 0;

  for (let index = 0; index < items.length; index += chunkSize) {
    const chunk = items.slice(index, index + chunkSize);

    const { data, error } = await supabase
      .from("ai_analysis_job_items")
      .upsert(chunk, {
        onConflict: "job_id,publication_id",
        ignoreDuplicates: true,
      })
      .select("id");

    if (error) {
      throw new Error(`Erro ao inserir itens da fila: ${error.message}`);
    }

    inserted += data?.length || 0;
  }

  return inserted;
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

    const clientId = String(input.clientId || "").trim();
    const startDate = String(input.startDate || "").trim();
    const endDate = String(input.endDate || "").trim();
    const recreate = String(input.recreate || "false") === "true";

    if (!clientId) {
      return res.status(400).json({
        ok: false,
        error: "clientId é obrigatório.",
      });
    }

    if (!startDate || !endDate) {
      return res.status(400).json({
        ok: false,
        error: "startDate e endDate são obrigatórios.",
      });
    }

    if (!recreate) {
      const existingJob = await findReusableJob({
        clientId,
        startDate,
        endDate,
      });

      if (existingJob) {
        const counts = await syncJobCounters(existingJob.id);

        return res.status(200).json({
          ok: true,
          reused: true,
          job: {
            id: existingJob.id,
            clientId: existingJob.client_id,
            startDate: existingJob.start_date,
            endDate: existingJob.end_date,
            status: existingJob.status,
            promptVersion: existingJob.prompt_version,
            createdAt: existingJob.created_at,
            updatedAt: existingJob.updated_at,
          },
          counts,
        });
      }
    }

    const { data: publications, error: publicationsError } = await supabase
      .from("publicacoes")
      .select("id, client_id, numero_publicacao, titulo, veiculo, url, data_publicacao, raw_data")
      .eq("client_id", clientId)
      .gte("data_publicacao", startDate)
      .lte("data_publicacao", endDate)
      .order("data_publicacao", { ascending: true });

    if (publicationsError) {
      throw new Error(`Erro ao buscar publicações do recorte: ${publicationsError.message}`);
    }

    const publicationsWithUrl = (publications || []).filter((publication) =>
      getPublicationUrl(publication)
    );

    const { data: job, error: jobError } = await supabase
      .from("ai_analysis_jobs")
      .insert({
        client_id: clientId,
        start_date: startDate,
        end_date: endDate,
        status: "pending",
        total_items: publicationsWithUrl.length,
        processed_items: 0,
        valid_items: 0,
        invalid_items: 0,
        error_items: 0,
        prompt_version: PROMPT_VERSION,
        raw_data: {
          origem: "criação de fila de análise IA",
          total_publications_in_cut: publications?.length || 0,
          publications_with_url: publicationsWithUrl.length,
        },
      })
      .select("*")
      .single();

    if (jobError) {
      throw new Error(`Erro ao criar job de análise: ${jobError.message}`);
    }

    const items = publicationsWithUrl.map((publication) => ({
      job_id: job.id,
      publication_id: publication.id,
      client_id: clientId,
      status: "pending",
      attempts: 0,
      raw_data: {
        numero_publicacao: publication.numero_publicacao || null,
        title: getPublicationTitle(publication),
        vehicle: getPublicationVehicle(publication),
        url: getPublicationUrl(publication),
        data_publicacao: publication.data_publicacao || null,
      },
    }));

    const insertedItems = await chunkInsertItems(items);
    const counts = await syncJobCounters(job.id);

    return res.status(200).json({
      ok: true,
      reused: false,
      job: {
        id: job.id,
        clientId: job.client_id,
        startDate: job.start_date,
        endDate: job.end_date,
        status: job.status,
        promptVersion: job.prompt_version,
        createdAt: job.created_at,
        updatedAt: job.updated_at,
      },
      summary: {
        totalPublicationsInCut: publications?.length || 0,
        publicationsWithUrl: publicationsWithUrl.length,
        insertedItems,
      },
      counts,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "Erro inesperado ao criar fila de análise IA.",
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}
