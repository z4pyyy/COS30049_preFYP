# Certification Pipeline, Auto-Nomination & In-App Notifications

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement Senior Guide auto-promotion, the full certification interview flow UI, HoD badge issuance UI, and an in-app notification system with bell icon + unread count.

**Architecture:** Three features share a single new migration (020). Feature 1 adds a DB trigger on `guide_badges` to auto-promote after 2 renewals, plus a manual nomination RPC. Feature 2 builds two new pages (`/senior-guide/interviews` and `/dashboard/hod/certifications`) that call existing RPCs. Feature 3 adds a `notifications` table with DB triggers that fire on stage transitions, plus a bell icon component in TopNavView and a `/notifications` page. All notification triggers live in the DB so they fire regardless of which API route or RPC caused the stage change.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS v4, Supabase (PostgreSQL + Auth + RLS), nodemailer (lib/email.ts)

---

## File Structure

### Migration
- **Create:** `supabase/migrations/020_notifications_and_promotions.sql`
  - `notifications` table + RLS
  - `fn_notify_on_cert_stage_change()` trigger on `guide_track_certifications`
  - `fn_notify_on_new_application()` trigger on `guide_applications`
  - `fn_auto_promote_senior_guide()` trigger on `guide_badges`
  - `nominate_senior_guide(p_guide_id)` RPC (HoD only)
  - `mark_notifications_read(p_ids)` RPC

### Email Templates
- **Modify:** `lib/email.ts`
  - Add `sendCertInterviewAssignedEmail()` (to Senior Guide)
  - Add `sendCertInterviewScheduledEmail()` (to Guide — reuse existing template shape)
  - Add `sendBadgeIssuedEmail()` (to Guide)

### Feature 1 — Senior Guide Auto-Nomination
- **Modify:** `app/dashboard/hod/groups/page.tsx` — add "Nominate to Senior Guide" button per guide row

### Feature 2 — Certification Interview + Badge Issuance
- **Create:** `app/senior-guide/interviews/page.tsx` — Senior Guide interview management
- **Create:** `app/senior-guide/layout.tsx` — layout with TopNavClient
- **Create:** `app/api/certifications/[id]/schedule/route.ts` — wraps `schedule_certification_interview` RPC + sends email
- **Create:** `app/api/certifications/[id]/outcome/route.ts` — wraps `record_interview_outcome` RPC + sends email
- **Create:** `app/api/certifications/[id]/issue/route.ts` — wraps `issue_tpa_badge` RPC + sends email
- **Create:** `app/api/certifications/[id]/packet/route.ts` — wraps `get_hod_approval_packet` RPC
- **Create:** `app/dashboard/hod/certifications/page.tsx` — HoD badge issuance page

### Feature 3 — In-App Notifications
- **Create:** `components/NotificationBell.tsx` — bell icon with unread count, used in TopNavView
- **Create:** `app/notifications/page.tsx` — full notifications list page
- **Create:** `app/api/notifications/route.ts` — GET (list) + PATCH (mark read)
- **Modify:** `components/TopNavView.tsx` — add NotificationBell next to Dashboard link

### Sidebar Navigation
- **Modify:** `components/GuardianPortalSidebar.tsx` — add HoD "Certifications" link, Senior "Interviews" link
- **Modify:** `types/roles.ts` — add `/senior-guide` route protection

---

## Task 1: Database Migration — Notifications Table + Triggers

**Files:**
- Create: `supabase/migrations/020_notifications_and_promotions.sql`

- [ ] **Step 1: Create the notifications table, RLS, and indexes**

```sql
-- ================================================================
-- 020_notifications_and_promotions.sql
-- In-app notifications, auto-promotion, HoD manual nomination
-- ================================================================

-- ── SECTION 1: Notifications table ──────────────────────────────

CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT        NOT NULL,
  body        TEXT        NOT NULL DEFAULT '',
  link        TEXT,                -- optional deep-link path e.g. /senior-guide/interviews
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user    ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_unread  ON public.notifications(user_id) WHERE read_at IS NULL;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notif: own read"  ON public.notifications;
DROP POLICY IF EXISTS "notif: own update" ON public.notifications;

CREATE POLICY "notif: own read"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "notif: own update"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id);

-- Service-role inserts bypass RLS; triggers use SECURITY DEFINER.
```

- [ ] **Step 2: Create mark_notifications_read RPC**

```sql
-- ── SECTION 2: Mark-read RPC ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.mark_notifications_read(p_ids UUID[])
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE public.notifications
  SET read_at = NOW()
  WHERE id = ANY(p_ids)
    AND user_id = auth.uid()
    AND read_at IS NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_notifications_read(UUID[]) TO authenticated;
```

- [ ] **Step 3: Create certification stage-change notification trigger**

This trigger fires on UPDATE of `guide_track_certifications.stage` and inserts notifications for the relevant users.

```sql
-- ── SECTION 3: Cert stage-change notification trigger ───────────

CREATE OR REPLACE FUNCTION public.fn_notify_on_cert_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_guide_name  TEXT;
  v_track_title TEXT;
  v_senior_id   UUID;
BEGIN
  -- Only fire when stage actually changes
  IF OLD.stage = NEW.stage THEN RETURN NEW; END IF;

  SELECT full_name INTO v_guide_name FROM public.profiles WHERE id = NEW.guide_id;
  SELECT title INTO v_track_title FROM public.training_tracks WHERE id = NEW.track_id;
  v_guide_name  := COALESCE(v_guide_name, 'A guide');
  v_track_title := COALESCE(v_track_title, 'a track');

  -- PENDING_INTERVIEW: notify the assigned Senior Guide
  IF NEW.stage = 'PENDING_INTERVIEW' AND OLD.stage IN ('QUIZZES_PASSED', 'MODULES_COMPLETED') THEN
    -- Find the Senior Guide responsible for this guide
    SELECT senior_guide_id INTO v_senior_id
    FROM public.guide_group_members
    WHERE guide_id = NEW.guide_id
    LIMIT 1;

    IF v_senior_id IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, title, body, link)
      VALUES (
        v_senior_id,
        'Interview Ready',
        v_guide_name || ' has completed all requirements for ' || v_track_title || ' and is ready for their certification interview.',
        '/senior-guide/interviews'
      );
    END IF;
  END IF;

  -- PENDING_BADGE_APPROVAL: notify all HoDs
  IF NEW.stage = 'PENDING_BADGE_APPROVAL' THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    SELECT p.id,
           'Badge Approval Required',
           v_guide_name || ' has passed their interview for ' || v_track_title || '. Review and issue badge.',
           '/dashboard/hod/certifications'
    FROM public.profiles p
    WHERE public.role_rank(p.role) >= public.role_rank('HOD');
  END IF;

  -- Interview scheduled: notify the Guide
  IF NEW.stage = 'PENDING_INTERVIEW' AND NEW.interview_date IS NOT NULL AND (OLD.interview_date IS NULL OR OLD.interview_date <> NEW.interview_date) THEN
    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (
      NEW.guide_id,
      'Interview Scheduled',
      'Your certification interview for ' || v_track_title || ' has been scheduled for ' || NEW.interview_date::TEXT || '.',
      '/training/modules'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_cert_stage_notify ON public.guide_track_certifications;
CREATE TRIGGER trg_cert_stage_notify
  AFTER UPDATE ON public.guide_track_certifications
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_on_cert_stage_change();
```

