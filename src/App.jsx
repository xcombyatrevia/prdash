import React, { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  ComposedChart,
  LabelList,
} from "recharts";
import {
  Calendar,
  Home,
  TrendingUp,
  PieChart as PieIcon,
  Megaphone,
  Layers,
  BarChart3,
  FileText,
  Settings,
  Newspaper,
  Coins,
  Users,
  ClipboardList,
  Sparkles,
  Target,
  Globe2,
  RefreshCw,
  AlertCircle,
  Wand2,
  Database,
  Upload,
  CheckCircle,
  XCircle,
} from "lucide-react";

const supabaseBrowser = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
);

const SHEET_ID = "1wFL7LF1Q-GdsATZoACaTSl2SxCdVXZYPGN7veHYHBVY";
const PUBLICATIONS_SHEET = "CLIENTEX";
const MONTHLY_SHEET = "CLIENTEXMENSAIS";

const VALUATION_SHEET_ID = "1cZCdW-1In741SBo8ZjaJijy6GIXEJVAj";
const VEHICLES_SHEET = "Veiculos";
const RULES_SHEET = "Regras";

const CLIENT_OPTIONS = [
  { id: "cliente_x", name: "Cliente X" },
  { id: "cliente_y", name: "Cliente Y" },
  { id: "cliente_z", name: "Cliente Z" },
  { id: "cliente_u", name: "Cliente U" },
  { id: "cliente_v", name: "Cliente V" },
];

const COLORS = ["#3758ff", "#05080f", "#c9d40b", "#70d6c9", "#facc15"];

const valuationDefaults = {
  presence: 0.6,
  destaque: "Sem destaque",
  destaqueFactor: 1,
  protagonismo: "Médio",
  protagonismoFactor: 0.6,
  tom: "Neutro",
  tomFactor: 0.5,
};

const FALLBACK_MONTHLY = [
  { sortKey: "2025-03", month: "Mar/25", publications: 412, mediaValue: 11.6, reach: 26.6 },
  { sortKey: "2025-04", month: "Abr/25", publications: 445, mediaValue: 17.8, reach: 27.1 },
  { sortKey: "2025-05", month: "Mai/25", publications: 253, mediaValue: 13.1, reach: 21.4 },
  { sortKey: "2025-06", month: "Jun/25", publications: 337, mediaValue: 3.7, reach: 25.0 },
  { sortKey: "2025-07", month: "Jul/25", publications: 198, mediaValue: 7.6, reach: 20.0 },
  { sortKey: "2025-08", month: "Ago/25", publications: 625, mediaValue: 78.7, reach: 113.0 },
  { sortKey: "2025-09", month: "Set/25", publications: 164, mediaValue: 11.6, reach: 40.4 },
  { sortKey: "2025-10", month: "Out/25", publications: 298, mediaValue: 12.9, reach: 17.9 },
  { sortKey: "2025-11", month: "Nov/25", publications: 299, mediaValue: 21.3, reach: 26.4 },
  { sortKey: "2025-12", month: "Dez/25", publications: 156, mediaValue: 6.0, reach: 12.7 },
  { sortKey: "2026-01", month: "Jan/26", publications: 165, mediaValue: 3.3, reach: 15.7 },
  { sortKey: "2026-02", month: "Fev/26", publications: 167, mediaValue: 6.6, reach: 16.6 },
  { sortKey: "2026-03", month: "Mar/26", publications: 444, mediaValue: 22.8, reach: 41.2 },
];

