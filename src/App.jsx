import React, { useEffect, useMemo, useState } from "react";
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
} from "lucide-react";

const SHEET_ID = "1RBM6VjmVufmkvueq05wanBBoKMbExouW";
const PUBLICATIONS_SHEET = "CLIENTEX";
const MONTHLY_SHEET = "CLIENTEXMENSAIS";

const VALUATION_SHEET_ID = "1DcmLM7TpOuc_5EJUkydhSMcVBMkKTTzg";
const VEHICLES_SHEET = "Veiculos";
const RULES_SHEET = "Regras";

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
    url: getValue(row, ["Link", "URL", "Url", "Link da matéria", "Link da Materia"]),
    raw: row,
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

function normalizeVehicle(row) {
  const vehicle = getValue(row, ["Veiculo", "Veículo", "Nome", "Nome do Veículo", "Nome do Veiculo"]);
  if (!vehicle) return null;

  return {
    id: getValue(row, ["ID_Veiculo", "ID Veiculo", "Id", "ID"]),
    vehicle,
    mediaType: getValue(row, ["Tipo_Midia", "Tipo Midia", "Tipo de mídia", "Tipo de midia", "Tipo"]),
    segment: getValue(row, ["Segmento"]),
    market: getValue(row, ["Praca", "Praça", "Cidade", "UF"]),
    tier: getValue(row, ["Tier"]),
    audience: parseNumber(
      getValue(row, ["Audiencia_Estimada", "Audiência Estimada", "Audiencia Estimada", "Audiencia", "Audiência", "Alcance"])
    ),
    cpm: parseNumber(getValue(row, ["CPM_Ref", "CPM Ref", "CPM", "Cpm"])),
    pageValue: parseNumber(getValue(row, ["Valor_Pagina", "Valor Página", "Valor Pagina", "Valor de página", "Valor de pagina"])),
    cmValue: parseNumber(getValue(row, ["Valor_CM_Coluna", "Valor CM Coluna", "Valor_CM", "Valor CM", "Valor cm/coluna"])),
    value30s: parseNumber(getValue(row, ["Valor_30s", "Valor 30s", "Valor 30 segundos", "Valor_30"])),
    updated: getValue(row, ["Dados atualizados", "Dados Atualizados", "Atualizado"]),
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
    source = "Sem correspondência na aba Veiculos";
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
    status = "Dados insuficientes";
    source = "Falta duração da inserção ou Valor_30s";
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

  const canCalculate = status === "Calculado" || status === "Calculado · página padrão";
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

const navItems = [
  [Home, "Visão Geral"],
  [Coins, "Valorações"],
  [TrendingUp, "Evolução"],
  [PieIcon, "Análises"],
  [Megaphone, "Canais"],
  [Layers, "Temas"],
  [BarChart3, "Benchmark"],
  [FileText, "Relatórios"],
  [Settings, "Configurações"],
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
    <Card className="flex min-h-[150px] items-center gap-6 p-6">
      <div className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-full border ${colorMap[accent]}`}>
        <Icon size={38} strokeWidth={1.6} />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wide text-slate-300">{label}</p>
        <p className="mt-2 font-serif text-5xl leading-none text-white">{value}</p>
        <p className="mt-2 text-sm text-slate-300">{helper}</p>
      </div>
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

function AiAnalysisCard() {
  const [url, setUrl] = useState("");
  const [clientName, setClientName] = useState("Cliente X");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  async function analyze() {
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const response = await fetch("/api/analyze-publication", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          url,
          clientName,
          title: "",
          vehicle: "",
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro na análise.");
      }

      setResult(data);
    } catch (err) {
      setError(err.message || "Erro inesperado.");
    } finally {
      setLoading(false);
    }
  }

  const analysis = result?.analysis;

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

      {result?.extraction && (
        <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Texto extraído</p>
          <p className="mt-2 font-medium text-slate-100">{result.extraction.title || "Sem título extraído"}</p>
          <p className="mt-2 text-xs text-slate-500">{result.extraction.textLength} caracteres</p>
          <p className="mt-3 text-sm leading-relaxed text-slate-300">{result.extraction.preview}</p>
        </div>
      )}

      {analysis && (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-4">
          {[
            ["Presença", analysis.presence],
            ["Destaque", analysis.highlight],
            ["Protagonismo", analysis.protagonism],
            ["Tom", analysis.tone],
          ].map(([label, item]) => (
            <div key={label} className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">{label}</p>
              <p className="mt-2 text-lg font-semibold text-white">{item?.category}</p>
              <p className="mt-1 text-sm text-cyan-200">Fator {item?.factor}</p>
              <p className="mt-3 text-xs leading-relaxed text-slate-400">{item?.justification}</p>
            </div>
          ))}
        </div>
      )}

      {analysis?.evidence?.length > 0 && (
        <div className="mt-4 rounded-xl border border-white/10 bg-slate-950/40 p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Evidências</p>
          <ul className="mt-2 space-y-2 text-sm text-slate-300">
            {analysis.evidence.map((item, index) => (
              <li key={`${item}-${index}`}>“{item}”</li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}

function ValuationPublicationsCard({ rows }) {
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

                <td className="rounded-r-xl border-y border-r border-white/10 px-3 py-3">
                  <span className="rounded-full border border-amber-300/20 bg-amber-300/10 px-2.5 py-1 text-xs text-amber-100">
                    {row.status}
                  </span>
                  <p className="mt-2 max-w-[280px] text-xs leading-relaxed text-slate-500">{row.detail}</p>
                </td>
              </tr>
            ))}

            {!rows.length && (
              <tr>
                <td colSpan={5} className="rounded-xl border border-white/10 bg-slate-950/45 px-4 py-8 text-center text-slate-400">
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

export default function PRDashboard() {
  const defaultDateRange = useMemo(() => getPreviousMonthRange(), []);

  const [activePage, setActivePage] = useState("Visão Geral");
  const [publications, setPublications] = useState([]);
  const [monthlyData, setMonthlyData] = useState(FALLBACK_MONTHLY);
  const [vehicles, setVehicles] = useState([]);
  const [rules, setRules] = useState([]);
  const [startDate, setStartDate] = useState(defaultDateRange.startDate);
  const [endDate, setEndDate] = useState(defaultDateRange.endDate);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [lastUpdated, setLastUpdated] = useState("dados estáticos iniciais");

  async function loadData() {
    setIsLoading(true);
    setLoadError("");

    try {
      const [publicationsResponse, monthlyResponse, vehiclesResponse, rulesResponse] = await Promise.all([
        fetch(csvUrl(PUBLICATIONS_SHEET)),
        fetch(csvUrl(MONTHLY_SHEET)),
        fetch(csvUrl(VEHICLES_SHEET, VALUATION_SHEET_ID)),
        fetch(csvUrl(RULES_SHEET, VALUATION_SHEET_ID)),
      ]);

      if (!publicationsResponse.ok) throw new Error(`Erro ao carregar ${PUBLICATIONS_SHEET}`);
      if (!monthlyResponse.ok) throw new Error(`Erro ao carregar ${MONTHLY_SHEET}`);
      if (!vehiclesResponse.ok) throw new Error(`Erro ao carregar ${VEHICLES_SHEET}`);

      const [publicationsCsv, monthlyCsv, vehiclesCsv, rulesCsv] = await Promise.all([
        publicationsResponse.text(),
        monthlyResponse.text(),
        vehiclesResponse.text(),
        rulesResponse.ok ? rulesResponse.text() : Promise.resolve(""),
      ]);

      const looksLikeHtml = (text) => String(text || "").trim().startsWith("<") || String(text || "").includes("<html");

      if (looksLikeHtml(publicationsCsv)) throw new Error(`A aba ${PUBLICATIONS_SHEET} não retornou CSV.`);
      if (looksLikeHtml(monthlyCsv)) throw new Error(`A aba ${MONTHLY_SHEET} não retornou CSV.`);
      if (looksLikeHtml(vehiclesCsv)) throw new Error(`A aba ${VEHICLES_SHEET} não retornou CSV.`);

      const normalizedPublications = rowsToObjects(parseCSV(publicationsCsv))
        .map(normalizePublication)
        .filter((item) => item.title || item.vehicle);

      const normalizedMonthly = rowsToObjects(parseCSV(monthlyCsv)).map(normalizeMonthly).filter(Boolean);
      const normalizedVehicles = rowsToObjects(parseCSV(vehiclesCsv)).map(normalizeVehicle).filter(Boolean);
      const normalizedRules = rulesCsv ? rowsToObjects(parseCSV(rulesCsv)) : [];

      setPublications(normalizedPublications);
      if (normalizedMonthly.length) setMonthlyData(normalizedMonthly);
      setVehicles(normalizedVehicles);
      setRules(normalizedRules);

      setLastUpdated(new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }));
    } catch (error) {
      setLoadError(error.message || "Não foi possível carregar os dados.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

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
    () => [...monthlyData].sort((a, b) => (a.sortKey || a.month).localeCompare(b.sortKey || b.month)).slice(-13),
    [monthlyData]
  );

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
          <p className="mt-1 text-sm text-slate-400">Base CLIENTEXMENSAIS · histórico independente do filtro</p>
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

  return (
    <div className="min-h-screen bg-[#030b13] text-slate-100">
      <div className="flex">
        <aside className="hidden min-h-screen w-48 shrink-0 border-r border-white/10 bg-black/30 px-4 py-8 lg:block">
          <div className="mb-12 ml-16 h-8 w-1 rounded bg-amber-300" />

          <nav className="space-y-3">
            {navItems.map(([Icon, label]) => {
              const active = activePage === label;

              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => setActivePage(label)}
                  className={`flex w-full items-center gap-3 rounded-lg px-4 py-3 text-left text-sm transition ${
                    active ? "bg-amber-400/15 text-amber-200" : "text-slate-300 hover:bg-white/5 hover:text-white"
                  }`}
                >
                  <Icon size={20} />
                  <span>{label}</span>
                </button>
              );
            })}
          </nav>

          <div className="absolute bottom-8 left-5 rounded-xl border border-white/10 bg-slate-900/80 p-4 text-xs text-slate-300">
            <Calendar size={20} className="mb-3 text-slate-300" />
            <p>Última atualização</p>
            <p className="mt-2">
              <span className="text-emerald-400">●</span> {lastUpdated}
            </p>
          </div>
        </aside>

        <main className="w-full px-6 py-6 lg:px-9">
          <header className="mb-4 flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-4">
                <h1 className="font-serif text-4xl text-white md:text-5xl">Dashboard de Resultados de PR</h1>
                <span className="rounded-lg border border-white/10 px-4 py-2 text-sm text-slate-300">Relatório mensal</span>
              </div>
              <p className="mt-1 text-xl text-slate-300">Cliente X — dados dinâmicos por período</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={loadData}
                disabled={isLoading}
                className="flex items-center gap-2 rounded-lg border border-cyan-300/25 bg-cyan-300/10 px-4 py-3 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/15 disabled:opacity-60"
              >
                <RefreshCw size={17} className={isLoading ? "animate-spin" : ""} />
                {isLoading ? "Carregando..." : "Carregar dados"}
              </button>

              <label className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-400">
                Início
                <input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="ml-2 bg-transparent text-sm text-slate-100 outline-none"
                />
              </label>

              <label className="rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-400">
                Fim
                <input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="ml-2 bg-transparent text-sm text-slate-100 outline-none"
                />
              </label>

              <div className="flex items-center gap-3 rounded-lg border border-white/10 bg-slate-950/70 px-4 py-3 text-sm text-slate-200">
                <Calendar size={18} /> {periodLabel}
              </div>
            </div>
          </header>

          {loadError && (
            <div className="mb-4 flex items-center gap-3 rounded-xl border border-amber-300/20 bg-amber-300/10 px-4 py-3 text-sm text-amber-100">
              <AlertCircle size={18} /> {loadError}
            </div>
          )}

          {activePage === "Valorações" ? (
            <>
              <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <ValuationMonthlyCard />
                <PublicationsValuationCard />
              </section>

              <section className="mt-4">
                <AiAnalysisCard />
              </section>

              <section className="mt-4">
                <ValuationPublicationsCard rows={valuationPublicationRows} />
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

              <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <ValuationMonthlyCard />

                <Card className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <SectionTitle>Alcance mês a mês</SectionTitle>
                      <p className="mt-1 text-sm text-slate-400">Base CLIENTEXMENSAIS · histórico independente do filtro</p>
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
                        <Tooltip contentStyle={{ background: "#081522", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12 }} />
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

              <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-2">
                <Card className="p-5">
                  <SectionTitle>Análise Qualitativa x Quantitativa</SectionTitle>
                  <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-[0.85fr_1.4fr]">
                    <div className="rounded-xl border border-white/10 bg-slate-950/50 p-4">
                      <p className="text-lg font-semibold text-amber-300">{dashboard.themes.length} temas/assuntos mapeados</p>
                      <p className="mt-2 text-sm leading-relaxed text-slate-300">
                        A coluna “Assunto” alimenta o ranking. O destaque do período é {topTheme.name}.
                      </p>
                      <div className="mt-4 rounded-xl bg-slate-900/80 p-3 text-xs text-slate-300">
                        Este bloco responde ao filtro de datas no topo.
                      </div>
                    </div>

                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashboard.themes} margin={{ top: 5, right: 10, left: 0, bottom: 45 }}>
                          <CartesianGrid stroke="rgba(255,255,255,0.08)" vertical={false} />
                          <XAxis dataKey="name" tick={{ fill: "#cbd5e1", fontSize: 10 }} interval={0} angle={-30} textAnchor="end" height={55} />
                          <YAxis tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                          <Tooltip contentStyle={{ background: "#081522", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12 }} />
                          <Bar dataKey="value" name="Publicações" fill="#c9d40b" radius={[5, 5, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </Card>

                <Card className="p-5">
                  <SectionTitle>Análise dos Canais</SectionTitle>
                  <div className="mt-4 grid grid-cols-1 gap-5 md:grid-cols-[1.2fr_0.9fr]">
                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={dashboard.channels} layout="vertical" margin={{ top: 5, right: 25, left: 25, bottom: 5 }}>
                          <CartesianGrid stroke="rgba(255,255,255,0.08)" horizontal={false} />
                          <XAxis type="number" tick={{ fill: "#cbd5e1", fontSize: 12 }} />
                          <YAxis type="category" dataKey="name" tick={{ fill: "#e2e8f0", fontSize: 12 }} width={100} />
                          <Tooltip contentStyle={{ background: "#081522", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12 }} />
                          <Bar dataKey="publications" name="Publicações" fill="#70d6c9" radius={[0, 6, 6, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="h-52">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={dashboard.tiers}
                            dataKey="value"
                            nameKey="name"
                            innerRadius={48}
                            outerRadius={78}
                            paddingAngle={2}
                            label={({ value }) => `${value}%`}
                          >
                            {dashboard.tiers.map((entry, index) => (
                              <Cell key={entry.name} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ background: "#081522", border: "1px solid rgba(255,255,255,.12)", borderRadius: 12 }} />
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

              <section className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[1.3fr_0.7fr]">
                <Card className="p-5">
                  <SectionTitle>Principais leituras do período</SectionTitle>
                  <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-4">
                    <div className="border-r border-white/10 pr-4">
                      <TrendingUp className="mb-3 text-amber-300" />
                      <p className="text-sm text-slate-300">{dashboard.kpis.publications} publicações no período filtrado.</p>
                    </div>

                    <div className="border-r border-white/10 pr-4">
                      <Megaphone className="mb-3 text-amber-300" />
                      <p className="text-sm text-slate-300">{topChannel.name} concentra o maior volume de inserções.</p>
                    </div>

                    <div className="border-r border-white/10 pr-4">
                      <Target className="mb-3 text-amber-300" />
                      <p className="text-sm text-slate-300">Tema de maior recorrência: {topTheme.name}.</p>
                    </div>

                    <div>
                      <Globe2 className="mb-3 text-amber-300" />
                      <p className="text-sm text-slate-300">UFs e canais são recalculados a cada alteração de período.</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-5">
                  <SectionTitle>Fontes atuais</SectionTitle>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[PUBLICATIONS_SHEET, MONTHLY_SHEET, VEHICLES_SHEET, RULES_SHEET, "Google Sheets direto"].map((field) => (
                      <span key={field} className="rounded-full border border-amber-300/20 bg-amber-300/10 px-3 py-1 text-xs text-amber-100">
                        {field}
                      </span>
                    ))}
                  </div>
                  <p className="mt-4 text-xs uppercase tracking-wide text-slate-400">Registros carregados</p>
                  <p className="mt-2 text-sm text-slate-300">
                    {publications.length.toLocaleString("pt-BR")} publicações · {vehicles.length.toLocaleString("pt-BR")} veículos ·{" "}
                    {rules.length.toLocaleString("pt-BR")} regras
                  </p>
                </Card>
              </section>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
