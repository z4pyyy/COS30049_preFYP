-- Allow authenticated users to read sensor data (RLS was only granting anon)

-- sensor_readings: all authenticated users can SELECT
CREATE POLICY IF NOT EXISTS "authenticated_read_sensor_readings"
  ON public.sensor_readings
  FOR SELECT
  TO authenticated
  USING (true);

-- sensor_alerts: all authenticated users can SELECT
CREATE POLICY IF NOT EXISTS "authenticated_read_sensor_alerts"
  ON public.sensor_alerts
  FOR SELECT
  TO authenticated
  USING (true);
