### PUBLIC PROFILE PAGE
Build a full-stack Guide Profile page for a Next.js 14 App Router project using Supabase and Tailwind CSS.

## Context
This is a Sarawak Forestry Corporation biodiversity guide management system. The profile page is used by authenticated users with role GUIDE, SENIOR_GUIDE, or HOD. The UI language/style should match the existing app: white cards, rounded-2xl, border border-gray-200, shadow-sm, primary color is #025b3a (dark forest green), bg-[#f5f5f0] page background, Material Symbols Outlined icons.

## Route
`/profile` — authenticated, accessible by GUIDE, SENIOR_GUIDE, HOD roles.

---

## Page Layout

Split into two columns on desktop (lg:grid-cols-[280px_1fr]), single column on mobile.

### Left Column — Identity Card
- Avatar with upload button (overlaid camera icon); uploads to Supabase Storage bucket `avatars`, saves public URL to profiles.avatar_url
- Display: preferred_name (large), full_name (muted, smaller), role badge (pill, color-coded: GUIDE=green, SENIOR_GUIDE=blue, HOD=purple)
- Certification status badge: ACTIVE=green, EXPIRED=red, SUSPENDED=amber, PENDING_RENEWAL=yellow
- Availability toggle (is_available) — large prominent toggle with label "Available for Tours" / "Unavailable"; optimistic UI update
- Quick stats row (read-only, from Ratings & Activity section):
  - average_rating (⭐ X.X)
  - total_tours_completed
  - tours_this_month
  - no_show_count

### Right Column — Tabbed Sections
Four tabs: "Personal", "Certification", "Background", "Availability"

---

## Tab: Personal

Fields (all editable unless noted):
- full_name (text input, required)
- preferred_name (text input)
- email (read-only, from auth.users, grayed out)
- phone (country code selector + numeric-only input, default country +60 MY)
  - Country code options: +60 MY, +65 SG, +62 ID, +63 PH, +66 TH, +84 VN, +44 GB, +1 US
  - On save, store as concatenated string e.g. "+60112345678"
- ic_number — masked input: show only last 4 digits (e.g. ••••••••1234); full value editable on focus; label says "MyKad / Passport No." — treat as sensitive, do not log
- date_of_birth (date picker)
- gender (select: Male | Female | Prefer not to say)
- nationality (text input, default "Malaysian")

---

## Tab: Certification

All fields in this tab are READ-ONLY for the guide. Only HOD/SUPERADMIN can edit. Show a subtle info banner: "Certification details are managed by your HoD."

Fields (display only):
- role (pill badge)
- certification_level (e.g. "Naturalist Level 2")
- certified_tpas — rendered as a list of green pills (park names)
- certification_number
- certification_issued_at (formatted date)
- certification_expires_at — if within 60 days, show amber warning "Expires soon"; if past, show red "Expired"
- certification_status badge

Data comes from:
- profiles table: role, certification_level, certification_number, certification_issued_at, certification_expires_at, certification_status
- guide_certifications table (join): certified_tpas as array of tpa_name strings

---

## Tab: Background

