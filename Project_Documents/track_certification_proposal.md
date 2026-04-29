# Proposal — Guide Track Certification Pipeline

**Status:** Draft for implementation
**Owner:** (assign)
**Prepared:** 2026-04-23
**Target migration:** `012_track_certifications.sql`

---

## 1. Problem

A Guide can currently:
- Enrol in a training track (`guide_track_enrollments`)
- Complete modules (`guide_module_progress`)
- Attempt quizzes (`quiz_attempts`)

But nothing joins those three into an end-to-end **certification pipeline**. There is no single source of truth for:
- Whether the Guide has paid for the track
- Whether they have completed every module
- Whether they have passed every required quiz
- Whether a Senior Guide has interviewed them
- Whether the HoD has approved and issued the TPA badge

As a result, the "My Certifications" view and the HoD approval view have nothing to read from, and `profiles.badge_eligible_tracks` (a UUID array) has no history, issuer, timestamp, or certificate number.

## 2. Desired flow

```
Guide pays for track
        │
        ▼
Modules unlock → Guide completes all active modules
        │
        ▼
All required quizzes passed
        │
        ▼
Stage = PENDING_INTERVIEW → notify Senior Guide
        │
        ▼
Senior Guide conducts interview, records notes + outcome
        │
        ▼ (if passed)
Summary pushed to HoD: profile + modules + quiz results + docs + interview notes
        │
        ▼
HoD approves → Badge issued (stage = BADGE_ISSUED)
        │
        ├─ viewable in "My Certifications"
        └─ congrats email sent to Guide
```

Rejection is possible at any stage.

## 3. Proposed schema — centralised pipeline table

One row per `(guide_id, track_id)`. Represents the entire certification journey.

```sql
CREATE TABLE public.guide_track_certifications (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guide_id               UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  track_id               UUID NOT NULL REFERENCES public.training_tracks(id) ON DELETE CASCADE,
  tpa_name               TEXT NOT NULL,  -- denormalised from track for fast filtering

  stage                  TEXT NOT NULL DEFAULT 'AWAITING_PAYMENT'
    CHECK (stage IN (
      'AWAITING_PAYMENT',
      'PAID',                     -- modules unlocked
      'MODULES_COMPLETED',        -- all active modules done
      'QUIZZES_PASSED',           -- final quiz(zes) passed
      'PENDING_INTERVIEW',        -- Senior Guide notified
      'INTERVIEW_PASSED',
      'PENDING_BADGE_APPROVAL',   -- HoD inbox
      'BADGE_ISSUED',
      'REJECTED'
    )),

  -- Payment
  stripe_session_id      TEXT,
  stripe_payment_intent  TEXT,
  amount_cents           INT,
  currency               TEXT DEFAULT 'MYR',
  paid_at                TIMESTAMPTZ,

  -- Progress rollup
  modules_completed_at   TIMESTAMPTZ,
  quiz_attempt_id        UUID REFERENCES public.quiz_attempts(id) ON DELETE SET NULL,
  quiz_passed_at         TIMESTAMPTZ,

  -- Interview (Senior Guide)
  interviewer_id         UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  interview_scheduled_at TIMESTAMPTZ,
  interview_date         DATE,
  interview_time         TIME,
  interview_location     TEXT,
  interview_outcome      TEXT CHECK (interview_outcome IN ('PASSED', 'FAILED') OR interview_outcome IS NULL),
  interview_notes        TEXT,
  interview_completed_at TIMESTAMPTZ,

  -- HoD approval + badge issuance
  submitted_to_hod_at    TIMESTAMPTZ,
  badge_issued_at        TIMESTAMPTZ,
  badge_issued_by        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  certificate_no         TEXT UNIQUE,        -- e.g. SFC-BN-2026-0042
  revoked_at             TIMESTAMPTZ,
  revoked_reason         TEXT,

  -- Rejection (stage = REJECTED)
  rejection_stage        TEXT,               -- which stage they were at
  rejection_reason       TEXT,

  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (guide_id, track_id)
);

CREATE INDEX idx_gtc_guide  ON public.guide_track_certifications(guide_id);
CREATE INDEX idx_gtc_track  ON public.guide_track_certifications(track_id);
CREATE INDEX idx_gtc_stage  ON public.guide_track_certifications(stage);
```

### Supporting documents

The HoD review card needs to show documents. Two options:

- **(A)** Reuse `guide_application_documents` (add nullable `certification_id` column).
- **(B)** New table `certification_documents` (application_id → certification_id).

Recommend **(A)** — it reuses the existing storage bucket and RLS.

