import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BUZZ_WEIGHTS = {
  vehicleOccupation: 0.25,
  capturedReach: 0.25,
  capturedReturn: 0.2,
  vehicleQuality: 0.15,
  capturedCapillarity: 0.1,
  adjustedFrequency: 0.05,
};

const QUALI_WEIGHTS = {
  publicationTone: 0.25,
  brandProtagonism: 0.2,
  keyMessageAdherence: 0.2,
  brandValuesAdherence: 0.15,
  reputationalContext: 0.1,
  reputationalRisk: 0.1,
};

const ICR_WEIGHTS = {
  buzz: 0.5,
  quali: 0.5,
};

const DEFAULT_FREQUENCY_IDEAL = 5;

function clampScore(value) {
  const number = Number(value || 0);

  if (Number.isNaN(number)) return 0;
  if (number < 0) return 0;
  if (number > 100) return 100;

  return number;
}

function safeDivide(numerator, denominator) {
  const n = Number(numerator || 0);
  const d = Number(denominator || 0);

  if (!d) return 0;

  return n / d;
}

function normalizeByPotential(value, potential) {
  return clampScore(safeDivide(value, potential) * 100);
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

function normalizeVehicleName(value) {
  return removeAccents(value)
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
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

    if (after?.length === 3 && before.length <= 3) {
      cleaned = `${before}${after}`;
    }
  }

  const number = Number(cleaned) || 0;
  return negative ? -number : number;
}

function tierToScore(tier) {
  const normalized = normalizeKey(tier);

  if (["tier_1", "tier1", "1", "a"].includes(normalized)) return 100;
  if (["tier_2", "tier2", "2", "b"].includes(normalized)) return 75;
  if (["tier_3", "tier3", "3", "c"].includes(normalized)) return 50;
  if (["tier_4", "tier4", "4", "d"].includes(normalized)) return 25;

  return 50;
}

function getVehicleQualityScore(vehicle) {
  if (
    vehicle?.peso !== null &&
    vehicle?.peso !== undefined &&
    !Number.isNaN(Number(vehicle.peso))
  ) {
    return Number(vehicle.peso);
  }

  return getTierScore(vehicle?.tier);
}

function getVehicleReach(vehicle) {
  return parseNumber(vehicle.audiencia || vehicle.unique_visitors || 0);
}

function getVehiclePotentialReturn(vehicle) {
  const valorPagina = parseNumber(vehicle.valor_pagina);
  const valorSegundo = parseNumber(vehicle.valor_segundo);
  const valorCm = parseNumber(vehicle.valor_cm);
  const cpm = parseNumber(vehicle.cpm_ref);
  const reach = getVehicleReach(vehicle);

  if (valorPagina > 0) return valorPagina;
  if (valorSegundo > 0) return valorSegundo;
  if (valorCm > 0) return valorCm;
  if (cpm > 0 && reach > 0) return (reach / 1000) * cpm;

  return 0;
}

function getPublicationVehicleName(publication) {
  return (
    publication.veiculo ||
    publication.vehicle ||
    publication.nome_veiculo ||
    publication.nomeVeiculo ||
    publication.raw_data?.veiculo ||
    ""
  );
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

function getPublicationId(publication) {
  return String(
    publication.numero_publicacao ||
      publication.numeroPublicacao ||
      publication.publication_id ||
      publication.id_publicacao ||
      publication.id ||
      ""
  ).trim();
}

function getPublicationReturn(publication) {
  return parseNumber(
    publication.retorno_midia ||
      publication.retornoMidia ||
      publication.valoracao ||
      publication.valoração ||
      publication.valorizacao ||
      publication.valor ||
      publication.raw_data?.retorno_midia ||
      publication.raw_data?.valoracao ||
      0
  );
}

function buildVehicleIndex(vehicles) {
  const index = new Map();

  for (const vehicle of vehicles) {
    const name = normalizeVehicleName(vehicle.nome || vehicle.name || vehicle.vehicle);

    if (name && !index.has(name)) {
      index.set(name, vehicle);
    }
  }

  return index;
}

function parseModelJson(content = "") {
  const raw = String(content || "").trim();

  try {
    return JSON.parse(raw);
  } catch {
    // tenta extrair JSON de markdown/texto
  }

  const jsonMatch = raw.match(/\{[\s\S]*\}/);

  if (!jsonMatch) return null;

  let candidate = jsonMatch[0]
    .replace(/```json/gi, "")
    .replace(/```/g, "")
    .trim();

  candidate = candidate.replace(/,\s*([}\]])/g, "$1");

  try {
    return JSON.parse(candidate);
  } catch {
    return null;
  }
}

