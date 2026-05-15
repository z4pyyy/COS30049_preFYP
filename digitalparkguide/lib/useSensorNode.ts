// lib/useSensorNode.ts
// HTTP polling only — works from HTTPS PWA over ESP32 hotspot.
// Polls http://192.168.4.1/sensor every 500ms when active.
// Falls back gracefully when node not reachable — AI-only mode.

import { useEffect, useRef, useState, useCallback } from 'react'

// ── Config ────────────────────────────────────────────────────────────────────
const NODE_IP       = '192.168.4.1'
const SENSOR_URL    = `http://${NODE_IP}/sensor`
const PING_URL      = `http://${NODE_IP}/ping`
const POLL_MS       = 500   // poll every 500ms
const TIMEOUT_MS    = 2000  // 2s fetch timeout
const ALERT_TTL_MS  = 3000  // how long sensorAlert stays active after trigger

// ── Types ─────────────────────────────────────────────────────────────────────
export interface SensorAlert {
  type:      'plant_intrusion' | 'motion_detected'
  distance:  number
  node:      string
  timestamp: number
  active:    boolean
}

interface SensorState {
  node:             string
  distance:         number
  inZone:           boolean
  intrusionActive:  boolean
  pirActive:        boolean
  lastEvent:        string
  lastEventAge:     number
  uptime:           number
}

// ── Notify ESP32 node — triggers buzzer + red LED ────────────────────────
export async function notifyNodeViolation(): Promise<void> {
  try {
    await fetch(`http://${NODE_IP}/violation`, {
      method: 'POST',
      signal: AbortSignal.timeout(TIMEOUT_MS),
      cache: 'no-store',
    })
  } catch {
    // Node unreachable — fail silently, AI-only mode
  }
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useSensorNode() {
  const pollRef         = useRef<ReturnType<typeof setInterval> | null>(null)
  const alertTimerRef   = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const mountedRef      = useRef(true)
  const wasIntruding    = useRef(false)  // edge detection — only fire once per intrusion
  const wasPirActive    = useRef(false)

  const [nodeConnected, setNodeConnected] = useState(false)
  const [lastDistance,  setLastDistance]  = useState<number | null>(null)
  const [sensorAlert,   setSensorAlert]   = useState<SensorAlert | null>(null)

  // Stable ref — violation gate in useDetection reads this directly
  const sensorAlertRef = useRef<SensorAlert | null>(null)

  // ── Set alert with auto-clear ─────────────────────────────────────────────
  const setAlert = useCallback((alert: SensorAlert) => {
    sensorAlertRef.current = alert
    setSensorAlert(alert)

    // Clear active flag after TTL — 3s window for pose classifier to match
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current)
    alertTimerRef.current = setTimeout(() => {
      if (!mountedRef.current) return
      const cleared = { ...alert, active: false }
      sensorAlertRef.current = cleared
      setSensorAlert(cleared)
    }, ALERT_TTL_MS)
  }, [])

  // ── Poll sensor state ─────────────────────────────────────────────────────
  const poll = useCallback(async () => {
    if (!mountedRef.current) return

    try {
      // ESP32 firmware must return `Access-Control-Allow-Private-Network: true`
      // in its CORS preflight response for Chrome Private Network Access to work.
      const res = await fetch(`${SENSOR_URL}?t=${Date.now()}`, {
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache:  'no-store',
        headers: { 'Access-Control-Request-Private-Network': 'true' },
      })

      if (!res.ok) {
        setNodeConnected(false)
        return
      }

      const data: SensorState = await res.json()
      if (!mountedRef.current) return

      setNodeConnected(true)
      setLastDistance(data.distance)

      // ── Plant intrusion — rising edge only ───────────────────────────────
      if (data.intrusionActive && !wasIntruding.current) {
        wasIntruding.current = true
        setAlert({
          type:      'plant_intrusion',
          distance:  data.distance,
          node:      data.node,
          timestamp: Date.now(),
          active:    true,
        })
        console.log(`[Sensor] Plant intrusion: ${data.distance}cm`)
      }

      if (!data.intrusionActive) {
        wasIntruding.current = false
      }

      // ── PIR motion — rising edge only ────────────────────────────────────
      if (data.pirActive && !wasPirActive.current) {
        wasPirActive.current = true
        setAlert({
          type:      'motion_detected',
          distance:  data.distance,
          node:      data.node,
          timestamp: Date.now(),
          active:    true,
        })
        console.log('[Sensor] Motion detected')
      }

      if (!data.pirActive) {
        wasPirActive.current = false
      }

    } catch {
      // Fetch failed — node unreachable
      if (mountedRef.current) {
        setNodeConnected(false)
      }
    }
  }, [setAlert])

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true

    // Initial poll immediately
    poll()

    // Start polling interval
    pollRef.current = setInterval(poll, POLL_MS)

    return () => {
      mountedRef.current = false
      if (pollRef.current)       clearInterval(pollRef.current)
      if (alertTimerRef.current) clearTimeout(alertTimerRef.current)
    }
  }, [poll])

  const clearSensorAlert = useCallback(() => {
    sensorAlertRef.current = null
    setSensorAlert(null)
    if (alertTimerRef.current) clearTimeout(alertTimerRef.current)
  }, [])

  return {
    nodeConnected,
    lastDistance,
    sensorAlert,
    sensorAlertRef,
    clearSensorAlert,
  }
}