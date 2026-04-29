'use client'

import { useEffect } from 'react'

interface StatusPopupProps {
  message: string | null
  type: 'success' | 'error'
  onClose: () => void
  duration?: number
}

export function StatusPopup({ message, type, onClose, duration = 3500 }: StatusPopupProps) {
  useEffect(() => {
    if (!message) return
    const timer = setTimeout(onClose, duration)
    return () => clearTimeout(timer)
  }, [message, duration, onClose])

  if (!message) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
      <div
        className={`pointer-events-auto max-w-md w-full mx-4 rounded-2xl shadow-2xl border-2 p-6 text-center animate-[popIn_0.3s_ease-out] ${
          type === 'success'
            ? 'bg-white border-emerald-400'
            : 'bg-white border-red-400'
        }`}
      >
        <span
          className={`material-symbols-outlined text-5xl mb-3 block ${
            type === 'success' ? 'text-emerald-500' : 'text-red-500'
          }`}
        >
          {type === 'success' ? 'check_circle' : 'error'}
        </span>
        <p
          className={`text-lg font-bold ${
            type === 'success' ? 'text-emerald-800' : 'text-red-800'
          }`}
        >
          {type === 'success' ? 'Success' : 'Error'}
        </p>
        <p className="text-sm text-slate-600 mt-2">{message}</p>
        <button
          onClick={onClose}
          className={`mt-4 px-6 py-2 rounded-xl text-sm font-bold text-white transition-colors ${
            type === 'success'
              ? 'bg-emerald-500 hover:bg-emerald-600'
              : 'bg-red-500 hover:bg-red-600'
          }`}
        >
          OK
        </button>
      </div>
    </div>
  )
}
