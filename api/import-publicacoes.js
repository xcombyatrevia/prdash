import formidable from "formidable";
import fs from "fs/promises";
import * as XLSX from "xlsx";
import { createClient } from "@supabase/supabase-js";

export const config = {
  api: {
    bodyParser: false,
  },
};

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const CLIENT_OPTIONS = {
  cliente_x: "Cliente X",
  cliente_y: "Cliente Y",
  cliente_z: "Cliente Z",
  cliente_u: "Cliente U",
  cliente_v: "Cliente V",
};

const COLUMN_ALIASES = {
  titulo: ["titulo", "título", "title", "materia", "matéria"],
  veiculo: ["veiculo", "veículo", "vehicle"],
  assunto: ["assunto", "tema", "subject"],
  cidade: ["cidade", "city"],
  uf: ["uf", "estado", "state"],
  data_publicacao: [
    "data de publicacao",
    "data de publicação",
    "data publicacao",
    "data publicação",
    "publicacao",
    "publicação",
    "data",
  ],
  data_insercao: [
    "data de insercao",
    "data de inserção",
    "data insercao",
    "data inserção",
  ],
  secao: ["secao", "seção", "editoria", "section"],
  cm: ["cm", "centimetragem", "centimetragem cm", "cm coluna"],
  tempo: ["tempo", "duracao", "duração"],
  retorno_midia: [
    "retorno de midia",
    "retorno de mídia",
    "valoracao",
    "valoração",
    "valorizacao",
    "valorização",
    "valor",
  ],
  tipo_midia: [
    "tipo de midia",
    "tipo de mídia",
    "tipo midia",
    "tipo mídia",
    "tipo_midia",
    "canal",
    "tipo",
  ],
  tiragem: ["tiragem"],
  unique_visitors: [
    "unique visitors",
    "uniquevisitors",
    "visitantes unicos",
    "visitantes únicos",
  ],
  audiencia: ["audiencia", "audiência", "alcance", "pessoas impactadas"],
  tier: ["tier"],
  sentimento: ["sentimento", "sentiment"],
  url: ["url", "link", "link da materia", "link da matéria"],
};

const REQUIRED_FIELDS = ["titulo", "veiculo", "data_publicacao"];

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function isBlankRow(row) {
  return row.every((cell) => isBlank(cell));
}

function normalizeUrl(value) {
  const url = String(value || "").trim();
  return url || null;
}

function parseNumber(value) {
  if (typeof value === "number") return value;
  if (isBlank(value)) return null;

  let raw = String(value).trim();

  raw = raw
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/[^\d,.-]/g, "");

  if (!raw) return null;

  const hasComma = raw.includes(",");
  const hasDot = raw.includes(".");

  if (hasComma && hasDot) {
    raw = raw.replace(/\./g, "").replace(",", ".");
  } else if (hasComma) {
    raw = raw.replace(",", ".");
  } else if ((raw.match(/\./g) || []).length > 1) {
    raw = raw.replace(/\./g, "");
  }

  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseInteger(value) {
  const parsed = parseNumber(value);
  if (parsed === null) return null;
  return Math.round(parsed);
}

