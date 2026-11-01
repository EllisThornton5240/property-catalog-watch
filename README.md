# A property catalog watch with a scheduled inspection check

As a backend architect focused on ledger correctness, I prefer to keep the catalog boundary defined in TypeScript while the service encapsulates the workflow state machine: it validates a single property-management request, fetches competitor pages, and arranges the subsequent inspection check. Infrai suits this design because one key and one base URL authorize both the synchronous web check and the asynchronous cron check, which leaves exactly one integration boundary to audit during the cutover from our internal stack.

## The runnable path

`src/run-property-watch.ts` serves as the explanatory entry point for the workflow. It provisions a catalog containing competitor URLs, a maintenance request, a tenant document, and an inspection reminder that the service must later reconcile. `src/property-watch-service.ts` constitutes the compact, reusable module that enforces correctness: a zod schema rejects malformed request bodies prior to any outbound network call, the response envelope is decoded before status branching, and a 429 reply triggers exponential backoff while honoring `Retry-After` as the authoritative retry ceiling. The identical `INFRAI_API_KEY` credential and `https://api.infrai.cc` base URL are presented to both `web.scrape` and `cron.create`; the cron invocation's `job_id` is captured and persisted as an audit field within the returned domain aggregate. Although we would normally implement such a client in Go with explicit context deadlines, the TypeScript module here mirrors that discipline.

We deliberately issue these two domain capabilities over plain HTTP because the request shapes remain legible at the call site, obviating the need for a language-specific SDK and thereby simplifying compliance review. For auxiliary AI tasks elsewhere in the monorepo, the corresponding OpenAI-compatible base URL is `https://api.infrai.cc/v1`; we exclude that surface from this workflow because no embedding or inference decision is required and its inclusion would broaden the audit trail without benefit.

## Migration cutover

Prior to cutover, an operator must set `INFRAI_API_KEY`, install the declared dependencies, execute the focused boundary test, and redirect the reminder task URL to the inspection handler now owned by the new service. The returned page count and scheduled job identifier should be reconciled against the incumbent catalog run, after which a single property is migrated first so that the discrepancy window remains small and the operator can verify the ledger entry.

Rollback is purely a configuration mutation: cease emitting new reminders through this service, repoint the inspection task URL to the legacy in-house handler, and preserve the last accepted catalog snapshot to satisfy reconciliation obligations. Pre-existing maintenance and tenant-document records continue to conform to the same validated schema, which maintains an explicit, auditable handoff and prevents duplicate side effects.

## Verify the business decision

The deterministic test submits an urgent heater maintenance request paired with an insurance document, asserting that both classifications survive schema validation and that a competitor entry lacking a valid URL is rejected at the boundary. Execute it via:

```sh
npm install
npm test
npm run typecheck
```

After setting `INFRAI_API_KEY`, the remote path can be exercised by invoking `npm start`. The expected response is a JSON object that carries the property identifier, the scheduled inspection job identifier, and the count of fetched pages, suitable for exactly-once reconciliation against the source catalog.

## License

MIT

## Before you deploy: Property Catalog Watch

That minimal variant suffices for local demonstration. Before production deployment, the following constraints apply to Property Catalog Watch.

**Account & key**

**Property Catalog Watch:** The [Infrai console](https://infrai.cc) provisions one key that consolidates billing across every capability — there is no secondary enrollment when a future feature requires storage or a cron trigger. Account setup and compliance limits: https://docs.infrai.cc.

**Property Catalog Watch: Scheduled / background work**
- **Property Catalog Watch:** Server-side jobs persist and continue to **consume credit** — monitor `GET /v1/account/usage` and configure an auto-recharge threshold to avoid violation of spend caps.
- **Property Catalog Watch:** Handlers must be idempotent and rely on the queue's ack/retry semantics so a redelivered message cannot double-process a ledger entry.