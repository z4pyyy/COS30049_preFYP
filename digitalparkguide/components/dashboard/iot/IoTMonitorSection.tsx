'use client'

import { useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  LineChart, Line,
  Tooltip, ResponsiveContainer,
} from 'recharts'

// ─── DB row types ───────────────────────────────────────────────────────────────

interface DbSensorReading {
  id: string
  device_id: string
  temperature: number
  humidity: number
  risk_score: number
  created_at: string
}

interface DbSensorAlert {
  id: string
  device_id: string
  alert_type: 'fire_risk' | 'flood_risk' | 'anomaly'
  severity: 'warning' | 'critical'
  triggered_value: number
  threshold_used: number
  resolved_at: string | null
  created_at: string
}

interface ZoneStatus {
  id: string
  label: string
  pirStatus: 'offline' | 'clear' | 'triggered'
  lastEvent: string | null
}

interface DbIntrusionEvent {
  id: string
  device_id: string
  zone: string
  pir_triggered: boolean
  sound_triggered: boolean
  confidence: 'low' | 'medium' | 'high'
  event_type: 'motion_only' | 'sound_only' | 'compound_intrusion'
  acknowledged: boolean
  created_at: string
}

// ─── Constants ──────────────────────────────────────────────────────────────────

const DEVICE_ID = 'm5stack-zone-alpha'
const INTRUSION_DEVICE_ID = 'esp32-intrusion-node-1'

const MOCK_ZONES: ZoneStatus[] = Array.from({ length: 8 }, (_, i) => ({
  id: `A${i + 2}`,
  label: `A${i + 2}`,
  pirStatus: 'clear' as const,
  lastEvent: 'No intrusion',
}))

// ─── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function tempStatus(t: number): 'NORMAL' | 'WARNING' | 'CRITICAL' {
  if (t >= 45) return 'CRITICAL'
  if (t >= 35) return 'WARNING'
  return 'NORMAL'
}

function humidityStatus(h: number): 'NORMAL' | 'WARNING' | 'CRITICAL' {
  if (h < 20 || h > 90) return 'CRITICAL'
  if (h < 40 || h > 80) return 'WARNING'
  return 'NORMAL'
}

const ALERT_LABEL: Record<string, string> = {
  fire_risk: 'Fire Risk Detected',
  flood_risk: 'Flood Risk Detected',
  anomaly: 'Environmental Anomaly',
}

