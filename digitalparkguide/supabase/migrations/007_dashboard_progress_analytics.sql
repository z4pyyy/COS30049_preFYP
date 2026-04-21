-- ============================================================
-- Adds a view that rolls up per-guide training progress so the
-- HoD dashboard can show aggregates without hammering the client
-- with N+1 queries.
--
-- Consumed by:
--   /api/training-progress/me        (guide's own rows)
--   /api/training-progress/summary   (HoD aggregate)
-- ============================================================

-- Drop & recreate so reruns stay clean
DROP VIEW IF EXISTS public.guide_progress_summary CASCADE;

-- One row per (guide, track) combo. Only counts non-archived active
-- modules — an archived module shouldn't lower anyone's completion %.
CREATE VIEW public.guide_progress_summary
WITH (security_invoker = true)  -- honour caller's RLS, not the view owner's
AS
SELECT
  e.guide_id,
  e.track_id,
  t.title            AS track_title,
  t.tpa_name,
  t.track_type,
  p.full_name        AS guide_name,
  -- total active modules in the track
  COUNT(m.id)                                              AS total_modules,
  -- modules the guide has completed
  COUNT(gmp.id) FILTER (WHERE gmp.completed = TRUE)        AS completed_modules,
  -- modules touched but not finished
  COUNT(gmp.id) FILTER (
    WHERE gmp.completed = FALSE
      AND array_length(gmp.assets_consumed, 1) > 0
  )                                                        AS in_progress_modules,
  -- percent complete, clamped to 0 when track has no modules yet
  CASE
    WHEN COUNT(m.id) = 0 THEN 0
    ELSE ROUND(
      (COUNT(gmp.id) FILTER (WHERE gmp.completed = TRUE)::numeric
       / COUNT(m.id)::numeric) * 100
    )
  END                                                      AS completion_pct,
  MAX(gmp.last_accessed_at)                                AS last_activity_at,
  e.status                                                 AS enrollment_status
FROM public.guide_track_enrollments e
JOIN public.training_tracks t   ON t.id = e.track_id
JOIN public.profiles p          ON p.id = e.guide_id
LEFT JOIN public.training_modules m
       ON m.track_id = e.track_id
      AND m.is_active   = TRUE
      AND m.is_archived = FALSE
LEFT JOIN public.guide_module_progress gmp
       ON gmp.module_id = m.id
      AND gmp.guide_id  = e.guide_id
WHERE t.is_archived = FALSE
GROUP BY e.guide_id, e.track_id, t.title, t.tpa_name,
         t.track_type, p.full_name, e.status;

COMMENT ON VIEW public.guide_progress_summary IS
  'Per-guide/per-track rollup of module progress. RLS is inherited from '
  'guide_track_enrollments + guide_module_progress (security_invoker).';

-- Give authenticated users SELECT — the underlying table RLS still decides
-- which rows they actually see.
GRANT SELECT ON public.guide_progress_summary TO authenticated;