- [ ] **Step 4: Create new-application notification trigger (for HoD)**

```sql
-- ── SECTION 4: New application notification ─────────────────────

CREATE OR REPLACE FUNCTION public.fn_notify_on_new_application()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_applicant_name TEXT;
BEGIN
  SELECT full_name INTO v_applicant_name FROM public.profiles WHERE id = NEW.applicant_id;
  v_applicant_name := COALESCE(v_applicant_name, 'A new applicant');

  INSERT INTO public.notifications (user_id, title, body, link)
  SELECT p.id,
         'New Guide Application',
         v_applicant_name || ' has submitted a guide application for review.',
         '/dashboard?action=applications'
  FROM public.profiles p
  WHERE public.role_rank(p.role) >= public.role_rank('HOD');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_new_application_notify ON public.guide_applications;
CREATE TRIGGER trg_new_application_notify
  AFTER INSERT ON public.guide_applications
  FOR EACH ROW EXECUTE FUNCTION public.fn_notify_on_new_application();
```

- [ ] **Step 5: Create auto-promote Senior Guide trigger**

Fires when `guide_badges` row is updated to `status = 'RENEWED'`. Counts total renewals — if >= 2, promotes to SENIOR_GUIDE.

```sql
-- ── SECTION 5: Auto-promote to Senior Guide after 2 renewals ────

CREATE OR REPLACE FUNCTION public.fn_auto_promote_senior_guide()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_renewal_count INTEGER;
  v_current_role  app_role;
BEGIN
  -- Only act on RENEWED status
  IF NEW.status <> 'RENEWED' THEN RETURN NEW; END IF;

  -- Count how many distinct tracks this guide has renewed badges for
  SELECT COUNT(*) INTO v_renewal_count
  FROM public.guide_badges
  WHERE guide_id = NEW.guide_id
    AND status IN ('RENEWED', 'ACTIVE');

  IF v_renewal_count < 2 THEN RETURN NEW; END IF;

  -- Check current role — only promote if currently GUIDE
  SELECT role INTO v_current_role
  FROM public.profiles WHERE id = NEW.guide_id;

  IF v_current_role = 'GUIDE' THEN
    UPDATE public.profiles
    SET role = 'SENIOR_GUIDE'
    WHERE id = NEW.guide_id;

    INSERT INTO public.notifications (user_id, title, body, link)
    VALUES (
      NEW.guide_id,
      'Promoted to Senior Guide',
      'Congratulations! You have been promoted to Senior Guide after renewing your TPA badge for the 2nd time.',
      '/dashboard'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_promote_senior ON public.guide_badges;
CREATE TRIGGER trg_auto_promote_senior
  AFTER INSERT OR UPDATE OF status ON public.guide_badges
  FOR EACH ROW EXECUTE FUNCTION public.fn_auto_promote_senior_guide();
```

- [ ] **Step 6: Create HoD manual nomination RPC**

```sql
-- ── SECTION 6: HoD manual nomination to Senior Guide ────────────

CREATE OR REPLACE FUNCTION public.nominate_senior_guide(p_guide_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role      app_role;
  v_target    app_role;
  v_name      TEXT;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  IF public.role_rank(v_role) < public.role_rank('HOD') THEN
    RAISE EXCEPTION 'Only HOD+ may nominate Senior Guides';
  END IF;

  SELECT role INTO v_target FROM public.profiles WHERE id = p_guide_id;
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'User not found';
  END IF;
  IF v_target <> 'GUIDE' THEN
    RAISE EXCEPTION 'User is already % — can only nominate GUIDE role', v_target;
  END IF;

  UPDATE public.profiles SET role = 'SENIOR_GUIDE' WHERE id = p_guide_id;

  SELECT full_name INTO v_name FROM public.profiles WHERE id = p_guide_id;

  INSERT INTO public.notifications (user_id, title, body, link)
  VALUES (
    p_guide_id,
    'Promoted to Senior Guide',
    'You have been nominated as a Senior Guide by the Head of Department.',
    '/dashboard'
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.nominate_senior_guide(UUID) TO authenticated;
```

- [ ] **Step 7: Add NOTIFY and finalize migration**

```sql
-- ================================================================
-- END
-- ================================================================

NOTIFY pgrst, 'reload schema';
```

- [ ] **Step 8: Apply migration**

Run via Supabase MCP tool `apply_migration` or:
```bash
# If using supabase CLI locally:
supabase db push
```

- [ ] **Step 9: Commit**

```bash
git add supabase/migrations/020_notifications_and_promotions.sql
git commit -m "feat(db): add notifications table, auto-promotion trigger, nomination RPC"
```

---

## Task 2: Notifications API Route

**Files:**
- Create: `app/api/notifications/route.ts`