const monthNames = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const MONTH_FILTER_OPTIONS = [
  { value: "01", label: "Janeiro" },
  { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" },
  { value: "04", label: "Abril" },
  { value: "05", label: "Maio" },
  { value: "06", label: "Junho" },
  { value: "07", label: "Julho" },
  { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
  { value: "all", label: "Todos" },
];

function getYearFromDateInput(dateString) {
  const year = Number(String(dateString || "").slice(0, 4));
  return year || new Date().getFullYear();
}

function getMonthFromDateInput(dateString) {
  const month = String(dateString || "").slice(5, 7);
  return month || String(new Date().getMonth() + 1).padStart(2, "0");
}

function getDateRangeFromMonthYear(year, month) {
  const numericYear = Number(year) || new Date().getFullYear();

  if (month === "all") {
    return {
      startDate: `${numericYear}-01-01`,
      endDate: `${numericYear}-12-31`,
    };
  }

  const monthIndex = Number(month) - 1;

  const start = new Date(numericYear, monthIndex, 1);
  const end = new Date(numericYear, monthIndex + 1, 0);

  return {
    startDate: toInputDate(start),
    endDate: toInputDate(end),
  };
}

function removeAccents(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function normalizeKey(value) {
  return removeAccents(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function normalizeVehicleName(name) {
  return removeAccents(name).toLowerCase().trim();
}

function csvUrl(sheetName, spreadsheetId = SHEET_ID) {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(
    sheetName
  )}&cacheBust=${Date.now()}`;
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      field += '"';
      i += 1;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((cell) => String(cell).trim() !== "")) rows.push(row);
  return rows;
}

function findHeaderIndex(rows) {
  const index = rows.findIndex((row) => {
    const keys = row.map((cell) => normalizeKey(cell));
    return (
      keys.includes("data_de_publicacao") ||
      keys.includes("titulo") ||
      keys.includes("veiculo") ||
      keys.includes("ano") ||
      keys.includes("mes") ||
      keys.includes("publicacoes")
    );
  });

  return Math.max(0, index);
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const headerIndex = findHeaderIndex(rows);
  const headers = rows[headerIndex].map((header) => normalizeKey(header));

  return rows.slice(headerIndex + 1).map((row) => {
    const object = {};
    headers.forEach((header, index) => {
      if (header) object[header] = row[index] ?? "";
    });
    return object;
  });
}

function parseNumber(value) {
  if (typeof value === "number") return value;

  const raw = String(value ?? "").trim();
  if (!raw) return 0;

  let cleaned = "";
  for (const char of raw) {
    if ((char >= "0" && char <= "9") || char === "," || char === "." || char === "-") {
      cleaned += char;
    }
  }

  if (!cleaned) return 0;

  const negative = cleaned.startsWith("-");
  if (negative) cleaned = cleaned.slice(1);

  const commaCount = cleaned.split(",").length - 1;
  const dotCount = cleaned.split(".").length - 1;

  if (commaCount && dotCount) {
    cleaned = cleaned.split(".").join("").replace(",", ".");
  } else if (commaCount) {
    cleaned = cleaned.replace(",", ".");
  } else if (dotCount > 1) {
    cleaned = cleaned.split(".").join("");
  } else if (dotCount === 1) {
    const [before, after] = cleaned.split(".");
    if (after?.length === 3 && before.length <= 3) cleaned = `${before}${after}`;
  }

  const number = Number(cleaned) || 0;
  return negative ? -number : number;
}

function parseDate(value) {
  if (!value && value !== 0) return null;

  const asNumber = Number(value);
  if (!Number.isNaN(asNumber) && asNumber > 25000 && asNumber < 80000) {
    const utcDays = Math.floor(asNumber - 25569);
    return new Date(utcDays * 86400 * 1000);
  }

  const raw = String(value).trim().split(" ")[0];
  if (!raw) return null;

  const delimiter = ["/", "-", "."].find((item) => raw.includes(item));

  if (delimiter) {
    const textParts = raw.split(delimiter);
    const parts = textParts.map((part) => Number(part));

    if (parts.length >= 3 && parts.every((part) => !Number.isNaN(part))) {
      if (String(textParts[0]).length === 4) {
        return new Date(parts[0], parts[1] - 1, parts[2]);
      }

      const a = parts[0];
      const b = parts[1];
      const year = parts[2] < 100 ? 2000 + parts[2] : parts[2];

      if (b > 12 && a <= 12) return new Date(year, a - 1, b);
      if (a > 12 && b <= 12) return new Date(year, b - 1, a);

      return new Date(year, b - 1, a);
    }
  }

  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : date;
}

function toInputDate(date) {
  if (!date) return "";
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function getPreviousMonthRange(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0);

  return {
    startDate: toInputDate(start),
    endDate: toInputDate(end),
  };
}


function getMonthRangeFromDate(date) {
  if (!date || Number.isNaN(date.getTime())) {
    return getPreviousMonthRange();
  }

  const year = date.getFullYear();
  const month = date.getMonth();

  const start = new Date(year, month, 1);
  const end = new Date(year, month + 1, 0);

  return {
    startDate: toInputDate(start),
    endDate: toInputDate(end),
  };
}

function getLatestPublicationMonthRange(publications) {
  const validDates = publications
    .map((publication) => publication.publicationDate)
    .filter((date) => date instanceof Date && !Number.isNaN(date.getTime()));

  if (!validDates.length) {
    return getPreviousMonthRange();
  }

  const latestDate = validDates.reduce((latest, current) => {
    return current > latest ? current : latest;
  }, validDates[0]);

  return getMonthRangeFromDate(latestDate);
}

function getValue(row, keys) {
  for (const key of keys) {
    const normalized = normalizeKey(key);
    if (row[normalized] !== undefined && row[normalized] !== "") return row[normalized];
  }
  return "";
}

function normalizePublication(row, index) {
  const publicationDate = parseDate(
    getValue(row, ["Data de Publicação", "Data Publicação", "Data Publicacao", "Publicação", "Publicacao", "Data"])
  );

  return {
    id: index + 1,
    publicationId:
      String(
        getValue(row, [
          "id_publicacao",
          "ID Publicacao",
          "ID Publicação",
          "Id Publicacao",
          "Id Publicação",
          "publication_id",
          "Publication ID",
        ]) || ""
      ).trim() || `row_${index + 1}`,
    title:
      getValue(row, ["Título", "Titulo", "Nome", "Matéria", "Materia", "Chamada"]) ||
      `Publicação ${index + 1}`,
    vehicle: getValue(row, ["Veículo", "Veiculo", "Mídia", "Midia"]) || "Veículo não informado",
    subject: getValue(row, ["Assunto", "Tema", "Temas", "Editoria", "Seção", "Secao"]) || "Sem assunto",
    city: getValue(row, ["Cidade"]),
    uf: getValue(row, ["UF", "Estado"]) || "ND",
    publicationDate,
    insertionDate: parseDate(getValue(row, ["Data de Inserção", "Data Inserção", "Data Insercao"])),
    section: getValue(row, ["Seção", "Secao"]),
    cm: parseNumber(
      getValue(row, [
        "Cm",
        "CM",
        "Centimetragem",
        "Centimetragem cm",
        "Centimetragem/Coluna",
        "CM Coluna",
        "Cm Coluna",
      ])
    ),
    time: getValue(row, ["Tempo", "Duração", "Duracao"]),
    oldValuation: parseNumber(
      getValue(row, [
        "Retorno de mídia",
        "Retorno de Midia",
        "Valoração",
        "Valoracao",
        "Valorização",
        "Valorizacao",
        "Valor",
      ])
    ),
    mediaType: getValue(row, ["Tipo de mídia", "Tipo de midia", "Tipo_Midia", "Tipo Midia", "Tipo", "Canal"]) || "Não informado",
    circulation: getValue(row, ["Tiragem"]),
    uniqueVisitors: parseNumber(getValue(row, ["Unique Visitors", "UniqueVisitors", "Visitantes únicos", "Visitantes Unicos"])),
    audience: parseNumber(getValue(row, ["Audiência", "Audiencia", "Alcance", "Pessoas impactadas"])),
    tier: getValue(row, ["Tier"]) || "ND",
    url: String(getValue(row, ["url", "URL", "Url", "Link", "Link da matéria", "Link da Materia"]) || "").trim(),
    raw: row,
  };
}

function normalizeSupabasePublication(row, index) {
  return {
    id: row.id || index + 1,
    databaseId: row.databaseId || row.id || "",
    numeroPublicacao: row.numeroPublicacao || row.numero_publicacao || null,

    publicationId:
      String(
        row.publicationId ||
          row.databaseId ||
          row.id ||
          row.numeroPublicacao ||
          row.numero_publicacao ||
          ""
      ).trim() || `supabase_${index + 1}`,

    title:
      row.title ||
      row.titulo ||
      `Publicação ${index + 1}`,

    vehicle:
      row.vehicle ||
      row.veiculo ||
      "Veículo não informado",

    subject:
      row.subject ||
      row.assunto ||
      "Sem assunto",

    city:
      row.city ||
      row.cidade ||
      "",

    uf:
      row.uf ||
      row.state ||
      row.estado ||
      "ND",

    publicationDate: parseDate(
      row.publicationDate ||
        row.dataPublicacao ||
        row.data_publicacao
    ),

    insertionDate: parseDate(
      row.insertionDate ||
        row.data_insercao
    ),

    section:
      row.section ||
      row.secao ||
      "",

    cm: parseNumber(
      row.cm ||
        row.centimetragem
    ),

    time:
      row.time ||
      row.tempo ||
      row.duration ||
      "",

    oldValuation: parseNumber(
      row.oldValuation ||
        row.retorno_midia ||
        row.retornoMidia ||
        row.valuation
    ),

    mediaType:
      row.mediaType ||
      row.tipoMidia ||
      row.tipo_midia ||
      "Não informado",

    circulation:
      row.circulation ||
      row.tiragem ||
      "",

    uniqueVisitors: parseNumber(
      row.uniqueVisitors ||
        row.unique_visitors
    ),

    audience: parseNumber(
      row.audience ||
        row.audiencia ||
        row.alcance
    ),

    tier:
      row.tier ||
      "ND",

    sentiment:
      row.sentiment ||
      row.sentimento ||
      "",

    url:
      String(row.url || row.link || "").trim(),

    raw:
      row.rawData ||
      row.raw_data ||
      row,
  };
}



function normalizeMonthly(row) {
  const year = parseNumber(getValue(row, ["Ano", "Year"]));
  const monthNumber = parseNumber(getValue(row, ["Mês", "Mes", "Month"]));
  const publications = parseNumber(getValue(row, ["Publicações", "Publicacoes", "Publications"]));
  const valuationRaw = parseNumber(
    getValue(row, ["Valoração", "Valoracao", "Valorização", "Valorizacao", "Retorno de mídia", "Retorno de Midia"])
  );
  const reachRaw = parseNumber(getValue(row, ["Alcance", "Audiência", "Audiencia", "Reach"]));

  if (!year || !monthNumber) return null;

  return {
    sortKey: `${year}-${String(monthNumber).padStart(2, "0")}`,
    month: `${monthNames[monthNumber - 1] || monthNumber}/${String(year).slice(-2)}`,
    year,
    monthNumber,
    publications,
    mediaValue: valuationRaw / 1000000,
    reach: reachRaw / 1000000,
  };
}

function normalizeSupabaseMonthly(row) {
  const year = parseNumber(row.year || row.ano);
  const monthNumber = parseNumber(row.monthNumber || row.mes_numero);

  if (!year || !monthNumber) return null;

  const publications = parseNumber(
    row.publications ||
      row.totalPublications ||
      row.total_publicacoes
  );

  const valuationRaw = parseNumber(
    row.valuation ||
      row.retornoMidia ||
      row.retorno_midia
  );

  const reachRaw = parseNumber(
    row.reach ||
      row.alcance ||
      row.audience ||
      row.audiencia
  );

  return {
    sortKey: `${year}-${String(monthNumber).padStart(2, "0")}`,
    month: `${monthNames[monthNumber - 1] || monthNumber}/${String(year).slice(-2)}`,
    year,
    monthNumber,
    publications,
    mediaValue: valuationRaw / 1000000,
    reach: reachRaw / 1000000,
  };
}


function buildMonthlyWindowFromPeriod(monthlyData, selectedYear, selectedMonth) {
  const numericYear = Number(selectedYear) || new Date().getFullYear();

  const monthlyMap = new Map();

  monthlyData.forEach((item) => {
    if (item?.sortKey) {
      monthlyMap.set(item.sortKey, item);
    }
  });

  const result = [];

  if (selectedMonth === "all") {
    for (let month = 1; month <= 12; month += 1) {
      const sortKey = `${numericYear}-${String(month).padStart(2, "0")}`;
      const existing = monthlyMap.get(sortKey);

      result.push(
        existing || {
          sortKey,
          month: `${monthNames[month - 1] || month}/${String(numericYear).slice(-2)}`,
          year: numericYear,
          monthNumber: month,
          publications: 0,
          mediaValue: 0,
          reach: 0,
        }
      );
    }

    return result;
  }

  const selectedMonthNumber = Number(selectedMonth) || new Date().getMonth() + 1;
  const endDate = new Date(numericYear, selectedMonthNumber - 1, 1);

  for (let index = 11; index >= 0; index -= 1) {
    const date = new Date(endDate.getFullYear(), endDate.getMonth() - index, 1);
    const year = date.getFullYear();
    const monthNumber = date.getMonth() + 1;
    const sortKey = `${year}-${String(monthNumber).padStart(2, "0")}`;
    const existing = monthlyMap.get(sortKey);

    result.push(
      existing || {
        sortKey,
        month: `${monthNames[monthNumber - 1] || monthNumber}/${String(year).slice(-2)}`,
        year,
        monthNumber,
        publications: 0,
        mediaValue: 0,
        reach: 0,
      }
    );
  }

  return result;
}




function normalizeVehicle(row) {
  const vehicle =
    row.vehicle ||
    row.name ||
    row.nome ||
    getValue(row, ["Veiculo", "Veículo", "Nome", "Nome do Veículo", "Nome do Veiculo"]);

  if (!vehicle) return null;

  return {
    id:
      row.id ||
      row.vehicleId ||
      row.id_veiculo ||
      getValue(row, ["ID_Veiculo", "ID Veiculo", "Id", "ID"]),

    vehicle,

    mediaType:
      row.mediaType ||
      row.tipoMidia ||
      row.tipo_midia ||
      getValue(row, ["Tipo_Midia", "Tipo Midia", "Tipo de mídia", "Tipo de midia", "Tipo"]),

    segment:
      row.segment ||
      row.segmento ||
      getValue(row, ["Segmento"]),

    market:
      row.market ||
      row.praca ||
      getValue(row, ["Praca", "Praça", "Cidade", "UF"]),

    tier:
      row.tier ||
      getValue(row, ["Tier"]),

    audience: parseNumber(
      row.audience ||
        row.audiencia ||
        getValue(row, ["Audiencia_Estimada", "Audiência Estimada", "Audiencia Estimada", "Audiencia", "Audiência", "Alcance"])
    ),

    cpm: parseNumber(
      row.cpm ||
        row.cpmRef ||
        row.cpm_ref ||
        getValue(row, ["CPM_Ref", "CPM Ref", "CPM", "Cpm"])
    ),

    pageValue: parseNumber(
      row.pageValue ||
        row.valorPagina ||
        row.valor_pagina ||
        getValue(row, ["Valor_Pagina", "Valor Página", "Valor Pagina", "Valor de página", "Valor de pagina"])
    ),

    cmValue: parseNumber(
      row.cmValue ||
        row.valorCm ||
        row.valor_cm ||
        getValue(row, ["Valor_CM_Coluna", "Valor CM Coluna", "Valor_CM", "Valor CM", "Valor cm/coluna"])
    ),

    value30s: parseNumber(
      row.value30s ||
        row.valorSegundo ||
        row.valor_segundo ||
        getValue(row, ["Valor_30s", "Valor 30s", "Valor 30 segundos", "Valor_30"])
    ),

    updated:
      row.dadosAtualizados ||
      row.dados_atualizados ||
      row.updated ||
      getValue(row, ["Dados atualizados", "Dados Atualizados", "Atualizado"]),

    raw: row.rawData || row.raw || row,
  };
}

function buildVehicleIndex(vehicles) {
  return vehicles.reduce((acc, vehicle) => {
    acc[normalizeVehicleName(vehicle.vehicle)] = vehicle;
    return acc;
  }, {});
}

function canonicalMediaType(value) {
  const normalized = normalizeKey(value);

  if (
    [
      "online",
      "sites_e_portais",
      "jornais_online",
      "blog",
      "blogs",
      "podcast",
      "newsletter",
      "outro",
      "outros",
    ].includes(normalized)
  ) {
    return "digital";
  }

  if (["impresso", "jornal", "jornais", "revista", "revistas"].includes(normalized)) return "impresso";
  if (["tv", "televisao"].includes(normalized)) return "tv";
  if (["radio"].includes(normalized)) return "radio";

  return normalized || "nao_informado";
}

function calculateValuation(publication, vehicleIndex, aiAnalysis = null) {
  const vehicle = vehicleIndex[normalizeVehicleName(publication.vehicle)];
  const mediaType = publication.mediaType || vehicle?.mediaType || "Não informado";
  const type = canonicalMediaType(mediaType);
  const publicationReach = publication.audience || publication.uniqueVisitors || 0;
  const vehicleReach = vehicle?.audience || 0;

  let baseValue = 0;
  let source = "";
  let status = "Calculado";

  if (!vehicle) {
    status = "Veículo não encontrado";
    source = "Sem correspondência na tabela veiculos";
  } else if (type === "digital") {
    const reach = publicationReach || vehicleReach;

    if (reach && vehicle.cpm) {
      baseValue = (reach / 1000) * vehicle.cpm;
      source = publicationReach
        ? "Audiência/Unique Visitors da clipagem x CPM_Ref"
        : "Audiência estimada do veículo x CPM_Ref";
    } else {
      status = "Dados insuficientes";
      source = "Falta audiência/alcance ou CPM_Ref";
    }
  } else if (type === "impresso") {
    if (publication.cm && vehicle.cmValue) {
      baseValue = publication.cm * vehicle.cmValue;
      source = "Centimetragem x Valor_CM_Coluna";
    } else if (vehicle.pageValue) {
      baseValue = vehicle.pageValue;
      source = "Valor_Pagina do veículo usado por ausência de Cm";
      status = "Calculado · página padrão";
    } else {
      status = "Dados insuficientes";
      source = "Falta Cm/Valor_CM_Coluna ou Valor_Pagina";
    }
  } else if (type === "tv" || type === "radio") {
    if (vehicle.value30s) {
      baseValue = vehicle.value30s;
      source = "Valor_30s do veículo usado como referência inicial";
      status = "Calculado · 30s padrão";
    } else {
      status = "Dados insuficientes";
      source = "Falta duração da inserção ou Valor_30s";
    }
  } else {
    status = "Dados insuficientes";
    source = "Tipo de mídia sem regra aplicável";
  }

  const factor = aiAnalysis
    ? aiAnalysis.presence.factor *
      aiAnalysis.highlight.factor *
      aiAnalysis.protagonism.factor *
      aiAnalysis.tone.factor
    : valuationDefaults.presence *
      valuationDefaults.destaqueFactor *
      valuationDefaults.protagonismoFactor *
      valuationDefaults.tomFactor;

  const canCalculate =
    status === "Calculado" ||
    status === "Calculado · página padrão" ||
    status === "Calculado · 30s padrão";

  const newValuation = canCalculate ? baseValue * factor : 0;

  return {
    baseValue,
    newValuation,
    status: aiAnalysis && canCalculate ? "Calculado com IA" : status,
    detail: canCalculate
      ? `${source} · fator ${factor.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}`
      : source,
    vehicleData: vehicle || null,
  };
}

function groupRows(rows, keyGetter, valueGetter = () => 1, limit = 10) {
  const map = new Map();

  rows.forEach((row) => {
    const name = keyGetter(row) || "Não informado";
    const value = valueGetter(row) || 0;
    map.set(name, (map.get(name) || 0) + value);
  });

  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, limit);
}

function groupChannels(rows) {
  const map = new Map();

  rows.forEach((row) => {
    const name = row.mediaType || "Não informado";
    const current = map.get(name) || { name, publications: 0, value: 0 };
    current.publications += 1;
    current.value += row.oldValuation || 0;
    map.set(name, current);
  });

  return Array.from(map.values()).sort((a, b) => b.publications - a.publications);
}

function groupTiers(rows) {
  const total = rows.length || 1;

  return groupRows(rows, (row) => row.tier || "ND")
    .map((item) => ({
      name: item.name,
      value: Math.round((item.value / total) * 100),
      count: item.value,
    }))
    .slice(0, 6);
}

function brl(value) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function compactBRL(value) {
  const number = Number(value || 0);
  if (number >= 1000000) return `R$ ${(number / 1000000).toFixed(1).replace(".", ",")} M`;
  if (number >= 1000) return `R$ ${(number / 1000).toFixed(1).replace(".", ",")} mil`;
  return brl(number);
}

function compactNumber(value) {
  const number = Number(value || 0);
  if (number >= 1000000) return `${(number / 1000000).toFixed(1).replace(".", ",")} M`;
  if (number >= 1000) return `${(number / 1000).toFixed(1).replace(".", ",")} mil`;
  return number.toLocaleString("pt-BR");
}

function formatBRLMillionsLabel(value) {
  return `R$ ${Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} M`;
}

function formatMillionsLabel(value) {
  return `${Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })} M`;
}

const navGroups = [
  [
    [Home, "Visão Geral"],
    [Calendar, "Tivemos no mês"],
    [Target, "Principal resultado"],
    [Newspaper, "Destaques na Imprensa"],
    [ClipboardList, "Próximos passos"],
  ],
  [
    [Database, "Gestão de Dados"],
    [Settings, "Configurações"],
  ],
  [
    [Coins, "Valorações"],
    [Sparkles, "Reputação"],
  ],
];

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-slate-900/70 shadow-xl shadow-black/20 ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ children }) {
  return <h2 className="font-serif text-xl text-white">{children}</h2>;
}

function KpiCard({ icon: Icon, label, value, helper, accent = "cyan" }) {
  const colorMap = {
    cyan: "border-cyan-300/70 text-cyan-200 bg-cyan-400/10",
    yellow: "border-amber-300/70 text-amber-200 bg-amber-400/10",
    blue: "border-blue-300/70 text-blue-200 bg-blue-400/10",
    green: "border-green-300/70 text-green-200 bg-green-400/10",
  };

  return (
    <Card className="flex min-h-[140px] items-center gap-5 p-5">
      <div className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-full border ${colorMap[accent]}`}>
        <Icon size={30} strokeWidth={1.6} />
      </div>

      <div className="min-w-0">
        <p className="text-[11px] uppercase leading-snug tracking-wide text-slate-300">
          {label}
        </p>

        <p className="mt-2 break-words font-serif text-3xl leading-tight text-white xl:text-[2rem]">
          {value}
        </p>

        <p className="mt-1 text-xs leading-relaxed text-slate-300">
          {helper}
        </p>
      </div>
    </Card>
  );
}


function AnalysisTextCard({ title, children }) {
  return (
    <Card className="p-5">
      <p className="text-xs uppercase tracking-[0.25em] text-amber-300">
        Análise
      </p>

      <h3 className="mt-2 font-serif text-xl text-white">
        {title}
      </h3>

      <p className="mt-3 text-sm leading-relaxed text-slate-300">
        {children}
      </p>
    </Card>
  );
}