function excelSerialToDate(serial) {
  const utcDays = Math.floor(serial - 25569);
  const utcValue = utcDays * 86400;
  const date = new Date(utcValue * 1000);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toISODate(date) {
  if (!date || Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function parseDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return toISODate(value);
  }

  if (typeof value === "number" && value > 25000 && value < 80000) {
    return toISODate(excelSerialToDate(value));
  }

  if (isBlank(value)) return null;

  const raw = String(value).trim().split(" ")[0];
  const delimiter = ["/", "-", "."].find((item) => raw.includes(item));

  if (delimiter) {
    const parts = raw.split(delimiter).map((part) => Number(part));

    if (parts.length >= 3 && parts.every((part) => Number.isFinite(part))) {
      if (String(raw.split(delimiter)[0]).length === 4) {
        return toISODate(new Date(parts[0], parts[1] - 1, parts[2]));
      }

      const day = parts[0];
      const month = parts[1];
      const year = parts[2] < 100 ? 2000 + parts[2] : parts[2];

      return toISODate(new Date(year, month - 1, day));
    }
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : toISODate(date);
}

function findHeaderRow(rows) {
  let bestIndex = 0;
  let bestScore = 0;

  rows.slice(0, 20).forEach((row, index) => {
    const normalizedCells = row.map((cell) => normalizeText(cell));
    let score = 0;

    Object.values(COLUMN_ALIASES).forEach((aliases) => {
      if (aliases.some((alias) => normalizedCells.includes(normalizeText(alias)))) {
        score += 1;
      }
    });

    if (score > bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  });

  return bestIndex;
}

function buildColumnMap(headerRow) {
  const columnMap = {};
  const normalizedHeaders = headerRow.map((header) => normalizeText(header));

  for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
    const aliasIndex = normalizedHeaders.findIndex((header) =>
      aliases.some((alias) => header === normalizeText(alias))
    );

    if (aliasIndex >= 0) {
      columnMap[field] = aliasIndex;
    }
  }

  return columnMap;
}

function getCell(row, columnMap, field) {
  const index = columnMap[field];
  if (index === undefined) return "";
  return row[index] ?? "";
}

function getCellHyperlink(worksheet, rowNumber, columnIndex) {
  if (!worksheet) return null;
  if (columnIndex === undefined || columnIndex === null) return null;

  const cellAddress = XLSX.utils.encode_cell({
    r: rowNumber - 1,
    c: columnIndex,
  });

  const cell = worksheet[cellAddress];

  if (!cell || !cell.l) return null;

  const target = cell.l.Target || cell.l.target || "";
  return String(target || "").trim() || null;
}

function getUrlFromRow(row, columnMap, worksheet, rowNumber) {
  const explicitUrl = String(getCell(row, columnMap, "url") || "").trim();

  if (explicitUrl) {
    return explicitUrl;
  }

  const titleColumnIndex = columnMap.titulo;
  const titleHyperlink = getCellHyperlink(worksheet, rowNumber, titleColumnIndex);

  return titleHyperlink || null;
}

function sanitizeJsonValue(value) {
  if (value instanceof Date) return value.toISOString();
  if (value === undefined) return null;
  if (Number.isNaN(value)) return null;
  return value;
}

function normalizeRow(row, columnMap, originalHeaders, rowNumber, clientId, origemArquivo, worksheet) {
  const titulo = String(getCell(row, columnMap, "titulo") || "").trim();
  const veiculo = String(getCell(row, columnMap, "veiculo") || "").trim();
  const dataPublicacaoRaw = getCell(row, columnMap, "data_publicacao");
  const dataPublicacao = parseDate(dataPublicacaoRaw);

  const rawData = {};
  originalHeaders.forEach((header, index) => {
    if (!isBlank(header)) {
      rawData[String(header)] = sanitizeJsonValue(row[index] ?? "");
    }
  });

  const url = normalizeUrl(getUrlFromRow(row, columnMap, worksheet, rowNumber));

  return {
    client_id: clientId,
    titulo,
    veiculo,
    assunto: String(getCell(row, columnMap, "assunto") || "").trim() || null,
    cidade: String(getCell(row, columnMap, "cidade") || "").trim() || null,
    uf: String(getCell(row, columnMap, "uf") || "").trim() || null,
    data_publicacao: dataPublicacao,
    data_insercao: parseDate(getCell(row, columnMap, "data_insercao")),
    secao: String(getCell(row, columnMap, "secao") || "").trim() || null,
    cm: parseNumber(getCell(row, columnMap, "cm")),
    tempo: String(getCell(row, columnMap, "tempo") || "").trim() || null,
    retorno_midia: parseNumber(getCell(row, columnMap, "retorno_midia")),
    tipo_midia: String(getCell(row, columnMap, "tipo_midia") || "").trim() || null,
    tiragem: String(getCell(row, columnMap, "tiragem") || "").trim() || null,
    unique_visitors: parseInteger(getCell(row, columnMap, "unique_visitors")),
    audiencia: parseInteger(getCell(row, columnMap, "audiencia")),
    tier: String(getCell(row, columnMap, "tier") || "").trim() || null,
    sentimento: String(getCell(row, columnMap, "sentimento") || "").trim() || null,
    url,
    origem_arquivo: origemArquivo,
    linha_original: rowNumber,
    raw_data: rawData,
  };
}

function validateAndNormalizeWorkbook({ workbook, sheetName, clientId, fileName }) {
  const availableSheets = workbook.SheetNames || [];

  if (!sheetName || !availableSheets.includes(sheetName)) {
    return {
      ok: false,
      error: `A aba "${sheetName}" não foi encontrada.`,
      availableSheets,
      rows: [],
    };
  }

  const worksheet = workbook.Sheets[sheetName];
  const allRows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: true,
    defval: "",
  });

  if (!allRows.length) {
    return {
      ok: false,
      error: "A aba selecionada está vazia.",
      availableSheets,
      rows: [],
    };
  }

  const headerIndex = findHeaderRow(allRows);
  const headers = allRows[headerIndex] || [];
  const columnMap = buildColumnMap(headers);

  const missingRequired = REQUIRED_FIELDS.filter(
    (field) => columnMap[field] === undefined
  );

  if (missingRequired.length) {
    return {
      ok: false,
      error: `Colunas obrigatórias ausentes: ${missingRequired.join(", ")}.`,
      availableSheets,
      rows: [],
      recognizedFields: Object.keys(columnMap),
    };
  }

  const dataRows = allRows.slice(headerIndex + 1);
  const validRows = [];
  const errors = [];
  let ignoredEmptyRows = 0;
  let rowsWithExplicitUrl = 0;
  let rowsWithUrlFromTitle = 0;
  let rowsWithoutUrl = 0;

  dataRows.forEach((row, index) => {
    const rowNumber = headerIndex + index + 2;

    if (isBlankRow(row)) {
      ignoredEmptyRows += 1;
      return;
    }

    const explicitUrl = String(getCell(row, columnMap, "url") || "").trim();
    const titleHyperlink = getCellHyperlink(worksheet, rowNumber, columnMap.titulo);

    const normalized = normalizeRow(
      row,
      columnMap,
      headers,
      rowNumber,
      clientId,
      fileName,
      worksheet
    );

    const rowErrors = [];

    if (!normalized.titulo) {
      rowErrors.push({
        row: rowNumber,
        field: "Título",
        message: "Título ausente.",
      });
    }

    if (!normalized.veiculo) {
      rowErrors.push({
        row: rowNumber,
        field: "Veículo",
        message: "Veículo ausente.",
      });
    }

    if (!normalized.data_publicacao) {
      rowErrors.push({
        row: rowNumber,
        field: "Data de Publicação",
        message: "Data de Publicação ausente ou inválida.",
      });
    }

    if (rowErrors.length) {
      errors.push(...rowErrors);
      return;
    }

    if (normalized.url && explicitUrl) rowsWithExplicitUrl += 1;
    else if (normalized.url && titleHyperlink) rowsWithUrlFromTitle += 1;
    else rowsWithoutUrl += 1;

    validRows.push(normalized);
  });

  return {
    ok: true,
    availableSheets,
    headerIndex,
    totalRows: dataRows.length,
    validRowsCount: validRows.length,
    ignoredEmptyRows,
    errors,
    rows: validRows,
    recognizedFields: Object.keys(columnMap),
    urlStats: {
      rowsWithExplicitUrl,
      rowsWithUrlFromTitle,
      rowsWithoutUrl,
    },
  };
}

