/**
 * Query/mutation layer for the intelligence service.
 *
 * Everything the attribution pipeline exposes is reached through this module so
 * routes never call `fetch` themselves.
 */
import { queryOptions } from "@tanstack/react-query";

import {
  backendConfigured,
  backendHealth,
  backendRequest,
  getBackendToken,
  setBackendToken,
} from "./client";
import type {
  AiSystemsStatus,
  AlertRecord,
  AlertStatus,
  AttributionSummary,
  BackendInvestigation,
  BackendUser,
  CopilotMode,
  CopilotResponse,
  Complaint,
  ComplaintSource,
  FraudType,
  LeaReport,
  RoutePredictionResult,
  TriageQueue,
} from "./backend-types";

interface Paginated<T> {
  items: T[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
}

/* ---------------- Connection ---------------- */

export const backendHealthQuery = () =>
  queryOptions({
    queryKey: ["backend", "health"],
    enabled: backendConfigured(),
    retry: false,
    staleTime: 30_000,
    refetchInterval: 60_000,
    queryFn: () => backendHealth(),
  });

export const backendMeQuery = (token: string | null) =>
  queryOptions({
    queryKey: ["backend", "me", token ? token.slice(-12) : "anon"],
    enabled: backendConfigured() && Boolean(token),
    retry: false,
    queryFn: async () => {
      const data = await backendRequest<{ user: BackendUser }>("/auth/me");
      return data.user;
    },
  });

export async function backendLogin(email: string, password: string) {
  const data = await backendRequest<{ user: BackendUser; token: string }>("/auth/login", {
    method: "POST",
    body: { email, password },
    anonymous: true,
  });
  setBackendToken(data.token);
  return data.user;
}

export function backendLogout() {
  setBackendToken(null);
}

export { getBackendToken, backendConfigured };

/* ---------------- Complaints ---------------- */

export interface ComplaintFilters {
  status?: string;
  source?: string;
  riskCategory?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export const complaintsQuery = (filters: ComplaintFilters = {}, enabled = true) =>
  queryOptions({
    queryKey: ["backend", "complaints", filters],
    enabled: backendConfigured() && enabled,
    retry: false,
    queryFn: () =>
      backendRequest<Paginated<Complaint>>("/complaints", {
        query: {
          page: filters.page ?? 1,
          limit: filters.limit ?? 25,
          ...(filters.status && filters.status !== "all" ? { status: filters.status } : {}),
          ...(filters.source && filters.source !== "all" ? { source: filters.source } : {}),
          ...(filters.riskCategory && filters.riskCategory !== "all"
            ? { riskCategory: filters.riskCategory }
            : {}),
          ...(filters.search ? { search: filters.search } : {}),
        },
      }),
  });

export const triageQueueQuery = (enabled = true) =>
  queryOptions({
    queryKey: ["backend", "complaints", "queue"],
    enabled: backendConfigured() && enabled,
    retry: false,
    refetchInterval: 30_000,
    queryFn: () => backendRequest<TriageQueue>("/complaints/queue"),
  });

export const complaintQuery = (id: string, enabled = true) =>
  queryOptions({
    queryKey: ["backend", "complaints", "detail", id],
    enabled: backendConfigured() && enabled && Boolean(id),
    retry: false,
    queryFn: async () => {
      const data = await backendRequest<{ complaint: Complaint }>(`/complaints/${id}`);
      return data.complaint;
    },
  });

export const leaReportQuery = (id: string, enabled = true) =>
  queryOptions({
    queryKey: ["backend", "complaints", "report", id],
    enabled: backendConfigured() && enabled && Boolean(id),
    retry: false,
    queryFn: () => backendRequest<LeaReport>(`/complaints/${id}/report`),
  });

export interface FileComplaintInput {
  source: ComplaintSource;
  externalRef?: string;
  jurisdiction?: string;
  fraudType: FraudType;
  lossInr: number;
  narrative?: string;
  victim?: { maskedName?: string; state?: string; district?: string };
  addresses: { address: string; chain: string; note?: string }[];
}

export async function fileComplaint(input: FileComplaintInput) {
  const data = await backendRequest<{ complaint: Complaint }>("/complaints", {
    method: "POST",
    body: input,
  });
  return data.complaint;
}

export async function retriageComplaint(id: string) {
  return backendRequest<{ reference: string }>(`/complaints/${id}/retriage`, { method: "POST" });
}

export async function escalateComplaint(id: string) {
  return backendRequest<{ caseId: string; complaint: Complaint }>(
    `/complaints/${id}/escalate`,
    { method: "POST" },
  );
}

/* ---------------- Ad-hoc attribution ---------------- */

export interface AttributeInput {
  address: string;
  chain: string;
  maxHops: number;
  minValueUsd: number;
  direction: "outbound" | "inbound" | "both";
  fraudType?: FraudType;
  seedValueUsd?: number;
}

export async function attributeAddress(input: AttributeInput) {
  return backendRequest<AttributionSummary>("/complaints/attribute", {
    method: "POST",
    body: input,
  });
}

/* ---------------- Alerts ---------------- */

export const alertsQuery = (
  filters: { status?: string; severity?: string; complaintId?: string } = {},
  enabled = true,
) =>
  queryOptions({
    queryKey: ["backend", "alerts", filters],
    enabled: backendConfigured() && enabled,
    retry: false,
    refetchInterval: 45_000,
    queryFn: () =>
      backendRequest<Paginated<AlertRecord>>("/alerts", {
        query: {
          page: 1,
          limit: 50,
          ...(filters.status && filters.status !== "all" ? { status: filters.status } : {}),
          ...(filters.severity && filters.severity !== "all" ? { severity: filters.severity } : {}),
          ...(filters.complaintId ? { complaintId: filters.complaintId } : {}),
        },
      }),
  });

export async function setAlertStatus(id: string, status: AlertStatus) {
  const data = await backendRequest<{ alert: AlertRecord }>(`/alerts/${id}/status`, {
    method: "PATCH",
    body: { status },
  });
  return data.alert;
}

/* ---------------- Providers ---------------- */

export const backendProvidersQuery = (enabled = true) =>
  queryOptions({
    queryKey: ["backend", "providers"],
    enabled: backendConfigured() && enabled,
    retry: false,
    queryFn: () =>
      backendRequest<{ providers: { chain: string; provider: string; live: boolean }[] }>(
        "/intelligence/providers",
      ),
  });

/* ---------------- Dual AI ---------------- */

export const aiStatusQuery = (enabled = true) =>
  queryOptions({
    queryKey: ["backend", "ai", "status"],
    enabled: backendConfigured() && enabled,
    retry: false,
    staleTime: 60_000,
    queryFn: () => backendRequest<AiSystemsStatus>("/ai/status"),
  });

export const backendInvestigationsQuery = (enabled = true) =>
  queryOptions({
    queryKey: ["backend", "investigations"],
    enabled: backendConfigured() && enabled,
    retry: false,
    queryFn: () =>
      backendRequest<Paginated<BackendInvestigation>>("/investigations", {
        query: { page: 1, limit: 50 },
      }),
  });

/** AI System 1 — ask the platform model which route the money took. */
export async function predictMoneyRoute(investigationId: string) {
  return backendRequest<RoutePredictionResult>(
    `/ai/investigations/${investigationId}/route-prediction`,
    { method: "POST" },
  );
}

/** AI System 2 — one grounded copilot turn about a stored investigation. */
export async function askCopilot(input: {
  investigationId: string;
  mode: CopilotMode;
  question?: string;
}) {
  return backendRequest<CopilotResponse>(`/ai/investigations/${input.investigationId}/copilot`, {
    method: "POST",
    body: { mode: input.mode, ...(input.question ? { question: input.question } : {}) },
  });
}
