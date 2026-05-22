# Emergency Dispatch System — Architecture

**Version:** 2.0 (post-review)
**Stack:** Node.js + Next.js + PostgreSQL/PostGIS + Redis + OSRM
**Scope:** Nationwide ambulance + firefighter dispatch, deterministic (no AI)
**Deployment target:** Localhost via Docker Compose

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Technology Stack](#2-technology-stack)
3. [OSRM Licensing](#3-osrm-licensing)
4. [National Infrastructure Registry](#4-national-infrastructure-registry)
5. [Live Vehicle State](#5-live-vehicle-state)
6. [Incident Intake](#6-incident-intake)
7. [Rule-Based Classifier](#7-rule-based-classifier)
8. [Priority Scoring](#8-priority-scoring)
9. [Incident State Machine](#9-incident-state-machine)
10. [Assignment Table and Concurrency Control](#10-assignment-table-and-concurrency-control)
11. [Dispatch Engine](#11-dispatch-engine)
12. [Hospital Matching](#12-hospital-matching)
13. [Routing (OSRM)](#13-routing-osrm)
14. [Real-Time Communication](#14-real-time-communication)
15. [Dispatcher Console](#15-dispatcher-console)
16. [Failure and Degraded Modes](#16-failure-and-degraded-modes)
17. [Audit Logging](#17-audit-logging)
18. [Security](#18-security)
19. [Data Storage Summary](#19-data-storage-summary)
20. [Bottleneck Resolutions](#20-bottleneck-resolutions)
21. [Incident Processing Flow](#21-incident-processing-flow)
22. [Implementation Order](#22-implementation-order)
23. [Algorithms Reference](#23-algorithms-reference)
24. [Future Expansion](#24-future-expansion)
25. [Design Philosophy](#25-design-philosophy)

---

## 1. Project Overview

This system is a nationwide emergency dispatch platform that coordinates ambulances, firefighter units, and hospital assignments. It receives citizen emergency requests, classifies them using deterministic rule-based logic, and dispatches the best-matching available resources in real time.

The design prioritizes correctness, speed, and crash recovery. There is no machine learning component — every decision is reproducible and auditable. The architecture is intended to be implementable as a working prototype quickly, while remaining production-feasible at small to medium national scale.

---

## 2. Technology Stack

- **Backend:** Node.js (20+) with Fastify
- **Frontend:** Next.js 14+ (App Router)
- **Primary database:** PostgreSQL 15+ with the PostGIS extension
- **Live state cache:** Redis 7+ (geospatial commands and pub/sub)
- **Routing engine:** Self-hosted OSRM in Docker, fed a Lebanon OSM extract
- **Real-time transport:** WebSockets backed by Redis pub/sub
- **Map rendering:** MapLibre GL JS with OpenStreetMap raster tiles
- **Query layer:** `pg` (node-postgres) with parameterized queries — no ORM

PostGIS is required for spatial indexing, KNN queries, and distance calculations. Redis handles the high-frequency write path for live vehicle positions and the pub/sub layer for real-time fan-out. OSRM provides realistic road-network routing instead of straight-line distance estimates.

---

## 3. OSRM Licensing

OSRM is **BSD-2-Clause licensed** — free to self-host, modify, and use commercially. The public demo server (`router.project-osrm.org`) is rate-limited and explicitly not for production use; we must self-host.

OpenStreetMap data, which OSRM consumes, is licensed under **ODbL**. For our use case (computing routes and displaying them) we only need to attribute OpenStreetMap with a small visible label. No fees, no API keys.

Setup is a Docker container with an OSM extract from Geofabrik. The Lebanon extract is ~49 MB. Preprocessing takes 2–5 minutes once, after which OSRM answers route queries in 5–20 ms.

**Download URL:** `https://download.geofabrik.de/asia/lebanon-latest.osm.pbf`

---

## 4. National Infrastructure Registry

Stored in PostgreSQL with PostGIS, indexed by GiST. Updated infrequently, queried often.

### 4.1 Hospitals

- Geographic location (lat/lng) as `geography(POINT, 4326)`
- Trauma capability flag
- Burn unit availability flag
- ICU capacity (live counter, updated by hospital staff)
- ICU available (decremented atomically on assignment)
- Current load status
- Acceptance status (accepting / not accepting patients)
- Operational status

### 4.2 Ambulances

- Home station / base location
- Last known position (refreshed from Redis every 30 seconds)
- Equipment level (basic, advanced, ICU)
- Medical staff level
- Crew composition
- Status (available, dispatched, en_route, on_scene, transporting, returning, offline)
- Current assignment ID (nullable)

### 4.3 Firefighter Units

- Station location
- Last known position
- Available trucks
- Crew readiness
- Specialization (rescue, fire suppression, hazmat)
- Status
- Current assignment ID (nullable)

### 4.4 Rescue Centers

- Geographic location
- Vehicle inventory (JSONB)
- Staffing levels
- Operational status

---

## 5. Live Vehicle State

Vehicle live state is kept in **Redis** to avoid hammering PostGIS with constant position updates. Every active vehicle has a Redis entry containing:

- Current GPS position (via `GEOADD`)
- Status flag
- Current assignment ID, if any
- Last heartbeat timestamp

A heartbeat timeout policy (60 seconds of silence) marks a vehicle offline automatically. Position history is asynchronously flushed to PostgreSQL every 30 seconds for audit, into an append-only `vehicle_position_history` table partitioned by day.

**Why two-tier storage:** live positions are write-heavy and queried only on current value; history is append-only and queried rarely. Mixing them causes spatial index bloat in PostGIS. Separating them lets each layer do what it is good at.

---

## 6. Incident Intake

Citizens submit emergency requests via the Next.js web application. Each request captures:

- Free-text description (min 10 characters)
- Location (from `navigator.geolocation`, with manual map-pick fallback)
- Optional victim count
- Optional caller contact

On submission, an incident row is created with state `received` and is timestamped. The location comes from the citizen's device — confirmed visually on a map — not from any inference algorithm. The accuracy radius from the Geolocation API is preserved and displayed to dispatchers.

---

## 7. Rule-Based Classifier

Deterministic keyword and pattern engine. No AI, no probabilistic models. The classifier outputs:

- Required service: `medical`, `fire`, `rescue`, or combined
- Severity level: `low`, `medium`, `high`, `critical`
- Estimated unit count
- Special needs flags (trauma, burn, hazmat, cardiac, etc.)

Output is persisted on the incident row. Incident transitions to state `classified`.

The classifier is implemented as keyword maps and pattern matchers — hardcoded and inspectable. When the audit log says "severity=critical because keyword 'unconscious' matched rule R7," that's reproducible. An AI model saying "I think it's critical" is not.

---

## 8. Priority Scoring

**Important correction from original design:** the binary heap priority queue is misleading. A heap implies sequential processing, but in a real dispatch system, low-priority incidents that arrive earlier cannot be blocked waiting for a high-priority incident that arrives later. Incidents must be dispatched concurrently.

Each incident still receives a priority score. The score is used only for:

- Resolving conflicts when two incidents compete for the same unit
- Selecting which pending incident to handle first when dispatcher capacity is saturated
- Selecting which queued incident to assign first when a unit becomes available

For the prototype, a simple SQL query (`ORDER BY priority DESC, created_at ASC`) over pending incidents is sufficient. No in-memory heap is required.

---

## 9. Incident State Machine

Explicit states with defined transitions. Each transition is a single PostgreSQL transaction and is written to the audit log.

```
received → classified → dispatching → dispatched → en_route
        → on_scene → transporting → completed
        (any pre-completed state) → cancelled
```

On dispatcher service startup, any incident stuck in `dispatching` state is automatically recovered and re-evaluated. This is what protects against process crashes mid-dispatch.

---

## 10. Assignment Table and Concurrency Control

Assignments are stored in a dedicated table:

```sql
CREATE TABLE assignments (
  id BIGSERIAL PRIMARY KEY,
  incident_id BIGINT NOT NULL REFERENCES incidents(id),
  unit_id BIGINT NOT NULL,
  unit_type TEXT NOT NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL,
  eta_seconds INTEGER,
  route_polyline TEXT
);
```

Concurrency control uses **`SELECT ... FOR UPDATE SKIP LOCKED`** on the unit row inside the assignment transaction. If two incidents try to dispatch the same nearest ambulance simultaneously, the second dispatcher immediately moves to the next-best candidate instead of waiting. This is the correct behavior for emergency dispatch — no waiting, no double-assignments, no ghost units.

---

## 11. Dispatch Engine

### Stage 1: Candidate retrieval via PostGIS KNN

Instead of progressive radius expansion, we use the PostGIS `<->` operator to fetch the K nearest available units in a single indexed query:

```sql
SELECT id, ST_Distance(last_known_position, ST_MakePoint($1, $2)::geography) AS dist_m
FROM ambulances
WHERE status = 'available'
ORDER BY last_known_position <-> ST_MakePoint($1, $2)::geography
LIMIT 5;
```

**Why KNN beats progressive radius:** the database does the optimization itself, in one query, with no arbitrary radius steps and no risk of "found a candidate but a better one was just outside the ring." This replaces the original early-exit progressive search.

### Stage 2: Capability filtering

Drop candidates that lack required equipment, specialization, or crew.

### Stage 3: Real route evaluation (OSRM)

For remaining candidates, call OSRM's `/route` endpoint to get actual driving ETA. Calls are run in parallel using `Promise.all` — each takes 5–20 ms, so 5 parallel calls complete in essentially one round-trip.

### Stage 4: Weighted scoring and locked assignment

Score each candidate using configurable weights:

| Factor | Weight | Normalization |
|---|---|---|
| ETA (driving time) | 0.60 | `1 - (eta / max_acceptable_eta)`, clamped [0,1] |
| Equipment match | 0.20 | 1.0 full, partial credit otherwise |
| Crew level | 0.15 | basic=0.5, advanced=0.8, ICU=1.0 |
| Specialization fit | 0.05 | 1.0 match, 0.5 otherwise |

Select the highest score. Open a transaction, lock the chosen unit with `SKIP LOCKED`, create the assignment row, transition the incident to `dispatched`. If the chosen unit was locked by a concurrent dispatch, fall through to the next-best candidate automatically.

---

## 12. Hospital Matching

After ambulance dispatch, the destination hospital is selected:

- KNN query for the 3 nearest hospitals matching required specialization (trauma, burn, etc.)
- Filter by `accepting = true` AND `icu_available > 0`
- OSRM route from incident location to each hospital
- Pick best ETA among capable hospitals

The selected hospital is notified via WebSocket. The capacity counter decrements atomically inside the same transaction that records the assignment, so two ambulances cannot claim the last ICU bed.

---

## 13. Routing (OSRM)

Self-hosted Docker setup:

- Lebanon OSM extract from Geofabrik (refreshed monthly)
- Image: `osrm/osrm-backend`
- Preprocessing pipeline: `osrm-extract` → `osrm-partition` → `osrm-customize`
- HTTP backend exposed only on the internal/localhost network
- Driving profile by default; a custom emergency-vehicle profile can be added later

OSRM internally uses **Contraction Hierarchies / Multi-Level Dijkstra** (improvements on the classic A\* algorithm) for shortest-path computation. We use it for:

- Candidate ETA evaluation in Stage 3 of dispatch
- Hospital ETA in matching
- Route polyline display on the dispatcher map

OSRM is never exposed directly to the public internet.

---

## 14. Real-Time Communication

WebSocket server (via `@fastify/websocket`) with three channel families:

- `dispatcher:*` — operator console live updates
- `unit:{id}` — vehicle crew app updates
- `hospital:{id}` — incoming-patient notifications

**All events publish to Redis pub/sub.** Every Node instance subscribes and broadcasts to its own connected clients. This pattern is built in from day one, even with a single Node process, because retrofitting it later requires changing how every real-time event is emitted.

Clients that reconnect issue a `sync` request that returns current full state rather than a diff. Mobile clients in particular drop connections constantly, and full-state resync is far simpler than reliable diff replay.

---

## 15. Dispatcher Console

Built in Next.js at `/console`. Displays:

- Incoming incidents with classifier output
- Recommended units with their scores and reasoning
- One-click confirm or manual override
- Live map of all active assignments (MapLibre GL JS + OSM tiles)

**Auto-dispatch policy:** low-severity incidents may auto-dispatch; high-severity always requires a dispatcher confirmation (configurable). Fully automatic dispatch for a prototype is irresponsible — there must be a human in the loop for high-stakes decisions.

---

## 16. Failure and Degraded Modes

- **OSRM down:** fall back to Haversine ETA × 1.4. Log degraded mode. Dispatch continues.
- **Redis down:** read positions from `last_known_position` in PostgreSQL. Pub/sub disabled; console polls every 2 seconds. Dispatch continues.
- **PostgreSQL down:** hard stop. Display a manual-dispatch screen. This is acceptable because Postgres outages are rare with proper hosting, and degrading gracefully here would risk lost incidents — which is worse than a clear escalation.

A degraded-mode banner is shown on all dispatcher and hospital screens when any dependency is unhealthy, polled via the `/health` endpoint every 10 seconds.

---

## 17. Audit Logging

Every state transition, dispatch decision, score calculation, and operator override is written to an append-only `audit_log` table. Each entry records:

- Actor (system or user ID)
- Timestamp
- Action
- Entity type and ID
- Before / after state (JSONB)
- Reasoning blob (JSONB) — which candidates were considered, their scores, why the winner was chosen

This is non-negotiable for emergency systems. Every dispatch decision must be reconstructible after the fact for legal, operational, and improvement purposes.

---

## 18. Security

- Dispatcher and unit endpoints behind authenticated sessions (JWT-based for localhost prototype)
- Citizen intake is public but rate-limited per IP (5 submissions/minute via Redis counter)
- WebSocket connections are authenticated at handshake; channel subscriptions are authorized per channel
- All inter-service traffic on a private network (Docker Compose internal network)
- OSRM is never exposed to the internet

---

## 19. Data Storage Summary

**PostgreSQL with PostGIS stores:**

- Hospitals, ambulances, firefighter units, rescue centers (static infrastructure)
- Incidents and their state history
- Assignments
- Audit log
- Vehicle position history (append-only, partitioned by day)
- `last_known_position` per vehicle (for KNN queries when Redis is unavailable)
- Users (for local auth)

**Redis stores:**

- Live vehicle positions (via `GEOADD`)
- Vehicle status flags
- Pub/sub channels for real-time fan-out
- Rate-limit counters
- Short-lived locks if needed (most locking is done via Postgres `SKIP LOCKED`)

---

## 20. Bottleneck Resolutions

### GPS update storms
Resolved by routing live updates to Redis, flushing to Postgres every 30 seconds. Avoids spatial index bloat and contention between writes and reads.

### WebSocket fan-out
Resolved by Redis pub/sub between Node instances, built in from day one even with a single instance running.

### Spatial index bloat
Resolved by keeping live positions out of the PostGIS index. PostGIS only holds static infrastructure and append-only history.

### Dispatch engine single point of failure
Resolved by the database-backed incident state machine. On crash recovery, incidents in intermediate states are resumed automatically.

### Concurrent unit assignment
Resolved by `SELECT ... FOR UPDATE SKIP LOCKED` on unit rows during assignment. No double-dispatch, no waiting.

### Suboptimal early-exit radius search
Replaced with PostGIS KNN. Single indexed query returns the K nearest candidates, all of which are then scored properly via OSRM.

---

## 21. Incident Processing Flow

1. Incident submitted by citizen via Next.js intake (location confirmed visually on map).
2. Rule-based classifier determines required service, severity, and special needs.
3. Incident priority score computed.
4. Incident enters `classified` state; dispatcher console receives it via WebSocket.
5. For low/medium severity: auto-dispatch begins. For high/critical: dispatcher confirms.
6. Dispatch engine runs multi-stage selection:
   - PostGIS KNN → capability filter → parallel OSRM ETAs → weighted scoring
7. Unit locked via `SKIP LOCKED`, assignment row created, incident transitions to `dispatched`.
8. Hospital matched (KNN + capability + OSRM) and notified via WebSocket.
9. Real-time tracking via Redis live positions + WebSocket pub/sub.
10. Crew progresses through states (`en_route` → `on_scene` → `transporting` → `completed`).
11. All transitions written to audit log with full reasoning.

---

## 22. Implementation Order

Recommended sequence. Foundations (steps 1–4) must be solid before higher layers are built.

| Step | Component | Estimate |
|---|---|---|
| 1 | Docker Compose: Postgres + PostGIS + Redis + OSRM | 1 day |
| 2 | DB schema + migrations + seed (Lebanon data) | 2 days |
| 3 | Incident state machine + assignment table + audit log | 2 days |
| 4 | Rule-based classifier | 1 day |
| 5 | Dispatch engine: KNN + OSRM + SKIP LOCKED | 3 days |
| 6 | Hospital matching | 1 day |
| 7 | WebSocket layer + Redis pub/sub | 2 days |
| 8 | Dispatcher console (Next.js) | 3 days |
| 9 | Citizen intake (Next.js) | 2 days |
| 10 | Vehicle/crew mobile-web view | 2 days |
| 11 | Hospital view | 1 day |
| 12 | Failure mode handling + audit dashboard | 2 days |

Total: approximately three weeks for a focused single engineer.

---

## 23. Algorithms Reference

A quick reference of every algorithm in the system and its role.

### Haversine Formula
**Purpose:** Straight-line distance between two lat/lng points, accounting for Earth's curvature.
**Use:** OSRM fallback (multiply by 1.4 for road estimate), sanity checks.
**Limitation:** Crow-flies, not road distance. Never the primary distance metric.

### PostGIS KNN (`<->` operator)
**Purpose:** Find K geographically nearest entities in a single indexed query.
**Use:** Stage 1 of dispatch (nearest units), hospital matching (nearest hospitals).
**Backed by:** GiST spatial index on `geography(POINT, 4326)` columns.
**Replaces:** Progressive circular radius search from the original design.

### A\* / Contraction Hierarchies (inside OSRM)
**Purpose:** Shortest-path routing on a road graph.
**Use:** Real driving ETA in Stage 3 of dispatch, hospital ETA, route polylines.
**Why not implement ourselves:** OSRM is mature, fast (5–20 ms per query), and handles preprocessing of the road graph for us.

### Weighted Scoring
**Purpose:** Pick the best candidate from K filtered options using multi-criteria decision.
**Use:** Final unit selection (Stage 4), hospital selection.
**Why:** Transparent, tunable, deterministic. Every decision reconstructable from the audit log.

### Rule-Based Classifier
**Purpose:** Convert free-text incident description into structured classification.
**Use:** Immediately after intake.
**Implementation:** Keyword maps + pattern matchers. No AI.
**Why:** Explainable, fast, no external dependencies, deterministic.

### Database-Driven Priority Selection
**Purpose:** Pick the next pending incident when dispatcher is saturated.
**Implementation:** `ORDER BY priority DESC, created_at ASC LIMIT 1 FOR UPDATE SKIP LOCKED`.
**Replaces:** In-memory binary heap from the original design.

### Pessimistic Locking (`SELECT ... FOR UPDATE SKIP LOCKED`)
**Purpose:** Prevent two simultaneous dispatch operations from assigning the same unit.
**Use:** Unit assignment transaction, hospital ICU bed claim.
**Why SKIP LOCKED:** Waiting is the wrong behavior for emergency dispatch — fall through to next-best candidate immediately.

### Redis Geospatial Commands (`GEOADD`, `GEOSEARCH`)
**Purpose:** Store and query live vehicle positions without taxing PostGIS.
**Use:** Hot path for GPS updates from crew apps.
**Backed by:** Internal geohash encoding in Redis sorted sets.

---

## 24. Future Expansion

Out of scope for prototype, but the architecture is ready to accommodate:

- AI-based incident classification (would replace the rule-based classifier behind the same interface)
- Predictive emergency demand forecasting
- Live traffic-aware routing (Valhalla migration)
- Multi-region scaling clusters
- Custom emergency-vehicle routing profile in OSRM
- Mobile-native crew applications
- Telco-provided location data for phone-call intake
- National address-registry lookups for dispatcher manual entry

---

## 25. Design Philosophy

- **Deterministic** — every decision is reproducible from the audit log
- **Crash-recoverable** — state lives in Postgres, intermediate states resume on restart
- **Concurrency-safe** — locks at the database level prevent ghost assignments
- **Human-in-the-loop** — high-severity dispatch requires confirmation
- **Degradable** — defined fallbacks for OSRM and Redis outages
- **Auditable** — every decision logged with its reasoning
- **No black boxes** — no ML, no opaque heuristics, no inference where confirmation is possible
