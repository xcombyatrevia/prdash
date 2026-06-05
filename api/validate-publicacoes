import formidable from "formidable";
import fs from "fs/promises";
import * as XLSX from "xlsx";

export const config = {
  api: {
    bodyParser: false,
  },
};

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

const OPTIONAL_FIELDS = [
  "assunto",
  "cidade",
  "uf",
  "data_insercao",
  "secao",
  "cm",
  "tempo",
  "retorno_midia",
  "tipo_midia",
  "tiragem",
  "unique_visitors",
  "audiencia",
  "tier",
  "sentimento",
  "url",
];

function normalizeText(value = "") {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeHeader(value = "") {
  return normalizeText(value)
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function isBlank(value) {
  return value === null || value === undefined || String(value).trim() === "";
}

function isBlankRow(row) {
  return row.every((cell) => isBlank(cell));
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

function normalizeRow(row, columnMap, originalHeaders, rowNumber) {
  const titulo = String(getCell(row, columnMap, "titulo") || "").trim();
  const veiculo = String(getCell(row, columnMap, "veiculo") || "").trim();
  const dataPublicacaoRaw = getCell(row, columnMap, "data_publicacao");
  const dataPublicacao = parseDate(dataPublicacaoRaw);

  const rawData = {};
  originalHeaders.forEach((header, index) => {
    if (!isBlank(header)) rawData[String(header)] = row[index] ?? "";
  });

  const normalized = {
    client_id: null,
    linha_original: rowNumber,
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
    url: String(getCell(row, columnMap, "url") || "").trim() || null,
    raw_data: rawData,
  };

  return {
    normalized,
    raw: {
      titulo,
      veiculo,
      dataPublicacaoRaw,
    },
  };
}

function incrementWarning(warningsByField, field, rowNumber, message) {
  if (!warningsByField[field]) {
    warningsByField[field] = {
      field,
      count: 0,
      examples: [],
    };
  }

  warningsByField[field].count += 1;

  if (warningsByField[field].examples.length < 5) {
    warningsByField[field].examples.push({
      row: rowNumber,
      message,
    });
  }
}

function validateWorkbook({ workbook, sheetName, clientId, clientName, fileName }) {
  const availableSheets = workbook.SheetNames || [];

  if (!sheetName || !availableSheets.includes(sheetName)) {
    return {
      ok: false,
      blocking: true,
      error: `A aba "${sheetName}" não foi encontrada.`,
      availableSheets,
    };
  }

  const worksheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    raw: true,
    defval: "",
  });

  if (!rows.length) {
    return {
      ok: false,
      blocking: true,
      error: "A aba selecionada está vazia.",
      availableSheets,
    };
  }

  const headerIndex = findHeaderRow(rows);
  const headers = rows[headerIndex] || [];
  const columnMap = buildColumnMap(headers);

  const recognizedFields = Object.keys(columnMap);
  const missingRequired = REQUIRED_FIELDS.filter((field) => columnMap[field] === undefined);
  const missingOptional = OPTIONAL_FIELDS.filter((field) => columnMap[field] === undefined);

  if (!recognizedFields.length) {
    return {
      ok: false,
      blocking: true,
      error: "Nenhuma coluna reconhecida foi encontrada.",
      availableSheets,
      columns: {
        recognized: [],
        missingRequired,
        missingOptional,
        extra: headers.filter(Boolean),
      },
    };
  }

  if (missingRequired.length) {
    return {
      ok: false,
      blocking: true,
      error: `Colunas obrigatórias ausentes: ${missingRequired.join(", ")}.`,
      availableSheets,
      columns: {
        recognized: recognizedFields,
        missingRequired,
        missingOptional,
        extra: headers
          .map((header) => String(header || "").trim())
          .filter(Boolean)
          .filter((header) => !recognizedFields.includes(normalizeHeader(header))),
      },
    };
  }

  const errors = [];
  const warningsByField = {};
  const validRows = [];
  let ignoredEmptyRows = 0;
  let rowsWithWarnings = 0;

  const dataRows = rows.slice(headerIndex + 1);

  dataRows.forEach((row, index) => {
    const rowNumber = headerIndex + index + 2;

    if (isBlankRow(row)) {
      ignoredEmptyRows += 1;
      return;
    }

    const { normalized, raw } = normalizeRow(row, columnMap, headers, rowNumber);
    normalized.client_id = clientId;

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

    if (isBlank(raw.dataPublicacaoRaw)) {
      rowErrors.push({
        row: rowNumber,
        field: "Data de Publicação",
        message: "Data de Publicação ausente.",
      });
    } else if (!normalized.data_publicacao) {
      rowErrors.push({
        row: rowNumber,
        field: "Data de Publicação",
        message: "Data de Publicação inválida.",
      });
    }

    if (rowErrors.length) {
      errors.push(...rowErrors);
      return;
    }

    let hadWarning = false;

    for (const field of OPTIONAL_FIELDS) {
      if (columnMap[field] === undefined) continue;

      const value = normalized[field];

      if (value === null || value === "") {
        incrementWarning(
          warningsByField,
          field,
          rowNumber,
          `Campo opcional "${field}" vazio.`
        );
        hadWarning = true;
      }
    }

    if (hadWarning) rowsWithWarnings += 1;

    validRows.push(normalized);
  });

  const warningsSummary = Object.values(warningsByField).sort((a, b) => b.count - a.count);

  const preview = validRows.slice(0, 10).map((row) => ({
    linha_original: row.linha_original,
    titulo: row.titulo,
    veiculo: row.veiculo,
    data_publicacao: row.data_publicacao,
    tipo_midia: row.tipo_midia,
    url: row.url,
  }));

  return {
    ok: true,
    blocking: false,
    mode: "validate",
    clientId,
    clientName,
    fileName,
    sheetName,
    availableSheets,
    summary: {
      totalRows: dataRows.length,
      validRows: validRows.length,
      ignoredEmptyRows,
      rowsWithErrors: errors.length,
      rowsWithWarnings,
    },
    columns: {
      recognized: recognizedFields,
      missingRequired,
      missingOptional,
      extra: headers
        .map((header) => String(header || "").trim())
        .filter(Boolean)
        .filter((header) => {
          const normalizedHeader = normalizeText(header);
          return !Object.values(COLUMN_ALIASES).some((aliases) =>
            aliases.some((alias) => normalizedHeader === normalizeText(alias))
          );
        }),
    },
    errors: errors.slice(0, 50),
    errorsTotal: errors.length,
    warningsSummary,
    preview,
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

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Use POST.",
      });
    }

    const { fields, files } = await parseForm(req);

    const clientId = getField(fields, "clientId", "cliente_x");
    const clientName = getField(fields, "clientName", CLIENT_OPTIONS[clientId] || "Cliente X");
    const sheetName = getField(fields, "sheetName", "").trim();
    const uploadedFile = getUploadedFile(files);

    if (!CLIENT_OPTIONS[clientId]) {
      return res.status(400).json({
        ok: false,
        error: "Cliente inválido.",
      });
    }

    if (!sheetName) {
      return res.status(400).json({
        ok: false,
        error: "Informe o nome da aba a ser importada.",
      });
    }

    if (!uploadedFile) {
      return res.status(400).json({
        ok: false,
        error: "Arquivo Excel obrigatório.",
      });
    }

    const fileName = uploadedFile.originalFilename || uploadedFile.newFilename || "arquivo.xlsx";
    const lowerName = fileName.toLowerCase();

    if (!lowerName.endsWith(".xlsx") && !lowerName.endsWith(".xls")) {
      return res.status(400).json({
        ok: false,
        error: "Envie um arquivo .xlsx ou .xls.",
      });
    }

    const fileBuffer = await fs.readFile(uploadedFile.filepath);

    const workbook = XLSX.read(fileBuffer, {
      type: "buffer",
      cellDates: true,
    });

    const validation = validateWorkbook({
      workbook,
      sheetName,
      clientId,
      clientName,
      fileName,
    });

    return res.status(validation.ok ? 200 : 400).json(validation);
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "Erro inesperado ao validar arquivo.",
    });
  }
}
