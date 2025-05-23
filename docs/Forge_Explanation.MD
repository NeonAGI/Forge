# The Forge – System Overview

## 1  Mission Statement

Craft a calm yet powerful ambient assistant that helps the user *forge* each day into a masterpiece by fusing voice, glanceable data, and subtle ambient cues.

## 2  Core Philosophy

* **Ambient first** – the UI should disappear until summoned.
* **Voice-centric** – conversation is the primary I/O, but always backed by touch / remote.
* **Self-hosted** – runs on a Raspberry Pi so data stays in the living room, not the cloud.
* **Composable** – every feature lives in its own module that can be swapped or upgraded.

## 3  Functional Modules

| Module               | Responsibility                                         |
| -------------------- | ------------------------------------------------------ |
| **EmberMic**         | Wake-word, VAD, Whisper STT, TTS feedback              |
| **ClockCard**        | Time, date, timezone detection                         |
| **TaskList**         | CRUD todos via voice or tap                            |
| **WorkoutLogger**    | Rapid set / rep capture + history                      |
| **GoalTracker**      | Long-term progress bars                                |
| **VitalsCard**       | Steps, calories, readiness via Health Kit / Google Fit |
| **BackgroundEngine** | SDXL prompt builder → nightly city artwork             |

## 4  Application Architecture

### 4.1  Frontend

* **Framework**: SvelteKit (lightweight, SSR friendly)
* **State**: `svelte-store` (read-through cache to SQLite)
* **Style**: Tailwind 4 + CSS variables from the UI guide
* **Routing**: Single dashboard route + modal overlays

### 4.2  Backend

* **Runtime**: Node 20 (bun or TS-node dev)
* **Database**: SQLite with `better-sqlite3` (file-based, no server)
* **API**: REST over `express` + WebSocket event bus
* **Auth**: local bearer token (only needed for remote clients)

### 4.3  Voice Pipeline

```
Mic → Porcupine (wake) → VAD → Whisper.cpp small → Intent Router
     ↘──────────────TTS (Piper)────────────↗
```

Router emits intents to Svelte store → UI reacts.

### 4.4  Sync / Backup

Optional Supabase table mirror via nightly job.

## 5  Hardware Blueprint

* **Raspberry Pi 5** (8 GB) + NVMe hat
* **USB condenser mic** (Samson Go, ReSpeaker 2-mic)
* **Pi Cam v3 wide-angle** for presence detection
* **HDMI to TV**, CEC wake / sleep
* **PIR sensor** (optional) on GPIO 4 for ultra-low-power wake when TV off

## 6  Data Schema (v0.1)

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  is_done BOOLEAN DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE goals (
  id TEXT PRIMARY KEY,
  title TEXT,
  target_value REAL,
  unit TEXT,
  deadline DATE,
  progress REAL DEFAULT 0
);

CREATE TABLE workouts (
  id TEXT PRIMARY KEY,
  date DATE,
  exercise TEXT,
  set_number INT,
  reps INT,
  weight REAL
);
```

## 7  Deployment Workflow

1. `pnpm i && pnpm dev` – local hot-reload on laptop
2. `docker build -t the-forge .`
3. `scp` to Pi → `docker compose up -d` (mounting `/data`)
4. TV opens `http://forge.local:5173` as its Home Screen.

## 8  Roadmap (Q3 → Q4)

1. **Presence adaptive brightness**
2. **Calendar integration & "Anvil" task batching**
3. **Offline LLM (Phi-3-mini) for simple queries**
4. **Bluetooth HRM ingestion for workout auto-log**
5. **Companion mobile app** for push reminders
