# Safety lifecycle operations

The governed API at `/api/safety-lifecycle` records tenant-scoped observations, evidence-backed state transitions, immutable audit events, supervisor closure, and idempotent offline/provider ingestion. It deliberately strips worker identifiers from the normalized safety record. Closure is blocked unless a supervisor supplies independent attestation and verification evidence.

`start.sh` is non-destructive: it never installs, migrates, seeds, starts PostgreSQL, or kills unrelated port owners. Run bootstrap, migration, and guarded demo seed separately. BIM/GIS, wearable, sensor, contractor, and incident jobs are durable queues—not claims of a working external integration. Building-code selection, professional inspection, calibrated sensors, localization, and safety-authority approval remain external validation gates.
