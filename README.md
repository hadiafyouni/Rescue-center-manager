# Emergency Dispatch System (Localhost Prototype)

A nationwide Emergency Dispatch System prototype running on localhost via Docker Compose.

## Prerequisites

- Docker and Docker Compose
- Node.js 20+

## Setup & Running

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Prepare OSRM (Run once):**
   This downloads the Lebanon OpenStreetMap extract and prepares the routing engine data.
   ```bash
   npm run osrm:prepare
   ```

3. **Start Infrastructure:**
   Start Postgres (with PostGIS), Redis, and OSRM.
   ```bash
   npm run infra:up
   ```

4. **Seed Database:**
   ```bash
   npm run seed
   ```

5. **Start Application:**
   Starts both the backend (Fastify) and frontend (Next.js) concurrently.
   ```bash
   npm run dev
   ```

## Architecture

- **Postgres (with PostGIS)**: Primary database, handles spatial KNN queries for dispatch.
- **Redis**: Live geospatial cache for vehicle positions, and Pub/Sub for real-time WebSockets.
- **OSRM**: Self-hosted local routing engine for accurate ETA calculations.
- **Backend**: Node.js + Fastify.
- **Frontend**: Next.js (App Router).

## References
- [ChatGPT Share](https://chatgpt.com/share/6a106741-25c4-83eb-a1b5-ee93315e7309)
- [Claude AI Share](https://claude.ai/share/c6053bb0-7201-403b-87f3-914e9240a948)