- [ ] **Step 1: Create GET + PATCH handlers**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data, error } = await supabase
    .from('notifications')
    .select('id, title, body, link, read_at, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const unread_count = (data ?? []).filter(n => !n.read_at).length

  return NextResponse.json({ notifications: data ?? [], unread_count })
}

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { ids } = await req.json()
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: 'ids array required' }, { status: 400 })
  }

  const { data: count, error } = await supabase.rpc('mark_notifications_read', { p_ids: ids })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ marked: count })
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/notifications/route.ts
git commit -m "feat(api): notifications GET + PATCH endpoint"
```

---

## Task 3: NotificationBell Component + TopNavView Integration

**Files:**
- Create: `components/NotificationBell.tsx`
- Modify: `components/TopNavView.tsx`

- [ ] **Step 1: Create NotificationBell client component**

```typescript
'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function NotificationBell() {
  const [count, setCount] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function fetchCount() {
      try {
        const res = await fetch('/api/notifications', { cache: 'no-store' })
        if (!res.ok) return
        const body = await res.json()
        if (!cancelled) setCount(body.unread_count ?? 0)
      } catch {
        // silent
      }
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => { cancelled = true; clearInterval(interval) }
  }, [])

  return (
    <Link
      href="/notifications"
      className="relative flex items-center justify-center w-9 h-9 rounded-md hover:bg-gray-100 transition-colors"
      title="Notifications"
    >
      <span className="material-symbols-outlined text-xl text-gray-600">notifications</span>
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold px-1">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </Link>
  )
}
```

- [ ] **Step 2: Add NotificationBell to TopNavView**

In `components/TopNavView.tsx`, add the import at the top:

```typescript
import NotificationBell from "@/components/NotificationBell";
```

Then in the auth CTA section (around line 93-112), add the bell between the Dashboard link and ProfileDropdown. Find this block:

```tsx
                <>
                  {isPublic ? (
                    <Link
                      href="/apply-guide"
                      ...
                    >
                      ...
                    </Link>
                  ) : (
                    <Link
                      href={dashboardHref(role)}
                      ...
                    >
                      ...
                    </Link>
                  )}
                  <ProfileDropdown name={name ?? ""} email={email ?? ""} />
                </>
```

Replace the non-public branch to insert NotificationBell before ProfileDropdown:

```tsx
                  ) : (
                    <>
                      <Link
                        href={dashboardHref(role)}
                        className="flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-[#024a2f] transition-colors"
                      >
                        <span className="material-symbols-outlined text-base leading-none">dashboard</span>
                        Dashboard
                      </Link>
                      <NotificationBell />
                    </>
                  )}
```

- [ ] **Step 3: Commit**

```bash
git add components/NotificationBell.tsx components/TopNavView.tsx
git commit -m "feat(ui): notification bell with unread count in top nav"
```

---

## Task 4: Notifications Page

**Files:**
- Create: `app/notifications/page.tsx`

- [ ] **Step 1: Create the notifications list page**

```typescript
'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import TopNavClient from '@/components/TopNavClient'

interface Notification {
  id: string
  title: string
  body: string
  link: string | null
  read_at: string | null
  created_at: string
}