// ─── UI primitives ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: 'live' | 'offline' | 'mock' }) {
  const cfg = {
    live: { text: 'LIVE', bg: 'bg-emerald-500', pulse: true },
    offline: { text: 'SENSOR OFFLINE', bg: 'bg-gray-500', pulse: false },
    mock: { text: 'MOCK DATA', bg: 'bg-amber-500', pulse: false },
  }[status]

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider text-white ${cfg.bg}`}>
      {cfg.pulse && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-200" />
        </span>
      )}
      {cfg.text}
    </span>
  )
}

// ─── Sparkline tooltip ──────────────────────────────────────────────────────────

function SparklineTooltip({ active, payload }: {
  active?: boolean; payload?: Array<{ payload: { risk_score: number; time: string } }>
}) {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div className="bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-xs shadow-xl">
      <p className="text-gray-400 font-mono">{d.time}</p>
      <p className="text-emerald-400 font-bold">Risk: {d.risk_score}</p>
    </div>
  )
}

// ─── Card 1: Environmental Anomaly Station (LIVE) ───────────────────────────────

function EnvironmentalAnomalyStation({ latest, history, isLive }: {
  latest: DbSensorReading | null
  history: Array<{ risk_score: number; time: string }>
  isLive: boolean
}) {
  const riskScore = latest?.risk_score ?? 0
  const riskColor = riskScore < 60 ? 'bg-emerald-500' : riskScore < 80 ? 'bg-amber-500' : 'bg-red-500'
  const riskTextColor = riskScore < 60 ? 'text-emerald-400' : riskScore < 80 ? 'text-amber-400' : 'text-red-400'
  const hasData = latest != null

  return (
    <div className="bg-[#0a1f14] border border-emerald-900/30 rounded-xl overflow-hidden">
      <div className="p-5 pb-0">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h4 className="text-base font-bold text-white">Environmental Anomaly Station</h4>
            <p className="text-xs text-gray-500 mt-0.5">Fire & Flood Risk Index — Bako National Park, Zone Alpha</p>
          </div>
          <StatusBadge status={isLive ? 'live' : hasData ? 'offline' : 'offline'} />
        </div>
      </div>

      <div className="px-5 pt-4 pb-1">
        {hasData ? (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-gray-900/60 border border-white/5 rounded-lg p-3 text-center">
              <span className="material-symbols-outlined text-emerald-400/60 text-xl">thermostat</span>
              <p className="text-2xl font-black text-white font-mono mt-1">{latest.temperature.toFixed(1)}°</p>
              <p className="text-[9px] text-gray-500 uppercase tracking-wider">Temperature</p>
              <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border mt-1 inline-block ${
                tempStatus(latest.temperature) === 'NORMAL' ? 'bg-emerald-900/40 text-emerald-400 border-emerald-700/30' :
                tempStatus(latest.temperature) === 'WARNING' ? 'bg-amber-900/40 text-amber-400 border-amber-700/30' :
                'bg-red-900/40 text-red-400 border-red-700/30'
              }`}>{tempStatus(latest.temperature)}</span>
            </div>
            <div className="bg-gray-900/60 border border-white/5 rounded-lg p-3 text-center">
              <span className="material-symbols-outlined text-emerald-400/60 text-xl">humidity_percentage</span>
              <p className="text-2xl font-black text-white font-mono mt-1">{latest.humidity.toFixed(0)}%</p>
              <p className="text-[9px] text-gray-500 uppercase tracking-wider">Humidity</p>
              <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border mt-1 inline-block ${
                humidityStatus(latest.humidity) === 'NORMAL' ? 'bg-emerald-900/40 text-emerald-400 border-emerald-700/30' :
                humidityStatus(latest.humidity) === 'WARNING' ? 'bg-amber-900/40 text-amber-400 border-amber-700/30' :
                'bg-red-900/40 text-red-400 border-red-700/30'
              }`}>{humidityStatus(latest.humidity)}</span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div className="bg-gray-900/60 border border-white/5 rounded-lg p-3 text-center">
              <span className="material-symbols-outlined text-gray-600 text-xl">thermostat</span>
              <p className="text-2xl font-black text-gray-600 font-mono mt-1">—</p>
              <p className="text-[9px] text-gray-600 uppercase tracking-wider">Temperature</p>
            </div>
            <div className="bg-gray-900/60 border border-white/5 rounded-lg p-3 text-center">
              <span className="material-symbols-outlined text-gray-600 text-xl">humidity_percentage</span>
              <p className="text-2xl font-black text-gray-600 font-mono mt-1">—</p>
              <p className="text-[9px] text-gray-600 uppercase tracking-wider">Humidity</p>
            </div>
          </div>
        )}
      </div>

      {/* Sparkline — last 20 risk scores */}
      {history.length > 1 && (
        <div className="px-5 pb-2">
          <p className="text-[9px] font-bold uppercase tracking-widest text-gray-500 mb-1">Risk Score Trend</p>
          <div className="h-16">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={0}>
              <LineChart data={history} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                <Tooltip content={<SparklineTooltip />} />
                <Line
                  type="monotone"
                  dataKey="risk_score"
                  stroke="#10b981"
                  strokeWidth={1.5}
                  dot={false}
                  activeDot={{ r: 3, fill: '#10b981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="px-5 pb-5">
        <div className="bg-gray-900/60 rounded-lg p-4 border border-white/5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-widest text-gray-400">Risk Index</span>
            <span className={`text-2xl font-black font-mono ${hasData ? riskTextColor : 'text-gray-600'}`}>
              {hasData ? riskScore : 0}
            </span>
          </div>
          <div className="h-2.5 bg-gray-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${hasData ? riskColor : 'bg-gray-700'}`}
              style={{ width: `${hasData ? riskScore : 0}%` }}
            />
          </div>
          <div className="flex justify-between mt-1.5 text-[9px] text-gray-600 font-mono">
            <span>0 — Safe</span>
            <span>60 — Elevated</span>
            <span>80 — Critical</span>
            <span>100</span>
          </div>
        </div>
        <p className="text-[10px] text-gray-600 mt-3">
          Last reading: {latest ? timeAgo(latest.created_at) : '—'}
        </p>
      </div>
    </div>
  )
}

// ─── Card 2: Perimeter Intrusion Detection (LIVE A1 + mock A2-A9) ──────────────

