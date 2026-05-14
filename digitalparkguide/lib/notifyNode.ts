// Add this function to useSensorNode.ts
// Call it from useDetection.ts triggerAlert() when source === 'sensor_and_pose'

// ── Notify ESP32 node of confirmed violation ──────────────────────────────────
// ESP32 will trigger buzzer + red LED for 3 seconds
export async function notifyNodeViolation(): Promise<void> {
  try {
    await fetch(`http://192.168.4.1/violation`, {
      method: 'POST',
      signal: AbortSignal.timeout(2000),
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'confirmed_violation', ts: Date.now() }),
    })
    console.log('[Sensor] Violation notification sent to node')
  } catch {
    // Node unreachable — PWA alert still fires, hardware alert just won't trigger
    console.warn('[Sensor] Could not notify node — offline?')
  }
}