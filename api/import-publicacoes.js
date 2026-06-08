import formidable from "formidable";
import fs from "fs/promises";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: false,
  },
};

function parseForm(req) {
  const form = formidable({
    multiples: false,
    keepExtensions: true,
    maxFileSize: 20 * 1024 * 1024,
  });

  return new Promise((resolve, reject) => {
    form.parse(req, (error, fields, files) => {
      if (error) reject(error);
      else resolve({ fields, files });
    });
  });
}

function getField(fields, name, fallback = "") {
  const value = fields[name];
  if (Array.isArray(value)) return value[0] ?? fallback;
  return value ?? fallback;
}

function getUploadedFile(files) {
  const file = files.file || files.excel || files.upload;
  if (Array.isArray(file)) return file[0];
  return file;
}

export default async function handler(req, res) {
  const steps = [];

  try {
    steps.push("handler_started");

    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Use POST.",
        steps,
      });
    }

    steps.push("method_ok");

    const supabaseUrl = process.env.SUPABASE_URL || "";
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

    steps.push("env_checked");

    if (!supabaseUrl) {
      return res.status(500).json({
        ok: false,
        error: "SUPABASE_URL ausente.",
        steps,
      });
    }

    if (!supabaseKey) {
      return res.status(500).json({
        ok: false,
        error: "SUPABASE_SERVICE_ROLE_KEY ausente.",
        steps,
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    steps.push("supabase_client_created");

    const { fields, files } = await parseForm(req);

    steps.push("form_parsed");

    const clientId = getField(fields, "clientId", "cliente_x");
    const clientName = getField(fields, "clientName", "Cliente X");
    const sheetName = getField(fields, "sheetName", "").trim();
    const confirm = getField(fields, "confirm", "false");
    const uploadedFile = getUploadedFile(files);

    steps.push("fields_read");

    if (!uploadedFile) {
      return res.status(400).json({
        ok: false,
        error: "Arquivo Excel obrigatório.",
        steps,
        receivedFields: fields,
        receivedFileKeys: Object.keys(files || {}),
      });
    }

    const fileName =
      uploadedFile.originalFilename ||
      uploadedFile.newFilename ||
      "arquivo.xlsx";

    steps.push("file_found");

    const fileBuffer = await fs.readFile(uploadedFile.filepath);

    steps.push("file_read");

    const workbook = XLSX.read(fileBuffer, {
      type: "buffer",
      cellDates: true,
    });

    steps.push("workbook_read");

    const availableSheets = workbook.SheetNames || [];

    if (!sheetName || !availableSheets.includes(sheetName)) {
      return res.status(400).json({
        ok: false,
        error: `A aba "${sheetName}" não foi encontrada.`,
        availableSheets,
        steps,
      });
    }

    steps.push("sheet_found");

    const worksheet = workbook.Sheets[sheetName];

    const rows = XLSX.utils.sheet_to_json(worksheet, {
      header: 1,
      raw: true,
      defval: "",
    });

    steps.push("rows_read");

    const { data, error } = await supabase
      .from("publicacoes")
      .select("id")
      .limit(1);

    steps.push("supabase_test_query_done");

    if (error) {
      return res.status(500).json({
        ok: false,
        error: `Erro ao consultar publicacoes: ${error.message}`,
        details: error,
        steps,
      });
    }

    return res.status(200).json({
      ok: true,
      status: "diagnostico_importacao_ok",
      message: "A rota recebeu o arquivo, leu o Excel e consultou o Supabase.",
      steps,
      clientId,
      clientName,
      sheetName,
      confirm,
      fileName,
      fileSize: uploadedFile.size,
      availableSheets,
      totalRowsInSheet: rows.length,
      supabaseRowsFound: data?.length || 0,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "Erro inesperado no diagnóstico de importação.",
      stack: error.stack || null,
      steps,
    });
  }
}
