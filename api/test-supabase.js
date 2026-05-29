import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl) {
      return res.status(500).json({
        ok: false,
        error: "SUPABASE_URL ausente.",
      });
    }

    if (!supabaseKey) {
      return res.status(500).json({
        ok: false,
        error: "SUPABASE_SERVICE_ROLE_KEY ausente.",
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from("ai_analyses")
      .select("id, url, created_at")
      .limit(1);

    if (error) {
      return res.status(500).json({
        ok: false,
        step: "query",
        error: error.message,
        details: error,
        supabaseUrl,
      });
    }

    return res.status(200).json({
      ok: true,
      message: "Conexão com Supabase funcionando.",
      supabaseUrl,
      rowsFound: data?.length || 0,
      data,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      step: "catch",
      error: error.message,
      cause: error.cause?.message || null,
      hasSupabaseUrl: Boolean(process.env.SUPABASE_URL),
      supabaseUrl: process.env.SUPABASE_URL || null,
      hasServiceRoleKey: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
      serviceRoleKeyLength: process.env.SUPABASE_SERVICE_ROLE_KEY?.length || 0,
    });
  }
}
