# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**DigitalParkGuide** — A web platform for Sarawak Forestry Commission (SFC) to manage guide/ranger training certifications and AI-powered activity monitoring. Built as a Swinburne COS30049 pre-FYP assignment.

The app directory lives at `COS30049_preFYP/digitalparkguide/`. All commands below should be run from that directory.

## Commands

```bash
pnpm dev       # Start development server at localhost:3000
pnpm build     # Production build
pnpm start     # Serve production build
pnpm lint      # Run ESLint
```

There are no tests configured yet.

## Architecture

**Stack:** Next.js (App Router) + React 19 + TypeScript (strict) + Tailwind CSS v4. No external UI library — all components use Tailwind utility classes directly.

**Planned backend integrations** (credentials in `.env`, not yet wired up):
- **Supabase** — PostgreSQL database + file storage
- **Gmail** — Email notifications
- **Twilio** — SMS/WhatsApp alerts
- **AI model** — On-device webcam-based abnormal activity detection

**Current pages** (all under `digitalparkguide/app/`):
- `/` (`page.tsx`) — Marketing landing page showcasing features
- `/login` — Client component with simulated form submission (no real auth)
- `/dashboard` — Mentor dashboard with hardcoded demo data; dual responsive layouts (sidebar for desktop, bottom nav for mobile) using `hidden lg:flex` / `lg:hidden` breakpoint patterns

**Responsive pattern:** Mobile-first. Desktop enhancements use `lg:` prefix. The dashboard has entirely separate layout trees for mobile vs desktop — not just reordered columns.

**Design tokens** (Sarawak Forestry branding, defined in `globals.css`):
- Dark green: `#1B3A24`, medium green: `#2D6A3F`
- Amber: `#F0A500`, lime: `#8DC63F`

**Path alias:** `@/*` resolves to the project root (`digitalparkguide/`).

## Key Documents

`COS30049_preFYP/Project_Documents/` contains the requirements specification:
- `TrainingNCertification.txt` — Full system spec: role hierarchy (SFC Management → HoD → Senior Guides → Guides/Rangers), park-specific badges (non-transferable between parks), certification tracks, AI alert system behaviour
- `notes.md` — Stakeholder Q&A clarifying zone-specific training, payment structure, evaluation workflow, and AI monitoring scope