export default function NotificationsPage() {
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<Notification[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/notifications', { cache: 'no-store' })
    if (res.ok) {
      const body = await res.json()
      setRows(body.notifications ?? [])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const markRead = async (ids: string[]) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ids }),
    })
    setRows(prev => prev.map(n => ids.includes(n.id) ? { ...n, read_at: new Date().toISOString() } : n))
  }

  const markAllRead = () => {
    const unread = rows.filter(n => !n.read_at).map(n => n.id)
    if (unread.length > 0) markRead(unread)
  }

  const unreadCount = rows.filter(n => !n.read_at).length
  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1) return 'Just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  return (
    <div className="min-h-screen bg-[#f8fafc]">
      <TopNavClient />
      <div className="max-w-3xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-black text-[#1B3A24]">Notifications</h1>
            <p className="text-sm text-gray-500">{unreadCount} unread</p>
          </div>
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="text-sm font-semibold text-emerald-600 hover:text-emerald-700 hover:underline"
            >
              Mark all as read
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <span className="material-symbols-outlined animate-spin text-[#2D6A3F] text-4xl">progress_activity</span>
          </div>
        ) : rows.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <span className="material-symbols-outlined text-5xl text-gray-300 mb-3 block">notifications_off</span>
            <p className="text-lg font-bold text-gray-700">No notifications yet</p>
            <p className="text-sm text-gray-500">You'll see updates here when something needs your attention.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {rows.map(n => (
              <div
                key={n.id}
                className={`bg-white rounded-xl border p-4 transition-all ${
                  n.read_at ? 'border-gray-100 opacity-70' : 'border-emerald-200 bg-emerald-50/30'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      {!n.read_at && (
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      )}
                      <h3 className="text-sm font-bold text-gray-900">{n.title}</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{n.body}</p>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-gray-400">{timeAgo(n.created_at)}</span>
                      {n.link && (
                        <Link href={n.link} className="text-xs font-semibold text-emerald-600 hover:underline">
                          View details
                        </Link>
                      )}
                    </div>
                  </div>
                  {!n.read_at && (
                    <button
                      onClick={() => markRead([n.id])}
                      className="text-xs text-gray-400 hover:text-gray-600 shrink-0"
                      title="Mark as read"
                    >
                      <span className="material-symbols-outlined text-base">done</span>
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/notifications/page.tsx
git commit -m "feat(ui): notifications list page with mark-read"
```

---

## Task 5: Email Templates for Certification Flow

**Files:**
- Modify: `lib/email.ts`

- [ ] **Step 1: Add three new email functions**

Append to `lib/email.ts`:

```typescript
interface CertInterviewAssignedPayload {
  recipientEmail: string
  seniorGuideName: string
  guideName: string
  tpaName: string
  trackTitle: string
}

export async function sendCertInterviewAssignedEmail(payload: CertInterviewAssignedPayload) {
  const { recipientEmail, seniorGuideName, guideName, tpaName, trackTitle } = payload

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background:#1B3A24;padding:28px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;">Sarawak Forestry Corporation</h1>
            <p style="margin:4px 0 0;color:#8DC63F;font-size:14px;">Digital Park Guide Programme</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 16px;color:#1B3A24;font-size:20px;">Interview Assignment</h2>
            <p style="color:#333;font-size:15px;line-height:1.6;">Dear <strong>${seniorGuideName}</strong>,</p>
            <p style="color:#333;font-size:15px;line-height:1.6;">
              <strong>${guideName}</strong> has completed all modules and quizzes for
              <strong>${trackTitle}</strong> (${tpaName}) and is ready for their certification interview.
            </p>
            <p style="color:#333;font-size:15px;line-height:1.6;">
              Please log in to <strong>/senior-guide/interviews</strong> to schedule the interview.
            </p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9f9f9;padding:20px 32px;border-top:1px solid #eee;">
            <p style="margin:0;color:#999;font-size:12px;">
              This is an automated notification from the Digital Park Guide system.<br>
              &copy; ${new Date().getFullYear()} Sarawak Forestry Corporation
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: recipientEmail,
    subject: `Interview Assignment — ${guideName} (${tpaName})`,
    html,
  })
}


interface CertInterviewScheduledPayload {
  recipientEmail: string
  guideName: string
  trackTitle: string
  tpaName: string
  interviewDate: string
  interviewTime: string
  interviewLocation: string
}

export async function sendCertInterviewScheduledEmail(payload: CertInterviewScheduledPayload) {
  const { recipientEmail, guideName, trackTitle, tpaName, interviewDate, interviewTime, interviewLocation } = payload

  const formattedDate = new Date(interviewDate + 'T00:00:00').toLocaleDateString('en-MY', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background:#1B3A24;padding:28px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;">Sarawak Forestry Corporation</h1>
            <p style="margin:4px 0 0;color:#8DC63F;font-size:14px;">Digital Park Guide Programme</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 16px;color:#1B3A24;font-size:20px;">Certification Interview Scheduled</h2>
            <p style="color:#333;font-size:15px;line-height:1.6;">Dear <strong>${guideName}</strong>,</p>
            <p style="color:#333;font-size:15px;line-height:1.6;">
              Your certification interview for <strong>${trackTitle}</strong> (${tpaName}) has been scheduled.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7f2;border-left:4px solid #2D6A3F;border-radius:8px;margin:16px 0 24px;">
              <tr><td style="padding:20px 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr><td style="color:#666;font-size:13px;padding:4px 0;">Date</td><td style="color:#1B3A24;font-size:15px;font-weight:bold;">${formattedDate}</td></tr>
                  <tr><td style="color:#666;font-size:13px;padding:4px 0;">Time</td><td style="color:#1B3A24;font-size:15px;font-weight:bold;">${interviewTime}</td></tr>
                  <tr><td style="color:#666;font-size:13px;padding:4px 0;">Location</td><td style="color:#1B3A24;font-size:15px;font-weight:bold;">${interviewLocation}</td></tr>
                </table>
              </td></tr>
            </table>
            <p style="color:#333;font-size:15px;">Please arrive at least <strong>15 minutes early</strong> with valid identification.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9f9f9;padding:20px 32px;border-top:1px solid #eee;">
            <p style="margin:0;color:#999;font-size:12px;">Automated notification &copy; ${new Date().getFullYear()} Sarawak Forestry Corporation</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: recipientEmail,
    subject: `Certification Interview Scheduled — ${trackTitle} (${tpaName})`,
    html,
  })
}


interface BadgeIssuedPayload {
  recipientEmail: string
  guideName: string
  trackTitle: string
  tpaName: string
  certificateNo: string
}

export async function sendBadgeIssuedEmail(payload: BadgeIssuedPayload) {
  const { recipientEmail, guideName, trackTitle, tpaName, certificateNo } = payload

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#f4f4f4;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;">
        <tr>
          <td style="background:#1B3A24;padding:28px 32px;">
            <h1 style="margin:0;color:#ffffff;font-size:22px;">Sarawak Forestry Corporation</h1>
            <p style="margin:4px 0 0;color:#8DC63F;font-size:14px;">Digital Park Guide Programme</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px;">
            <h2 style="margin:0 0 16px;color:#2D6A3F;font-size:22px;">Congratulations! Badge Issued</h2>
            <p style="color:#333;font-size:15px;line-height:1.6;">Dear <strong>${guideName}</strong>,</p>
            <p style="color:#333;font-size:15px;line-height:1.6;">
              Your TPA badge for <strong>${trackTitle}</strong> (${tpaName}) has been officially issued!
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f7f2;border:2px solid #2D6A3F;border-radius:12px;margin:16px 0 24px;">
              <tr><td style="padding:24px;text-align:center;">
                <p style="color:#666;font-size:13px;margin:0 0 4px;">Certificate Number</p>
                <p style="color:#1B3A24;font-size:24px;font-weight:bold;margin:0;letter-spacing:2px;">${certificateNo}</p>
              </td></tr>
            </table>
            <p style="color:#333;font-size:15px;">You are now certified to operate as a guide in ${tpaName}. View your badge in the Dashboard.</p>
          </td>
        </tr>
        <tr>
          <td style="background:#f9f9f9;padding:20px 32px;border-top:1px solid #eee;">
            <p style="margin:0;color:#999;font-size:12px;">Automated notification &copy; ${new Date().getFullYear()} Sarawak Forestry Corporation</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: recipientEmail,
    subject: `TPA Badge Issued — ${trackTitle} (${tpaName}) [${certificateNo}]`,
    html,
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/email.ts
git commit -m "feat(email): certification interview + badge issued email templates"
```

---

## Task 6: Certification API Routes

**Files:**
- Create: `app/api/certifications/[id]/schedule/route.ts`
- Create: `app/api/certifications/[id]/outcome/route.ts`
- Create: `app/api/certifications/[id]/issue/route.ts`
- Create: `app/api/certifications/[id]/packet/route.ts`

- [ ] **Step 1: Create schedule interview route**

```typescript
// app/api/certifications/[id]/schedule/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendCertInterviewScheduledEmail } from '@/lib/email'

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id: certId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { date, time, location } = await req.json()
  if (!date || !time || !location?.trim()) {
    return NextResponse.json({ error: 'date, time, and location are required' }, { status: 400 })
  }

  const { error } = await supabase.rpc('schedule_certification_interview', {
    p_cert_id: certId,
    p_date: date,
    p_time: time,
    p_location: location.trim(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Send email to the guide
  try {
    const { data: cert } = await supabase
      .from('guide_track_certifications')
      .select('guide_id, tpa_name, training_tracks(title)')
      .eq('id', certId)
      .single()

    if (cert) {
      const { data: guideAuth } = await supabase.auth.admin.getUserById(cert.guide_id)
      const { data: guideProfile } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', cert.guide_id)
        .single()

      if (guideAuth?.user?.email) {
        const track = cert.training_tracks as { title: string } | null
        await sendCertInterviewScheduledEmail({
          recipientEmail: guideAuth.user.email,
          guideName: guideProfile?.full_name || 'Guide',
          trackTitle: track?.title || '',
          tpaName: cert.tpa_name,
          interviewDate: date,
          interviewTime: time,
          interviewLocation: location.trim(),
        })
      }
    }
  } catch (emailErr) {
    console.error('Failed to send interview email:', emailErr)
  }

  return NextResponse.json({ success: true })
}
```

- [ ] **Step 2: Create record outcome route**

```typescript
// app/api/certifications/[id]/outcome/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(req: NextRequest, { params }: RouteParams) {
  const { id: certId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { outcome, notes } = await req.json()
  if (!outcome || !['PASSED', 'FAILED'].includes(outcome)) {
    return NextResponse.json({ error: 'outcome must be PASSED or FAILED' }, { status: 400 })
  }

  const { data, error } = await supabase.rpc('record_interview_outcome', {
    p_cert_id: certId,
    p_outcome: outcome,
    p_notes: notes || '',
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ certification: data })
}
```

- [ ] **Step 3: Create issue badge route**

```typescript
// app/api/certifications/[id]/issue/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendBadgeIssuedEmail } from '@/lib/email'

interface RouteParams { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: RouteParams) {
  const { id: certId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data, error } = await supabase.rpc('issue_tpa_badge', { p_cert_id: certId })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Send congrats email
  try {
    const cert = data as { guide_id: string; tpa_name: string; track_id: string; certificate_no: string }
    const { data: guideAuth } = await supabase.auth.admin.getUserById(cert.guide_id)
    const { data: guideProfile } = await supabase.from('profiles').select('full_name').eq('id', cert.guide_id).single()
    const { data: track } = await supabase.from('training_tracks').select('title').eq('id', cert.track_id).single()

    if (guideAuth?.user?.email) {
      await sendBadgeIssuedEmail({
        recipientEmail: guideAuth.user.email,
        guideName: guideProfile?.full_name || 'Guide',
        trackTitle: track?.title || '',
        tpaName: cert.tpa_name,
        certificateNo: cert.certificate_no,
      })
    }
  } catch (emailErr) {
    console.error('Failed to send badge email:', emailErr)
  }

  return NextResponse.json({ certification: data })
}
```

- [ ] **Step 4: Create approval packet route**

```typescript
// app/api/certifications/[id]/packet/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface RouteParams { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const { id: certId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })

  const { data, error } = await supabase.rpc('get_hod_approval_packet', { p_cert_id: certId })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ packet: data })
}
```

- [ ] **Step 5: Commit**

```bash
git add app/api/certifications/
git commit -m "feat(api): certification schedule, outcome, issue, packet endpoints"
```

---

## Task 7: Senior Guide Interviews Page

**Files:**
- Create: `app/senior-guide/layout.tsx`
- Create: `app/senior-guide/interviews/page.tsx`

- [ ] **Step 1: Create Senior Guide layout**

```typescript
// app/senior-guide/layout.tsx
import TopNavServer from '@/components/TopNavServer'

export default function SeniorGuideLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <TopNavServer active="training" />
      {children}
    </>
  )
}
```

- [ ] **Step 2: Create interviews page**

This page shows certifications in PENDING_INTERVIEW or QUIZZES_PASSED stage for guides in the Senior Guide's group. The Senior Guide can schedule interviews and record outcomes.

```typescript
// app/senior-guide/interviews/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StatusPopup } from '@/components/StatusPopup'

interface CertRow {
  id: string
  guide_id: string
  guide_name: string
  track_title: string
  tpa_name: string
  stage: string
  quiz_passed_at: string | null
  interview_date: string | null
  interview_time: string | null
  interview_location: string | null
  resit_count: number
}

export default function SeniorInterviewsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<CertRow[]>([])
  const [popup, setPopup] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const clearPopup = useCallback(() => setPopup(null), [])

  // Schedule form state
  const [scheduling, setScheduling] = useState<string | null>(null)
  const [schedForm, setSchedForm] = useState({ date: '', time: '', location: '' })
  const [saving, setSaving] = useState(false)

  // Outcome form state
  const [recording, setRecording] = useState<string | null>(null)
  const [outcomeForm, setOutcomeForm] = useState({ outcome: 'PASSED' as 'PASSED' | 'FAILED', notes: '' })

  const load = useCallback(async () => {
    setLoading(true)

    // Get guides in my group
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: members } = await supabase
      .from('guide_group_members')
      .select('guide_id')
      .eq('senior_guide_id', user.id)

    const guideIds = (members ?? []).map(m => m.guide_id)
    if (guideIds.length === 0) { setLoading(false); return }

    const { data: certs } = await supabase
      .from('guide_track_certifications')
      .select('id, guide_id, tpa_name, stage, quiz_passed_at, interview_date, interview_time, interview_location, resit_count, training_tracks(title)')
      .in('guide_id', guideIds)
      .in('stage', ['QUIZZES_PASSED', 'PENDING_INTERVIEW'])
      .order('created_at', { ascending: false })

    const mapped: CertRow[] = (certs ?? []).map((c: Record<string, unknown>) => {
      const track = c.training_tracks as { title: string } | null
      return {
        id: c.id as string,
        guide_id: c.guide_id as string,
        guide_name: '',
        track_title: track?.title ?? '',
        tpa_name: c.tpa_name as string,
        stage: c.stage as string,
        quiz_passed_at: c.quiz_passed_at as string | null,
        interview_date: c.interview_date as string | null,
        interview_time: c.interview_time as string | null,
        interview_location: c.interview_location as string | null,
        resit_count: c.resit_count as number,
      }
    })

    // Fetch guide names
    const uniqueGuides = [...new Set(mapped.map(m => m.guide_id))]
    if (uniqueGuides.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', uniqueGuides)
      const nameMap = new Map((profiles ?? []).map(p => [p.id, p.full_name || p.id.slice(0, 8)]))
      mapped.forEach(m => { m.guide_name = nameMap.get(m.guide_id) || m.guide_id.slice(0, 8) })
    }

    setRows(mapped)
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const scheduleInterview = async (certId: string) => {
    if (!schedForm.date || !schedForm.time || !schedForm.location.trim()) {
      setPopup({ msg: 'Please fill in date, time, and location.', type: 'error' })
      return
    }
    setSaving(true)
    const res = await fetch(`/api/certifications/${certId}/schedule`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(schedForm),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json()
      setPopup({ msg: d.error || 'Schedule failed', type: 'error' })
      return
    }
    setPopup({ msg: 'Interview scheduled. Guide has been notified.', type: 'success' })
    setScheduling(null)
    setSchedForm({ date: '', time: '', location: '' })
    load()
  }

  const recordOutcome = async (certId: string) => {
    setSaving(true)
    const res = await fetch(`/api/certifications/${certId}/outcome`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(outcomeForm),
    })
    setSaving(false)
    if (!res.ok) {
      const d = await res.json()
      setPopup({ msg: d.error || 'Failed to record outcome', type: 'error' })
      return
    }
    setPopup({ msg: outcomeForm.outcome === 'PASSED' ? 'Interview passed. Submitted to HoD for badge approval.' : 'Interview outcome recorded.', type: 'success' })
    setRecording(null)
    setOutcomeForm({ outcome: 'PASSED', notes: '' })
    load()
  }

  const needsScheduling = rows.filter(r => r.stage === 'QUIZZES_PASSED' || (r.stage === 'PENDING_INTERVIEW' && !r.interview_date))
  const scheduled = rows.filter(r => r.stage === 'PENDING_INTERVIEW' && r.interview_date)

  return (
    <div className="max-w-5xl mx-auto p-6">
      <StatusPopup message={popup?.msg ?? null} type={popup?.type ?? 'success'} onClose={clearPopup} />

      <div className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-black text-[#1B3A24]">Certification Interviews</h1>
        <p className="text-gray-500">Manage interview scheduling and record outcomes for your assigned guides.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="material-symbols-outlined animate-spin text-[#2D6A3F] text-4xl">progress_activity</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
          <span className="material-symbols-outlined text-5xl text-gray-300 mb-3 block">event_available</span>
          <h2 className="text-xl font-bold text-gray-700 mb-2">No pending interviews</h2>
          <p className="text-gray-500">Guides in your group who complete all requirements will appear here.</p>
        </div>
      ) : (
        <>
          {/* Ready to schedule */}
          {needsScheduling.length > 0 && (
            <section className="mb-10">
              <h2 className="text-lg font-bold text-[#1B3A24] mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-500">schedule</span>
                Awaiting Interview ({needsScheduling.length})
              </h2>
              <div className="space-y-3">
                {needsScheduling.map(r => (
                  <div key={r.id} className="bg-white rounded-xl border border-amber-200 p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-bold text-gray-900">{r.guide_name}</p>
                        <p className="text-sm text-gray-500">{r.track_title} — {r.tpa_name}</p>
                        {r.resit_count > 0 && (
                          <span className="inline-block mt-1 text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-semibold">
                            Resit #{r.resit_count}
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => { setScheduling(r.id); setSchedForm({ date: '', time: '', location: '' }) }}
                        className="bg-[#1B3A24] text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-[#111827] transition"
                      >
                        Schedule Interview
                      </button>
                    </div>
                    {r.quiz_passed_at && (
                      <p className="text-xs text-gray-400">Quizzes passed: {new Date(r.quiz_passed_at).toLocaleDateString()}</p>
                    )}

                    {scheduling === r.id && (
                      <div className="mt-4 border-t pt-4 grid grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
                          <input type="date" value={schedForm.date} onChange={e => setSchedForm(f => ({ ...f, date: e.target.value }))} className="w-full border rounded-lg p-2 text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Time</label>
                          <input type="time" value={schedForm.time} onChange={e => setSchedForm(f => ({ ...f, time: e.target.value }))} className="w-full border rounded-lg p-2 text-sm" />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Location</label>
                          <input value={schedForm.location} onChange={e => setSchedForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. TPA Office" className="w-full border rounded-lg p-2 text-sm" />
                        </div>
                        <div className="col-span-3 flex justify-end gap-2 mt-2">
                          <button onClick={() => setScheduling(null)} className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1">Cancel</button>
                          <button onClick={() => scheduleInterview(r.id)} disabled={saving} className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:opacity-50">
                            {saving ? 'Scheduling...' : 'Confirm'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Scheduled — ready for outcome */}
          {scheduled.length > 0 && (
            <section>
              <h2 className="text-lg font-bold text-[#1B3A24] mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined text-emerald-500">event</span>
                Scheduled Interviews ({scheduled.length})
              </h2>
              <div className="space-y-3">
                {scheduled.map(r => (
                  <div key={r.id} className="bg-white rounded-xl border border-emerald-200 p-5">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-bold text-gray-900">{r.guide_name}</p>
                        <p className="text-sm text-gray-500">{r.track_title} — {r.tpa_name}</p>
                      </div>
                      <button
                        onClick={() => { setRecording(r.id); setOutcomeForm({ outcome: 'PASSED', notes: '' }) }}
                        className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 transition"
                      >
                        Record Outcome
                      </button>
                    </div>
                    <div className="flex gap-4 text-xs text-gray-500">
                      <span>{r.interview_date}</span>
                      <span>{r.interview_time}</span>
                      <span>{r.interview_location}</span>
                    </div>

                    {recording === r.id && (
                      <div className="mt-4 border-t pt-4 space-y-3">
                        <div className="flex gap-3">
                          {(['PASSED', 'FAILED'] as const).map(o => (
                            <button
                              key={o}
                              onClick={() => setOutcomeForm(f => ({ ...f, outcome: o }))}
                              className={`flex-1 py-3 rounded-xl text-sm font-bold border-2 transition ${
                                outcomeForm.outcome === o
                                  ? o === 'PASSED' ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-red-500 bg-red-50 text-red-700'
                                  : 'border-gray-200 text-gray-500'
                              }`}
                            >
                              {o}
                            </button>
                          ))}
                        </div>
                        <textarea
                          value={outcomeForm.notes}
                          onChange={e => setOutcomeForm(f => ({ ...f, notes: e.target.value }))}
                          placeholder="Interview notes..."
                          rows={3}
                          className="w-full border rounded-lg p-2 text-sm resize-none"
                        />
                        <div className="flex justify-end gap-2">
                          <button onClick={() => setRecording(null)} className="text-sm text-gray-500 px-3 py-1">Cancel</button>
                          <button onClick={() => recordOutcome(r.id)} disabled={saving} className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:opacity-50">
                            {saving ? 'Saving...' : 'Submit Outcome'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/senior-guide/
git commit -m "feat(ui): Senior Guide interviews page — schedule + record outcome"
```

---

## Task 8: HoD Certifications / Badge Issuance Page

**Files:**
- Create: `app/dashboard/hod/certifications/page.tsx`

- [ ] **Step 1: Create the HoD certifications page**

This page lists all `guide_track_certifications` visible to HoD, sorted with `PENDING_BADGE_APPROVAL` at top. Each row has an "Issue Badge" button that calls the issue endpoint, and a "View Packet" button that fetches the approval packet.

```typescript
// app/dashboard/hod/certifications/page.tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { StatusPopup } from '@/components/StatusPopup'

interface CertRow {
  id: string
  guide_id: string
  guide_name: string
  tpa_name: string
  track_title: string
  stage: string
  quiz_passed_at: string | null
  interview_notes: string | null
  interviewer_name: string | null
  submitted_to_hod_at: string | null
  certificate_no: string | null
  badge_issued_at: string | null
  created_at: string
}

interface ApprovalPacket {
  guide: { full_name: string; phone: string; role: string }
  track: { title: string; tpa_name: string; duration_weeks: number }
  interviewer: { full_name: string }
  modules_completed: Array<{ title: string; completed_at: string }>
  quiz_result: { score: number; passed: boolean; attempt_at: string } | null
  documents: Array<{ id: string; file_name: string; storage_path: string }>
  certification: Record<string, unknown>
}

const STAGE_ORDER: Record<string, number> = {
  PENDING_BADGE_APPROVAL: 0,
  BADGE_ISSUED: 1,
  PENDING_INTERVIEW: 2,
  QUIZZES_PASSED: 3,
  MODULES_COMPLETED: 4,
  PAID: 5,
  AWAITING_PAYMENT: 6,
  REJECTED: 7,
}

const STAGE_CHIP: Record<string, { label: string; cls: string }> = {
  PENDING_BADGE_APPROVAL: { label: 'Ready for Badge', cls: 'bg-amber-100 text-amber-800 border-amber-300' },
  BADGE_ISSUED: { label: 'Badge Issued', cls: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
  PENDING_INTERVIEW: { label: 'Interview Pending', cls: 'bg-blue-100 text-blue-800 border-blue-300' },
  REJECTED: { label: 'Rejected', cls: 'bg-red-100 text-red-800 border-red-300' },
}

export default function HodCertificationsPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [rows, setRows] = useState<CertRow[]>([])
  const [popup, setPopup] = useState<{ msg: string; type: 'success' | 'error' } | null>(null)
  const clearPopup = useCallback(() => setPopup(null), [])
  const [issuing, setIssuing] = useState<string | null>(null)
  const [viewingPacket, setViewingPacket] = useState<string | null>(null)
  const [packet, setPacket] = useState<ApprovalPacket | null>(null)
  const [packetLoading, setPacketLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('guide_track_certifications')
      .select('id, guide_id, tpa_name, stage, quiz_passed_at, interview_notes, submitted_to_hod_at, certificate_no, badge_issued_at, created_at, interviewer_id, training_tracks(title)')
      .order('created_at', { ascending: false })

    const mapped: CertRow[] = (data ?? []).map((c: Record<string, unknown>) => {
      const track = c.training_tracks as { title: string } | null
      return {
        id: c.id as string,
        guide_id: c.guide_id as string,
        guide_name: '',
        tpa_name: c.tpa_name as string,
        track_title: track?.title ?? '',
        stage: c.stage as string,
        quiz_passed_at: c.quiz_passed_at as string | null,
        interview_notes: c.interview_notes as string | null,
        interviewer_name: null,
        submitted_to_hod_at: c.submitted_to_hod_at as string | null,
        certificate_no: c.certificate_no as string | null,
        badge_issued_at: c.badge_issued_at as string | null,
        created_at: c.created_at as string,
      }
    })

    // Fetch guide + interviewer names
    const allIds = [...new Set(mapped.flatMap(m => [m.guide_id, ...((data ?? []).map((c: Record<string, unknown>) => c.interviewer_id as string).filter(Boolean))]))]
    if (allIds.length > 0) {
      const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', allIds)
      const nameMap = new Map((profiles ?? []).map(p => [p.id, p.full_name || p.id.slice(0, 8)]))
      mapped.forEach((m, i) => {
        m.guide_name = nameMap.get(m.guide_id) || m.guide_id.slice(0, 8)
        const interviewerId = (data ?? [])[i]?.interviewer_id as string | null
        if (interviewerId) m.interviewer_name = nameMap.get(interviewerId) || null
      })
    }

    // Sort: PENDING_BADGE_APPROVAL first
    mapped.sort((a, b) => (STAGE_ORDER[a.stage] ?? 99) - (STAGE_ORDER[b.stage] ?? 99))

    setRows(mapped)
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  const issueBadge = async (certId: string) => {
    if (!confirm('Issue badge for this certification? This action cannot be undone.')) return
    setIssuing(certId)
    const res = await fetch(`/api/certifications/${certId}/issue`, { method: 'POST' })
    setIssuing(null)
    if (!res.ok) {
      const d = await res.json()
      setPopup({ msg: d.error || 'Failed to issue badge', type: 'error' })
      return
    }
    setPopup({ msg: 'Badge issued successfully! Guide has been notified.', type: 'success' })
    load()
  }

  const viewPacket = async (certId: string) => {
    setViewingPacket(certId)
    setPacketLoading(true)
    const res = await fetch(`/api/certifications/${certId}/packet`)
    if (res.ok) {
      const body = await res.json()
      setPacket(body.packet)
    }
    setPacketLoading(false)
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      <StatusPopup message={popup?.msg ?? null} type={popup?.type ?? 'success'} onClose={clearPopup} />

      <div className="mb-8 border-b pb-4">
        <h1 className="text-3xl font-black text-[#1B3A24]">Certification Management</h1>
        <p className="text-gray-500">Review certification pipeline and issue TPA badges.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <span className="material-symbols-outlined animate-spin text-[#2D6A3F] text-4xl">progress_activity</span>
        </div>
      ) : rows.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-12 text-center">
          <span className="material-symbols-outlined text-5xl text-gray-300 mb-3 block">workspace_premium</span>
          <h2 className="text-xl font-bold text-gray-700">No certifications yet</h2>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map(r => {
            const chip = STAGE_CHIP[r.stage] ?? { label: r.stage.replace(/_/g, ' '), cls: 'bg-gray-100 text-gray-700 border-gray-200' }
            const isPending = r.stage === 'PENDING_BADGE_APPROVAL'

            return (
              <div
                key={r.id}
                className={`bg-white rounded-xl border p-5 transition-all ${
                  isPending ? 'border-amber-300 bg-amber-50/30 ring-1 ring-amber-200' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <p className="font-bold text-gray-900 text-lg">{r.guide_name}</p>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold border ${chip.cls}`}>
                        {chip.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{r.track_title} — {r.tpa_name}</p>
                    {r.certificate_no && (
                      <p className="text-sm text-emerald-700 font-mono font-bold mt-1">{r.certificate_no}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {isPending && (
                      <>
                        <button
                          onClick={() => viewPacket(r.id)}
                          className="text-sm font-semibold text-blue-600 hover:underline px-3 py-2"
                        >
                          View Packet
                        </button>
                        <button
                          onClick={() => issueBadge(r.id)}
                          disabled={issuing === r.id}
                          className="bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700 disabled:opacity-50 transition"
                        >
                          {issuing === r.id ? 'Issuing...' : 'Issue Badge'}
                        </button>
                      </>
                    )}
                    {r.stage === 'BADGE_ISSUED' && (
                      <span className="text-xs text-gray-400">Issued {r.badge_issued_at ? new Date(r.badge_issued_at).toLocaleDateString() : ''}</span>
                    )}
                  </div>
                </div>

                {r.interviewer_name && (
                  <p className="text-xs text-gray-400 mt-2">Interviewer: {r.interviewer_name}</p>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Approval Packet Modal */}
      {viewingPacket && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-y-auto p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-black text-[#1B3A24]">Approval Packet</h2>
              <button onClick={() => { setViewingPacket(null); setPacket(null) }} className="text-gray-400 hover:text-gray-600">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            {packetLoading ? (
              <div className="py-12 text-center">
                <span className="material-symbols-outlined animate-spin text-[#2D6A3F] text-3xl">progress_activity</span>
              </div>
            ) : packet ? (
              <div className="space-y-5 text-sm">
                <section>
                  <h3 className="text-xs font-bold uppercase text-gray-400 mb-2">Guide</h3>
                  <p className="font-semibold text-gray-900">{packet.guide.full_name}</p>
                  <p className="text-gray-500">{packet.guide.phone} · {packet.guide.role}</p>
                </section>
                <section>
                  <h3 className="text-xs font-bold uppercase text-gray-400 mb-2">Track</h3>
                  <p className="font-semibold text-gray-900">{packet.track.title} — {packet.track.tpa_name}</p>
                  <p className="text-gray-500">{packet.track.duration_weeks} weeks</p>
                </section>
                <section>
                  <h3 className="text-xs font-bold uppercase text-gray-400 mb-2">Modules Completed ({packet.modules_completed.length})</h3>
                  <ul className="space-y-1">
                    {packet.modules_completed.map((m, i) => (
                      <li key={i} className="flex justify-between text-gray-700">
                        <span>{m.title}</span>
                        <span className="text-gray-400">{new Date(m.completed_at).toLocaleDateString()}</span>
                      </li>
                    ))}
                  </ul>
                </section>
                {packet.quiz_result && (
                  <section>
                    <h3 className="text-xs font-bold uppercase text-gray-400 mb-2">Quiz Result</h3>
                    <p className="text-gray-700">Score: <strong>{packet.quiz_result.score}%</strong> — {packet.quiz_result.passed ? 'Passed' : 'Failed'}</p>
                  </section>
                )}
                <section>
                  <h3 className="text-xs font-bold uppercase text-gray-400 mb-2">Interview</h3>
                  <p className="text-gray-700">Interviewer: {packet.interviewer.full_name}</p>
                  <p className="text-gray-500">{(packet.certification as { interview_notes?: string }).interview_notes || 'No notes'}</p>
                </section>
                {packet.documents.length > 0 && (
                  <section>
                    <h3 className="text-xs font-bold uppercase text-gray-400 mb-2">Documents ({packet.documents.length})</h3>
                    <ul className="space-y-1">
                      {packet.documents.map(d => (
                        <li key={d.id} className="text-gray-700 flex items-center gap-2">
                          <span className="material-symbols-outlined text-sm text-gray-400">description</span>
                          {d.file_name}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
              </div>
            ) : (
              <p className="text-gray-500 py-6 text-center">Failed to load packet.</p>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/dashboard/hod/certifications/
git commit -m "feat(ui): HoD certification management + badge issuance page"
```

---

## Task 9: HoD Manual Nomination in Groups Page

**Files:**
- Modify: `app/dashboard/hod/groups/page.tsx`

- [ ] **Step 1: Add nomination capability**

In `app/dashboard/hod/groups/page.tsx`, add a "Nominate to Senior Guide" button for each guide in the group list. When clicked, calls the `nominate_senior_guide` RPC via the Supabase client.

Find the section where guide memberships are rendered (the guide card/row within each senior guide's group). Add a button:

After the guide name display, add:

```tsx
<button
  onClick={async () => {
    if (!confirm(`Promote ${guideName} to Senior Guide?`)) return
    setSaving(guideId)
    const { error } = await supabase.rpc('nominate_senior_guide', { p_guide_id: guideId })
    setSaving(null)
    if (error) { setToast({ msg: error.message, ok: false }); return }
    setToast({ msg: `${guideName} promoted to Senior Guide.`, ok: true })
    load()
  }}
  disabled={saving === guideId}
  className="text-xs font-semibold text-emerald-600 hover:underline"
>
  Nominate Senior
</button>
```

Also add a "Nominate" button for unassigned guides in the unassigned list.

The exact insertion point depends on the current rendering structure — locate the guide name rendering in each membership card and add the button after it.

- [ ] **Step 2: Add import for supabase client if not already present**

The page already uses `fetch('/api/guide-groups')`. Add a supabase client import:

```typescript
import { createClient } from '@/lib/supabase/client'
```

And in the component body:

```typescript
const supabase = createClient()
```

- [ ] **Step 3: Commit**

```bash
git add app/dashboard/hod/groups/page.tsx
git commit -m "feat(ui): HoD manual nomination to Senior Guide in groups page"
```

---

## Task 10: Sidebar Navigation Updates

**Files:**
- Modify: `components/GuardianPortalSidebar.tsx`
- Modify: `types/roles.ts`

- [ ] **Step 1: Add Certifications link to HoD sidebar and Interviews link to Senior sidebar**

In `components/GuardianPortalSidebar.tsx`, find the `items` array. Add to the HoD section (after quiz-result):

```typescript
{ href: '/dashboard/hod/certifications', icon: 'workspace_premium', label: 'Certifications', active: pathname.startsWith('/dashboard/hod/certifications') },
```

Add to the Senior Guide section (after the existing "My Group" entry):

```typescript
{
  href: '/senior-guide/interviews',
  icon: 'event',
  label: 'Interviews',
  active: pathname.startsWith('/senior-guide/interviews'),
},
```

- [ ] **Step 2: Add route protection for /senior-guide**

In `types/roles.ts`, add to `PROTECTED_ROUTES` array before the `/dashboard` entry:

```typescript
{ prefix: '/senior-guide', minRole: 'SENIOR_GUIDE' },
```

- [ ] **Step 3: Commit**

```bash
git add components/GuardianPortalSidebar.tsx types/roles.ts
git commit -m "feat(nav): add Certifications + Interviews sidebar links, protect /senior-guide route"
```

---

## Task 11: TypeScript Check + Final Verification

- [ ] **Step 1: Run TypeScript check**

```bash
cd digitalparkguide && npx tsc --noEmit
```

Fix any type errors.

- [ ] **Step 2: Run dev server and manually verify**

```bash
pnpm dev
```

Check:
1. `/notifications` — page loads, shows empty state
2. Bell icon visible in top nav (when logged in)
3. `/senior-guide/interviews` — loads for Senior Guide role
4. `/dashboard/hod/certifications` — loads for HoD role
5. Sidebar shows new links for each role

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix: resolve TypeScript errors from certification pipeline"
```