function getReputationAnalysisFromResponse(data) {
  return data?.reputationAnalysis || data?.analysis || null;
}

function hasCompleteReputationAnalysis(analysis) {
  if (!analysis) return false;

  const required = [
    "publicationTone",
    "brandProtagonism",
    "keyMessageAdherence",
    "brandValuesAdherence",
    "reputationalContext",
    "reputationalRisk",
    "spokespersonPresence",
    "titleOrSubtitleMention",
  ];

  return required.every((key) => {
    const item = analysis[key];
    const score = Number(item?.score);

    return item && !Number.isNaN(score);
  });
}

function hasBrandMentionInAnalysis(analysis) {
  const text = [
    analysis?.publicationTone?.justification,
    analysis?.brandProtagonism?.justification,
    analysis?.keyMessageAdherence?.justification,
    analysis?.brandValuesAdherence?.justification,
    analysis?.reputationalContext?.justification,
    analysis?.reputationalRisk?.justification,
    analysis?.spokespersonPresence?.justification,
    analysis?.titleOrSubtitleMention?.justification,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const invalidSignals = [
    "marca não é mencionada",
    "marca nao e mencionada",
    "não menciona a marca",
    "nao menciona a marca",
    "não há menção",
    "nao ha mencao",
    "sem menção relevante",
    "sem mencao relevante",
    "não aparece",
    "nao aparece",
    "não é mencionada",
    "nao e mencionada",
  ];

  return !invalidSignals.some((signal) => text.includes(signal));
}

function hasUsableEvidence(data) {
  return Array.isArray(data?.evidence) && data.evidence.length > 0;
}

function isTextExtractionLimited(data) {
  const text = [
    data?.summary?.overallReading,
    data?.summary?.mainRisk,
    data?.summary?.mainStrength,
    ...(Array.isArray(data?.evidence) ? data.evidence : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  const limitedSignals = [
    "texto não pôde ser extraído",
    "texto nao pode ser extraido",
    "conteúdo não pôde ser extraído",
    "conteudo nao pode ser extraido",
    "pdf binário",
    "pdf binario",
    "dados binários",
    "dados binarios",
    "conteúdo ilegível",
    "conteudo ilegivel",
    "não foi possível extrair",
    "nao foi possivel extrair",
    "não pôde ser lido",
    "nao pode ser lido",
  ];

  return limitedSignals.some((signal) => text.includes(signal));
}

function classifyAiAnalysisQuality(data) {
  const analysis = getReputationAnalysisFromResponse(data);

  if (!hasCompleteReputationAnalysis(analysis)) {
    return {
      status: "incompleta",
      validForQuali: false,
      reason: "A análise não retornou os 8 indicadores completos.",
    };
  }

  if (isTextExtractionLimited(data)) {
    return {
      status: "texto_insuficiente",
      validForQuali: false,
      reason: "A análise foi baseada em texto insuficiente, ilegível ou não extraído.",
    };
  }

  if (!hasBrandMentionInAnalysis(analysis)) {
    return {
      status: "sem_mencao_marca",
      validForQuali: false,
      reason: "A análise indica que a marca não foi mencionada de forma relevante.",
    };
  }

  if (!hasUsableEvidence(data)) {
    return {
      status: "sem_evidencia",
      validForQuali: false,
      reason: "A análise não trouxe evidências literais para sustentar a leitura.",
    };
  }

  return {
    status: "valida",
    validForQuali: true,
    reason: "Análise completa e válida para cálculo do IER-Quali.",
  };
}

function calculateQualiFromAnalysis(analysis) {
  if (!hasCompleteReputationAnalysis(analysis)) return null;

  return (
    clampScore(analysis.publicationTone?.score) * QUALI_WEIGHTS.publicationTone +
    clampScore(analysis.brandProtagonism?.score) * QUALI_WEIGHTS.brandProtagonism +
    clampScore(analysis.keyMessageAdherence?.score) * QUALI_WEIGHTS.keyMessageAdherence +
    clampScore(analysis.brandValuesAdherence?.score) * QUALI_WEIGHTS.brandValuesAdherence +
    clampScore(analysis.reputationalContext?.score) * QUALI_WEIGHTS.reputationalContext +
    clampScore(analysis.reputationalRisk?.score) * QUALI_WEIGHTS.reputationalRisk
  );
}

function calculateAverage(values) {
  const validValues = values
    .map((value) => Number(value))
    .filter((value) => !Number.isNaN(value));

  if (!validValues.length) return 0;

  return validValues.reduce((sum, value) => sum + value, 0) / validValues.length;
}

async function getActiveTerritory(clientId) {
  const { data, error } = await supabase
    .from("territorios")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "ativo")
    .order("versao", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar território ativo: ${error.message}`);
  }

  if (!data) {
    throw new Error(`Nenhum território ativo encontrado para o cliente ${clientId}.`);
  }

  return data;
}
async function getLatestTerritorySnapshot(territorioId) {
  const { data, error } = await supabase
    .from("territorio_snapshots")
    .select("*")
    .eq("territorio_id", territorioId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar snapshot do território: ${error.message}`);
  }

  if (!data) {
    throw new Error("Nenhum snapshot encontrado para o território ativo.");
  }

  return data;
}

async function getTerritoryVehicles(territoryId) {
  const { data, error } = await supabase
    .from("territorio_veiculos")
    .select(`
      id,
      territorio_id,
      veiculo_id,
      tier,
      peso,
      ativo,
      veiculos (
        id,
        nome,
        nome_normalizado,
        tipo_midia,
        audiencia,
        unique_visitors,
        tiragem,
        valor_cm,
        valor_segundo,
        cpm_ref,
        valor_pagina,
        segmento,
        praca,
        ativo
      )
    `)
    .eq("territorio_id", territoryId)
    .eq("ativo", true);

  if (error) {
    throw new Error(`Erro ao buscar veículos do território: ${error.message}`);
  }

  return (data || [])
    .filter((item) => item.veiculos && item.veiculos.ativo !== false)
    .map((item) => ({
      territoryVehicleId: item.id,
      territorioId: item.territorio_id,
      veiculoId: item.veiculo_id,

      tier: item.tier,
      peso: item.peso,

      id: item.veiculos.id,
      nome: item.veiculos.nome,
      nome_normalizado: item.veiculos.nome_normalizado,
      tipo_midia: item.veiculos.tipo_midia,
      audiencia: item.veiculos.audiencia,
      unique_visitors: item.veiculos.unique_visitors,
      tiragem: item.veiculos.tiragem,
      valor_cm: item.veiculos.valor_cm,
      valor_segundo: item.veiculos.valor_segundo,
      cpm_ref: item.veiculos.cpm_ref,
      valor_pagina: item.veiculos.valor_pagina,
      segmento: item.veiculos.segmento,
      praca: item.veiculos.praca,
    }));
}

  const { data: vehicles, error: vehiclesError } = await supabase
    .from("veiculos")
    .select("*")
    .in("id", vehicleIds)
    .eq("ativo", true);

  if (vehiclesError) {
    throw new Error(`Erro ao buscar dados dos veículos: ${vehiclesError.message}`);
  }

  return vehicles || [];
}