const EVENT_TYPE_LABEL: Record<string, string> = {
  motion_only: 'Motion',
  sound_only: 'Sound',
  compound_intrusion: 'Compound',
}

const CONFIDENCE_STYLE: Record<string, string> = {
  low: 'bg-gray-800 text-gray-400 border-gray-700',
  medium: 'bg-amber-900/40 text-amber-400 border-amber-700/30',
  high: 'bg-red-900/40 text-red-400 border-red-700/30',
}

function PerimeterIntrusionDetection({ zones, events, isLive }: {
  zones: ZoneStatus[]
  events: DbIntrusionEvent[]
  isLive: boolean
}) {
  const pirDotColor = {
    offline: 'bg-gray-600',
    clear: 'bg-emerald-400',
    triggered: 'bg-red-500 animate-pulse',
  }

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const eventsToday = events.filter(e => new Date(e.created_at) >= todayStart).length

  return (
    <div className="bg-[#0a1f14] border border-emerald-900/30 rounded-xl overflow-hidden">
      <div className="p-5 pb-0">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h4 className="text-base font-bold text-white">Perimeter Intrusion Detection</h4>
            <p className="text-xs text-gray-500 mt-0.5">Motion & Sound Anomaly — Trail Network</p>
          </div>
          <StatusBadge status={isLive ? 'live' : events.length > 0 ? 'live' : 'offline'} />
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="grid grid-cols-3 gap-2">
          {zones.map(z => (
            <div key={z.id} className={`bg-gray-900/60 border rounded-lg p-2.5 text-center ${
              z.pirStatus === 'triggered' ? 'border-red-700/40' : 'border-white/5'
            }`}>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className={`w-2 h-2 rounded-full ${pirDotColor[z.pirStatus]}`} />
                <span className="text-xs font-bold text-gray-300 font-mono">{z.label}</span>
              </div>
              <p className="text-[9px] text-gray-600">{z.lastEvent ?? '—'}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="px-5 pb-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-2">Recent Events</p>
        <div className="space-y-2 max-h-36 overflow-y-auto">
          {events.length === 0 ? (
            <p className="text-xs text-gray-600 py-2">No intrusion events recorded</p>
          ) : (
            events.slice(0, 5).map(e => (
              <div key={e.id} className="flex items-center gap-2 py-2 border-b border-white/5 last:border-b-0">
                <span className={`text-[8px] font-bold uppercase px-1.5 py-0.5 rounded-full border shrink-0 ${CONFIDENCE_STYLE[e.confidence]}`}>
                  {e.confidence}
                </span>
                <span className="text-xs text-gray-300 truncate flex-1">
                  {EVENT_TYPE_LABEL[e.event_type] ?? e.event_type}
                  {e.pir_triggered && <span className="text-amber-500 ml-1">PIR</span>}
                  {e.sound_triggered && <span className="text-cyan-500 ml-1">SND</span>}
                </span>
                <span className="text-[10px] text-gray-600 shrink-0 font-mono">{timeAgo(e.created_at)}</span>
              </div>
            ))
          )}
        </div>
      </div>

      <div className="px-5 pb-5 flex items-center justify-between">
        <span className="text-xs text-gray-500">Events today: <span className="font-bold text-gray-300 font-mono">{eventsToday}</span></span>
        <span className="text-[10px] text-gray-600 font-mono">Zone A1 live · A2–A9 demo</span>
      </div>
    </div>
  )
}

// ─── Alert Feed ─────────────────────────────────────────────────────────────────

function AlertFeed({ alerts, loading }: { alerts: DbSensorAlert[]; loading: boolean }) {
  const severityStyle = {
    critical: 'bg-red-900/40 text-red-400 border-red-700/30',
    warning: 'bg-amber-900/40 text-amber-400 border-amber-700/30',
  }

  const severityIcon = {
    critical: 'bg-red-100 text-red-700',
    warning: 'bg-amber-100 text-amber-700',
  }

  return (
    <div className="bg-[#0a1f14] border border-emerald-900/30 rounded-xl overflow-hidden">
      <div className="p-5 pb-3">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-bold text-white flex items-center gap-2">
            <span className="material-symbols-outlined text-red-400 text-lg">notification_important</span>
            Sensor Alerts & Incidents
          </h4>
          <span className="text-[10px] text-gray-400 font-mono">
            {alerts.length} alert{alerts.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      <div className="px-5 pb-5">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3 p-3 bg-gray-900/40 rounded-lg animate-pulse">
                <div className="h-10 w-10 bg-gray-800 rounded-full shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-gray-800 rounded w-3/4" />
                  <div className="h-2 bg-gray-800 rounded w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-8">
            <span className="material-symbols-outlined text-3xl text-gray-700 block mb-2">check_circle</span>
            <p className="text-sm text-gray-500">No sensor alerts</p>
            <p className="text-[10px] text-gray-600 mt-1">Alerts from environmental sensors will appear here</p>
          </div>
        ) : (
          <div className="space-y-2">
            {alerts.map(a => (
              <div key={a.id} className="flex items-center gap-3 p-3 bg-gray-900/40 rounded-lg hover:bg-gray-900/60 transition-colors">
                <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 ${severityIcon[a.severity]}`}>
                  <span className="material-symbols-outlined text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>
                    {a.severity === 'critical' ? 'report_problem' : 'warning'}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded-full border shrink-0 ${severityStyle[a.severity]}`}>
                      {a.severity}
                    </span>
                    <h5 className="text-sm font-bold text-white truncate">
                      {ALERT_LABEL[a.alert_type] ?? a.alert_type}
                    </h5>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Score: {a.triggered_value}/100 · Threshold: {a.threshold_used}
                    {a.resolved_at && <span className="text-emerald-500 ml-2">· Resolved</span>}
                  </p>
                </div>
                <span className="text-[10px] text-gray-600 shrink-0 font-mono">{timeAgo(a.created_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main Export ─────────────────────────────────────────────────────────────────

export default function IoTMonitorSection() {
  const [readings, setReadings] = useState<DbSensorReading[]>([])
  const [alerts, setAlerts] = useState<DbSensorAlert[]>([])
  const [intrusionEvents, setIntrusionEvents] = useState<DbIntrusionEvent[]>([])
  const [loading, setLoading] = useState(true)
  const [alertsLoading, setAlertsLoading] = useState(true)
  const [realtimeConnected, setRealtimeConnected] = useState(false)
  const [intrusionRealtimeConnected, setIntrusionRealtimeConnected] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const mountedRef = useRef(true)

  useEffect(() => {
    mountedRef.current = true
    const supabase = createClient()

    console.log('[IoT] useEffect fired — fetching sensor data...')

    async function fetchReadings() {
      try {
        const { data, error } = await supabase
          .from('sensor_readings')
          .select('*')
          .eq('device_id', DEVICE_ID)
          .order('created_at', { ascending: false })
          .limit(50)

        console.log('[IoT] sensor_readings result:', { rows: data?.length ?? 0, error: error?.message ?? null })

        if (!mountedRef.current) return
        if (error) {
          setFetchError(error.message)
        } else if (data) {
          setReadings(data as DbSensorReading[])
        }
      } catch (e) {
        console.error('[IoT] sensor_readings exception:', e)
        if (mountedRef.current) setFetchError(String(e))
      }
      if (mountedRef.current) setLoading(false)
    }

    async function fetchAlerts() {
      try {
        const { data, error } = await supabase
          .from('sensor_alerts')
          .select('*')
          .eq('device_id', DEVICE_ID)
          .order('created_at', { ascending: false })
          .limit(20)

        console.log('[IoT] sensor_alerts result:', { rows: data?.length ?? 0, error: error?.message ?? null })

        if (!mountedRef.current) return
        if (error) {
          console.error('[IoT] sensor_alerts error:', error.message)
        } else if (data) {
          setAlerts(data as DbSensorAlert[])
        }
      } catch (e) {
        console.error('[IoT] sensor_alerts exception:', e)
      }
      if (mountedRef.current) setAlertsLoading(false)
    }

    async function fetchIntrusionEvents() {
      try {
        const { data, error } = await supabase
          .from('intrusion_events')
          .select('*')
          .eq('device_id', INTRUSION_DEVICE_ID)
          .order('created_at', { ascending: false })
          .limit(30)

        console.log('[IoT] intrusion_events result:', { rows: data?.length ?? 0, error: error?.message ?? null })

        if (!mountedRef.current) return
        if (error) {
          console.error('[IoT] intrusion_events error:', error.message)
        } else if (data) {
          setIntrusionEvents(data as DbIntrusionEvent[])
        }
      } catch (e) {
        console.error('[IoT] intrusion_events exception:', e)
      }
    }

    function fetchAll() {
      fetchReadings()
      fetchAlerts()
      fetchIntrusionEvents()
    }

    fetchAll()
    const pollInterval = setInterval(fetchAll, 3000)

    const readingsChannel = supabase
      .channel(`sensor-readings-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'sensor_readings',
          filter: `device_id=eq.${DEVICE_ID}`,
        },
        (payload) => {
          console.log('[IoT] realtime INSERT sensor_readings')
          setReadings(prev => [payload.new as DbSensorReading, ...prev].slice(0, 50))
        }
      )
      .subscribe((status) => {
        console.log('[IoT] readings channel status:', status)
        if (mountedRef.current) setRealtimeConnected(status === 'SUBSCRIBED')
      })

    const alertsChannel = supabase
      .channel(`sensor-alerts-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'sensor_alerts',
          filter: `device_id=eq.${DEVICE_ID}`,
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setAlerts(prev => [payload.new as DbSensorAlert, ...prev].slice(0, 20))
          } else if (payload.eventType === 'UPDATE') {
            setAlerts(prev => prev.map(a =>
              a.id === (payload.new as DbSensorAlert).id ? payload.new as DbSensorAlert : a
            ))
          }
        }
      )
      .subscribe()

    const intrusionChannel = supabase
      .channel(`intrusion-events-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'intrusion_events',
          filter: `device_id=eq.${INTRUSION_DEVICE_ID}`,
        },
        (payload) => {
          console.log('[IoT] realtime INSERT intrusion_events')
          setIntrusionEvents(prev => [payload.new as DbIntrusionEvent, ...prev].slice(0, 30))
        }
      )
      .subscribe((status) => {
        console.log('[IoT] intrusion channel status:', status)
        if (mountedRef.current) setIntrusionRealtimeConnected(status === 'SUBSCRIBED')
      })

    return () => {
      mountedRef.current = false
      clearInterval(pollInterval)
      supabase.removeChannel(readingsChannel)
      supabase.removeChannel(alertsChannel)
      supabase.removeChannel(intrusionChannel)
    }
  }, [])

  const latest = readings[0] ?? null
  const isLive = realtimeConnected && latest != null

  // Build A1 zone from real intrusion data
  const latestIntrusion = intrusionEvents[0] ?? null
  const zoneA1: ZoneStatus = {
    id: 'A1',
    label: 'A1',
    pirStatus: latestIntrusion ? (latestIntrusion.pir_triggered ? 'triggered' : 'clear') : 'offline',
    lastEvent: latestIntrusion ? timeAgo(latestIntrusion.created_at) : null,
  }
  const allZones: ZoneStatus[] = [zoneA1, ...MOCK_ZONES]

  // Sparkline data: last 20 readings, oldest first for left-to-right display
  const sparklineData = readings
    .slice(0, 20)
    .reverse()
    .map(r => ({
      risk_score: r.risk_score,
      time: new Date(r.created_at).toLocaleTimeString('en-MY', {
        hour: '2-digit', minute: '2-digit',
      }),
    }))

  // Connection status text
  const connectionStatus = fetchError
    ? `Error: ${fetchError}`
    : loading
      ? 'Connecting...'
      : isLive
        ? `Live · ${readings.length} readings cached`
        : latest
          ? `Last data: ${timeAgo(latest.created_at)}`
          : 'Awaiting sensor connection'

  const connectionColor = fetchError
    ? 'text-red-500'
    : isLive ? 'text-emerald-500' : latest ? 'text-amber-500' : 'text-gray-400'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg sm:text-xl font-bold text-primary flex items-center gap-2">
            <span className="material-symbols-outlined text-emerald-600">sensors</span>
            IoT Park Sensor Monitor
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">M5Stack FIRE sensor network — Environmental and motion intelligence</p>
        </div>
        <span className={`text-[10px] bg-gray-100 px-3 py-1 rounded-full font-bold uppercase tracking-wider flex items-center gap-1.5 ${connectionColor}`}>
          {isLive && (
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
          )}
          {connectionStatus}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <EnvironmentalAnomalyStation
          latest={latest}
          history={sparklineData}
          isLive={isLive}
        />
        <PerimeterIntrusionDetection zones={allZones} events={intrusionEvents} isLive={intrusionRealtimeConnected} />
      </div>

      <AlertFeed alerts={alerts} loading={alertsLoading} />
    </div>
  )
}
