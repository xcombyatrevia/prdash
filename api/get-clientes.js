import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function mapClient(row) {
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

export default async function handler(req, res) {
  try {
    if (req.method !== "GET") {
      return res.status(405).json({
        ok: false,
        error: "Use GET.",
        clients: [],
        clientes: [],
      });
    }

    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return res.status(500).json({
        ok: false,
        error: "Variáveis do Supabase ausentes.",
        clients: [],
        clientes: [],
      });
    }

    const { data, error } = await supabase
      .from("clientes")
      .select("id, nome, slug, ativo, ordem, descricao")
      .eq("ativo", true)
      .order("ordem", { ascending: true })
      .order("nome", { ascending: true });

    if (error) {
      return res.status(500).json({
        ok: false,
        error: error.message,
        details: error,
        clients: [],
        clientes: [],
      });
    }

    const clients = (data || []).map(mapClient);

    return res.status(200).json({
      ok: true,
      source: "supabase",
      count: clients.length,
      clients,
      clientes: clients,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "Erro inesperado ao buscar clientes.",
      stack: error.stack || null,
      clients: [],
      clientes: [],
    });
  }
}