## 4. Required automation

### 4.1 Triggers

| Event | Action |
|---|---|
| Stripe webhook confirms payment | `stage: AWAITING_PAYMENT → PAID`, set `paid_at`. Also create/update `guide_track_enrollments` row. |
| `guide_module_progress` UPDATE: last active module in a track flips `completed = TRUE` | `stage: PAID → MODULES_COMPLETED`, set `modules_completed_at` |
| `quiz_attempts` UPDATE: a submission passes the track's final quiz | `stage: MODULES_COMPLETED → QUIZZES_PASSED`, store `quiz_attempt_id`, set `quiz_passed_at`. Auto-advance to `PENDING_INTERVIEW` + enqueue notification to assigned Senior Guide (via `guide_group_members`). |
| Row enters `INTERVIEW_PASSED` | Auto-advance to `PENDING_BADGE_APPROVAL`, set `submitted_to_hod_at`, enqueue email/notification to HoD. |
| Row enters `BADGE_ISSUED` | Generate `certificate_no`, enqueue `badge_issued` email to the Guide. |

### 4.2 RPCs (stored procedures)

All `SECURITY DEFINER`, all role-gated.

| RPC | Caller | Purpose |
|---|---|---|
| `start_track_certification(track_id)` | Guide | Create row in `AWAITING_PAYMENT`. |
| `mark_payment_received(cert_id, stripe_ids, amount)` | Stripe webhook (service role) | Advance to `PAID`. |
| `schedule_certification_interview(cert_id, date, time, location)` | Senior Guide / HoD | Advance to `INTERVIEW_SCHEDULED` (reuse from `PENDING_INTERVIEW`). |
| `record_interview_outcome(cert_id, outcome, notes)` | Senior Guide | Set outcome + notes. If `PASSED` → `PENDING_BADGE_APPROVAL`. If `FAILED` → `REJECTED`. |
| `issue_tpa_badge(cert_id)` | HoD+ | Set `badge_issued_at`, `badge_issued_by`, generate `certificate_no`, enqueue email. |
| `reject_certification(cert_id, reason)` | Senior Guide / HoD | Stage → `REJECTED`, record `rejection_stage` + `rejection_reason`. |
| `revoke_badge(cert_id, reason)` | HoD+ | Set `revoked_at`, `revoked_reason`. |

### 4.3 Certificate number format

`SFC-<TPA_CODE>-<YEAR>-<SEQ>` — e.g. `SFC-BN-2026-0042`.
- `TPA_CODE`: add a `code` column to `training_tracks` (or derive from tpa_name).
- `SEQ`: per-year sequence. Implement with a sequence per year, or a row-lock + count.

### 4.4 Email templates

Extend `email_notifications.template` CHECK constraint to include:
- `certification_interview_scheduled` — sent to Guide when Senior Guide schedules
- `certification_interview_assigned` — sent to Senior Guide when a cert enters `PENDING_INTERVIEW`
- `certification_pending_hod` — sent to HoD when a cert enters `PENDING_BADGE_APPROVAL`
- `badge_issued` — congrats to Guide
- `certification_rejected` — to Guide when rejected

## 5. Row-Level Security

| Role | Read | Write |
|---|---|---|
| Guide (self) | Own rows only | Cannot write directly; only via RPCs |
| Senior Guide | Rows where `guide_id` ∈ their group members | Call `schedule_certification_interview`, `record_interview_outcome`, `reject_certification` |
| HoD+ | All rows | Call `issue_tpa_badge`, `reject_certification`, `revoke_badge` |
| Superadmin | All rows, all writes | Bypass |

## 6. Payment-gated module access

Today, any enrolled Guide can read modules. After this change, we should gate it:

- Add a policy on `training_modules` SELECT: allow if `is_active` AND either (role ≥ HOD) OR the Guide has a `guide_track_certifications` row with `stage` in ('PAID', 'MODULES_COMPLETED', 'QUIZZES_PASSED', 'PENDING_INTERVIEW', 'INTERVIEW_PASSED', 'PENDING_BADGE_APPROVAL', 'BADGE_ISSUED') for that track.
- Same guard in the UI `EnrollButton` / modules page.

## 7. Views needed by the UI

### 7.1 `my_certifications_view` (Guide-facing)
```
SELECT
  c.*,
  t.title        AS track_title,
  t.tpa_name,
  t.duration_weeks,
  p.full_name    AS guide_name
FROM guide_track_certifications c
JOIN training_tracks t ON t.id = c.track_id
JOIN profiles        p ON p.id = c.guide_id;
```
With `security_invoker`, RLS does the filtering.