async function getClientData(clientId) {
  const { data, error } = await supabase
    .from("clientes")
    .select("*")
    .eq("id", clientId)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar cliente: ${error.message}`);
  }

  return data || null;
}

async function getPublications({ clientId, startDate, endDate }) {
  let query = supabase
    .from("publicacoes")
    .select("*")
    .eq("client_id", clientId)
    .order("data_publicacao", { ascending: true });

  if (startDate) {
    query = query.gte("data_publicacao", startDate);
  }

  if (endDate) {
    query = query.lte("data_publicacao", endDate);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Erro ao buscar publicações do recorte: ${error.message}`);
  }

  return data || [];
}

function calculateBuzz({
  territory,
  snapshot,
  vehicles,
  publications,
}) {
  const vehicleIndex = buildVehicleIndex(vehicles);

  const matchedPublications = [];
  const unmatchedPublications = [];
  const occupiedVehicleMap = new Map();

  for (const publication of publications) {
    const publicationVehicleName = getPublicationVehicleName(publication);
    const vehicle = vehicleIndex.get(normalizeVehicleName(publicationVehicleName));

    if (!vehicle) {
      unmatchedPublications.push({
        id: getPublicationId(publication),
        title: getPublicationTitle(publication),
        vehicle: publicationVehicleName || "Veículo não informado",
      });
      continue;
    }

    matchedPublications.push({
      publication,
      vehicle,
    });

    occupiedVehicleMap.set(vehicle.id, vehicle);
  }

  const occupiedVehicles = Array.from(occupiedVehicleMap.values());

  const totalTerritoryVehicles = Number(snapshot.total_veiculos || vehicles.length || 0);
  const territoryReachPotential = Number(snapshot.alcance_potencial || 0);
  const territoryReturnPotential = Number(snapshot.retorno_potencial || 0);
  const territoryCapillarity = Number(snapshot.capilaridade_geografica || 0);

  const occupiedVehiclesCount = occupiedVehicles.length;

  const occupiedReach = occupiedVehicles.reduce((sum, vehicle) => {
    return sum + getVehicleReach(vehicle);
  }, 0);

  const generatedReturn = matchedPublications.reduce((sum, item) => {
    return sum + getPublicationReturn(item.publication);
  }, 0);

  const occupiedVehicleQuality = calculateAverage(
    occupiedVehicles.map((vehicle) => getVehicleQualityScore(vehicle))
  );

  const occupiedPlaces = new Set(
    occupiedVehicles
      .map((vehicle) => normalizeKey(vehicle.praca || vehicle.uf || vehicle.regiao || ""))
      .filter(Boolean)
  );

  const occupiedCapillarity = occupiedPlaces.size;

  const publicationsPerOccupiedVehicle = safeDivide(
    matchedPublications.length,
    occupiedVehiclesCount
  );

  const components = {
    vehicleOccupation: {
      label: "Ocupação de veículos",
      value: normalizeByPotential(occupiedVehiclesCount, totalTerritoryVehicles),
      origin: {
        occupiedVehicles: occupiedVehiclesCount,
        totalTerritoryVehicles,
      },
      formula: "veículos ocupados / total de veículos do território × 100",
    },
    capturedReach: {
      label: "Alcance capturado",
      value: normalizeByPotential(occupiedReach, territoryReachPotential),
      origin: {
        occupiedReach,
        territoryReachPotential,
      },
      formula: "alcance dos veículos ocupados / alcance potencial do território × 100",
    },
    capturedReturn: {
      label: "Retorno capturado",
      value: normalizeByPotential(generatedReturn, territoryReturnPotential),
      origin: {
        generatedReturn,
        territoryReturnPotential,
      },
      formula: "retorno gerado no recorte / retorno potencial do território × 100",
    },
    vehicleQuality: {
      label: "Qualidade dos veículos ocupados",
      value: clampScore(occupiedVehicleQuality),
      origin: {
        occupiedVehicleQuality,
        maxScale: 100,
      },
      formula: "média dos scores dos veículos ocupados",
    },
    capturedCapillarity: {
      label: "Capilaridade capturada",
      value: normalizeByPotential(occupiedCapillarity, territoryCapillarity),
      origin: {
        occupiedCapillarity,
        territoryCapillarity,
      },
      formula: "praças ocupadas / praças do território × 100",
    },
    adjustedFrequency: {
      label: "Frequência ajustada",
      value: normalizeByPotential(publicationsPerOccupiedVehicle, DEFAULT_FREQUENCY_IDEAL),
      origin: {
        totalPublications: matchedPublications.length,
        occupiedVehicles: occupiedVehiclesCount,
        publicationsPerOccupiedVehicle,
        idealFrequency: DEFAULT_FREQUENCY_IDEAL,
      },
      formula: "(publicações totais / veículos ocupados) / frequência ideal × 100",
    },
  };

  const ierBuzz =
    components.vehicleOccupation.value * BUZZ_WEIGHTS.vehicleOccupation +
    components.capturedReach.value * BUZZ_WEIGHTS.capturedReach +
    components.capturedReturn.value * BUZZ_WEIGHTS.capturedReturn +
    components.vehicleQuality.value * BUZZ_WEIGHTS.vehicleQuality +
    components.capturedCapillarity.value * BUZZ_WEIGHTS.capturedCapillarity +
    components.adjustedFrequency.value * BUZZ_WEIGHTS.adjustedFrequency;

  return {
    value: Number(ierBuzz.toFixed(2)),
    formula:
      "Ocupação de veículos × 25% + Alcance capturado × 25% + Retorno capturado × 20% + Qualidade dos veículos × 15% + Capilaridade × 10% + Frequência ajustada × 5%",
    weights: BUZZ_WEIGHTS,
    components,
    diagnostics: {
      territoryId: territory.id,
      territoryName: territory.nome,
      territoryVersion: territory.versao,
      totalPublicationsInCut: publications.length,
      matchedPublications: matchedPublications.length,
      unmatchedPublications: unmatchedPublications.length,
      occupiedVehicles: occupiedVehiclesCount,
      unmatchedExamples: unmatchedPublications.slice(0, 20),
    },
  };
}

