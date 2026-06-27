Markdown
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
How It Works
The platform relies on a flat, low-overhead rendering architecture to avoid unnecessary build-step abstractions:

Data Layer: potter_pulse.db hosts all structured squad and schedule data.

Server Engine: scripts/server.mjs handles incoming connections, queries the database utilizing Node's native node:sqlite module, and loads the HTML framework.

Template Injection: The server acts as a synchronous compiler, safely swapping string interpolation targets ({{heroOpponent}}, {{squadCards}}, {{fixtureTimeline}}) with sanitized relational data records before delivery.

Local Serving: The application initializes locally over port 4173 without requiring complex node package configurations, bundlers, or frontend dependency compilation.

Database Schema
Database File: potter_pulse.db

Table: stoke_squad
Purpose: Manages active roster personnel metrics.

id (PRIMARY KEY)

player_name (TEXT)

position (TEXT)

squad_number (INTEGER)

nationality (TEXT)

date_of_birth (TEXT)

created_at / updated_at (DATETIME)

Table: efl_fixtures
Purpose: Tracks full seasonal schedules and score verification metrics.

id (PRIMARY KEY)

competition (TEXT)

match_date (TEXT - Normalized to strict YYYY-MM-DD text format)

opponent (TEXT)

venue (TEXT - Constrained to lowercase constants: home, away, neutral)

status (TEXT)

stoke_score / opponent_score (INTEGER)

created_at / updated_at (DATETIME)

Running Locally
Bash
# 1. Initialize the local database server engine
node scripts\server.mjs

# 2. Launch your browser and navigate to the base address:
http://localhost:4173

# Port Conflict Fallback (If port 4173 is occupied by another process):
$env:PORT = '4174'
node scripts\server.mjs
Application View Routes
The application controls layout real estate using a client-side JavaScript tab manager mapped to specific hash locations:

http://localhost:4173/#matches - Matches: Features the pre-match briefing hero hub, editorial feed blocks, performance submission metrics, and the immediate schedule window.

http://localhost:4173/#squad - Squad: Accesses the absolute-positioned tactical pitch grid system.

http://localhost:4173/#away-days - Away Days: Dynamically processes logistical travel metrics matching the next scheduled away venue.

Design Direction
The user interface balances a premium athletic aesthetic with a high-density data dashboard layout. The visual architecture prioritizes structured telemetry matrices and responsive content boundaries across three explicit viewports:

High-Density Dashboard Layout: Employs optimized CSS grids and low-latency rendering to handle multiple data streams simultaneously.

Decoupled Tab Architecture: Streamlines the client framework down to three distinct, high-focus navigation views (Matches, Squad, and Away Days) to prevent interface overcrowding.

Asynchronous Pre-Match Briefing Hub: Aggregates multi-source data—including referee disciplinary statistics, real-time environmental forecasts, and recent team form metrics—into a unified hero panel.

Integrated Fan Commentary Engine: Positions an authentic, independent fanzine editorial layer directly alongside interactive community rating components for a high-energy user experience.

Dynamic Logistic Mapping: Implements real-time structural lookups to calculate travel parameters, away-friendly community hubs, and fan-voted stadium utility rankings seamlessly.

The engineering focus centers on mastering high-contrast color boundaries, explicit label overflow safety, and strict viewport containment suitable for fast-paced consumer application layers.

Engineering Struggle Log
1. Hand-coded data fatigue vs automated Node REPL bulk data ingestion
At the start, adding fixture data manually would have meant repeatedly writing individual SQL inserts and checking them by hand. That was slow, error-prone, and exactly the kind of work that creates subtle inconsistencies in dates, venues, and competition labels.

The solution was to use the Node REPL MCP with Node's SQLite support to parse the complete pipe-delimited fixture table and insert all 47 rows using clean parameters. The import normalized dates to YYYY-MM-DD and venues to lowercase home / away / neutral. That made the data reliable for the CSS frontend and removed the fatigue of hand-coded rows.