Fields (all editable):
- bio — textarea, 150–400 chars, char counter shown, placeholder: "Write a short introduction about yourself as a guide..."
  - Allowlist validation: only permit [a-zA-Z0-9\s,./()'\-] — strip everything else silently, show inline warning if stripping occurred
- years_experience — number input, min 0, max 60
- specializations — multi-select chip UI (not a native select):
  Options: Birdwatching, Herpetology, Night Safari, River Ecology, Cave Systems, Photography Tours, Mammals, Marine & Coastal, Forest Trekking, Cultural Heritage
  - Clicking a chip toggles selection; selected = filled green, unselected = outline gray
  - Saved as TEXT[] in Supabase
- languages_spoken — same chip toggle UI:
  Options: English, Bahasa Malaysia, Mandarin, Iban, Bidayuh, Melanau, Kenyah, Kayan, Other
  - Saved as TEXT[]
- prior_employers — textarea, free text, max 500 chars, placeholder: "e.g. Sarawak Forestry Corporation (2018–2022), independent tour operator..."
- education — two fields side by side:
  - qualification (text): e.g. "Bachelor of Science"
  - field_of_study (text): e.g. "Ecology & Conservation"

---

## Tab: Availability

Fields (all self-editable by guide):
- is_available — toggle (same as left column, synced)
- availability_notes — textarea, max 300 chars, placeholder: "e.g. Unavailable on Fridays. Based in Miri. Prefer morning tours."
- home_district — select dropdown:
  Options: Kuching, Samarahan, Serian, Sri Aman, Betong, Sarikei, Sibu, Mukah, Bintulu, Miri, Limbang, Kapit, Song, Belaga
- can_drive — toggle, label: "Can drive to remote TPAs"
- vehicle_type — radio group (only shown if can_drive = true): 4WD | Boat | Motorcycle | None

---

## Supabase Schema

Assume these columns exist on the `profiles` table (or need to be added via migration):
```sql
preferred_name        TEXT
avatar_url            TEXT
ic_number             TEXT  -- store as-is; masking is UI-only
date_of_birth         DATE
gender                TEXT
nationality           TEXT  DEFAULT 'Malaysian'
bio                   TEXT
years_experience      INTEGER DEFAULT 0
specializations       TEXT[] DEFAULT '{}'
languages_spoken      TEXT[] DEFAULT '{}'
prior_employers       TEXT
education_qualification TEXT
education_field       TEXT
is_available          BOOLEAN DEFAULT TRUE
availability_notes    TEXT
home_district         TEXT
can_drive             BOOLEAN DEFAULT FALSE
vehicle_type          TEXT
certification_level   TEXT
certification_number  TEXT
certification_issued_at DATE
certification_expires_at DATE
certification_status  TEXT  DEFAULT 'ACTIVE'
average_rating        NUMERIC(3,2) DEFAULT 0
total_tours_completed INTEGER DEFAULT 0
tours_this_month      INTEGER DEFAULT 0
last_active_at        TIMESTAMPTZ
no_show_count         INTEGER DEFAULT 0
```

guide_certifications table (read from, do not write):
```sql
id           UUID
guide_id     UUID  -- FK → profiles.id
tpa_name     TEXT
level        TEXT
status       TEXT
issued_at    DATE
expires_at   DATE
```

---

## Save Behavior

- Personal, Background, and Availability tabs each have their own "Save Changes" button at the bottom
- On save: validate → upsert to `profiles` where id = user.id → show success toast
- Optimistic UI on availability toggle: update local state immediately, then sync to Supabase in background; revert on error
- Avatar upload: on file select → validate (max 2MB, jpg/png/webp only) → upload to `avatars/{user.id}` in Supabase Storage → get public URL → update profiles.avatar_url → refresh avatar in UI

---

## Auth Guard

Use createClient() from @/lib/supabase/client. On mount:
1. Get session via supabase.auth.getUser()
2. If no user → redirect to /login?next=/profile
3. If role not in [GUIDE, SENIOR_GUIDE, HOD] → redirect to /dashboard

---

## Components to use/create

- Use existing: TopNavClient, PageLoader, useToast from @/components/ui/Toast
- Create: AvatarUpload, ChipSelector, MaskedInput (for ic_number), CertBadge, StatCard
- All icons: Material Symbols Outlined (already loaded globally)
- No external UI libraries — Tailwind only

---

## Do NOT

- Do not allow guides to edit: role, certification_level, certified_tpas, certification_number, certification_issued_at, certification_expires_at, certification_status, average_rating, total_tours_completed, tours_this_month, last_active_at, no_show_count
- Do not store ic_number in localStorage or log it to console
- Do not use react-hook-form or zod — use controlled inputs with useState












### Quiz system update
After completing all modules and quiz in a TPA, a guide would show 