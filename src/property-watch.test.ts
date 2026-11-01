import assert from "node:assert/strict";
import { parseCatalogRequest } from "./property-watch-service.js";

const request = parseCatalogRequest({
  propertyId: "unit-4b",
  catalogName: "Riverside catalog",
  competitorUrls: ["https://example.com/listings"],
  maintenanceRequest: { title: "Repair heater", priority: "urgent" },
  tenantDocument: { name: "proof of insurance", documentType: "insurance" },
  inspectionReminder: { cronExpr: "0 8 * * 1", taskUrl: "https://example.com/check" }
});

assert.equal(request.maintenanceRequest.priority, "urgent");
assert.equal(request.tenantDocument.documentType, "insurance");
assert.equal(request.inspectionReminder.cronExpr, "0 8 * * 1");
assert.throws(() => parseCatalogRequest({ ...request, competitorUrls: ["local"] }));
console.log("catalog boundary decisions passed");
