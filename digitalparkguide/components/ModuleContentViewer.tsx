'use client'

import { useState, useCallback } from 'react'

interface Asset {
  id: string
  file_name: string
  file_type: 'video' | 'pdf' | 'image'
  mime_type: string
  file_size: number
  storage_url: string
}

interface Progress {
  assets_consumed: string[]
  completed: boolean
  completed_at: string | null
}

interface ModuleContentViewerProps {
  moduleId: string
  content: string
  assets: Asset[]
  initialProgress: Progress | null
  quizId?: string | null
  trackQuizUnlocked?: boolean   // Bug 3: all modules in track complete?
  quizPassedAt?: string | null  // Bug 2: when did the guide pass the quiz?
}

export function ModuleContentViewer({
  moduleId,
  content,
  assets,
  initialProgress,
  quizId,
  trackQuizUnlocked = false,
  quizPassedAt = null,
}: ModuleContentViewerProps) {
  const [progress, setProgress] = useState<Progress>(
    initialProgress ?? { assets_consumed: [], completed: false, completed_at: null }
  )
  const [quizUnlocked, setQuizUnlocked] = useState(trackQuizUnlocked)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  const markAssetConsumed = useCallback(async (assetId: string) => {
    if (progress.assets_consumed.includes(assetId)) return
    setProgress(prev => ({ ...prev, assets_consumed: [...prev.assets_consumed, assetId] }))
    await fetch(`/api/training-modules/${moduleId}/progress`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ asset_id: assetId }),
    })
  }, [moduleId, progress.assets_consumed])

  const markComplete = async () => {
    if (progress.completed) return
    setSaving(true)
    try {
      const res = await fetch(`/api/training-modules/${moduleId}/progress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: true }),
      })
      const body = await res.json()
      if (body.progress) {
        setProgress(body.progress)
        if (body.progress.completed && quizId) setQuizUnlocked(true)
      }
      showToast(body.error ? `Error: ${body.error}` : 'Module marked as complete! Badge eligibility updated.')
    } finally {
      setSaving(false)
    }
  }

  const totalAssets = assets.length
  const consumedCount = assets.filter(a => progress.assets_consumed.includes(a.id)).length
  const completionPct = totalAssets > 0 ? Math.round((consumedCount / totalAssets) * 100) : 0

  return (
    <div className="space-y-8">
      {/* Toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-5 py-3 rounded-xl shadow-lg text-sm font-medium">
          {toast}
        </div>
      )}

      {/* Progress Bar */}
      {totalAssets > 0 && (
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-[#1B3A24]">Your Progress</span>
            <span className="text-sm font-bold text-[#2D6A3F]">{completionPct}%</span>
          </div>
          <div className="h-2 bg-[#e2e8f0] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#8DC63F] rounded-full transition-all duration-500"
              style={{ width: `${completionPct}%` }}
            />
          </div>
          <p className="text-xs text-[#64748b] mt-2">{consumedCount} of {totalAssets} resource{totalAssets !== 1 ? 's' : ''} viewed</p>
        </div>
      )}

      {/* Module Content (rich text / notes) */}
      {content && (
        <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6">
          <h2 className="text-lg font-bold text-[#1B3A24] mb-4 flex items-center gap-2">
            <span className="material-symbols-outlined text-[#2D6A3F]">article</span>
            Module Notes
          </h2>
          <div className="prose prose-sm max-w-none text-[#374151] whitespace-pre-wrap leading-relaxed">
            {content}
          </div>
        </div>
      )}

      {/* Assets */}
      {assets.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-bold text-[#1B3A24] flex items-center gap-2">
            <span className="material-symbols-outlined text-[#2D6A3F]">attach_file</span>
            Learning Resources
          </h2>
          {assets.map((asset) => {
            const consumed = progress.assets_consumed.includes(asset.id)
            return (
              <div key={asset.id} className={`bg-white rounded-2xl border-2 overflow-hidden transition-colors ${consumed ? 'border-[#8DC63F]' : 'border-[#e2e8f0]'}`}>
                {/* Asset Header */}
                <div className="flex items-center justify-between px-5 py-3 border-b border-[#e2e8f0]">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">
                      {asset.file_type === 'video' ? '🎥' : asset.file_type === 'pdf' ? '📄' : '🖼️'}
                    </span>
                    <span className="font-semibold text-[#1B3A24] text-sm">{asset.file_name}</span>
                  </div>
                  {consumed && (
                    <span className="text-xs font-bold text-[#2D6A3F] flex items-center gap-1">
                      <span className="material-symbols-outlined text-sm">check_circle</span>Viewed
                    </span>
                  )}
                </div>

                {/* Player */}
                <div className="p-4">
                  {asset.file_type === 'video' && (
                    <video
                      controls
                      className="w-full rounded-xl max-h-[480px] bg-black"
                      onEnded={() => markAssetConsumed(asset.id)}
                      onPlay={() => markAssetConsumed(asset.id)}
                    >
                      <source src={asset.storage_url} type={asset.mime_type} />
                      Your browser does not support the video tag.
                    </video>
                  )}

                  {asset.file_type === 'pdf' && (
                    <div>
                      <iframe
                        src={asset.storage_url}
                        className="w-full rounded-xl border border-[#e2e8f0]"
                        style={{ height: '600px' }}
                        onLoad={() => markAssetConsumed(asset.id)}
                        title={asset.file_name}
                      />
                      <a
                        href={asset.storage_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => markAssetConsumed(asset.id)}
                        className="mt-2 inline-flex items-center gap-1 text-xs text-[#2D6A3F] hover:underline"
                      >
                        <span className="material-symbols-outlined text-sm">open_in_new</span>
                        Open in new tab
                      </a>
                    </div>
                  )}

                  {asset.file_type === 'image' && (
                    <img
                      src={asset.storage_url}
                      alt={asset.file_name}
                      className="w-full rounded-xl max-h-[500px] object-contain"
                      onLoad={() => markAssetConsumed(asset.id)}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Complete / Quiz Section */}
      <div className="bg-white rounded-2xl border border-[#e2e8f0] p-6">
        {quizPassedAt ? (
          // Bug 2: distinct "Quiz Completed" state (takes precedence over "Module Completed")
          <div className="text-center">
            <span className="material-symbols-outlined text-5xl text-[#2D6A3F] mb-2 block">workspace_premium</span>
            <p className="text-lg font-bold text-[#1B3A24]">Quiz Completed</p>
            <p className="text-sm text-[#64748b] mt-1">
              Passed on {new Date(quizPassedAt).toLocaleDateString()}
            </p>
            <p className="text-xs text-[#8DC63F] font-bold uppercase tracking-widest mt-2">
              Certified for this track
            </p>
          </div>
        ) : progress.completed ? (
          <div className="text-center">
            <span className="material-symbols-outlined text-5xl text-[#8DC63F] mb-2 block">verified</span>
            <p className="text-lg font-bold text-[#1B3A24]">Module Completed!</p>
            <p className="text-sm text-[#64748b] mt-1">
              Completed on {new Date(progress.completed_at!).toLocaleDateString()}
            </p>
            {quizId && quizUnlocked ? (
              <a
                href={`/quiz?quiz_id=${quizId}`}
                className="mt-4 inline-flex items-center gap-2 bg-[#2D6A3F] text-white px-6 py-3 rounded-xl font-semibold hover:bg-[#1B3A24] transition"
              >
                <span className="material-symbols-outlined">quiz</span>
                Take Assessment Quiz
              </a>
            ) : quizId ? (
              <p className="mt-4 inline-flex items-center gap-2 text-sm text-[#64748b] bg-[#f1f5f9] px-4 py-3 rounded-xl">
                <span className="material-symbols-outlined text-sm">lock</span>
                Complete this module to unlock the quiz
              </p>
            ) : null}
          </div>
        ) : (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-[#1B3A24]">Ready to mark this module complete?</p>
              <p className="text-sm text-[#64748b]">
                {totalAssets > 0
                  ? `View all ${totalAssets} resource${totalAssets !== 1 ? 's' : ''} above, then mark complete to update your progress.`
                  : 'Click to mark this module as complete and update your progress.'}
              </p>
            </div>
            <button
              onClick={markComplete}
              disabled={saving}
              className="flex-shrink-0 inline-flex items-center gap-2 bg-[#8DC63F] text-[#1B3A24] font-bold px-6 py-3 rounded-xl hover:bg-[#7ab535] transition disabled:opacity-50"
            >
              {saving ? (
                <><span className="animate-spin material-symbols-outlined text-sm">progress_activity</span>Saving...</>
              ) : (
                <><span className="material-symbols-outlined">check_circle</span>Mark as Complete</>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
