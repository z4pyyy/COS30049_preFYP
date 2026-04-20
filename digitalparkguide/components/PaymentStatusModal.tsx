'use client'

import { useSearchParams, useRouter } from 'next/navigation'

export default function PaymentStatusModal() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const status = searchParams.get('payment') // 'success' | 'cancelled' | null
  const amountMyr = parseInt(searchParams.get('amount') ?? '0') || null

  if (!status) return null

  const isSuccess = status === 'success'

  function dismiss() {
    router.replace('/training/tracks')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-sm w-full p-8 text-center">
        {isSuccess ? (
          <>
            <div className="w-20 h-20 rounded-full bg-[#dcfce7] flex items-center justify-center mx-auto mb-5">
              <span className="material-symbols-outlined text-4xl text-[#15803d]" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
            </div>
            <h2 className="text-2xl font-black text-[#1B3A24] mb-2">Payment Successful</h2>
            <p className="text-[#475569] text-sm mb-1">Amount paid</p>
            <p className="text-3xl font-black text-[#1B3A24] mb-5">
              {amountMyr ? `RM ${amountMyr.toLocaleString('en-MY')}.00` : '—'}
            </p>
            <p className="text-[#64748b] text-sm mb-7 leading-relaxed">
              Your training track has been activated. You can now access all modules.
            </p>
            <div className="flex flex-col gap-3">
              <a
                href="/training/modules"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1B3A24] px-6 py-3 text-sm font-semibold text-white hover:bg-[#2D6A3F] transition"
              >
                <span className="material-symbols-outlined text-sm">school</span>
                Start My Modules
              </a>
              <button
                onClick={dismiss}
                className="text-sm text-[#94a3b8] hover:text-[#64748b] transition"
              >
                Back to Tracks
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="w-20 h-20 rounded-full bg-[#fee2e2] flex items-center justify-center mx-auto mb-5">
              <span className="material-symbols-outlined text-4xl text-[#dc2626]" style={{ fontVariationSettings: "'FILL' 1" }}>
                cancel
              </span>
            </div>
            <h2 className="text-2xl font-black text-[#1B3A24] mb-2">Payment Unsuccessful</h2>
            <p className="text-[#475569] text-sm mb-7 leading-relaxed">
              Your payment was not completed. No charge was made.
              You can try again whenever you&apos;re ready.
            </p>
            <div className="flex flex-col gap-3">
              <button
                onClick={dismiss}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#1B3A24] px-6 py-3 text-sm font-semibold text-white hover:bg-[#2D6A3F] transition"
              >
                <span className="material-symbols-outlined text-sm">refresh</span>
                Try Again
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
