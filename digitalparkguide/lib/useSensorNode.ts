// lib/useSensorNode.ts
// Connects PWA to ESP32 sensor node over local WiFi.
// HTTP ping confirms node is reachable.
// WebSocket receives real-time sensor events.
//
// Usage:
//   const { sensorAlert, nodeConnected, lastDistance } = useSensorNode()
//
// Phone must be connected to "SFC-SensorNode-01" WiFi for this to work.
// Falls back gracefully when not connected — AI-only mode.

import { useEffect, useRef, useState, useCallback } from 'react'

// ── Config ────────────────────────────────────────────────────────────────────
const NODE_IP      = '192.168.4.1'
const HTTP_URL     = `http://${NODE_IP}/ping`
const WS_URL       = `ws://${NODE_IP}:81`
const PING_INTERVAL = 5000   // ms — how often to check node is still alive
const RECONNECT_MS  = 3000   // ms — WebSocket reconnect delay

// ── Types ─────────────────────────────────────────────────────────────────────
export interface SensorAlert {
  type:      'plant_intrusion' | 'motion_detected'
  distance:  number
  node:      string
  timestamp: number
  active:    boolean
}

// ── Hook ──────────────────────────────────────────────────────────────────────
export function useSensorNode() {
  const wsRef           = useRef<WebSocket | null>(null)
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const reconnectRef    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef      = useRef(true)
  const alertTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [nodeConnected,  setNodeConnected]  = useState(false)
  const [lastDistance,   setLastDistance]   = useState<number | null>(null)
  const [sensorAlert,    setSensorAlert]    = useState<SensorAlert | null>(null)
  const [pirActive,      setPirActive]      = useState(false)

  // Stable ref so violation gate in useDetection always sees latest alert
  const sensorAlertRef = useRef<SensorAlert | null>(null)

  // ── HTTP ping — check node is reachable ────────────────────────────────────
  const pingNode = useCallback(async () => {
    try {
      const res = await fetch(HTTP_URL, {
        signal: AbortSignal.timeout(2000), // 2s timeout
      })
      if (res.ok && mountedRef.current) {
        setNodeConnected(true)
      }
    } catch {
      if (mountedRef.current) {
        setNodeConnected(false)
      }
    }
  }, [])

  // ── Handle incoming WebSocket message ─────────────────────────────────────
  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data)

      if (data.event === 'plant_intrusion') {
        setLastDistance(data.distance)

        const alert: SensorAlert = {
          type:      'plant_intrusion',
          distance:  data.distance,
          node:      data.node,
          timestamp: Date.now(),
          active:    true,
        }
        sensorAlertRef.current = alert
        setSensorAlert(alert)

        // Auto-clear alert active flag after 3s
        // (violation gate has 3s window to match with pose)
        if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current)
        alertTimeoutRef.current = setTimeout(() => {
          if (sensorAlertRef.current) {
            const cleared = { ...sensorAlertRef.current, active: false }
            sensorAlertRef.current = cleared
            setSensorAlert(cleared)
          }
        }, 3000)

        console.log(`[Sensor] Plant intrusion: ${data.distance}cm`)
      }

      if (data.event === 'motion_detected') {
        const alert: SensorAlert = {
          type:      'motion_detected',
          distance:  data.distance,
          node:      data.node,
          timestamp: Date.now(),
          active:    true,
        }
        sensorAlertRef.current = alert
        setSensorAlert(alert)

        if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current)
        alertTimeoutRef.current = setTimeout(() => {
          if (sensorAlertRef.current) {
            const cleared = { ...sensorAlertRef.current, active: false }
            sensorAlertRef.current = cleared
            setSensorAlert(cleared)
          }
        }, 3000)

        console.log('[Sensor] Motion detected')
      }

      if (data.event === 'connected') {
        setNodeConnected(true)
        setLastDistance(data.distance)
      }

    } catch (err) {
      console.warn('[Sensor] Failed to parse WS message:', event.data)
    }
  }, [])

  // ── WebSocket connect ──────────────────────────────────────────────────────
  const connectWS = useCallback(() => {
    if (!mountedRef.current) return
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    console.log('[Sensor] Connecting WebSocket...')

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      if (!mountedRef.current) return
      console.log('[Sensor] WebSocket connected')
      setNodeConnected(true)
    }

    ws.onmessage = handleMessage

    ws.onclose = () => {
      if (!mountedRef.current) return
      console.log('[Sensor] WebSocket closed — reconnecting...')
      setNodeConnected(false)
      // Reconnect after delay
      reconnectRef.current = setTimeout(connectWS, RECONNECT_MS)
    }

    ws.onerror = () => {
      // onclose will fire after onerror — let it handle reconnect
      ws.close()
    }
  }, [handleMessage])

  // ── Boot ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    mountedRef.current = true

    // Try initial ping first — if node not reachable, still try WS
    pingNode()

    // Connect WebSocket
    connectWS()

    // Periodic HTTP ping to confirm node still alive
    pingIntervalRef.current = setInterval(pingNode, PING_INTERVAL)

    return () => {
      mountedRef.current = false
      wsRef.current?.close()
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current)
      if (reconnectRef.current)    clearTimeout(reconnectRef.current)
      if (alertTimeoutRef.current) clearTimeout(alertTimeoutRef.current)
    }
  }, [connectWS, pingNode])

  // ── Manual clear ──────────────────────────────────────────────────────────
  const clearSensorAlert = useCallback(() => {
    sensorAlertRef.current = null
    setSensorAlert(null)
  }, [])

  return {
    nodeConnected,
    lastDistance,
    sensorAlert,
    sensorAlertRef,  // stable ref for violation gate in useDetection
    pirActive,
    clearSensorAlert,
  }
}