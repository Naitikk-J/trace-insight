/**
 * Contract mirror for the TRACIFY intelligence backend (`/server`).
 *
 * These types are hand-mirrored from the Express/Mongoose domain so the UI has
 * a single, explicit contract for the attribution pipeline: complaint intake →
 * nearest-VASP attribution → alerts → standardised LEA report.
 */

export const COMPLAINT_SOURCES = ["ncrp", "sahyog", "lea-api", "manual"] as const;
export type ComplaintSource = (typeof COMPLAINT_SOURCES)[number];

export const FRAUD_TYPES = [
  "investment-scam",
  "task-based-fraud",
  "sextortion",
  "ransomware",
  "phishing",
  "darknet",
  "impersonation",
  "other",
] as const;
export type FraudType = (typeof FRAUD_TYPES)[number];

export const TRIAGE_STATUSES = [
  "received",
  "attributing",
  "attributed",
  "escalated",
  "closed",
  "failed",
] as const;
export type TriageStatus = (typeof TRIAGE_STATUSES)[number];

export const RISK_CATEGORIES = ["low", "moderate", "elevated", "high", "severe"] as const;
export type RiskCategory = (typeof RISK_CATEGORIES)[number];

export const ALERT_SEVERITIES = ["info", "low", "medium", "high", "critical"] as const;
export type AlertSeverity = (typeof ALERT_SEVERITIES)[number];

export const ALERT_STATUSES = ["open", "acknowledged", "actioned", "dismissed"] as const;
export type AlertStatus = (typeof ALERT_STATUSES)[number];

export const FRAUD_TYPE_LABEL: Record<FraudType, string> = {
  "investment-scam": "Investment scam",
  "task-based-fraud": "Task-based fraud",
  sextortion: "Sextortion",
  ransomware: "Ransomware",
  phishing: "Phishing",
  darknet: "Darknet market",
  impersonation: "Impersonation",
  other: "Other",
};

export const COMPLAINT_SOURCE_LABEL: Record<ComplaintSource, string> = {
  ncrp: "NCRP",
  sahyog: "SAHYOG",
  "lea-api": "LEA API",
  manual: "Manual",
};

export interface VaspAttribution {
  address: string;
  chain: string;
  entity: string;
  category?: string;
  hops: number;
  directDeposit: boolean;
  valueUsd: number;
  confidence: number;
  path: string[];
  txHashes: string[];
  firstSeen?: string;
  lastSeen?: string;
}

export interface IntermediaryWallet {
  address: string;
  hop: number;
  valueUsd: number;
  role: "layering" | "splitter" | "consolidator" | "pass-through";
  reason: string;
}

export interface TypologyPrediction {
  type: FraudType;
  label: string;
  confidence: number;
  rationale: string;
  drivers: { feature: string; label: string; weight: number }[];
  alternatives: { type: FraudType; label: string; confidence: number }[];
}

export interface BehaviouralSignal {
  code: string;
  label: string;
  severity: string;
  explanation: string;
}

export interface AttributionSummary {
  address: string;
  chain: string;
  dataSource: "graphsense" | "synthetic";
  live: boolean;
  generatedAt: string;
  riskScore: number;
  riskCategory: RiskCategory;
  riskReasons: string[];
  typology: TypologyPrediction;
  nearestVasp: VaspAttribution | null;
  vaspCandidates: VaspAttribution[];
  intermediaries: IntermediaryWallet[];
  crossChain: { detected: boolean; note: string; bridgeHops: { address: string; hop: number; entity?: string; valueUsd: number }[] };
  obfuscation: { detected: boolean; note: string; services: { address: string; hop: number; entity?: string; valueUsd: number }[] };
  signals: BehaviouralSignal[];
  metrics: {
    addressesTouched: number;
    hopsTraced: number;
    valueTracedUsd: number;
    vaspTouchpoints: number;
    retainedValuePct: number;
  };
  freezeActionable: boolean;
  recommendations: string[];
}

export interface SuspectAddress {
  address: string;
  chain: string;
  note?: string;
  attribution?: AttributionSummary;
  attributedAt?: string;
}