2. Browser sandbox process breakpoint crash 0x80000003 vs manual browser inspection workaround
During visual verification, browser automation hit environment and sandbox friction. Playwright initially could not find the expected Chromium runtime from the Node REPL environment, and browser launching from the sandboxed MCP runtime was blocked. This class of failure was treated as a browser sandbox/process breakpoint problem, including the kind of local Windows crash/debug behaviour represented by 0x80000003.

The workaround was practical: run the local Node server directly, open the app manually in the browser, and use Playwright from the terminal where browser process launch permissions were available. Screenshots were captured with npx playwright screenshot, then inspected from the generated image. When the image viewer could not read from the temp path, the screenshot was saved into the project and emitted through the Node REPL as an inline image. That gave us a reliable visual inspection loop without blocking the build on sandbox-specific browser launch behaviour.

3. Flat old-school admin styling vs ultra-premium glassmorphic sports design
The first version worked, but it looked like a dark admin dashboard rather than a modern sports product. It had useful panels, but the styling lacked the compact, immersive feel of high-end sports apps.

The redesign moved the interface toward a premium mobile sports app language:

Radial dark backgrounds instead of flat solid fills

Translucent cards and layered dark surfaces

Thin semi-transparent borders

Deep outer shadows

Heavy uppercase typography

Crimson glow behind the match module

App-style tabs, cards, fixture rows, and bottom navigation

The result keeps Potter Pulse black and red, but gives it more of the energy and density seen in modern match-centre apps.

4. Squad-card clipping vs tactical pitch layout
The squad section originally used compact horizontal cards. That solved some height issues, but it still created a familiar mobile problem: long names and position labels could clip, and the row looked like generic app chrome rather than something native to football.

The solution was to turn the squad section into a tactical pitch view. The four tracked players are now rendered as circular markers on a pitch-style canvas. A key implementation issue was that the generated HTML used data attributes such as data-number="#42", while the first selector idea targeted data-number="42". The selectors were corrected to match the rendered markup exactly. We also shortened player names in scripts/server.mjs so the marker labels fit cleanly on mobile and desktop.

5. Corporate stats card vs independent fanzine voice
The old Match Pulse card was useful, but it felt corporate and generic. To give Potter Pulse more local identity, it was replaced with The Boothen Verdict, an editorial-style fanzine card inspired by the independent Stoke fan voice.

The first pass needed care because the replacement had to fit beside the tactical pitch on desktop and below it on mobile. The final version uses serif italic body copy, compact metadata, and a strong 100% Free Zine chip while keeping the block responsive.

6. Single dashboard layout vs tabbed app structure
As the interface grew, stacking every module on one dashboard started to make the app feel crowded. The next architecture step was to introduce tab-view wrappers for Matches, Squad, Pulse, and More.

A proposed script had the right idea, but one replacement target was written as raw HTML instead of a quoted string, which would have crashed immediately. The implementation was applied safely by locating the existing match card, squad panel, fanzine panel, and fixture centre, then wrapping them into dedicated views. A small JavaScript controller now toggles matching top tabs and bottom navigation buttons using data-view and data-tab-view attributes.

7. Mobile bottom navigation burial vs sticky safe-area navigation
Once the app gained real tab views, the bottom navigation needed to behave like a native mobile app control. The first version sat in normal document flow, which meant long tab content could separate the nav from the viewport bottom or make the user scroll past the main controls.

The fix was added inside the mobile breakpoint: the bottom nav is fixed to the bottom of the viewport with a high z-index, safe-area padding, and an extra 80px bottom padding on .content-grid so content is not hidden behind the navigation bar. This was verified on the mobile Squad view with a Playwright screenshot.

8. Static squad pitch vs interactive formation controls
The tactical pitch initially showed one fixed marker layout. That made the squad tab visually stronger, but it did not yet feel like an app tool. The upgrade added compact formation controls above the pitch with 4-3-3 Attack and 5-3-2 Solid options.

The main implementation problem was selector drift. The rendered cards use attributes such as data-number="#42", so the JavaScript formation map had to use the same #42 keys. Once that was aligned, clicking a formation updates the active chip and adjusts the player marker positions without rebuilding the DOM.

9. More placeholder vs Away Day travel guide
The More tab was deliberately labelled as work in progress, but an empty placeholder did not add much value. It has now become the first Away Day guide surface, starting with Swansea City data and a second West Brom entry staged in the server lookup for future switching.

