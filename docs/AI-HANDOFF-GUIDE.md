# PROPETRA — AI Handoff Guide

> This document defines how work on PROPETRA is handed off between development sessions and between different AI systems, so that no session requires the original conversation history to continue correctly.

## Purpose

PROPETRA is expected to be developed across multiple sessions, potentially by different AI systems or developers. This guide defines the standard mechanism — `PROJECT-STATE.md` plus a defined ZIP structure — that makes each handoff self-contained.

## The `PROJECT-STATE.md` Standard

Every phase must produce (and every phase must begin by reading) a `PROJECT-STATE.md` file at the root of the project, containing:

```text
Project
Current Phase
Completed Work
Architecture Status
Database Status
Implemented Modules
UI Status
Known Issues
Dependencies
Environment Requirements
Important Decisions
Next Phase
Next Phase Requirements
```

This file is the single most important artifact for continuity — it should always reflect the true current state of the project, updated at the end of every phase.

## Required AI Development Workflow

```text
Receive Phase ZIP
        ↓
Read PROJECT-STATE.md
        ↓
Read PROJECT-SUMMARY.md
        ↓
Read SYSTEM-ARCHITECTURE.md
        ↓
Inspect existing code
        ↓
Inspect database/schema
        ↓
Understand current UI
        ↓
Read DEVELOPMENT-PHASES.md
        ↓
Read requirements for next phase
        ↓
Plan changes
        ↓
Implement only the current phase
        ↓
Test
        ↓
Update documentation
        ↓
Generate new PROJECT-STATE.md
        ↓
Package next ZIP
```

No phase should begin by writing code before this sequence is completed. Documentation and existing code are always the source of truth — never assumptions carried over from a prior conversation that isn't reflected in the repository itself.

## Phase ZIP Handoff Standard

Each completed phase is packaged as a ZIP with a consistent structure:

```text
PROPETRA-PHASE-NN/
├── src/
├── prisma/
├── public/
├── docs/
├── PROJECT-STATE.md
├── README.md
├── package.json
├── docker-compose.yml
└── ...
```

### Must Be Included
- Full source code for the current state of the application (`src/`).
- Prisma schema and migrations (`prisma/`).
- All documentation (`docs/`), kept up to date.
- `PROJECT-STATE.md`, reflecting the true current state.
- `README.md`, explaining how to run the project locally.
- `package.json` and any other manifest files needed to install dependencies.
- `docker-compose.yml` and related configuration needed to run the project.
- `.env.example` documenting required environment variables (with placeholder, non-real values).

### Must Never Be Included
- Real secrets or credentials of any kind.
- `.env` files containing real values.
- `node_modules` or other generated/installable dependency directories.
- Production database credentials or connection strings.
- Any real hotel or guest data.

## Handoff Discipline

- A receiving AI or developer should treat the repository and documentation as authoritative over any prior conversation summary.
- If documentation and code appear to disagree, that discrepancy should be resolved (and documented) before proceeding — not silently assumed one way or the other.
- Uncertain or undecided items should remain marked as **Proposed**, **To Be Decided**, or **Future Consideration** in documentation until a phase explicitly resolves them.

## What Must NOT Be Changed Without Explicit Decision

- The modular monolith architecture (`SYSTEM-ARCHITECTURE.md`, `MODULE-ARCHITECTURE.md`).
- The shared-database, tenant-ID multi-tenancy model (`MULTI-TENANCY.md`).
- The core technology stack direction (`TECH-STACK.md`), unless a documented reason requires revisiting it.
- The phase sequence and dependency order (`DEVELOPMENT-PHASES.md`), absent a documented reason to resequence.

Any change to these must be reflected explicitly in the relevant documentation file and in `PROJECT-STATE.md`'s "Important Decisions" section — never silently.