async function parseForm(req) {
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

function chunkArray(items, size) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function findExistingByUrls(clientId, urls) {
  const uniqueUrls = Array.from(new Set(urls.filter(Boolean)));

  if (!uniqueUrls.length) return new Map();

  const existingMap = new Map();
  const chunks = chunkArray(uniqueUrls, 100);

  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from("publicacoes")
      .select("id, url")
      .eq("client_id", clientId)
      .in("url", chunk);

    if (error) {
      throw new Error(`Erro ao buscar duplicidades por URL: ${error.message}`);
    }

    for (const item of data || []) {
      if (item.url) existingMap.set(item.url, item.id);
    }
  }

  return existingMap;
}

async function insertRowsInBatches(rows) {
  let inserted = 0;
  const errors = [];
  const chunks = chunkArray(rows, 50);

  for (const chunk of chunks) {
    const { error } = await supabase
      .from("publicacoes")
      .insert(chunk);

    if (error) {
      errors.push({
        operation: "insert",
        rows: chunk.map((row) => row.linha_original),
        error: error.message,
        details: error,
      });
    } else {
      inserted += chunk.length;
    }
  }

  return { inserted, errors };
}

async function updateRowsIndividually(rowsWithIds) {
  let updated = 0;
  const errors = [];

  for (const item of rowsWithIds) {
    const { id, row } = item;

    const { error } = await supabase
      .from("publicacoes")
      .update(row)
      .eq("id", id);

    if (error) {
      errors.push({
        operation: "update",
        row: row.linha_original,
        title: row.titulo,
        url: row.url,
        error: error.message,
        details: error,
      });
    } else {
      updated += 1;
    }
  }

  return { updated, errors };
}

