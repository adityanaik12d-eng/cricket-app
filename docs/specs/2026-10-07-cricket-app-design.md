# Cricket App - Design Spec

**Date:** 2026-10-07
**Status:** Draft
**Platform:** Native (Kotlin/Android, Swift/iOS) + Web (PWA)
**Theme:** Dark-first, responsive (phone + tablet)

## 1. Purpose

A CricHeroes-like cricket scoring and match management app with dark UI that works well on both phones and tablets. The app supports native mobile apps (Kotlin/Swift) and web, with offline-first scoring and live score sharing.

### 1.1 Goals
- Ball-by-ball scoring for grassroots cricket with offline support
- Live scores and scorecards viewable by spectators (no account required)
- Player profiles and career statistics
- Team/tournament management for organizers
- Dark-first, responsive UI optimized for both phone and tablet use
- Native performance on iOS/Android with shared core logic

### 1.2 Key Design Principles
- Event-sourced: All match data as append-only log of events (same as ninja-cricketer)
- Pure core logic: Scoring engine is platform-agnostic, testable, deterministic
- Offline-first: Scorer can complete entire match without network
- Single source of truth: Same engine logic across all platforms
- Responsive design: Adaptive layouts for phone (portrait) and tablet (landscape)

## 2. Architecture Overview

We adopt event sourcing with a shared core engine, similar to ninja-cricketer but restructured for multi-platform (native + web).

### 2.1 High-level Architecture

| Component | Platform | Responsibility |
|---|---|---|
| `core-engine` (shared) | All (KMP/TS) | Pure scoring engine, event validation, state projection. Zero I/O, deterministic. |
| `shared-models` | All | Domain types, events, DTOs (serializable) |
| Android App (Kotlin) | Android | Scoring UI, local storage, sync |
| iOS App (Swift) | iOS | Scoring UI, local storage, sync |
| Web App (React/Vite PWA) | Web | Spectator view, admin, PWA installable |
| API Backend | Server | Event ingest, sync, auth, realtime (SSE/WebSocket) |
| DB | Postgres | Event store, projections |

### 2.2 Core Domain Model

Following ninja-cricketer's event-sourced approach - **match events are the source of truth**. Everything else is derived.

**Key entities:**
- `Match` - Match configuration and metadata
- `MatchEvent` (append-only) - Ball events, toss, declare, corrections, end match
- `Player`, `Team`, `League`, `Tournament`
- Projections: LiveScore, Scorecard, Commentary, PlayerCareer, PointsTable

## 3. Event Model

Core event types (inspired by ninja-cricketer, adapted):
- `BALL` - Delivery with runs, extras, wicket info
- `TOSS` - Toss result
- `DECLARE` - Innings declared
- `PENALTY` - Penalty runs
- `END_MATCH` - Tie/abandoned/completed
- `CORRECTION` - Supersedes previous event (preserves audit trail)

Ordering is by `seq` (sequence number), never by timestamp. Client-generated UUIDs for idempotency.

## 4. Multi-Platform Strategy

Two approaches for shared core:
1. **Kotlin Multiplatform (KMP)** - Write core in Kotlin, share with iOS via Kotlin Native. Web could share via Kotlin/JS (or keep TS). Good for native-first.
2. **TypeScript core + bindings** - TS engine compiled, use via Kotlin/JS interop on Android, or share via WASM? Or just duplicate thin wrappers. Simpler for web.

Recommended: **KMP for core models + engine logic** if doing proper native. Or start with TS core (portable) and build native UIs separately calling it? Let us design for flexibility.

But user wants Kotlin (Android) and Swift (iOS) natively - so core logic could be in Kotlin Multiplatform shared module consumed by Android, and also compiled to native frameworks for iOS, or duplicated. KMP is cleanest.

## 5. UI/UX Design (Dark-first, Responsive)

### 5.1 Design System
- **Theme**: Dark-first (#0F172A background, #1F2937 surfaces, accent colors)
- **Colors**: Cricket green/blue accents, high contrast for outdoor visibility
- **Typography**: System fonts, readable at all sizes
- **Components**: Large tap targets (min 48dp) for scoring in field conditions
- **Responsive breakpoints**: Phone (< 768px), Tablet (>= 768px), landscape vs portrait

### 5.2 Scoring UI (Primary use case)
- **Phone (portrait)**: Single column, large buttons for runs/extras/wickets, bottom sheet for wicket types
- **Tablet (landscape)**: Split view - scorecard + scoring controls side-by-side, more info visible
- **Offline indicators**, sync status, conflict warnings

### 5.3 Spectator View (Web + can be in apps)
- Live score, ball-by-ball, full scorecard, commentary
- Dark theme, mobile-friendly

## 6. Tech Stack

| Layer | Tech | Notes |
|---|---|---|
| Shared Core | Kotlin Multiplatform | Share models, engine, sync logic between Android/iOS |
| Android | Kotlin, Jetpack Compose | Modern native UI |
| iOS | Swift, SwiftUI | Modern native UI |
| Web | React + Vite + TypeScript, PWA | Spectator/admin, installable |
| Backend | Fastify (Node/TS) or Ktor (Kotlin) | Event ingest, SSE, auth |
| DB | PostgreSQL + Drizzle/Ktorm | Event store |
| Local Storage (Mobile) | Room/SQLDelight (Android), CoreData/GRDB (iOS) | Local event log (IndexedDB equivalent) |
| Realtime | SSE (server-sent events) | Simple, works well for score updates |
| Auth | Magic link (email) | As per design - no passwords/OAuth |

## 7. Implementation Phases

### Phase 1: Core Engine (Shared)
- Event types, scoring engine, validation (pure, deterministic)
- Port ninja-cricketer engine logic to KMP/TS shared core
- Comprehensive tests (unit + property-based)

### Phase 2: Backend API
- Event store schema, ingest endpoints, sync logic
- SSE streaming for live updates
- Auth (magic links)

### Phase 3: Android App (Scorer)
- Dark UI, responsive layouts (phone/tablet)
- Offline event log, sync queue
- Ball-by-ball scoring flow

### Phase 4: iOS App (Scorer)
- SwiftUI, matching UX, responsive
- CoreData/GRDB for local log
- Sync with API

### Phase 5: Web App (Spectator)
- PWA, live scorecast, profiles
- Shareable match links

### Phase 6: Polish & Testing
- E2E flows, golden file tests with real matches
- Offline-equals-online verification

## 8. Project Structure (Proposed)

```
cricket-app/
  docs/
    specs/
  core/                    # Shared KMP core (or packages/core)
    shared/
      src/commonMain/      # Engine, models, logic
      src/commonTest/
  android/                 # Android app
  ios/                     # iOS app
  web/                     # Web app (PWA)
  server/                  # Backend API
  packages/                # If TS-first: engine, shared-types
```

Need to decide KMP vs TS-first. Given "Kotlin/Swift native" requirement, KMP for shared business logic is cleaner.

## Next Steps
1. Decide core strategy (KMP vs TS) - recommend KMP
2. Create detailed technical specs for each platform
3. Set up monorepo structure
4. Implement core engine first (TDD)