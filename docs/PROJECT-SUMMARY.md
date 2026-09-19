# PROPETRA — Project Summary

## What Is PROPETRA?

PROPETRA — *Property Excellence Through Reliable Automation* — is a modern, cloud-based, multi-tenant **Property Management System (PMS)** built for hotels, resorts, and hospitality businesses. It is being developed as an original, independent product: no existing PMS is being customized, white-labeled, or rebranded.

## Who Is TEAM PETRA?

TEAM PETRA is the software development and technology team building and operating PROPETRA. TEAM PETRA is responsible for the full lifecycle of the product — architecture, development, hosting, security, maintenance, hotel onboarding, and customer support.

## Target Customers

PROPETRA is aimed at hotels, resorts, and hospitality businesses that need a reliable, professional PMS but prefer not to build or operate their own software infrastructure. This includes independent hotels, small hotel groups, and resorts looking to modernize daily operations.

## Business Model

PROPETRA follows a **software-as-a-service (SaaS)** model:

- TEAM PETRA develops and centrally hosts the platform.
- Multiple hotels subscribe to and use PROPETRA as tenants.
- Each hotel operates within its own isolated workspace — its own users, data, and day-to-day operations.
- TEAM PETRA centrally manages infrastructure, security, updates, maintenance, onboarding, and support across all tenants.

## Core Problem

Many hotels, particularly small and mid-sized properties, rely on fragmented, outdated, or manually operated systems for reservations, guest records, billing, and housekeeping. They typically lack the internal technical resources to build, secure, and maintain professional-grade software. PROPETRA addresses this by providing a centrally managed platform that removes that burden from individual hotels.

## Project Objectives

- Build a reliable, professional PMS tailored to hospitality operations.
- Support multiple independent hotel tenants on one shared platform.
- Guarantee strict data isolation and security between tenants.
- Centralize platform administration, maintenance, and support under TEAM PETRA.
- Establish an architecture that scales cleanly as more hotels are onboarded.
- Build the product as a real commercial system, not a demo or tutorial project.

## Core PMS Capabilities

- Room and property management
- Reservations and booking management
- Guest information management
- Billing and payment management
- Housekeeping operations
- Staff and role-based access control
- Reports and business analytics
- Centralized platform administration (TEAM PETRA side)
- Hotel onboarding and customer support
- Future integration capabilities (not yet defined)

## Multi-Hotel SaaS Concept

Each hotel is a **tenant** on the PROPETRA platform. A tenant has its own users, roles, rooms, reservations, guests, and operational data, logically isolated from every other tenant, while running on the same shared application and infrastructure. New hotels are onboarded as new tenants rather than as separate software deployments. See `MULTI-TENANCY.md` for the full design.

## TEAM PETRA Responsibilities

- Developing and maintaining the core platform
- Hosting and operating the system
- Applying updates, fixes, and improvements across all tenants
- Safeguarding platform and tenant data security
- Onboarding new hotel clients
- Providing customer support to hotel clients

## Current Project Status

**Phase 0 — Architecture & Master Documentation.** No production application code exists yet. This document set defines the architectural foundation, technical direction, and phased roadmap that will guide implementation starting in Phase 1. Technology choices described in this documentation are **proposed**, not yet implemented, unless explicitly stated otherwise.

## Long-Term Vision

PROPETRA is intended to grow into a full commercial hospitality platform capable of supporting many hotel clients concurrently, with room for future capabilities (e.g., external integrations, advanced analytics) to be added deliberately once the core platform is stable and proven. Growth in scope will always be evaluated against the project's core principle: build a strong foundation first, and avoid premature complexity.