function MonthlyComboChart({ data, lineDataKey, lineLabel, lineColor, lineValueFormatter, lineAxisFormatter }) {
  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 30, right: 26, left: 0, bottom: 10 }}>
          <defs>
            <linearGradient id={`barsGradient-${lineDataKey}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ecff44" stopOpacity={0.98} />
              <stop offset="48%" stopColor="#c9d40b" stopOpacity={0.94} />
              <stop offset="100%" stopColor="#778405" stopOpacity={0.82} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
          <XAxis dataKey="month" tick={{ fill: "#cbd5e1", fontSize: 10 }} interval={0} tickLine={false} />
          <YAxis yAxisId="left" tick={{ fill: "#94a3b8", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fill: "#94a3b8", fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={lineAxisFormatter}
          />
          <Tooltip
            contentStyle={{
              background: "#081522",
              border: "1px solid rgba(255,255,255,.12)",
              borderRadius: 12,
            }}
            formatter={(value, name) =>
              name === "Publicações" ? [Number(value).toLocaleString("pt-BR"), "Publicações"] : [lineValueFormatter(value), lineLabel]
            }
          />
          <Legend verticalAlign="top" align="left" height={24} wrapperStyle={{ color: "#cbd5e1", fontSize: 10 }} />
          <Bar
            yAxisId="left"
            dataKey="publications"
            name="Publicações"
            fill={`url(#barsGradient-${lineDataKey})`}
            radius={[7, 7, 0, 0]}
            barSize={22}
          >
            <LabelList dataKey="publications" position="top" offset={5} style={{ fill: "#f8fafc", fontSize: 10 }} />
          </Bar>
          <Line
            yAxisId="right"
            type="monotone"
            dataKey={lineDataKey}
            name={lineLabel}
            stroke={lineColor}
            strokeWidth={2.4}
            dot={{ r: 3.8, strokeWidth: 1.8, fill: "#071421", stroke: lineColor }}
          >
            <LabelList
              dataKey={lineDataKey}
              position="top"
              offset={12}
              formatter={lineValueFormatter}
              style={{ fill: "#dbeafe", fontSize: 9.5 }}
            />
          </Line>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function AiAnalysisCard({ selectedPublication = null }) {
  const [url, setUrl] = useState("");
  const [clientName, setClientName] = useState("Cliente X");
  const [publicationId, setPublicationId] = useState("");
  const [publicationTitle, setPublicationTitle] = useState("");
  const [publicationVehicle, setPublicationVehicle] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);
  const [rawApiResponse, setRawApiResponse] = useState("");
  const [httpStatus, setHttpStatus] = useState("");
  useEffect(() => {
    if (!selectedPublication) return;

    setUrl(selectedPublication.url || "");
    setClientName("Cliente X");
    setPublicationId(selectedPublication.publicationId || "");
    setPublicationTitle(selectedPublication.title || "");
    setPublicationVehicle(selectedPublication.vehicle || "");
    setError("");
    setResult(null);
    setRawApiResponse("");
    setHttpStatus("");
  }, [selectedPublication]);

  async function analyze() {
    setLoading(true);
    setError("");
    setResult(null);
    setRawApiResponse("");
    setHttpStatus("");

    try {
      const response = await fetch("/api/analyze-publication", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          clientId: "cliente_x",
          publicationId,
          clientName,
          title: publicationTitle,
          vehicle: publicationVehicle,
        }),
      });

      setHttpStatus(`HTTP ${response.status} - ${response.ok ? "OK" : "erro"}`);

      const responseText = await response.text();
      setRawApiResponse(responseText);

      let data;
      try {
        data = responseText ? JSON.parse(responseText) : {};
      } catch {
        data = {
          error: "A API não retornou JSON válido.",
          rawApiResponse: responseText,
        };
      }

      setResult(data);

      if (!response.ok) {
        const message =
          typeof data?.error === "string"
            ? data.error
            : data?.error?.message || "Erro na análise.";
        throw new Error(message);
      }
    } catch (err) {
      setError(err.message || "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  const analysis = result?.reputationAnalysis || result?.analysis;
  const fullText = result?.fullExtractedText || result?.extraction?.fullText || result?.extraction?.fullExtractedText || "";
  
  const reputationItems = analysis
    ? [
        ["Tom da publicação", analysis.publicationTone],
        ["Protagonismo da marca", analysis.brandProtagonism],
        ["Aderência à mensagem-chave", analysis.keyMessageAdherence],
        ["Aderência aos valores da marca", analysis.brandValuesAdherence],
        ["Contexto reputacional", analysis.reputationalContext],
        ["Risco reputacional", analysis.reputationalRisk],
        ["Presença de porta-voz", analysis.spokespersonPresence],
        ["Menção no título/subtítulo", analysis.titleOrSubtitleMention],
      ]
    : [];
 
  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 border-b border-white/10 pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <SectionTitle>Análise IA de reportagem</SectionTitle>
          <p className="mt-1 text-sm text-slate-400">
            Teste com um único link da clipadora para classificar presença, destaque, protagonismo e tom.
          </p>
        </div>
        <span className="rounded-full border border-violet-300/20 bg-violet-300/10 px-3 py-1 text-xs text-violet-100">
          DeepSeek
        </span>
      </div>

      {selectedPublication && (
        <div className="mt-4 rounded-xl border border-violet-300/20 bg-violet-300/10 p-4">
          <p className="text-xs uppercase tracking-wide text-violet-100">Publicação selecionada da tabela</p>
          <p className="mt-2 font-medium text-white">{publicationTitle || "Sem título informado"}</p>
          <div className="mt-2 flex flex-wrap gap-2 text-xs text-violet-50/80">
            <span>Veículo: {publicationVehicle || "não informado"}</span>
            <span>·</span>
            <span>ID: {publicationId || "sem id_publicacao"}</span>
          </div>
        </div>
      )}

      <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-[1fr_180px_auto]">
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="Cole aqui o link da clipadora"
          className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
        />
        <input
          value={clientName}
          onChange={(event) => setClientName(event.target.value)}
          placeholder="Cliente"
          className="rounded-xl border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-white outline-none placeholder:text-slate-500"
        />
        <button
          onClick={analyze}
          disabled={loading || !url}
          className="flex items-center justify-center gap-2 rounded-xl border border-violet-300/25 bg-violet-300/10 px-4 py-3 text-sm font-medium text-violet-100 transition hover:bg-violet-300/15 disabled:opacity-60"
        >
          <Wand2 size={17} />
          {loading ? "Analisando..." : "Extrair e analisar"}
        </button>
      </div>

      {error && (
        <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          {error}
        </div>
      )}

      {httpStatus && (
        <div className="mt-4 rounded-xl border border-cyan-300/15 bg-cyan-300/5 px-4 py-3 text-xs text-cyan-100">
          Status da API: {httpStatus}
        </div>
      )}

      {result?.extraction && (
        <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Texto extraído</p>
          <p className="mt-2 font-medium text-slate-100">{result.extraction.title || "Sem título extraído"}</p>
          <p className="mt-2 text-xs text-slate-500">
            {result.extraction.textLength} caracteres · método: {result.extraction.extractionMethod || "não informado"}
          </p>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">{result.extraction.preview}</p>

          {fullText && (
            <details className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3">
              <summary className="cursor-pointer text-sm font-medium text-cyan-100">
                Ver texto completo extraído ({fullText.length.toLocaleString("pt-BR")} caracteres)
              </summary>
              <pre className="mt-3 max-h-96 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-xs leading-relaxed text-slate-200">
                {fullText}
              </pre>
            </details>
          )}
        </div>
      )}

      {reputationItems.length > 0 && (
        <>
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            {reputationItems.map(([label, item]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  {label}
                </p>
      
                <p className="mt-2 font-serif text-3xl text-white">
                  {Number(item?.score || 0).toLocaleString("pt-BR")}
                </p>
      
                <p className="mt-1 text-sm text-cyan-200">
                  {item?.label || "sem classificação"}
                </p>
      
                <p className="mt-3 text-xs leading-relaxed text-slate-400">
                  {item?.justification || "Sem justificativa retornada."}
                </p>
              </div>
            ))}
          </div>
      
          {result?.summary && (
            <div className="mt-4 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4">
              <p className="text-xs uppercase tracking-wide text-emerald-100">
                Leitura geral da IA
              </p>
      
              <p className="mt-2 text-sm leading-relaxed text-emerald-50/90">
                {result.summary.overallReading || "Sem leitura geral retornada."}
              </p>
      
              <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-wide text-emerald-100/70">
                    Principal força
                  </p>
                  <p className="mt-1 text-sm text-white">
                    {result.summary.mainStrength || "Não informado."}
                  </p>
                </div>
      
                <div>
                  <p className="text-xs uppercase tracking-wide text-emerald-100/70">
                    Principal risco
                  </p>
                  <p className="mt-1 text-sm text-white">
                    {result.summary.mainRisk || "Não informado."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {result?.evidence?.length > 0 && (
        <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Evidências literais</p>
          <ul className="mt-2 space-y-2 text-sm text-slate-300">
            {result.evidence.map((item, index) => (
              <li key={`${item}-${index}`}>“{item}”</li>
            ))}
          </ul>
        </div>
      )}

      {result?.rawContent && (
        <div className="mt-4 rounded-xl border border-red-300/20 bg-red-300/10 p-4">
          <p className="text-xs uppercase tracking-wide text-red-200">Resposta bruta da DeepSeek</p>
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-xs leading-relaxed text-red-50">
            {result.rawContent}
          </pre>
        </div>
      )}

      {result?.debug && (
        <div className="mt-4 rounded-xl border border-cyan-300/20 bg-cyan-300/10 p-4">
          <p className="text-xs uppercase tracking-wide text-cyan-200">Debug da chamada DeepSeek</p>
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-xs leading-relaxed text-cyan-50">
            {JSON.stringify(result.debug, null, 2)}
          </pre>
        </div>
      )}

      {result?.extraction?.diagnostics && (
        <details className="mt-4 rounded-xl border border-white/10 bg-slate-950/40 p-4">
          <summary className="cursor-pointer text-sm font-medium text-slate-200">Diagnóstico da extração</summary>
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-xs leading-relaxed text-slate-300">
            {JSON.stringify(result.extraction.diagnostics, null, 2)}
          </pre>
        </details>
      )}

      {rawApiResponse && !result?.analysis && (
        <div className="mt-4 rounded-xl border border-orange-300/20 bg-orange-300/10 p-4">
          <p className="text-xs uppercase tracking-wide text-orange-200">Resposta bruta da API</p>
          <pre className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-black/40 p-3 text-xs leading-relaxed text-orange-50">
            {rawApiResponse}
          </pre>
        </div>
      )}
    </Card>
  );
}

function ValuationPublicationsCard({ rows, onAnalyzePublication }) {
  return (
    <Card className="overflow-hidden p-5">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <SectionTitle>Nova valoração — todas as citações do mês</SectionTitle>
          <p className="mt-1 text-sm text-slate-400">
            Cálculo estimado para todas as publicações do período filtrado.
          </p>
        </div>
        <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-2 text-xs leading-relaxed text-amber-100">
          Sem usar valoração antiga · defaults: presença 0,60 · destaque 1,00 · protagonismo 0,60 · tom neutro 0,50
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-wide text-slate-500">
              <th className="px-3 py-2 font-medium">Publicação</th>
              <th className="px-3 py-2 font-medium">Veículo</th>
              <th className="px-3 py-2 text-right font-medium">Valoração antiga</th>
              <th className="px-3 py-2 text-right font-medium">Nova valoração</th>
              <th className="px-3 py-2 font-medium">Status</th>
              <th className="px-3 py-2 text-right font-medium">IA</th>
            </tr>
          </thead>

          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="rounded-xl bg-slate-950/45 transition hover:bg-slate-900/70">
                <td className="max-w-[420px] rounded-l-xl border-y border-l border-white/10 px-3 py-3">
                  <p className="line-clamp-2 font-medium text-slate-100">{row.title}</p>
                  <p className="mt-1 text-xs text-slate-500">Valor-base: {compactBRL(row.baseValue)}</p>
                </td>

                <td className="border-y border-white/10 px-3 py-3">
                  <p className="font-medium text-slate-200">{row.vehicle}</p>
                  <div className="mt-1 flex gap-2">
                    <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-2 py-0.5 text-[11px] text-cyan-100">
                      {row.vehicleData?.mediaType || row.mediaType || "—"}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[11px] text-slate-300">
                      Tier {row.vehicleData?.tier || row.tier || "—"}
                    </span>
                  </div>
                </td>

                <td className="border-y border-white/10 px-3 py-3 text-right font-medium text-slate-300">
                  {compactBRL(row.oldValuation)}
                </td>

                <td className="border-y border-white/10 px-3 py-3 text-right">
                  <p className="font-serif text-xl text-white">{compactBRL(row.newValuation)}</p>
                  <p className="mt-1 text-xs text-slate-500">calculada pela regra nova</p>
                </td>

                <td className="border-y border-white/10 px-3 py-3">
                  <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-xs text-amber-100">
                    {row.status}
                  </span>
                  <p className="mt-2 max-w-[280px] text-xs leading-relaxed text-slate-500">{row.detail}</p>
                </td>

                <td className="rounded-r-xl border-y border-r border-white/10 px-3 py-3 text-right">
                  <button
                    type="button"
                    onClick={() => onAnalyzePublication?.(row)}
                    disabled={!row.url}
                    className="rounded-full border border-violet-300/25 bg-violet-300/10 px-3 py-1.5 text-xs font-medium text-violet-100 transition hover:bg-violet-300/15 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    Analisar IA
                  </button>
                  {!row.url && <p className="mt-2 text-[11px] text-slate-500">sem link</p>}
                </td>
              </tr>
            ))}

            {!rows.length && (
              <tr>
                <td colSpan={6} className="rounded-xl border border-white/10 bg-slate-950/45 px-4 py-8 text-center text-slate-400">
                  Nenhuma publicação encontrada para o período selecionado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

const reputationIndexData = [
  {
    id: "ierBuzz",
    title: "IER-Buzz",
    description: "Mede a força de ocupação reputacional da marca dentro do território e do recorte analisado.",
    value: "00",
    accent: "cyan",
    formula:
      "Ocupação de veículos × 25% + Alcance capturado × 25% + Retorno capturado × 20% + Qualidade dos veículos × 15% + Capilaridade × 10% + Frequência ajustada × 5%",
    components: [
      {
        name: "Ocupação de veículos",
        value: "00",
        description: "Percentual de veículos do território ocupados pela marca no recorte.",
        origin: [
          ["Veículos ocupados", "00"],
          ["Total de veículos do território", "00"],
        ],
      },
      {
        name: "Alcance capturado",
        value: "00",
        description: "Percentual do alcance potencial do território capturado no recorte.",
        origin: [
          ["Alcance dos veículos ocupados", "00"],
          ["Alcance potencial do território", "00"],
        ],
      },
      {
        name: "Retorno capturado",
        value: "00",
        description: "Percentual do retorno potencial do território convertido em valoração no recorte.",
        origin: [
          ["Retorno gerado no recorte", "R$ 00"],
          ["Retorno potencial do território", "R$ 00"],
        ],
      },
      {
        name: "Qualidade dos veículos ocupados",
        value: "00",
        description: "Score médio dos veículos ocupados, considerando tier ou peso estratégico.",
        origin: [
          ["Score médio dos veículos ocupados", "00"],
          ["Escala máxima", "100"],
        ],
      },
      {
        name: "Capilaridade capturada",
        value: "00",
        description: "Percentual de regiões, UFs ou praças do território com presença da marca.",
        origin: [
          ["Praças ocupadas", "00"],
          ["Praças do território", "00"],
        ],
      },
      {
        name: "Frequência ajustada",
        value: "00",
        description: "Intensidade média de publicações por veículo ocupado, ajustada por frequência ideal.",
        origin: [
          ["Publicações totais", "00"],
          ["Veículos ocupados", "00"],
          ["Frequência ideal", "00"],
        ],
      },
    ],
    methodology: [
      {
        index: "Ocupação de veículos",
        measures: "Quanto do território de veículos foi ocupado pela marca.",
        recorte: "Nº de veículos distintos com ao menos 1 publicação no recorte.",
        normalization: "Total de veículos ativos no território.",
        calculation: "veículos ocupados / total de veículos do território × 100",
      },
      {
        index: "Alcance capturado",
        measures: "Quanto do alcance potencial do território foi alcançado pela presença da marca.",
        recorte: "Soma do alcance dos veículos distintos ocupados no recorte.",
        normalization: "Soma do alcance potencial de todos os veículos do território.",
        calculation: "alcance dos veículos ocupados / alcance potencial do território × 100",
      },
      {
        index: "Retorno capturado",
        measures: "Quanto valor de mídia foi gerado em relação ao potencial do território.",
        recorte: "Soma da valoração/retorno das publicações do recorte.",
        normalization: "Retorno potencial estimado do território.",
        calculation: "retorno gerado no recorte / retorno potencial do território × 100",
      },
      {
        index: "Qualidade dos veículos ocupados",
        measures: "Qual é a força estratégica dos veículos onde a marca apareceu.",
        recorte: "Score médio dos veículos ocupados, por tier ou peso estratégico.",
        normalization: "Escala fixa de qualidade dos veículos, de 0 a 100.",
        calculation: "média dos scores dos veículos ocupados",
      },
      {
        index: "Capilaridade capturada",
        measures: "Quanto da distribuição geográfica do território foi ocupada.",
        recorte: "Nº de UFs, regiões ou praças distintas com presença no recorte.",
        normalization: "Total de UFs, regiões ou praças presentes no território.",
        calculation: "praças ocupadas / praças do território × 100",
      },
      {
        index: "Frequência ajustada",
        measures: "Intensidade de presença sem premiar repetição excessiva.",
        recorte: "Nº total de publicações dividido pelos veículos ocupados.",
        normalization: "Frequência ideal por veículo ocupado.",
        calculation: "(publicações totais / veículos ocupados) / frequência ideal × 100",
      },
    ],
  },
  {
    id: "ierQuali",
    title: "IER-Quali",
    description: "Mede a qualidade reputacional da presença, a partir da leitura semântica da IA.",
    value: "00",
    accent: "emerald",
    formula:
      "Tom × 20% + Protagonismo × 15% + Mensagem-chave × 20% + Valores da marca × 15% + Contexto × 15% + Baixo risco × 15%",
    components: [
      {
        name: "Tom da publicação",
        value: "00",
        description: "Leitura semântica geral da matéria em relação à marca.",
        origin: [["Score retornado pela IA", "00"]],
      },
      {
        name: "Protagonismo da marca",
        value: "00",
        description: "Grau de centralidade da marca na matéria.",
        origin: [["Score retornado pela IA", "00"]],
      },
      {
        name: "Aderência à mensagem-chave",
        value: "00",
        description: "Quanto a matéria contempla as mensagens estratégicas da marca.",
        origin: [["Score retornado pela IA", "00"]],
      },
      {
        name: "Aderência aos valores da marca",
        value: "00",
        description: "Quanto a matéria associa a marca aos valores desejados.",
        origin: [["Score retornado pela IA", "00"]],
      },
      {
        name: "Contexto reputacional",
        value: "00",
        description: "Qualidade do contexto em que a marca aparece.",
        origin: [["Score retornado pela IA", "00"]],
      },
      {
        name: "Risco reputacional",
        value: "00",
        description: "Ausência ou presença de crise, crítica, denúncia ou associação negativa.",
        origin: [["Score retornado pela IA", "00"]],
      },
    ],
    methodology: [
      {
        index: "Tom da publicação",
        measures: "Polaridade reputacional da matéria em relação à marca.",
        recorte: "Score de tom retornado pela IA.",
        normalization: "Escala fixa de 0 a 100.",
        calculation: "score da IA",
      },
      {
        index: "Protagonismo da marca",
        measures: "Centralidade da marca no conteúdo.",
        recorte: "Score de protagonismo retornado pela IA.",
        normalization: "Escala fixa de 0 a 100.",
        calculation: "score da IA",
      },
      {
        index: "Aderência à mensagem-chave",
        measures: "Aderência semântica às mensagens estratégicas cadastradas no cliente.",
        recorte: "Score de aderência retornado pela IA.",
        normalization: "Escala fixa de 0 a 100.",
        calculation: "score da IA",
      },
      {
        index: "Aderência aos valores da marca",
        measures: "Associação da publicação aos valores desejados da marca.",
        recorte: "Score de aderência retornado pela IA.",
        normalization: "Escala fixa de 0 a 100.",
        calculation: "score da IA",
      },
      {
        index: "Contexto reputacional",
        measures: "Qualidade do contexto em que a marca aparece.",
        recorte: "Score de contexto retornado pela IA.",
        normalization: "Escala fixa de 0 a 100.",
        calculation: "score da IA",
      },
      {
        index: "Risco reputacional",
        measures: "Nível de segurança reputacional da publicação.",
        recorte: "Score de risco retornado pela IA, já invertido.",
        normalization: "Escala fixa de 0 a 100.",
        calculation: "score da IA",
      },
    ],
  },
  {
    id: "icr",
    title: "ICR",
    description: "Índice composto de reputação, combinando força de presença e qualidade reputacional.",
    value: "00",
    accent: "amber",
    formula: "IER-Buzz × 50% + IER-Quali × 50%",
    components: [
      {
        name: "IER-Buzz",
        value: "00",
        description: "Força de ocupação reputacional no território e recorte analisado.",
        origin: [["Valor do IER-Buzz", "00"]],
      },
      {
        name: "IER-Quali",
        value: "00",
        description: "Qualidade reputacional da presença no recorte analisado.",
        origin: [["Valor do IER-Quali", "00"]],
      },
    ],
    methodology: [
      {
        index: "IER-Buzz",
        measures: "Força de presença, alcance e ocupação territorial.",
        recorte: "Resultado consolidado do IER-Buzz no recorte.",
        normalization: "Escala final de 0 a 100.",
        calculation: "IER-Buzz × 50%",
      },
      {
        index: "IER-Quali",
        measures: "Qualidade reputacional da presença.",
        recorte: "Resultado consolidado do IER-Quali no recorte.",
        normalization: "Escala final de 0 a 100.",
        calculation: "IER-Quali × 50%",
      },
    ],
  },
];

function MethodologyModal({ index, onClose }) {
  if (!index) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6">
      <div className="max-h-[86vh] w-full max-w-6xl overflow-hidden rounded-2xl border border-white/10 bg-slate-950 shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-white/10 px-5 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">
              Metodologia
            </p>
            <h3 className="mt-1 font-serif text-2xl text-white">
              {index.title}
            </h3>
            <p className="mt-1 text-sm text-slate-400">
              Como cada componente será normalizado para compor o índice.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 transition hover:bg-white/10"
          >
            Fechar
          </button>
        </div>

        <div className="max-h-[68vh] overflow-auto p-5">
          <table className="w-full min-w-[980px] border-separate border-spacing-y-2 text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2 font-medium">Índice</th>
                <th className="px-3 py-2 font-medium">O que mede</th>
                <th className="px-3 py-2 font-medium">Componente de recorte</th>
                <th className="px-3 py-2 font-medium">Componente de normalização</th>
                <th className="px-3 py-2 font-medium">Cálculo</th>
              </tr>
            </thead>

            <tbody>
              {index.methodology.map((row) => (
                <tr key={row.index} className="bg-slate-900/70">
                  <td className="rounded-l-xl border-y border-l border-white/10 px-3 py-3 font-medium text-white">
                    {row.index}
                  </td>
                  <td className="border-y border-white/10 px-3 py-3 text-slate-300">
                    {row.measures}
                  </td>
                  <td className="border-y border-white/10 px-3 py-3 text-slate-300">
                    {row.recorte}
                  </td>
                  <td className="border-y border-white/10 px-3 py-3 text-slate-300">
                    {row.normalization}
                  </td>
                  <td className="rounded-r-xl border-y border-r border-white/10 px-3 py-3 text-cyan-100">
                    {row.calculation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <p className="mt-4 text-xs leading-relaxed text-slate-500">
            Nesta página de teste, os valores aparecem como 00. Os cálculos serão conectados depois aos dados de território,
            recorte, publicações, veículos e análises de IA.
          </p>
        </div>
      </div>
    </div>
  );
}

function ReputationIndexBlock({ index, onOpenMethodology }) {
  const accentMap = {
    cyan: {
      border: "border-cyan-300/20",
      bg: "bg-cyan-300/10",
      text: "text-cyan-100",
      soft: "text-cyan-200",
    },
    emerald: {
      border: "border-emerald-300/20",
      bg: "bg-emerald-300/10",
      text: "text-emerald-100",
      soft: "text-emerald-200",
    },
    amber: {
      border: "border-amber-300/20",
      bg: "bg-amber-300/10",
      text: "text-amber-100",
      soft: "text-amber-200",
    },
  };

  const accent = accentMap[index.accent] || accentMap.cyan;

  return (
    <Card className="overflow-hidden">
      <div className={`border-b ${accent.border} ${accent.bg} px-5 py-5`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <p className={`text-xs uppercase tracking-[0.25em] ${accent.text}`}>
              Índice de reputação
            </p>

            <div className="mt-2 flex flex-wrap items-end gap-4">
              <h2 className="font-serif text-4xl text-white md:text-5xl">
                {index.title}
              </h2>

              <p className="font-serif text-6xl leading-none text-white md:text-7xl">
                {index.value}
              </p>
            </div>

            <p className="min-w-0 break-words font-serif text-3xl leading-tight text-cyan-200">
              {index.description}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onOpenMethodology(index)}
            className={`rounded-xl border ${accent.border} ${accent.bg} px-4 py-3 text-sm font-medium ${accent.text} transition hover:bg-white/10`}
          >
            Ver metodologia
          </button>
        </div>

        <div className="min-w-0 rounded-xl border border-white/10 bg-slate-950/45 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">
            Fórmula usada
          </p>
          <p className="mt-2 text-sm leading-relaxed text-slate-200">
            {index.formula}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 p-5 lg:grid-cols-2 xl:grid-cols-3">
        {index.components.map((component) => (
          <div key={component.name} className="rounded-xl border border-white/10 bg-slate-950/45 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">
                  Componente
                </p>
                <h3 className="mt-1 text-base font-semibold text-white">
                  {component.name}
                </h3>
              </div>

              <p className={`font-serif text-4xl ${accent.soft}`}>
                {component.value}
              </p>
            </div>

            <p className="mt-3 min-h-[44px] text-xs leading-relaxed text-slate-400">
              {component.description}
            </p>

            <div className="mt-4 space-y-2 border-t border-white/10 pt-3">
              {component.origin.map(([label, value]) => (
                <div
                  key={label}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3"
                >
                  <span className="min-w-0 break-words rounded-full border border-white/10 bg-white/5 px-2 py-1 text-[11px] text-slate-300">
                    {label}
                  </span>
              
                  <strong className="min-w-0 max-w-[160px] break-words text-right text-[11px] text-white">
                    {value}
                  </strong>
                </div>
              ))}


              
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function formatIndexValue(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "—";
  }

  return Number(value).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

function formatIntegerValue(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "00";
  }

  return Number(value).toLocaleString("pt-BR", {
    maximumFractionDigits: 0,
  });
}

function formatMoneyValue(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return "R$ 00";
  }

  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function buildOriginList(componentKey, component) {
  const origin = component?.origin || {};

  const maps = {
    vehicleOccupation: [
      ["Veículos ocupados", formatIntegerValue(origin.occupiedVehicles)],
      ["Total de veículos do território", formatIntegerValue(origin.totalTerritoryVehicles)],
    ],
    capturedReach: [
      ["Alcance dos veículos ocupados", formatIntegerValue(origin.occupiedReach)],
      ["Alcance potencial do território", formatIntegerValue(origin.territoryReachPotential)],
    ],
    capturedReturn: [
      ["Retorno gerado no recorte", formatMoneyValue(origin.generatedReturn)],
      ["Retorno potencial do território", formatMoneyValue(origin.territoryReturnPotential)],
    ],
    vehicleQuality: [
      ["Score médio dos veículos ocupados", formatIndexValue(origin.occupiedVehicleQuality)],
      ["Escala máxima", "100"],
    ],
    capturedCapillarity: [
      ["Praças ocupadas", formatIntegerValue(origin.occupiedCapillarity)],
      ["Praças do território", formatIntegerValue(origin.territoryCapillarity)],
    ],
    adjustedFrequency: [
      ["Publicações totais", formatIntegerValue(origin.totalPublications)],
      ["Veículos ocupados", formatIntegerValue(origin.occupiedVehicles)],
      ["Publicações por veículo", formatIndexValue(origin.publicationsPerOccupiedVehicle)],
      ["Frequência ideal", formatIndexValue(origin.idealFrequency)],
    ],
    publicationTone: [
      ["Análises válidas", formatIntegerValue(origin.analyzedPublications)],
      ["Média do score IA", formatIndexValue(origin.averageScore)],
    ],
    brandProtagonism: [
      ["Análises válidas", formatIntegerValue(origin.analyzedPublications)],
      ["Média do score IA", formatIndexValue(origin.averageScore)],
    ],
    keyMessageAdherence: [
      ["Análises válidas", formatIntegerValue(origin.analyzedPublications)],
      ["Média do score IA", formatIndexValue(origin.averageScore)],
    ],
    brandValuesAdherence: [
      ["Análises válidas", formatIntegerValue(origin.analyzedPublications)],
      ["Média do score IA", formatIndexValue(origin.averageScore)],
    ],
    reputationalContext: [
      ["Análises válidas", formatIntegerValue(origin.analyzedPublications)],
      ["Média do score IA", formatIndexValue(origin.averageScore)],
    ],
    reputationalRisk: [
      ["Análises válidas", formatIntegerValue(origin.analyzedPublications)],
      ["Média do score IA", formatIndexValue(origin.averageScore)],
    ],
    buzz: [["Valor do IER-Buzz", formatIndexValue(origin.ierBuzz)]],
    quali: [["Valor do IER-Quali", formatIndexValue(origin.ierQuali)]],
  };

  return maps[componentKey] || [];
}

function buildReputationIndexDataFromApi(data) {
  if (!data?.indexes) return reputationIndexData;

  const buzz = data.indexes.ierBuzz || {};
  const quali = data.indexes.ierQuali || {};
  const icr = data.indexes.icr || {};

  const buzzComponents = buzz.components || {};
  const qualiComponents = quali.components || {};
  const icrComponents = icr.components || {};

  return [
    {
      ...reputationIndexData[0],
      value: formatIndexValue(buzz.value),
      formula: buzz.formula || reputationIndexData[0].formula,
      components: [
        {
          key: "vehicleOccupation",
          name: "Ocupação de veículos",
          description: "Percentual de veículos do território ocupados pela marca no recorte.",
        },
        {
          key: "capturedReach",
          name: "Alcance capturado",
          description: "Percentual do alcance potencial do território capturado no recorte.",
        },
        {
          key: "capturedReturn",
          name: "Retorno capturado",
          description: "Percentual do retorno potencial do território convertido em valoração no recorte.",
        },
        {
          key: "vehicleQuality",
          name: "Qualidade dos veículos ocupados",
          description: "Score médio dos veículos ocupados, considerando tier ou peso estratégico.",
        },
        {
          key: "capturedCapillarity",
          name: "Capilaridade capturada",
          description: "Percentual de abrangências ou praças do território com presença da marca.",
        },
        {
          key: "adjustedFrequency",
          name: "Frequência ajustada",
          description: "Intensidade média de publicações por veículo ocupado, ajustada por frequência ideal.",
        },
      ].map((item) => {
        const component = buzzComponents[item.key];

        return {
          name: item.name,
          value: formatIndexValue(component?.value),
          description: item.description,
          origin: buildOriginList(item.key, component),
        };
      }),
    },
    {
      ...reputationIndexData[1],
      value: formatIndexValue(quali.value),
      formula: quali.formula || reputationIndexData[1].formula,
      components: [
        {
          key: "publicationTone",
          name: "Tom da publicação",
          description: "Leitura semântica geral das matérias válidas em relação à marca.",
        },
        {
          key: "brandProtagonism",
          name: "Protagonismo da marca",
          description: "Grau médio de centralidade da marca nas publicações válidas.",
        },
        {
          key: "keyMessageAdherence",
          name: "Aderência à mensagem-chave",
          description: "Aderência média às mensagens estratégicas da marca.",
        },
        {
          key: "brandValuesAdherence",
          name: "Aderência aos valores da marca",
          description: "Associação média aos valores desejados da marca.",
        },
        {
          key: "reputationalContext",
          name: "Contexto reputacional",
          description: "Qualidade média do contexto em que a marca aparece.",
        },
        {
          key: "reputationalRisk",
          name: "Risco reputacional",
          description: "Média do score de baixo risco reputacional.",
        },
      ].map((item) => {
        const component = qualiComponents[item.key];

        return {
          name: item.name,
          value: formatIndexValue(component?.value),
          description: item.description,
          origin: buildOriginList(item.key, component),
        };
      }),
    },
    {
      ...reputationIndexData[2],
      value: formatIndexValue(icr.value),
      formula: icr.formula || reputationIndexData[2].formula,
      components: [
        {
          name: "IER-Buzz",
          value: formatIndexValue(icrComponents.buzz?.value),
          description: "Força de ocupação reputacional no território e recorte analisado.",
          origin: buildOriginList("buzz", icrComponents.buzz),
        },
        {
          name: "IER-Quali",
          value: formatIndexValue(icrComponents.quali?.value),
          description: "Qualidade reputacional da presença no recorte analisado.",
          origin: buildOriginList("quali", icrComponents.quali),
        },
      ],
    },
  ];
}

const bigNumberClass =
  "mt-2 min-w-0 break-words font-serif text-3xl leading-tight text-white md:text-4xl";


function TerritoryDataBlock({ data = null }) {
  const territoryData = [
    {
      label: "Número de veículos",
      value: formatIntegerValue(data?.totalVehicles),
      helper: "Total de veículos ativos no território",
    },
    {
      label: "Alcance potencial",
      value: formatIntegerValue(data?.potentialReach),
      helper: "Soma do alcance potencial dos veículos",
    },
    {
      label: "Retorno potencial",
      value: formatMoneyValue(data?.potentialReturn),
      helper: "Potencial estimado de retorno do território",
    },
    {
      label: "Tier médio",
      value: formatIndexValue(data?.averageTier),
      helper: "Score médio dos veículos do território",
    },
    {
      label: "Capilaridade territorial",
      value: formatIntegerValue(data?.geographicCapillarity),
      helper: "Número de abrangências ou praças no território",
    },
  ];

  return (
    <Card className="p-5">
      <div className="flex flex-col gap-3 border-b border-white/10 pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <SectionTitle>Dados do território</SectionTitle>
          <p className="mt-1 max-w-4xl text-sm leading-relaxed text-slate-400">
            Resumo da régua de referência usada para normalizar os índices reputacionais.
          </p>
        </div>

        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
          {data?.name || "Território mapeado"}
        </span>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-5">
        {territoryData.map((item) => (
          <div
            key={item.label}
            className="min-w-0 rounded-xl border border-white/10 bg-slate-950/45 p-4"
          >
            <p className="text-xs uppercase leading-snug tracking-wide text-slate-500">
              {item.label}
            </p>

            <p className={bigNumberClass}>
              {item.value}
            </p>

            <p className="mt-2 text-xs leading-relaxed text-slate-400">
              {item.helper}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ReputationPage({ selectedClient, startDate, endDate }) {
  const [openMethodology, setOpenMethodology] = useState(null);
  const [reputationData, setReputationData] = useState(null);
  const [loadingReputation, setLoadingReputation] = useState(false);
  const [reputationError, setReputationError] = useState("");

  const [aiJob, setAiJob] = useState(null);
  const [aiJobCounts, setAiJobCounts] = useState(null);
  const [aiJobRecentItems, setAiJobRecentItems] = useState([]);
  const [aiJobError, setAiJobError] = useState("");
  const [aiJobLoading, setAiJobLoading] = useState(false);
  const [aiJobRunning, setAiJobRunning] = useState(false);
  const [aiJobLastProcessed, setAiJobLastProcessed] = useState(null);

  const aiJobRunningRef = useRef(false);

  const selectedClientId =
    selectedClient?.id ||
    selectedClient?.clientId ||
    selectedClient?.slug ||
    "";

  const indexData = reputationData?.indexes
    ? buildReputationIndexDataFromApi(reputationData)
    : reputationIndexData;

  async function readJsonResponse(response, fallbackMessage = "A API retornou uma resposta inválida.") {
    const text = await response.text();

    let data;

    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(text?.slice(0, 500) || fallbackMessage);
    }

    if (!response.ok || data.ok === false) {
      throw new Error(data.error || data.message || fallbackMessage);
    }

    return data;
  }

  function validateReputationInputs() {
    if (!selectedClientId) {
      throw new Error("Selecione um cliente antes de calcular reputação.");
    }

    if (!startDate || !endDate) {
      throw new Error("Informe data inicial e data final antes de calcular reputação.");
    }
  }

  async function loadReputation({ runAi = false, forceReanalyze = false, limit = 10 } = {}) {
    try {
      validateReputationInputs();

      setLoadingReputation(true);
      setReputationError("");

      const params = new URLSearchParams({
        clientId: selectedClientId,
        startDate,
        endDate,
        limit: String(limit),
      });

      if (runAi) params.set("runAi", "true");
      if (forceReanalyze) params.set("forceReanalyze", "true");

      const response = await fetch(`/api/get-reputation-test?${params.toString()}`);
      const data = await readJsonResponse(response, "Erro ao carregar dados de reputação.");

      setReputationData(data);
    } catch (error) {
      setReputationError(error.message || "Erro inesperado ao carregar reputação.");
    } finally {
      setLoadingReputation(false);
    }
  }

  async function loadAiJobStatus(jobId) {
    const params = new URLSearchParams({
      jobId,
    });

    const response = await fetch(`/api/ai-analysis-job?action=status&${params.toString()}`);
    const data = await readJsonResponse(response, "Erro ao consultar status da fila IA.");

    setAiJob(data.job || null);
    setAiJobCounts(data.counts || null);
    setAiJobRecentItems(data.recentItems || []);

    return data;
  }

  async function createOrResumeAiJob({ recreate = false } = {}) {
    validateReputationInputs();

    const params = new URLSearchParams({
      clientId: selectedClientId,
      startDate,
      endDate,
    });

    if (recreate) params.set("recreate", "true");

    const response = await fetch(`/api/ai-analysis-job?action=create&${params.toString()}`);
    const data = await readJsonResponse(response, "Erro ao criar ou retomar fila IA.");

    setAiJob(data.job || null);
    setAiJobCounts(data.counts || null);
    setAiJobLastProcessed(null);

    if (data.job?.id) {
      await loadAiJobStatus(data.job.id);
    }

    return data.job;
  }

  async function handleCreateOrResumeJob() {
    setAiJobLoading(true);
    setAiJobError("");

    try {
      await createOrResumeAiJob();
    } catch (error) {
      setAiJobError(error.message || "Erro ao criar ou retomar fila IA.");
    } finally {
      setAiJobLoading(false);
    }
  }

  async function processNextJobItem(jobId) {
    const params = new URLSearchParams({
      jobId,
    });

    const response = await fetch(`/api/ai-analysis-job?action=process-next&${params.toString()}`);
    const data = await readJsonResponse(response, "Erro ao processar próximo item da fila IA.");

    if (data.processedItem) {
      setAiJobLastProcessed(data.processedItem);
    }

    if (data.counts) {
      setAiJobCounts(data.counts);
    }

    await loadAiJobStatus(jobId);

    return data;
  }

  async function handleProcessOneJobItem() {
    setAiJobLoading(true);
    setAiJobError("");

    try {
      const currentJob = aiJob?.id ? aiJob : await createOrResumeAiJob();

      if (!currentJob?.id) {
        throw new Error("Não foi possível identificar a fila IA.");
      }

      await processNextJobItem(currentJob.id);
    } catch (error) {
      setAiJobError(error.message || "Erro ao processar item da fila IA.");
    } finally {
      setAiJobLoading(false);
    }
  }

  async function handleStartJobLoop() {
    setAiJobError("");
    setAiJobLoading(true);
    setAiJobRunning(true);
    aiJobRunningRef.current = true;

    try {
      const currentJob = aiJob?.id ? aiJob : await createOrResumeAiJob();

      if (!currentJob?.id) {
        throw new Error("Não foi possível identificar a fila IA.");
      }

      setAiJobLoading(false);

      while (aiJobRunningRef.current) {
        const data = await processNextJobItem(currentJob.id);

        if (data.done || data.counts?.pendingItems === 0) {
          aiJobRunningRef.current = false;
          setAiJobRunning(false);
          await loadAiJobStatus(currentJob.id);
          break;
        }

        await new Promise((resolve) => window.setTimeout(resolve, 700));
      }
    } catch (error) {
      aiJobRunningRef.current = false;
      setAiJobRunning(false);
      setAiJobLoading(false);
      setAiJobError(error.message || "Erro ao processar fila IA.");
    }
  }

  function handlePauseJobLoop() {
    aiJobRunningRef.current = false;
    setAiJobRunning(false);
  }

  async function handleRefreshJobStatus() {
    if (!aiJob?.id) {
      setAiJobError("Crie ou retome uma fila antes de atualizar o status.");
      return;
    }

    setAiJobLoading(true);
    setAiJobError("");

    try {
      await loadAiJobStatus(aiJob.id);
    } catch (error) {
      setAiJobError(error.message || "Erro ao atualizar status da fila IA.");
    } finally {
      setAiJobLoading(false);
    }
  }

  async function handleResetJobErrors() {
    if (!aiJob?.id) {
      setAiJobError("Crie ou retome uma fila antes de resetar erros.");
      return;
    }

    setAiJobLoading(true);
    setAiJobError("");

    try {
      const params = new URLSearchParams({
        jobId: aiJob.id,
      });

      const response = await fetch(`/api/ai-analysis-job?action=reset-errors&${params.toString()}`);
      await readJsonResponse(response, "Erro ao resetar erros da fila IA.");
      await loadAiJobStatus(aiJob.id);
    } catch (error) {
      setAiJobError(error.message || "Erro ao resetar erros da fila IA.");
    } finally {
      setAiJobLoading(false);
    }
  }

  const aiProgress = aiJobCounts?.progress || 0;
  const hasAiJob = Boolean(aiJob?.id);
  const aiJobDone =
    aiJobCounts?.totalItems > 0 &&
    aiJobCounts?.processedItems >= aiJobCounts?.totalItems;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <SectionTitle>Reputação</SectionTitle>
            <p className="mt-1 max-w-4xl text-sm leading-relaxed text-slate-400">
              Visualização dos índices reputacionais calculados sobre o recorte atual:
              cliente selecionado e período ativo no dashboard.
            </p>

            <p className="mt-3 text-xs text-slate-500">
              Cliente:{" "}
              <span className="text-slate-300">
                {selectedClient?.nome || selectedClient?.name || selectedClientId || "não selecionado"}
              </span>{" "}
              · Período:{" "}
              <span className="text-slate-300">
                {startDate || "—"} a {endDate || "—"}
              </span>
            </p>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row xl:justify-end">
            <button
              type="button"
              onClick={() => loadReputation({ runAi: false })}
              disabled={loadingReputation}
              className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingReputation ? "Carregando..." : "Calcular Buzz"}
            </button>

            <button
              type="button"
              onClick={() => loadReputation({ runAi: true, forceReanalyze: false, limit: 1 })}
              disabled={loadingReputation}
              className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loadingReputation ? "Analisando..." : "Analisar amostra IA"}
            </button>
          </div>
        </div>

        {reputationError && (
          <div className="mt-4 rounded-xl border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm text-red-100">
            {reputationError}
          </div>
        )}

        {reputationData?.recorte && (
          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Publicações no recorte
              </p>
              <p className="mt-1 font-serif text-3xl text-white">
                {formatIntegerValue(reputationData.recorte.totalPublications)}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                IA executada
              </p>
              <p className="mt-1 font-serif text-3xl text-white">
                {reputationData.recorte.runAi ? "Sim" : "Não"}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Análises válidas
              </p>
              <p className="mt-1 font-serif text-3xl text-white">
                {formatIntegerValue(reputationData.recorte.validAiAnalyses)}
              </p>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Tentativas IA
              </p>
              <p className="mt-1 font-serif text-3xl text-white">
                {formatIntegerValue(reputationData.recorte.attemptedAiAnalyses)}
              </p>
            </div>
          </div>
        )}
      </Card>

      <Card className="p-5">
        <div className="flex flex-col gap-4 border-b border-white/10 pb-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <SectionTitle>Fila de análise IA do recorte</SectionTitle>
            <p className="mt-1 max-w-4xl text-sm leading-relaxed text-slate-400">
              Processa as publicações com URL uma a uma, salva o status no banco e permite retomar se a tela fechar ou o sistema cair.
            </p>

            {aiJob?.id && (
              <p className="mt-2 text-xs text-slate-500">
                Job: <span className="text-slate-300">{aiJob.id}</span> · Status:{" "}
                <span className="text-slate-300">{aiJob.status || "—"}</span>
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2 xl:justify-end">
            <button
              type="button"
              onClick={handleCreateOrResumeJob}
              disabled={aiJobLoading || aiJobRunning}
              className="rounded-xl border border-cyan-300/20 bg-cyan-300/10 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {aiJobLoading && !aiJobRunning ? "Carregando..." : "Criar/retomar fila"}
            </button>

            <button
              type="button"
              onClick={handleProcessOneJobItem}
              disabled={aiJobLoading || aiJobRunning || aiJobDone}
              className="rounded-xl border border-violet-300/20 bg-violet-300/10 px-4 py-3 text-sm font-medium text-violet-100 transition hover:bg-violet-300/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Processar 1 item
            </button>

            {!aiJobRunning ? (
              <button
                type="button"
                onClick={handleStartJobLoop}
                disabled={aiJobLoading || aiJobDone}
                className="rounded-xl border border-emerald-300/20 bg-emerald-300/10 px-4 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-300/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Processar automaticamente
              </button>
            ) : (
              <button
                type="button"
                onClick={handlePauseJobLoop}
                className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm font-medium text-amber-100 transition hover:bg-amber-300/20"
              >
                Pausar
              </button>
            )}

            <button
              type="button"
              onClick={handleRefreshJobStatus}
              disabled={!hasAiJob || aiJobLoading}
              className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm font-medium text-slate-200 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Atualizar
            </button>

            <button
              type="button"
              onClick={handleResetJobErrors}
              disabled={!hasAiJob || aiJobLoading || aiJobRunning}
              className="rounded-xl border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm font-medium text-red-100 transition hover:bg-red-300/20 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Resetar erros
            </button>
          </div>
        </div>

        {aiJobError && (
          <div className="mt-4 rounded-xl border border-red-300/20 bg-red-300/10 px-4 py-3 text-sm text-red-100">
            {aiJobError}
          </div>
        )}

        {aiJobCounts ? (
          <>
            <div className="mt-5">
              <div className="flex items-center justify-between gap-3 text-xs text-slate-400">
                <span>Progresso da fila</span>
                <span>{formatIndexValue(aiProgress)}%</span>
              </div>

              <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-950">
                <div
                  className="h-full rounded-full bg-emerald-300 transition-all"
                  style={{ width: `${Math.min(100, Math.max(0, aiProgress))}%` }}
                />
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
              {[
                ["Total", aiJobCounts.totalItems],
                ["Processados", aiJobCounts.processedItems],
                ["Pendentes", aiJobCounts.pendingItems],
                ["Processando", aiJobCounts.processingItems],
                ["Válidos", aiJobCounts.validItems],
                ["Inválidos", aiJobCounts.invalidItems],
                ["Erros", aiJobCounts.errorItems],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-white/10 bg-slate-950/45 p-3">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                  <p className="mt-1 font-serif text-3xl text-white">
                    {formatIntegerValue(value)}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/45 px-4 py-4 text-sm text-slate-400">
            Nenhuma fila carregada para este recorte. Clique em “Criar/retomar fila”.
          </div>
        )}

        {aiJobLastProcessed && (
          <div className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-300/10 p-4">
            <p className="text-xs uppercase tracking-wide text-emerald-100">
              Último item processado
            </p>
            <p className="mt-2 text-sm font-medium text-white">
              {aiJobLastProcessed.title || "Sem título"}
            </p>
            <p className="mt-1 text-xs text-emerald-50/80">
              {aiJobLastProcessed.vehicle || "Veículo não informado"} · {aiJobLastProcessed.status}
            </p>
            {aiJobLastProcessed.reason && (
              <p className="mt-2 text-xs leading-relaxed text-emerald-50/80">
                {aiJobLastProcessed.reason}
              </p>
            )}
          </div>
        )}

        {aiJobRecentItems?.length > 0 && (
          <div className="mt-5 overflow-x-auto">
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">
              Itens recentes da fila
            </p>

            <table className="w-full min-w-[900px] border-separate border-spacing-y-2 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Status</th>
                  <th className="px-3 py-2">Publicação</th>
                  <th className="px-3 py-2">Veículo</th>
                  <th className="px-3 py-2">Tentativas</th>
                  <th className="px-3 py-2">Quali</th>
                  <th className="px-3 py-2">Motivo</th>
                </tr>
              </thead>

              <tbody>
                {aiJobRecentItems.map((item) => (
                  <tr key={item.id} className="bg-slate-950/45">
                    <td className="rounded-l-xl border-y border-l border-white/10 px-3 py-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs ${
                        item.status === "valid"
                          ? "border border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
                          : item.status === "invalid"
                            ? "border border-amber-300/20 bg-amber-300/10 text-amber-100"
                            : item.status === "error"
                              ? "border border-red-300/20 bg-red-300/10 text-red-100"
                              : item.status === "processing"
                                ? "border border-cyan-300/20 bg-cyan-300/10 text-cyan-100"
                                : "border border-white/10 bg-white/5 text-slate-300"
                      }`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="max-w-[360px] border-y border-white/10 px-3 py-3 text-slate-100">
                      <p className="line-clamp-2">{item.raw_data?.title || "Sem título"}</p>
                    </td>
                    <td className="border-y border-white/10 px-3 py-3 text-slate-300">
                      {item.raw_data?.vehicle || "—"}
                    </td>
                    <td className="border-y border-white/10 px-3 py-3 text-slate-300">
                      {formatIntegerValue(item.attempts)}
                    </td>
                    <td className="border-y border-white/10 px-3 py-3 text-slate-300">
                      {formatIndexValue(item.quali_value)}
                    </td>
                    <td className="rounded-r-xl border-y border-r border-white/10 px-3 py-3 text-xs leading-relaxed text-slate-400">
                      {item.reason || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <TerritoryDataBlock data={reputationData?.territory} />

      {indexData.map((index) => (
        <ReputationIndexBlock
          key={index.id}
          index={index}
          onOpenMethodology={setOpenMethodology}
        />
      ))}

      {reputationData?.aiAttempts?.length > 0 && (
        <Card className="p-5">
          <SectionTitle>Tentativas de análise IA</SectionTitle>
          <div className="mt-4 space-y-2">
            {reputationData.aiAttempts.map((attempt) => (
              <div
                key={`${attempt.publicationId}-${attempt.status}`}
                className="rounded-xl border border-white/10 bg-slate-950/45 p-3"
              >
                <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">
                      {attempt.title}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      {attempt.vehicle} · ID {attempt.publicationId}
                    </p>
                  </div>

                  <span className={`rounded-full px-3 py-1 text-xs ${
                    attempt.validForQuali
                      ? "border border-emerald-300/20 bg-emerald-300/10 text-emerald-100"
                      : "border border-amber-300/20 bg-amber-300/10 text-amber-100"
                  }`}>
                    {attempt.status}
                  </span>
                </div>

                {attempt.reason && (
                  <p className="mt-2 text-xs leading-relaxed text-slate-400">
                    {attempt.reason}
                  </p>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <MethodologyModal
        index={openMethodology}
        onClose={() => setOpenMethodology(null)}
      />
    </div>
  );
}
function DataManagementPage() {
  const [selectedClientId, setSelectedClientId] = useState("cliente_x");
  const [sheetName, setSheetName] = useState("CLIENTEX");
  const [selectedFile, setSelectedFile] = useState(null);
  const [validationResult, setValidationResult] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState("");
  const [isValidating, setIsValidating] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const selectedClient = CLIENT_OPTIONS.find((client) => client.id === selectedClientId) || CLIENT_OPTIONS[0];

async function requestUploadValidation(mode) {
  if (!selectedFile) throw new Error("Selecione um arquivo .xlsx.");
  if (!sheetName.trim()) throw new Error("Digite o nome da aba a ser carregada.");

  const endpoint =
    mode === "import"
      ? "/api/import-publicacoes"
      : "/api/validate-publicacoes-upload";

  const formData = new FormData();
  formData.append("file", selectedFile);
  formData.append("clientId", selectedClient.id);
  formData.append("clientName", selectedClient.name);
  formData.append("sheetName", sheetName.trim());

  if (mode === "import") {
    formData.append("confirm", "true");
  }

  console.log("UPLOAD DEBUG", {
    mode,
    endpoint,
    fileName: selectedFile.name,
    fileSize: selectedFile.size,
    clientId: selectedClient.id,
    clientName: selectedClient.name,
    sheetName: sheetName.trim(),
  });

  let response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      body: formData,
    });
  } catch (fetchError) {
    console.error("UPLOAD FETCH ERROR", fetchError);
    throw new Error(
      `Falha ao chamar ${endpoint}: ${fetchError.message || fetchError}`
    );
  }

  const text = await response.text();

  console.log("UPLOAD RESPONSE DEBUG", {
    endpoint,
    status: response.status,
    ok: response.ok,
    responsePreview: text.slice(0, 500),
  });

  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = {
      error: "A API não retornou JSON válido.",
      rawResponse: text,
    };
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
        data.message ||
        data.rawResponse ||
        `Erro HTTP ${response.status} em ${endpoint}`
    );
  }

  return data;
}


  

  async function validateFile() {
    setError("");
    setImportResult(null);
    setValidationResult(null);
    setIsValidating(true);

    try {
      const data = await requestUploadValidation("validate");
      setValidationResult(data);
    } catch (err) {
      setError(err.message || "Erro ao validar arquivo.");
    } finally {
      setIsValidating(false);
    }
  }

  async function confirmImport() {
    setError("");
    setIsImporting(true);
  
    try {
      const data = await requestUploadValidation("import");
      setImportResult(data);
    } catch (err) {
      setError(err.message || "Erro ao importar arquivo.");
    } finally {
      setIsImporting(false);
    }
  }

  function cancelImport() {
    setValidationResult(null);
    setImportResult(null);
    setSelectedFile(null);
    setError("");
  }

  const summary = validationResult?.summary;
  const importSummary = importResult?.summary;

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex flex-col gap-3 border-b border-white/10 pb-4 md:flex-row md:items-start md:justify-between">
          <div>
            <SectionTitle>Gestão de Dados</SectionTitle>
            <p className="mt-1 text-sm text-slate-400">
              Importe planilhas de clipping para a base de publicações. Primeiro valide o arquivo; depois confirme a importação.
            </p>
          </div>
          <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
            Supabase · publicacoes
          </span>
        </div>

        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[220px_220px_1fr_auto]">
          <label className="text-sm text-slate-300">
            Cliente
            <select
              value={selectedClientId}
              onChange={(event) => setSelectedClientId(event.target.value)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-white outline-none"
            >
              {CLIENT_OPTIONS.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-300">
            Nome da aba
            <input
              value={sheetName}
              onChange={(event) => setSheetName(event.target.value)}
              placeholder="CLIENTEX"
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-3 text-sm text-white outline-none placeholder:text-slate-500"
            />
          </label>

          <label className="text-sm text-slate-300">
            Arquivo Excel
            <input
              type="file"
              accept=".xlsx,.xls"
              onChange={(event) => setSelectedFile(event.target.files?.[0] || null)}
              className="mt-2 w-full rounded-xl border border-white/10 bg-slate-950/70 px-3 py-2.5 text-sm text-slate-200 file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-300/10 file:px-3 file:py-2 file:text-cyan-100"
            />
          </label>

          <div className="flex items-end">
            <button
              onClick={validateFile}
              disabled={isValidating || !selectedFile}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/15 disabled:opacity-50"
            >
              <Upload size={17} />
              {isValidating ? "Validando..." : "Pré-validar"}
            </button>
          </div>
        </div>

        {selectedFile && (
          <p className="mt-3 text-xs text-slate-500">
            Arquivo selecionado: <span className="text-slate-300">{selectedFile.name}</span>
          </p>
        )}
      </Card>

      {error && (
        <div className="rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
          <AlertCircle className="mr-2 inline" size={18} />
          {error}
        </div>
      )}

      {summary && (
        <Card className="p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <SectionTitle>Resultado da pré-validação</SectionTitle>
              <p className="mt-1 text-sm text-slate-400">
                Nenhum dado foi salvo ainda. Confira o resumo antes de confirmar a importação.
              </p>
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs ${summary.rowsWithErrors ? "border-amber-300/20 bg-amber-300/10 text-amber-100" : "border-emerald-300/20 bg-emerald-300/10 text-emerald-100"}`}>
              {summary.rowsWithErrors ? "Com erros de linha" : "Pronto para importar"}
            </span>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              ["Linhas lidas", summary.totalRows],
              ["Válidas", summary.validRows],
              ["Vazias ignoradas", summary.ignoredEmptyRows],
              ["Com alertas", summary.rowsWithWarnings],
              ["Com erro", summary.rowsWithErrors],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-slate-950/45 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-2 font-serif text-2xl text-white">{Number(value || 0).toLocaleString("pt-BR")}</p>
              </div>
            ))}
          </div>

          <div className="mt-5 grid grid-cols-1 gap-4 xl:grid-cols-2">
            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Colunas reconhecidas</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(validationResult.columns?.recognized || []).map((column) => (
                  <span key={column} className="rounded-full border border-emerald-300/20 bg-emerald-300/10 px-2.5 py-1 text-xs text-emerald-100">
                    {column}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-slate-950/40 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Alertas resumidos</p>
              <div className="mt-3 space-y-2 text-sm text-slate-300">
                {(validationResult.warningsSummary || []).length ? (
                  validationResult.warningsSummary.map((item) => (
                    <p key={item.field}>
                      <span className="text-amber-200">{item.field}</span>: {item.count} linha(s)
                    </p>
                  ))
                ) : (
                  <p className="text-slate-500">Nenhum alerta relevante.</p>
                )}
              </div>
            </div>
          </div>

          {(validationResult.errors || []).length > 0 && (
            <div className="mt-4 rounded-xl border border-amber-300/20 bg-amber-300/10 p-4">
              <p className="text-xs uppercase tracking-wide text-amber-100">Erros encontrados, primeiros exemplos</p>
              <div className="mt-3 space-y-2 text-sm text-amber-50">
                {validationResult.errors.slice(0, 20).map((item, index) => (
                  <p key={`${item.row}-${item.field}-${index}`}>Linha {item.row}: {item.field} — {item.message}</p>
                ))}
              </div>
            </div>
          )}

          <div className="mt-5 overflow-x-auto">
            <p className="mb-2 text-xs uppercase tracking-wide text-slate-500">Prévia das primeiras linhas válidas</p>
            <table className="w-full min-w-[900px] border-separate border-spacing-y-2 text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2">Linha</th>
                  <th className="px-3 py-2">Título</th>
                  <th className="px-3 py-2">Veículo</th>
                  <th className="px-3 py-2">Data</th>
                  <th className="px-3 py-2">Tipo</th>
                  <th className="px-3 py-2">URL</th>
                </tr>
              </thead>
              <tbody>
                {(validationResult.preview || []).map((row) => (
                  <tr key={row.linha_original} className="bg-slate-950/45">
                    <td className="rounded-l-xl border-y border-l border-white/10 px-3 py-3 text-slate-400">{row.linha_original}</td>
                    <td className="border-y border-white/10 px-3 py-3 text-slate-100">{row.titulo}</td>
                    <td className="border-y border-white/10 px-3 py-3 text-slate-300">{row.veiculo}</td>
                    <td className="border-y border-white/10 px-3 py-3 text-slate-300">{row.data_publicacao || "—"}</td>
                    <td className="border-y border-white/10 px-3 py-3 text-slate-300">{row.tipo_midia || "—"}</td>
                    <td className="rounded-r-xl border-y border-r border-white/10 px-3 py-3 text-xs text-slate-500">{row.url ? "com link" : "sem link"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-5 flex flex-wrap justify-end gap-3 border-t border-white/10 pt-4">

            <button
              type="button"
              onClick={cancelImport}
              className="rounded-xl border border-white/10 bg-slate-950/50 px-4 py-3 text-sm text-slate-200 transition hover:bg-white/5"
            >
              Cancelar importação
            </button>
            
            <button
              type="button"
              onClick={confirmImport}
              disabled={isImporting || !validationResult}
              className="flex items-center gap-2 rounded-xl border border-emerald-300/25 bg-emerald-300/10 px-4 py-3 text-sm font-medium text-emerald-100 transition hover:bg-emerald-300/15 disabled:opacity-50"
            >
              <CheckCircle size={17} />
              {isImporting ? "Importando..." : "Confirmar importação"}
            </button>
            
          </div>
        </Card>
      )}

      {importSummary && (
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <CheckCircle className="mt-1 text-emerald-300" size={22} />
            <div>
              <SectionTitle>Importação concluída</SectionTitle>
              <p className="mt-1 text-sm text-slate-400">Os dados válidos foram gravados na tabela publicacoes.</p>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
            {[
              ["Importadas", importSummary.imported],
              ["Atualizadas", importSummary.updated],
              ["Ignoradas", importSummary.ignored],
              ["Com erro", importSummary.importErrors],
              ["Importação", importResult.importId || "—"],
            ].map(([label, value]) => (
              <div key={label} className="rounded-xl border border-white/10 bg-slate-950/45 p-4">
                <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
                <p className="mt-2 text-lg text-white">{typeof value === "number" ? value.toLocaleString("pt-BR") : value}</p>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}

export default function PRDashboard() {
  const defaultDateRange = useMemo(() => getPreviousMonthRange(), []);

  const [activePage, setActivePage] = useState("Visão Geral");
  const [publications, setPublications] = useState([]);
  const [clients, setClients] = useState([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedClient, setSelectedClient] = useState(null);
  const [monthlyData, setMonthlyData] = useState(FALLBACK_MONTHLY);
  const [vehicles, setVehicles] = useState([]);
  const [rules, setRules] = useState([]);
  const [periodAnalyses, setPeriodAnalyses] = useState([]);
  const [startDate, setStartDate] = useState(defaultDateRange.startDate);
  const [endDate, setEndDate] = useState(defaultDateRange.endDate);

  const [selectedYear, setSelectedYear] = useState(() =>
    getYearFromDateInput(defaultDateRange.startDate)
  );
  
  const [selectedMonth, setSelectedMonth] = useState(() =>
    getMonthFromDateInput(defaultDateRange.startDate)
  );
  
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("dados estáticos iniciais");
  const [selectedAiPublication, setSelectedAiPublication] = useState(null);

  const [authSession, setAuthSession] = useState(null);
  const [authUser, setAuthUser] = useState(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  function handleAnalyzePublication(publication) {
    setSelectedAiPublication(publication);

    window.setTimeout(() => {
      document.getElementById("ai-analysis-card")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
  }

  async function loadClients() {
    try {
      const response = await fetch("/api/get-clientes");
      const data = await response.json();
  
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Erro ao carregar clientes.");
      }
  
      const loadedClients = data.clients || data.clientes || [];
  
      setClients(loadedClients);
  
      if (!selectedClientId && loadedClients.length) {
        setSelectedClientId(loadedClients[0].id);
        setSelectedClient(loadedClients[0]);
        return loadedClients[0].id;
      }
  
      return selectedClientId;
    } catch (error) {
      setLoadError(error.message || "Erro ao carregar clientes.");
      setClients([]);
      setSelectedClientId("");
      setSelectedClient(null);
      return "";
    }
  }
  
  async function loadData(clientIdToLoad = selectedClientId) {
    setIsLoading(true);
    setLoadError("");
  
    try {
      let clientId = clientIdToLoad;
  
      if (!clientId) {
        clientId = await loadClients();
      }
  
      if (!clientId) {
        throw new Error("Selecione um cliente para carregar o dashboard.");
      }
  
      const response = await fetch(
        `/api/get-dashboard-data?clientId=${encodeURIComponent(clientId)}`
      );
  
      const data = await response.json();
  
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Erro ao carregar dados do dashboard.");
      }
  
      const normalizedPublications = (data.publications || [])
        .map(normalizeSupabasePublication)
        .filter((item) => item.title || item.vehicle);
  
      const normalizedMonthly = (data.monthlyData || [])
        .map(normalizeSupabaseMonthly)
        .filter(Boolean);
  
      const normalizedVehicles = (data.vehicles || [])
        .map(normalizeVehicle)
        .filter(Boolean);
  
      const normalizedRules = data.rules || [];
  
      setSelectedClientId(data.clientId);
      setSelectedClient(data.client || null);
      setPublications(normalizedPublications);
      setMonthlyData(normalizedMonthly);
      setVehicles(normalizedVehicles);
      setRules(normalizedRules);
      setPeriodAnalyses(data.periodAnalyses || []);
  
      if (!startDate || !endDate) {
        const latestRange = getLatestPublicationMonthRange(normalizedPublications);
      
        setStartDate(latestRange.startDate);
        setEndDate(latestRange.endDate);
        setSelectedYear(getYearFromDateInput(latestRange.startDate));
        setSelectedMonth(getMonthFromDateInput(latestRange.startDate));
      }

      
      setLastUpdated(
        `${new Date().toLocaleString("pt-BR", {
          dateStyle: "short",
          timeStyle: "short",
        })} · ${data.client?.nome || data.client?.name || data.clientId} via Supabase`
      );
    } catch (error) {
      setLoadError(error.message || "Não foi possível carregar os dados.");
      setPublications([]);
      setMonthlyData([]);
      setVehicles([]);
      setRules([]);
    } finally {
      setIsLoading(false);
    }
  }
    
  
  useEffect(() => {
    let mounted = true;
    let subscription = null;

    async function checkSession() {
      try {
        const hasSupabaseConfig =
          Boolean(import.meta.env.VITE_SUPABASE_URL) &&
          Boolean(import.meta.env.VITE_SUPABASE_ANON_KEY);

        if (!hasSupabaseConfig) {
          throw new Error(
            "Configuração do Supabase ausente no frontend. Confira VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY na Vercel."
          );
        }

        const sessionPromise = supabaseBrowser.auth.getSession();
        const timeoutPromise = new Promise((_, reject) => {
          window.setTimeout(() => {
            reject(new Error("Tempo esgotado ao verificar sessão do Supabase."));
          }, 6000);
        });

        const { data, error } = await Promise.race([sessionPromise, timeoutPromise]);

        if (!mounted) return;

        if (error) {
          throw new Error(error.message || "Erro ao verificar sessão.");
        }

        setAuthSession(data.session || null);
        setAuthUser(data.session?.user || null);
      } catch (error) {
        if (!mounted) return;

        console.error("AUTH CHECK ERROR", error);
        setAuthSession(null);
        setAuthUser(null);
        setLoginError(error.message || "Erro ao verificar acesso.");
      } finally {
        if (mounted) {
          setIsCheckingAuth(false);
        }
      }
    }

    checkSession();

    const authListener = supabaseBrowser.auth.onAuthStateChange((_event, session) => {
      setAuthSession(session || null);
      setAuthUser(session?.user || null);
      setIsCheckingAuth(false);
    });

    subscription = authListener?.data?.subscription || null;

    return () => {
      mounted = false;

      if (subscription) {
        subscription.unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    if (!authSession) return;

    async function start() {
      const initialClientId = await loadClients();

      if (initialClientId) {
        await loadData(initialClientId);
      }
    }

    start();
  }, [authSession]);

  async function handleLogin(event) {
    event.preventDefault();

    setLoginError("");
    setIsLoggingIn(true);

    try {
      const email = loginEmail.trim();

      if (!email || !loginPassword) {
        throw new Error("Informe email e senha.");
      }

      const { data, error } = await supabaseBrowser.auth.signInWithPassword({
        email,
        password: loginPassword,
      });

      if (error) {
        throw new Error(error.message || "Não foi possível fazer login.");
      }

      setAuthSession(data.session || null);
      setAuthUser(data.user || null);
      setLoginPassword("");
    } catch (error) {
      setLoginError(error.message || "Erro ao fazer login.");
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function handleLogout() {
    await supabaseBrowser.auth.signOut();

    setAuthSession(null);
    setAuthUser(null);
    setPublications([]);
    setMonthlyData([]);
    setVehicles([]);
    setRules([]);
    setPeriodAnalyses([]);
    setLastUpdated("");
    setSelectedClientId("");
    setSelectedClient(null);
  }

  const yearOptions = useMemo(() => {
    const years = new Set();
  
    publications.forEach((publication) => {
      const date = publication.publicationDate;
  
      if (date instanceof Date && !Number.isNaN(date.getTime())) {
        years.add(date.getFullYear());
      }
    });
  
    monthlyData.forEach((item) => {
      if (item.year) {
        years.add(Number(item.year));
      } else if (item.sortKey) {
        years.add(Number(String(item.sortKey).slice(0, 4)));
      }
    });
  
    years.add(Number(selectedYear) || new Date().getFullYear());
  
    return Array.from(years)
      .filter(Boolean)
      .sort((a, b) => b - a);
  }, [publications, monthlyData, selectedYear]);
  
  function handleMonthFilterChange(nextMonth) {
    setSelectedMonth(nextMonth);
  
    const range = getDateRangeFromMonthYear(selectedYear, nextMonth);
  
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  }
  
  function handleYearFilterChange(nextYear) {
    const numericYear = Number(nextYear);
  
    setSelectedYear(numericYear);
  
    const range = getDateRangeFromMonthYear(numericYear, selectedMonth);
  
    setStartDate(range.startDate);
    setEndDate(range.endDate);
  }


  
  const filteredPublications = useMemo(() => {
    const start = startDate ? new Date(`${startDate}T00:00:00`) : null;
    const end = endDate ? new Date(`${endDate}T23:59:59`) : null;

    return publications.filter((publication) => {
      if (!publication.publicationDate) return false;
      if (start && publication.publicationDate < start) return false;
      if (end && publication.publicationDate > end) return false;
      return true;
    });
  }, [publications, startDate, endDate]);

  const dashboard = useMemo(() => {
    const channels = groupChannels(filteredPublications);
    const themes = groupRows(filteredPublications, (row) => row.subject || "Sem assunto", () => 1, 10);
    const topUFs = groupRows(filteredPublications, (row) => row.uf || "ND", () => 1, 10);
    const tiers = groupTiers(filteredPublications);

    const cm = filteredPublications.reduce((sum, row) => sum + (row.cm || 0), 0);
    const mediaValue = filteredPublications.reduce((sum, row) => sum + (row.oldValuation || 0), 0);
    const reach = filteredPublications.reduce((sum, row) => sum + (row.audience || row.uniqueVisitors || 0), 0);

    return {
      kpis: {
        publications: filteredPublications.length,
        cm,
        mediaValue,
        reach,
      },
      channels,
      themes,
      topUFs,
      tiers,
    };
  }, [filteredPublications]);

  const monthlyWindow = useMemo(
    () => buildMonthlyWindowFromPeriod(monthlyData, selectedYear, selectedMonth),
    [monthlyData, selectedYear, selectedMonth]
  );

  const selectedPeriodAnalysis = useMemo(() => {
    const year = Number(selectedYear);
    const month = String(selectedMonth || "");
  
    if (!year || !month) return null;
  
    return (
      periodAnalyses.find((item) => {
        return Number(item.ano) === year && String(item.mes) === month;
      }) || null
    );
  }, [periodAnalyses, selectedYear, selectedMonth]);  

  
  const vehicleIndex = useMemo(() => buildVehicleIndex(vehicles), [vehicles]);

  const valuationPublicationRows = useMemo(
    () => filteredPublications.map((publication) => ({ ...publication, ...calculateValuation(publication, vehicleIndex) })),
    [filteredPublications, vehicleIndex]
  );

  const topChannel = dashboard.channels[0] || { name: "—", publications: 0 };
  const topTheme = dashboard.themes[0] || { name: "—", value: 0 };
  const totalChannelPublications = dashboard.channels.reduce((sum, item) => sum + item.publications, 0);

  const periodLabel =
    startDate && endDate
      ? `${startDate.split("-").reverse().join("/")} – ${endDate.split("-").reverse().join("/")}`
      : "Período personalizado";

  const ValuationMonthlyCard = () => (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <SectionTitle>Valoração mês a mês</SectionTitle>
          <p className="mt-1 text-sm text-slate-400">Base Supabase · dados_mensais · histórico independente do filtro</p>
        </div>
        <span className="rounded-full border border-cyan-300/20 bg-cyan-300/10 px-3 py-1 text-xs text-cyan-100">
          Retorno de mídia
        </span>
      </div>

      <div className="mt-4">
        <MonthlyComboChart
          data={monthlyWindow}
          lineDataKey="mediaValue"
          lineLabel="Equivalência Publicitária (R$)"
          lineColor="#69d5ff"
          lineValueFormatter={formatBRLMillionsLabel}
          lineAxisFormatter={(v) => `R$ ${v}M`}
        />
      </div>

      <p className="mt-3 border-t border-white/10 pt-3 text-sm leading-relaxed text-slate-300">
        <TrendingUp className="mr-2 inline text-cyan-300" size={18} />
        As barras mostram publicações e a linha mostra a valoração mensal.
      </p>
    </Card>
  );

  const PublicationsValuationCard = () => (
    <Card className="p-5">
      <SectionTitle>Publicações x Valoração</SectionTitle>
      <div className="mt-4 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={dashboard.channels} margin={{ top: 15, right: 20, left: 0, bottom: 20 }}>
            <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
            <XAxis dataKey="name" tick={{ fill: "#cbd5e1", fontSize: 11 }} interval={0} angle={-10} textAnchor="end" height={55} />
            <YAxis yAxisId="left" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill: "#cbd5e1", fontSize: 12 }} tickFormatter={(v) => `${v / 1000000}M`} />
            <Tooltip
              formatter={(value, name) => (name === "Valoração" ? compactBRL(value) : Number(value).toLocaleString("pt-BR"))}
              contentStyle={{ background: "#081522", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12 }}
            />
            <Bar yAxisId="left" dataKey="publications" name="Publicações" fill="#c9d40b" radius={[6, 6, 0, 0]} />
            <Line yAxisId="right" type="monotone" dataKey="value" name="Valoração" stroke="#6bd5ef" strokeWidth={3} dot={{ r: 4 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <p className="mt-3 border-t border-white/10 pt-3 text-sm leading-relaxed text-slate-300">
        <Sparkles className="mr-2 inline text-amber-300" size={18} />O canal líder no período é {topChannel.name}, com{" "}
        {topChannel.publications} inserções.
      </p>
    </Card>
  );

  if (isCheckingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
        <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-6 text-sm text-slate-300 shadow-2xl">
          Verificando acesso...
        </div>
      </div>
    );
  }

  if (!authSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-6 text-slate-100">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl">
          <div className="mb-8">
            <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
              PR Dashboard
            </p>

            <h1 className="mt-3 text-3xl font-semibold text-white">
              Acesse sua conta
            </h1>

            <p className="mt-3 text-sm text-slate-400">
              Entre com seu email e senha para visualizar o dashboard.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-500">
                Email
              </label>

              <input
                type="email"
                value={loginEmail}
                onChange={(event) => setLoginEmail(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/50"
                placeholder="seu@email.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="mb-2 block text-xs uppercase tracking-[0.2em] text-slate-500">
                Senha
              </label>

              <input
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-slate-950/80 px-4 py-3 text-sm text-slate-100 outline-none transition focus:border-cyan-300/50"
                placeholder="Digite sua senha"
                autoComplete="current-password"
              />
            </div>

            {loginError && (
              <div className="rounded-xl border border-rose-300/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full rounded-xl border border-cyan-300/30 bg-cyan-300/10 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggingIn ? "Entrando..." : "Entrar"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030b13] text-slate-100">
      <div className="flex">

        <aside className="hidden min-h-screen w-64 shrink-0 border-r border-white/10 bg-black/30 px-4 py-6 lg:block">
          <button
            type="button"
            onClick={() => setActivePage("Visão Geral")}
            className="mb-10 block transition hover:opacity-80"
            aria-label="Voltar para a visão geral"
          >
            <img
              src="/logoxcomatreviapreto.jpg"
              alt="XCOM by ATREVIA"
              className="h-auto w-44 object-contain"
            />
          </button>
                  
          <nav className="space-y-5">
            {navGroups.map((group, groupIndex) => (
              <div
                key={`nav-group-${groupIndex}`}
                className={groupIndex > 0 ? "border-t border-white/10 pt-5" : ""}
              >
                <div className="space-y-3">
                  {group.map(([Icon, label]) => {
                    const active = activePage === label;
          
                    return (
                      <button
                        key={label}
                        type="button"
                        onClick={() => setActivePage(label)}
                        className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm transition ${
                          active
                            ? "bg-amber-400/15 text-amber-200"
                            : "text-slate-300 hover:bg-white/5 hover:text-white"
                        }`}
                      >
                        <Icon size={20} />
                        <span>{label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>

        


        <main className="w-full px-6 py-6 lg:px-9">
          <header className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-4">
                <h1 className="font-serif text-4xl text-white md:text-5xl">Resultados de Mídia</h1>
                <span className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300">Relatório</span>
              </div>
              <p className="mt-1 text-xl text-slate-300">
                {selectedClient?.nome || selectedClient?.name || "Cliente selecionado"} — dados dinâmicos por período
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 xl:w-auto xl:min-w-[620px]">
              <div className="flex w-full items-center justify-between gap-3">
                <select
                  value={selectedClientId}
                  onChange={(event) => {
                    const nextClientId = event.target.value;
                    const nextClient = clients.find((client) => client.id === nextClientId) || null;
            
                    setSelectedClientId(nextClientId);
                    setSelectedClient(nextClient);
            
                    if (nextClientId) {
                      loadData(nextClientId);
                    }
                  }}
                  className="h-12 min-w-[220px] rounded-xl border border-white/10 bg-slate-950/80 px-4 text-sm text-slate-100 outline-none transition focus:border-cyan-300/50"
                >
                  <option value="">Selecione um cliente</option>
            
                  {clients.map((client) => (
                    <option key={client.id} value={client.id}>
                      {client.nome || client.name || client.id}
                    </option>
                  ))}
                </select>
            
                <div className="ml-auto flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-slate-950/70 px-4 text-sm text-slate-200">
                  <span className="max-w-[260px] truncate text-slate-300">
                    {authUser?.email}
                  </span>
            
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-100 transition hover:bg-white/10"
                  >
                    Sair
                  </button>
                </div>
              </div>
            
              <div className="flex w-full flex-wrap items-center justify-end gap-3">
                <label className="flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-slate-950/70 px-4 text-xs text-slate-400">
                  <span>Mês</span>
                
                  <select
                    value={selectedMonth}
                    onChange={(event) => handleMonthFilterChange(event.target.value)}
                    className="bg-transparent text-sm text-slate-100 outline-none"
                  >
                    {MONTH_FILTER_OPTIONS.map((month) => (
                      <option key={month.value} value={month.value} className="bg-slate-950 text-slate-100">
                        {month.label}
                      </option>
                    ))}
                  </select>
                </label>
                
                <label className="flex h-12 items-center gap-3 rounded-xl border border-white/10 bg-slate-950/70 px-4 text-xs text-slate-400">
                  <span>Ano</span>
                
                  <select
                    value={selectedYear}
                    onChange={(event) => handleYearFilterChange(event.target.value)}
                    className="bg-transparent text-sm text-slate-100 outline-none"
                  >
                    {yearOptions.map((year) => (
                      <option key={year} value={year} className="bg-slate-950 text-slate-100">
                        {year}
                      </option>
                    ))}
                  </select>
                </label>                
            
                <button
                  type="button"
                  onClick={() => loadData(selectedClientId)}
                  disabled={!selectedClientId || isLoading}
                  className="flex h-12 items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-5 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/15 disabled:opacity-60"
                >
                  <RefreshCw size={17} className={isLoading ? "animate-spin" : ""} />
                  {isLoading ? "Carregando..." : "Carregar dados"}
                </button>
                
                <p className="mt-2 text-xs text-slate-500">
                  Última atualização: <span className="text-slate-300">{lastUpdated}</span>
                </p>
                
              </div>
            </div>


          </header>

          {loadError && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
              <AlertCircle size={18} /> {loadError}
            </div>
          )}

          {activePage === "Gestão de Dados" ? (
            <DataManagementPage />
          ) : activePage === "Reputação" ? (
            <ReputationPage
              selectedClient={selectedClient}
              startDate={startDate}
              endDate={endDate}
            />
          ) : activePage === "Valorações" ? (
            <>
              <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <ValuationMonthlyCard />
                <PublicationsValuationCard />
              </section>

              <section id="ai-analysis-card" className="mt-4 scroll-mt-6">
                <AiAnalysisCard selectedPublication={selectedAiPublication} />
              </section>

              <section className="mt-4">
                <ValuationPublicationsCard rows={valuationPublicationRows} onAnalyzePublication={handleAnalyzePublication} />
              </section>
            </>
          ) : (
            <>
              <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                <KpiCard
                  icon={Newspaper}
                  label="Resultados na imprensa"
                  value={dashboard.kpis.publications.toLocaleString("pt-BR")}
                  helper="publicações no período filtrado"
                  accent="cyan"
                />
                <KpiCard
                  icon={ClipboardList}
                  label="Centimetragem total"
                  value={dashboard.kpis.cm.toLocaleString("pt-BR")}
                  helper="CM somado na base filtrada"
                  accent="yellow"
                />
                <KpiCard
                  icon={Coins}
                  label="Equivalência publicitária"
                  value={compactBRL(dashboard.kpis.mediaValue)}
                  helper="retorno de mídia no período"
                  accent="blue"
                />
                <KpiCard
                  icon={Users}
                  label="Alcance estimado"
                  value={compactNumber(dashboard.kpis.reach)}
                  helper="audiência/alcance no período"
                  accent="green"
                />
              </section>

              <section className="mt-4">
                <AnalysisTextCard title={selectedPeriodAnalysis?.leitura_geral_titulo || "Leitura geral dos resultados"}>
                  {selectedPeriodAnalysis?.leitura_geral_texto ||
                    "Análise não cadastrada para o período."}
                </AnalysisTextCard>
              </section>

              <section className="mt-4 space-y-4">
                <ValuationMonthlyCard />
              
                <AnalysisTextCard title={selectedPeriodAnalysis?.valoracao_titulo || "Análise da valoração mês a mês"}>
                  {selectedPeriodAnalysis?.valoracao_texto ||
                    "Análise não cadastrada para o período."}
                </AnalysisTextCard>
              </section>
              
              <section className="mt-4 space-y-4">
                <Card className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <SectionTitle>Alcance mês a mês</SectionTitle>
                      <p className="mt-1 text-sm text-slate-400">
                        Base Supabase · dados_mensais · histórico independente do filtro
                      </p>
                    </div>
              
                    <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs text-amber-100">
                      Audiência
                    </span>
                  </div>
              
                  <div className="mt-4">
                    <MonthlyComboChart
                      data={monthlyWindow}
                      lineDataKey="reach"
                      lineLabel="Alcance"
                      lineColor="#7bc9ff"
                      lineValueFormatter={formatMillionsLabel}
                      lineAxisFormatter={(v) => `${v}M`}
                    />
                  </div>
              
                  <p className="mt-3 border-t border-white/10 pt-3 text-sm leading-relaxed text-slate-300">
                    <Users className="mr-2 inline text-amber-300" size={18} />
                    As barras mostram publicações e a linha mostra o alcance estimado.
                  </p>
                </Card>
              
                <AnalysisTextCard title={selectedPeriodAnalysis?.alcance_titulo || "Análise do alcance mês a mês"}>
                  {selectedPeriodAnalysis?.alcance_texto ||
                    "Análise não cadastrada para o período."}
                </AnalysisTextCard>
              </section>
              
              <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <PublicationsValuationCard />
              
                <Card className="p-5">
                  <SectionTitle>Distribuição Regional</SectionTitle>
              
                  <div className="mt-4 h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={dashboard.topUFs} margin={{ top: 10, right: 20, left: 0, bottom: 20 }}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                        <XAxis dataKey="name" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                        <YAxis tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                        <Tooltip
                          contentStyle={{
                            background: "#081522",
                            border: "1px solid rgba(255,255,255,.12)",
                            borderRadius: 12,
                          }}
                        />
                        <Bar dataKey="value" name="Publicações" fill="#70d6c9" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
              
                  <p className="mt-3 border-t border-white/10 pt-3 text-sm leading-relaxed text-slate-300">
                    <Globe2 className="mr-2 inline text-cyan-300" size={18} />
                    Ranking por UF calculado a partir das publicações filtradas.
                  </p>
                </Card>
              </section>

              <section className="mt-4 space-y-4">
                <Card className="p-5">
                  <SectionTitle>Análise Qualitativa x Quantitativa</SectionTitle>
              
                  <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-[0.6fr_1.4fr]">
                    <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
                      <p className="text-lg font-semibold text-amber-300">
                        {dashboard.themes.length} temas/assuntos mapeados
                      </p>
              
                      <p className="mt-2 text-sm leading-relaxed text-slate-300">
                        A coluna “Assunto” alimenta o ranking. O destaque do período é {topTheme.name}.
                      </p>
              
                      <div className="mt-4 rounded-xl bg-slate-900/80 p-3 text-xs text-slate-300">
                        Este bloco responde ao filtro de datas no topo.
                      </div>
                    </div>
              
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashboard.themes} margin={{ top: 5, right: 10, left: 0, bottom: 45 }}>
                          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                          <XAxis
                            dataKey="name"
                            tick={{ fill: "#cbd5e1", fontSize: 10 }}
                            interval={0}
                            angle={-30}
                            textAnchor="end"
                            height={55}
                          />
                          <YAxis tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                          <Tooltip
                            contentStyle={{
                              background: "#081522",
                              border: "1px solid rgba(255,255,255,.12)",
                              borderRadius: 12,
                            }}
                          />
                          <Bar dataKey="value" name="Publicações" fill="#c9d40b" radius={[5, 5, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </Card>
              
                <AnalysisTextCard title={selectedPeriodAnalysis?.quali_quanti_titulo || "Análise quali e quanti"}>
                  {selectedPeriodAnalysis?.quali_quanti_texto ||
                    "Análise não cadastrada para o período."}
                </AnalysisTextCard>
              
                <Card className="p-5">
                  <SectionTitle>Análise dos Canais</SectionTitle>
              
                  <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-[1.4fr_0.8fr]">
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashboard.channels} layout="vertical" margin={{ top: 5, right: 25, left: 25, bottom: 5 }}>
                          <CartesianGrid stroke="rgba(255,255,255,0.08)" horizontal={false} />
                          <XAxis type="number" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                          <YAxis
                            type="category"
                            dataKey="name"
                            tick={{ fill: "#e2e8f0", fontSize: 12 }}
                            width={100}
                          />
                          <Tooltip
                            contentStyle={{
                              background: "#081522",
                              border: "1px solid rgba(255,255,255,.12)",
                              borderRadius: 12,
                            }}
                          />
                          <Bar dataKey="publications" name="Publicações" fill="#70d6c9" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
              
                    <div className="h-72">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={dashboard.tiers}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={58}
                            outerRadius={98}
                            paddingAngle={2}
                            label={({ value }) => `${value}%`}
                          >
                            {dashboard.tiers.map((entry, index) => (
                              <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
              
                          <Tooltip
                            contentStyle={{
                              background: "#081522",
                              border: "1px solid rgba(255,255,255,.12)",
                              borderRadius: 12,
                            }}
                          />
              
                          <Legend wrapperStyle={{ color: "#cbd5e1", fontSize: 12 }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
              
                  <p className="mt-3 text-xs text-slate-400">
                    Total por canal exibido: {totalChannelPublications.toLocaleString("pt-BR")} publicações classificadas.
                  </p>
                </Card>
              </section>
              
              <footer className="mt-8 border-t border-white/10 py-6 text-center">
                <p className="text-xs uppercase tracking-[0.3em] text-slate-500">
                  XCOM by ATREVIA
                </p>
              
                <p className="mt-2 text-sm text-slate-400">
                  Relatório de resultados de mídia e reputação.
                </p>
              </footer>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