async function saveImportHistory({
  clientId,
  clientName,
  fileName,
  sheetName,
  validation,
  imported,
  updated,
  ignored,
  importErrors,
}) {
  const payload = {
    client_id: clientId,
    client_name: clientName,
    arquivo_nome: fileName,
    aba_nome: sheetName,
    linhas_lidas: validation.totalRows || 0,
    linhas_validas: validation.validRowsCount || 0,
    linhas_com_alerta: 0,
    linhas_com_erro: validation.errors?.length || 0,
    linhas_importadas: imported,
    linhas_atualizadas: updated,
    linhas_ignoradas: ignored,
    status: importErrors.length ? "importado_com_erros" : "importado",
    erros: importErrors || [],
    alertas: [],
    resumo: {
      totalRows: validation.totalRows || 0,
      validRows: validation.validRowsCount || 0,
      ignoredEmptyRows: validation.ignoredEmptyRows || 0,
      validationErrors: validation.errors?.length || 0,
      urlStats: validation.urlStats || {},
    },
  };

  const { data, error } = await supabase
    .from("importacoes")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    return {
      saved: false,
      error: error.message,
      id: null,
    };
  }

  return {
    saved: true,
    error: null,
    id: data?.id || null,
  };
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

    const { fields, files } = await parseForm(req);
    steps.push("form_parsed");

    const clientId = getField(fields, "clientId", "cliente_x");
    const clientName = getField(fields, "clientName", CLIENT_OPTIONS[clientId] || "Cliente X");
    const sheetName = getField(fields, "sheetName", "").trim();
    const confirm = getField(fields, "confirm", "false") === "true";
    const uploadedFile = getUploadedFile(files);

    steps.push("fields_read");

    if (!CLIENT_OPTIONS[clientId]) {
      return res.status(400).json({
        ok: false,
        error: "Cliente inválido.",
        steps,
      });
    }

    if (!sheetName) {
      return res.status(400).json({
        ok: false,
        error: "Informe o nome da aba a ser importada.",
        steps,
      });
    }

    if (!confirm) {
      return res.status(400).json({
        ok: false,
        error: "Importação não confirmada.",
        steps,
      });
    }

    if (!uploadedFile) {
      return res.status(400).json({
        ok: false,
        error: "Arquivo Excel obrigatório.",
        steps,
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

    const validation = validateAndNormalizeWorkbook({
      workbook,
      sheetName,
      clientId,
      fileName,
    });

    steps.push("validated");

    if (!validation.ok) {
      return res.status(400).json({
        ok: false,
        error: validation.error || "Arquivo inválido.",
        validation,
        steps,
      });
    }

    const rows = validation.rows;
    const urls = rows.map((row) => row.url).filter(Boolean);

    steps.push("dedupe_started");

    const existingByUrl = await findExistingByUrls(clientId, urls);

    steps.push("dedupe_finished");

    const rowsToUpdate = [];
    const rowsToInsert = [];

    for (const row of rows) {
      if (row.url && existingByUrl.has(row.url)) {
        rowsToUpdate.push({
          id: existingByUrl.get(row.url),
          row,
        });
      } else {
        rowsToInsert.push(row);
      }
    }

    steps.push("rows_split");

    const insertResult = await insertRowsInBatches(rowsToInsert);

    steps.push("insert_finished");

    const updateResult = await updateRowsIndividually(rowsToUpdate);

    steps.push("update_finished");

    const importErrors = [
      ...insertResult.errors,
      ...updateResult.errors,
    ];

    const imported = insertResult.inserted;
    const updated = updateResult.updated;
    const ignored = importErrors.reduce((sum, error) => {
      if (Array.isArray(error.rows)) return sum + error.rows.length;
      return sum + 1;
    }, 0);

    const history = await saveImportHistory({
      clientId,
      clientName,
      fileName,
      sheetName,
      validation,
      imported,
      updated,
      ignored,
      importErrors,
    });

    steps.push("history_saved_attempted");

    return res.status(importErrors.length ? 207 : 200).json({
      ok: importErrors.length === 0,
      status: importErrors.length ? "importado_com_erros" : "importado",
      message: importErrors.length
        ? "Importação concluída com erros em algumas linhas/lotes."
        : "Importação concluída com sucesso.",
      steps,
      clientId,
      clientName,
      sheetName,
      fileName,
      importId: history.id,
      history,
      summary: {
        totalRows: validation.totalRows,
        validRows: validation.validRowsCount,
        validationErrors: validation.errors.length,
        ignoredEmptyRows: validation.ignoredEmptyRows,
        imported,
        updated,
        ignored,
        importErrors: importErrors.length,
        rowsWithExplicitUrl: validation.urlStats.rowsWithExplicitUrl,
        rowsWithUrlFromTitle: validation.urlStats.rowsWithUrlFromTitle,
        rowsWithoutUrl: validation.urlStats.rowsWithoutUrl,
      },
      recognizedFields: validation.recognizedFields,
      validationErrors: validation.errors.slice(0, 20),
      importErrors: importErrors.slice(0, 20),
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "Erro inesperado ao importar publicações.",
      stack: error.stack || null,
      steps,
    });
  }
}