export interface Complaint {
  id: string;
  reference: string;
  source: ComplaintSource;
  externalRef?: string;
  reportedAt: string;
  jurisdiction?: string;
  victim: { maskedName?: string; state?: string; district?: string };
  fraudType: FraudType;
  lossInr: number;
  narrative?: string;
  suspectAddresses: SuspectAddress[];
  triageStatus: TriageStatus;
  riskScore: number;
  riskCategory: RiskCategory;
  primaryVasp?: {
    entity: string;
    address: string;
    chain: string;
    hops: number;
    confidence: number;
  };
  linkedCase?: string;
  failureReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AlertRecord {
  id: string;
  code: string;
  title: string;
  severity: AlertSeverity;
  status: AlertStatus;
  summary: string;
  recommendedActions: string[];
  chain?: string;
  addresses: string[];
  complaint?: string;
  case?: string;
  investigation?: string;
  evidence: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface LeaReport {
  title: string;
  reference: string;
  generatedAt: string;
  classification: "restricted";
  complaint: {
    reference: string;
    source: string;
    externalRef?: string;
    reportedAt: string;
    jurisdiction?: string;
    fraudType: string;
    lossInr: number;
    victimState?: string;
  };
  assessment: {
    riskScore: number;
    riskCategory: string;
    typology: string;
    typologyConfidence: number;
    freezeActionable: boolean;
  };
  attributedVasps: {
    entity: string;
    depositAddress: string;
    chain: string;
    hops: number;
    directDeposit: boolean;
    valueUsd: number;
    confidence: number;
    transactionReferences: string[];
  }[];
  transactionTrails: {
    reportedAddress: string;
    chain: string;
    dataSource: string;
    trail: string[];
    intermediaries: { address: string; hop: number; role: string; reason: string }[];
  }[];
  indicators: {
    crossChain: string;
    obfuscation: string;
    behavioural: BehaviouralSignal[];
  };
  alerts: { code: string; title: string; severity: string; summary: string }[];
  recommendedActions: string[];
  caveats: string[];
}

export interface TriageQueue {
  received: number;
  attributing: number;
  attributed: number;
  escalated: number;
  failed: number;
  [key: string]: number;
}

export interface BackendUser {
  id: string;
  name?: string;
  email: string;
  role: string;
}

/* ---------------- Dual AI: platform risk model + investigator copilot ------- */

export const ML_BANDS = ["low", "moderate", "elevated", "high", "severe"] as const;
export type MlBand = (typeof ML_BANDS)[number];
export type MlPriority = "routine" | "priority" | "urgent";

/** One feature's signed contribution to a route score — the explanation. */
export interface FeatureContribution {
  feature: string;
  value: number;
  weight: number;
  contribution: number;
  note: string;
}

/** The platform model's verdict on one candidate money route. */
export interface RouteCandidatePrediction {
  routeId: string;
  addresses: string[];
  routeScore: number;
  band: MlBand;
  priority: MlPriority;
  confidence: number;
  contributions: FeatureContribution[];
  rationale: string;
  features: Record<string, number>;
  featureSchemaVersion: string;
  modelId: string;
  modelVersion: string;
  source: "baseline" | "remote";
  degradedReason?: string;
}

export interface RoutePredictionResult {
  investigationId: string;
  reference: string;
  predicted: RouteCandidatePrediction | null;
  ranked: RouteCandidatePrediction[];
  modelId: string;
  modelVersion: string;
  featureSchemaVersion: string;
  source: "baseline" | "remote";
  degraded: boolean;
  degradedReason?: string;
  latencyMs: number;
}

export type CopilotMode = "answer" | "explain-route" | "draft-summary" | "next-steps";

export interface CopilotResponse {
  investigationId: string;
  mode: CopilotMode;
  content: string;
  fallback: boolean;
  fallbackReason?: string;
  provider: string;
  model: string;
  dataPolicy: string;
  groundingKeys: string[];
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
}

export interface AiSystemsStatus {
  riskModel: {
    mode: "mock" | "remote";
    active: "baseline" | "remote";
    featureSchemaVersion: string;
    baseline: { id: string; version: string; explainable: boolean };
    remote: { configured: boolean; reachable: boolean; version: string | null; detail?: string };
    demoMode: boolean;
  };
  copilot: {
    enabled: boolean;
    provider: string;
    model: string | null;
    dataPolicy: string;
    maxTokens: number;
    timeoutMs: number;
    capabilities: string[];
    restrictions: string[];
  };
  boundary: { riskModel: string; copilot: string };
}

/** Backend investigation record (the intelligence service's own trace store). */
export interface BackendInvestigation {
  id: string;
  reference: string;
  title: string;
  chain: string;
  rootAddress: string;
  status: string;
  riskScore: number;
  dataSource: string;
  direction: string;
  metrics: {
    addressesTouched: number;
    hopsTraced: number;
    valueTracedUsd: number;
    vaspTouchpoints: number;
    retainedValuePct: number;
  };
  createdAt: string;
}