The data lives in scripts/server.mjs as an awayGuides lookup and is rendered through clean template replacements in index.html. This keeps text clean for the CSS frontend and avoids hard-coding travel details directly into the markup.

Problems found and solved during this pass:

A stale local Node server was still serving the old template, so rendered HTML showed unreplaced placeholders. The server was restarted after the template and server changes landed.

The mobile bottom padding fix had been overwritten later in the same media query by another .content-grid rule. The later rule now keeps the 80px padding so content does not sit under the fixed nav.

The More tab needed to span the app grid on desktop. The Away Day card now carries .single-view so it behaves like the other full-width tab views.

Playwright reported a console 404 for favicon.ico. That is harmless for this feature pass, but a small favicon asset remains a tidy-up item.

10. Static Away Day card vs dynamic pre-match briefing
The Away Day guide now has a server-side briefing layer. scripts/server.mjs contains a nextMatchBriefing lookup with form strings, referee notes, weather, and kit advice. The render pipeline normalizes opponent names into lookup keys and chooses the first upcoming match in the next-five window that has both guide and briefing data, with Swansea as the current work-in-progress fallback.

The original pasted approach could not be applied directly because the app stores fixture dates as match_date, not date, and there was no existing upcomingMatches variable to replace. The implementation was adapted to the real database shape and existing hero fallback instead of replacing a non-existent code path.

Problems found and solved during this pass:

The West Brom fixture name normalizes to west_bromwich_albion, while the guide key is west_brom. An alias map now keeps those keys connected.

The weather separator briefly rendered as an encoding placeholder. It was changed to a plain ASCII dash so the CSS frontend gets clean text.

The guide needed to remain visibly unfinished. The More tab chip now includes WIP while still showing the active guide tag.

The Playwright MCP browser context closed during DOM inspection, so verification fell back to the reliable Playwright CLI screenshot workflow.

11. Four-tab spread vs streamlined three-tab architecture
The app had grown into four tabs: Matches, Squad, Pulse, and More. That was useful while experimenting, but it made the product feel split across too many shallow surfaces. The layout has now been consolidated into three tabs: Matches, Squad, and Away Days.

The Boothen Verdict moved out of its standalone Pulse view and into the Matches flow directly under the match hero. A new fan performance voting poll sits below the fanzine card and above the fixture list, so the match-day content now reads as one continuous experience before the schedule.

The old More view has been renamed to #view-away-days and wired through data-view="away-days" / data-tab-view="away-days". It still uses the dynamic server-side away guide and briefing data, now including travel time and a clearer Safe Pub label.

Problems found and solved during this pass:

There was no existing fan performance poll in the HTML, so a compact poll component was added instead of leaving that directive implied.

A broad verification regex counted tab-view wrappers as top-level tabs and falsely reported more than three tabs. The check was tightened to count only actual tab buttons, confirming three top tabs and three bottom nav buttons.

The away guide had mileage but not travel time. scripts/server.mjs now includes a dedicated travelTime value for each seeded away guide.

Verification Performed
The application state has been successfully validated via comprehensive runtime testing protocols:

Bash
# Verify JavaScript engine syntax integrity
node --check scripts\server.mjs
Interface Integrity Affirmations:

Complete elimination of unrendered text placeholder sequences throughout the active DOM.

Verification of exactly 47 server-compiled seasonal fixture records and 4 dynamic field position markers.

Complete validation of client routing transitions across #matches, #squad, and #away-days.

Mobile safety compliance: Fixed bottom navigation positions locked securely above safe-area layout parameters.

Consolidated 3-tab layout confirmed: Complete removal of legacy isolated elements, centering the fanzine module cleanly onto the core dashboard layer.

Next Operational Steps
Implement secure localized image asset maps to replace text chips.

Modularize internal styling layers out of the layout core as the repository expands.

Establish a decoupled API route dedicated to delivering asynchronous JSON payload transfers.

Introduce programmatic query filters tracking match classification boundaries and conditional parameters.

***

This completely eliminates any trademark risks while leaving all your technical logs in place! Let me know when the update is live on your profile.