async function analyzePublicationThroughApi({
  req,
  publication,
  client,
  clientId,
  forceReanalyze,
}) {
  const protocol = req.headers["x-forwarded-proto"] || "https";
  const host = req.headers.host;

  if (!host) {
    throw new Error("Host não encontrado para chamar /api/analyze-publication.");
  }

  const baseUrl = process.env.PUBLIC_APP_URL || `${protocol}://${host}`;

  const response = await fetch(`${baseUrl}/api/analyze-publication`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      url: getPublicationUrl(publication),
      clientId,
      publicationId: getPublicationId(publication),
      clientName: client?.nome || client?.name || clientId,
      title: getPublicationTitle(publication),
      vehicle: getPublicationVehicleName(publication),
      forceReanalyze: Boolean(forceReanalyze),
    }),
  });

  const text = await response.text();

  let data;

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = {
      error: "A API de análise não retornou JSON válido.",
      rawResponse: text,
    };
  }

  if (!response.ok) {
    throw new Error(data.error || data.message || `Erro HTTP ${response.status} na análise.`);
  }

  return data;
}

async function collectCompleteAnalyses({
  req,
  publications,
  client,
  clientId,
  limit,
  forceReanalyze,
}) {
  const completeAnalyses = [];
  const attempts = [];
  const candidates = publications
    .filter((publication) => getPublicationUrl(publication))
    .slice(0, Math.max(limit * 4, 20));

  for (const publication of candidates) {
    if (completeAnalyses.length >= limit) break;

    const attemptBase = {
      publicationId: getPublicationId(publication),
      title: getPublicationTitle(publication),
      vehicle: getPublicationVehicleName(publication),
      url: getPublicationUrl(publication),
    };

    try {
      const data = await analyzePublicationThroughApi({
        req,
        publication,
        client,
        clientId,
        forceReanalyze,
      });

      const analysis = getReputationAnalysisFromResponse(data);
      const quality = classifyAiAnalysisQuality(data);
      
      if (!quality.validForQuali) {
        attempts.push({
          ...attemptBase,
          status: quality.status,
          validForQuali: false,
          reason: quality.reason,
        });
        continue;
      }
      
      const qualiValue = calculateQualiFromAnalysis(analysis);
      
      completeAnalyses.push({
        ...attemptBase,
        status: "valida",
        validForQuali: true,
        analysis,
        reputationAnalysis: analysis,
        summary: data.summary || null,
        evidence: data.evidence || [],
        source: data.source || null,
        qualiValue,
      });
      
      attempts.push({
        ...attemptBase,
        status: "valida",
        validForQuali: true,
        qualiValue,
      });

      
    } catch (error) {
      attempts.push({
        ...attemptBase,
        status: "erro",
        reason: error.message || "Erro inesperado na análise.",
      });
    }
  }

  return {
    completeAnalyses,
    attempts,
    candidatesCount: candidates.length,
  };
}

