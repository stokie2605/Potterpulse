# Potter Pulse

## ⚖️ Portfolio Project Disclaimer
This repository serves strictly as a non-commercial, open-source technical portfolio piece for architectural demonstration, evaluation, and engineering prototyping. All fixture structures, numerical metrics, and club identifiers function entirely as mock testing assets within a local database sandbox environment. This application maintains no official affiliation with any professional athletic organizations or commercial media networks.

<img src="docs/screenshots/dashboard_latest.png" alt="Potter Pulse Desktop Interface" width="100%" />

Potter Pulse is a work-in-progress sports data tracker application engineered around a lightweight SQLite relational database and a native Node.js runtime rendering pipeline. It delivers an immersive, high-contrast visual interface optimized for immediate matchday telemetry, while maintaining a dedicated local identity. This project serves as an evolving layout prototype featuring dynamic data streams, an active server-side page compiler, and an explicitly documented architecture history.

## Project Status

The core backend configuration is fully operational, the relational SQLite layer is populated, and the high-contrast interface aesthetic is established. The platform is actively moving through a refinement phase to prepare the code for containerized staging deployment.

### Known WIP Areas
* Migrate temporary placeholder text badges to dynamic image asset arrays.
* Implement deep-dive statistical sub-views and interactive match event components.
* Refine viewport fluid scaling parameters across non-standard media breakpoints.
* Evaluate transition parameters from the direct server-side template injector to a decoupled frontend build stack.

---

## Current Architecture

```text
Potterpulse/
├── index.html                         # Single-page client shell and global style matrix
├── potter_pulse.db                    # Active SQLite database file
├── scripts/
│   ├── server.mjs                     # Core Node.js HTTP server and template injection engine
│   └── seed-potter-pulse.mjs          # Database seeding script for core schema initialization
├── docs/
│   └── screenshots/
│       └── dashboard_latest.png       # Optimized README architectural storefront image
└── potterpulse-*.png                  # Local visual validation artifacts generated during QA runs
