-- Allow authenticated users to read intrusion events

CREATE POLICY IF NOT EXISTS "authenticated_read_intrusion_events"
  ON public.intrusion_events
  FOR SELECT
  TO authenticated
  USING (true);