function calculateQuali(completeAnalyses = []) {
  const values = completeAnalyses
    .map((item) => item.qualiValue)
    .filter((value) => value !== null && value !== undefined && !Number.isNaN(Number(value)));

  if (!values.length) {
    return {
      value: null,
      formula:
        "Tom × 25% + Protagonismo × 20% + Mensagem-chave × 20% + Valores × 15% + Contexto × 10% + Baixo risco × 10%",
      weights: QUALI_WEIGHTS,
      components: {
        publicationTone: {
          label: "Tom da publicação",
          value: null,
          origin: {
            analyzedPublications: 0,
            averageScore: null,
          },
          formula: "média dos scores de tom retornados pela IA",
        },
        brandProtagonism: {
          label: "Protagonismo da marca",
          value: null,
          origin: {
            analyzedPublications: 0,
            averageScore: null,
          },
          formula: "média dos scores de protagonismo retornados pela IA",
        },
        keyMessageAdherence: {
          label: "Aderência à mensagem-chave",
          value: null,
          origin: {
            analyzedPublications: 0,
            averageScore: null,
          },
          formula: "média dos scores de aderência à mensagem-chave retornados pela IA",
        },
        brandValuesAdherence: {
          label: "Aderência aos valores da marca",
          value: null,
          origin: {
            analyzedPublications: 0,
            averageScore: null,
          },
          formula: "média dos scores de aderência aos valores retornados pela IA",
        },
        reputationalContext: {
          label: "Contexto reputacional",
          value: null,
          origin: {
            analyzedPublications: 0,
            averageScore: null,
          },
          formula: "média dos scores de contexto retornados pela IA",
        },
        reputationalRisk: {
          label: "Risco reputacional",
          value: null,
          origin: {
            analyzedPublications: 0,
            averageScore: null,
          },
          formula: "média dos scores de baixo risco retornados pela IA",
        },
      },
      diagnostics: {
        requestedAnalyses: completeAnalyses.length,
        averageFromValues: 0,
        status: "sem_analises_validas",
      },
    };
  }

  const componentsAccumulator = {
    publicationTone: [],
    brandProtagonism: [],
    keyMessageAdherence: [],
    brandValuesAdherence: [],
    reputationalContext: [],
    reputationalRisk: [],
  };

  for (const item of completeAnalyses) {
    const analysis = item.analysis || item.reputationAnalysis;

    if (!hasCompleteReputationAnalysis(analysis)) continue;

    componentsAccumulator.publicationTone.push(
      clampScore(analysis.publicationTone?.score)
    );

    componentsAccumulator.brandProtagonism.push(
      clampScore(analysis.brandProtagonism?.score)
    );

    componentsAccumulator.keyMessageAdherence.push(
      clampScore(analysis.keyMessageAdherence?.score)
    );

    componentsAccumulator.brandValuesAdherence.push(
      clampScore(analysis.brandValuesAdherence?.score)
    );

    componentsAccumulator.reputationalContext.push(
      clampScore(analysis.reputationalContext?.score)
    );

    componentsAccumulator.reputationalRisk.push(
      clampScore(analysis.reputationalRisk?.score)
    );
  }

  const publicationToneAverage = calculateAverage(componentsAccumulator.publicationTone);
  const brandProtagonismAverage = calculateAverage(componentsAccumulator.brandProtagonism);
  const keyMessageAdherenceAverage = calculateAverage(componentsAccumulator.keyMessageAdherence);
  const brandValuesAdherenceAverage = calculateAverage(componentsAccumulator.brandValuesAdherence);
  const reputationalContextAverage = calculateAverage(componentsAccumulator.reputationalContext);
  const reputationalRiskAverage = calculateAverage(componentsAccumulator.reputationalRisk);

  const components = {
    publicationTone: {
      label: "Tom da publicação",
      value: Number(publicationToneAverage.toFixed(2)),
      origin: {
        analyzedPublications: componentsAccumulator.publicationTone.length,
        averageScore: Number(publicationToneAverage.toFixed(2)),
      },
      formula: "média dos scores de tom retornados pela IA",
    },
    brandProtagonism: {
      label: "Protagonismo da marca",
      value: Number(brandProtagonismAverage.toFixed(2)),
      origin: {
        analyzedPublications: componentsAccumulator.brandProtagonism.length,
        averageScore: Number(brandProtagonismAverage.toFixed(2)),
      },
      formula: "média dos scores de protagonismo retornados pela IA",
    },
    keyMessageAdherence: {
      label: "Aderência à mensagem-chave",
      value: Number(keyMessageAdherenceAverage.toFixed(2)),
      origin: {
        analyzedPublications: componentsAccumulator.keyMessageAdherence.length,
        averageScore: Number(keyMessageAdherenceAverage.toFixed(2)),
      },
      formula: "média dos scores de aderência à mensagem-chave retornados pela IA",
    },
    brandValuesAdherence: {
      label: "Aderência aos valores da marca",
      value: Number(brandValuesAdherenceAverage.toFixed(2)),
      origin: {
        analyzedPublications: componentsAccumulator.brandValuesAdherence.length,
        averageScore: Number(brandValuesAdherenceAverage.toFixed(2)),
      },
      formula: "média dos scores de aderência aos valores retornados pela IA",
    },
    reputationalContext: {
      label: "Contexto reputacional",
      value: Number(reputationalContextAverage.toFixed(2)),
      origin: {
        analyzedPublications: componentsAccumulator.reputationalContext.length,
        averageScore: Number(reputationalContextAverage.toFixed(2)),
      },
      formula: "média dos scores de contexto retornados pela IA",
    },
    reputationalRisk: {
      label: "Risco reputacional",
      value: Number(reputationalRiskAverage.toFixed(2)),
      origin: {
        analyzedPublications: componentsAccumulator.reputationalRisk.length,
        averageScore: Number(reputationalRiskAverage.toFixed(2)),
      },
      formula: "média dos scores de baixo risco retornados pela IA",
    },
  };

  const ierQuali =
    publicationToneAverage * QUALI_WEIGHTS.publicationTone +
    brandProtagonismAverage * QUALI_WEIGHTS.brandProtagonism +
    keyMessageAdherenceAverage * QUALI_WEIGHTS.keyMessageAdherence +
    brandValuesAdherenceAverage * QUALI_WEIGHTS.brandValuesAdherence +
    reputationalContextAverage * QUALI_WEIGHTS.reputationalContext +
    reputationalRiskAverage * QUALI_WEIGHTS.reputationalRisk;

  return {
    value: Number(ierQuali.toFixed(2)),
    formula:
      "Tom × 25% + Protagonismo × 20% + Mensagem-chave × 20% + Valores × 15% + Contexto × 10% + Baixo risco × 10%",
    weights: QUALI_WEIGHTS,
    components,
    diagnostics: {
      requestedAnalyses: completeAnalyses.length,
      averageFromValues: values.length,
      status: "calculado_com_analises_validas",
    },
  };
}
export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "POST") {
      return res.status(405).json({
        ok: false,
        error: "Use GET ou POST.",
      });
    }

    const input = req.method === "POST" ? req.body || {} : req.query || {};

    const clientId = String(input.clientId || "").trim();
    const startDate = String(input.startDate || "").trim();
    const endDate = String(input.endDate || "").trim();
    const limit = Math.min(Math.max(Number(input.limit || 10), 1), 10);
    const forceReanalyze = String(input.forceReanalyze || "false") === "true";
    const runAi = String(input.runAi || "false") === "true";

    

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

    const territory = await getActiveTerritory(clientId);
    const snapshot = await getLatestTerritorySnapshot(territory.id);
    const vehicles = await getTerritoryVehicles(territory.id);
    const client = await getClientData(clientId);
    const publications = await getPublications({
      clientId,
      startDate,
      endDate,
    });

    const territoryData = {
      id: territory.id,
      name: territory.nome,
      version: territory.versao,
      snapshotId: snapshot.id,
      totalVehicles: Number(snapshot.total_veiculos || 0),
      potentialReach: Number(snapshot.alcance_potencial || 0),
      potentialReturn: Number(snapshot.retorno_potencial || 0),
      averageTier: Number(snapshot.tier_medio || 0),
      geographicCapillarity: Number(snapshot.capilaridade_geografica || 0),
      createdAt: snapshot.created_at,
    };

    const buzz = calculateBuzz({
      territory,
      snapshot,
      vehicles,
      publications,
    });

    const analysisCollection = runAi
      ? await collectCompleteAnalyses({
          req,
          publications,
          client,
          clientId,
          limit,
          forceReanalyze,
        })
      : {
          completeAnalyses: [],
          attempts: [],
          candidatesCount: 0,
        };
    
    const quali = calculateQuali(analysisCollection.completeAnalyses);
    
    const icrValue =
      quali.value === null || quali.value === undefined
        ? null
        : buzz.value * ICR_WEIGHTS.buzz + quali.value * ICR_WEIGHTS.quali;

    const icr = {
      value: icrValue === null ? null : Number(icrValue.toFixed(2)),
      formula: "IER-Buzz × 50% + IER-Quali × 50%",
      weights: ICR_WEIGHTS,
      components: {
        buzz: {
          label: "IER-Buzz",
          value: buzz.value,
          origin: {
            ierBuzz: buzz.value,
          },
          formula: "valor final do IER-Buzz × 50%",
        },
        quali: {
          label: "IER-Quali",
          value: quali.value,
          origin: {
            ierQuali: quali.value,
          },
          formula: "valor final do IER-Quali × 50%",
        },
      },
    };

    return res.status(200).json({
      ok: true,
      client: {
        id: clientId,
        name: client?.nome || client?.name || clientId,
      },
      period: {
        startDate,
        endDate,
      },
      territory: territoryData,
      recorte: {
        totalPublications: publications.length,
        runAi,
        aiAnalysisLimit: runAi ? limit : 0,
        validAiAnalyses: analysisCollection.completeAnalyses.length,
        attemptedAiAnalyses: analysisCollection.attempts.length,
      },
      indexes: {
        ierBuzz: buzz,
        ierQuali: quali,
        icr,
      },
      aiAnalyses: analysisCollection.completeAnalyses,
      aiAttempts: analysisCollection.attempts,
    });
  } catch (error) {
    return res.status(500).json({
      ok: false,
      error: error.message || "Erro inesperado ao calcular reputação.",
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}
