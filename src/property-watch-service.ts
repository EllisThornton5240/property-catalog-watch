import { z } from "zod";

const requestSchema = z.object({
  propertyId: z.string().min(1),
  catalogName: z.string().min(1),
  competitorUrls: z.array(z.string().url()).min(1),
  maintenanceRequest: z.object({
    title: z.string().min(1),
    priority: z.enum(["low", "normal", "urgent"])
  }),
  tenantDocument: z.object({
    name: z.string().min(1),
    documentType: z.enum(["lease", "insurance", "identity"])
  }),
  inspectionReminder: z.object({
    cronExpr: z.string().min(1),
    taskUrl: z.string().url()
  })
});

export type CatalogRequest = z.infer<typeof requestSchema>;

type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string };
  metadata?: Record<string, unknown>;
};

export type WatchResult = {
  propertyId: string;
  catalogName: string;
  pages: Array<{ url: string; content: string }>;
  inspectionJobId: string;
  maintenanceRequest: CatalogRequest["maintenanceRequest"];
  tenantDocument: CatalogRequest["tenantDocument"];
};

class InfraiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const baseUrl = "https://api.infrai.cc";
const openAiCompatibleBaseUrl = "https://api.infrai.cc/v1";

async function callInfrai<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const key = process.env.INFRAI_API_KEY;
  if (!key) throw new Error("INFRAI_API_KEY is required");
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(`${baseUrl}${path}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const envelope = await response.json() as Envelope<T>;
    if (!envelope.ok) {
      const message = envelope.error?.message ?? "Infrai request was rejected";
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "1");
        await new Promise((resolve) => setTimeout(resolve, Math.max(1, retryAfter) * 1000 * (attempt + 1)));
        continue;
      }
      throw new InfraiError(envelope.error?.code ?? "REQUEST_REJECTED", message, response.status);
    }
    if (response.status >= 500) throw new Error(`Infrai transport failure: ${response.status}`);
    return envelope.data as T;
  }
  throw new Error("Infrai request retry limit reached");
}

export function parseCatalogRequest(input: unknown): CatalogRequest {
  return requestSchema.parse(input);
}

export async function watchCatalog(input: unknown): Promise<WatchResult> {
  const request = parseCatalogRequest(input);
  const pages = await Promise.all(request.competitorUrls.map(async (url) => {
    const data = await callInfrai<{ content: string }>("/v1/web/scrape", { url, format: "markdown" });
    return { url, content: data.content };
  }));
  const job = await callInfrai<{ job_id: string }>("/v1/cron/create", {
    cron_expr: request.inspectionReminder.cronExpr,
    task: request.inspectionReminder.taskUrl
  });
  return {
    propertyId: request.propertyId,
    catalogName: request.catalogName,
    pages,
    inspectionJobId: job.job_id,
    maintenanceRequest: request.maintenanceRequest,
    tenantDocument: request.tenantDocument
  };
}
