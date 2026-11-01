import { watchCatalog } from "./property-watch-service.js";

const result = await watchCatalog({
  propertyId: "harbor-view-17",
  catalogName: "Harbor View homes",
  competitorUrls: ["https://example.com/availability"],
  maintenanceRequest: { title: "Replace lobby light", priority: "normal" },
  tenantDocument: { name: "renewal packet", documentType: "lease" },
  inspectionReminder: {
    cronExpr: "0 9 * * 1",
    taskUrl: "https://example.com/internal/inspection-check"
  }
});

console.log(JSON.stringify({ propertyId: result.propertyId, inspectionJobId: result.inspectionJobId, pages: result.pages.length }, null, 2));