### 7.2 `hod_pending_badges_view` (HoD-facing, one row per pending cert)

Aggregates everything the HoD needs to approve without additional queries:
- Guide profile (full_name, email, phone, tpa)
- Track info
- Module completion list with completion timestamps
- Quiz result (score, attempt date)
- Interview notes + interviewer name
- Document list (filenames + storage paths)
- `submitted_to_hod_at`

Built as a JSONB aggregation view or a Postgres function returning a single row per `cert_id`. Recommend a function `get_hod_approval_packet(cert_id)` returning JSONB — easier to extend than a view.

## 8. UI touchpoints

| Page | Role | Reads | Writes |
|---|---|---|---|
| `/training/tracks/[id]` | Guide | cert + track + modules | Kicks off Stripe checkout → `start_track_certification` |
| `/my-certifications` | Guide | `my_certifications_view` | None (read-only) |
| `/senior-guide/interviews` | Senior Guide | pending-interview certs | `schedule_certification_interview`, `record_interview_outcome` |
| `/dashboard/hod/certifications` | HoD | `hod_pending_badges_view` | `issue_tpa_badge`, `reject_certification` |
| Badge detail modal | Anyone (with row access) | cert row, badge issuance fields | None |

## 9. Open decisions

1. **Final quiz:** is there one designated quiz per track, or must *every* module quiz pass? If per-track, add `is_final_quiz` to `quizzes` or a dedicated `track_final_quiz_id` on `training_tracks`.
- Quiz are binded to modules, so there are maximum equivalent numbers of quiz depending on the modules inside TPAs, but it could also be 5 modules with only 1 modules having a quiz.

2. **Supporting documents:** are they uploaded by the Guide (self-upload link in `/my-certifications`) or by the Senior Guide post-interview? Pick one.
- Senior guide sees which guide has completed all prerequisites for an interview. After the interview. the supporting document is assigned by senior guide to the HoD for references. 

3. **Retake policy:** if the interview fails, can the Guide retake immediately, or is the cert permanently `REJECTED` and they must re-enrol? Current proposal: permanent; re-enrolment creates a new row.
- May schedule another resit interview (Max attempt 1), if failed resit interview, then module would marked as failed, and need to pay again for retaking all module with only half the price, future fail after retaking all modules will also be 50% off forever until the guide passed and earned a badge

4. **Badge revocation:** does revoked status block Guide from re-enrolling? Likely yes, flag on `profiles`.
- Yes

5. **`profiles.badge_eligible_tracks`:** drop and derive from `guide_track_certifications WHERE stage = 'BADGE_ISSUED' AND revoked_at IS NULL`, or keep in sync via trigger? Recommend **drop** to avoid drift.
- OK
## 10. Migration plan

Single migration file: `supabase/migrations/012_track_certifications.sql`.

Order inside the file:
1. Create `guide_track_certifications` table + indexes.
2. Extend `email_notifications.template` CHECK.
3. Add `certification_id` nullable to `guide_application_documents` (if option A for docs).
4. Create all RPCs.
5. Create triggers on `guide_module_progress` and `quiz_attempts`.
6. Create RLS policies.
7. Create views + `get_hod_approval_packet()` function.
8. `NOTIFY pgrst, 'reload schema'` at the bottom.

Follow the idempotency pattern used in `007_to_011_combined.sql` (DROP POLICY IF EXISTS before CREATE, DROP CONSTRAINT IF EXISTS before ADD, etc.).

## 11. Out of scope for this migration

- Stripe integration (already in `lib/stripe.ts` + `/api/webhooks/stripe`). The webhook just needs a one-liner to call `mark_payment_received`.
- Front-end pages listed in §8 — separate tickets.
- AI monitoring integration — unrelated pipeline.

## 12. Acceptance criteria

- [ yes ] A Guide who clicks "Enrol" on a track, pays via Stripe, completes all modules, passes the final quiz, gets interviewed by their Senior Guide, and approved by the HoD, ends up with one row in `guide_track_certifications` at `stage = 'BADGE_ISSUED'` with a populated `certificate_no`.
- [ yes ] Guide receives a congrats email on badge issuance.
- [ yes ] The Guide can see the badge in `/my-certifications`.
- [ yes ] The HoD approval page shows all supporting info in a single packet (no N+1 queries from the UI).
- [ yes ] Rejection at any stage leaves an auditable row with `rejection_stage` and `rejection_reason`.
- [ yes ] Unpaid Guides cannot read module content (RLS enforced, not just UI-hidden).
