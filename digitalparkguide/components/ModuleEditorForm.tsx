// Training Module Editor Form Component

'use client'

import { useState, useEffect } from 'react'
import { RichTextEditor } from './RichTextEditor'
import { ModuleMediaUploader } from './ModuleMediaUploader'
import { ModuleAssetsDisplay } from './ModuleAssetsDisplay'

export interface ModuleEditorState {
  id?: string
  track_id: string
  additional_track_ids: string[]
  title: string
  description: string
  content: string
  order_index: number
  duration_hours: number
  is_active: boolean
}

interface ModuleEditorFormProps {
  moduleId?: string
  trackId?: string
  tpaName?: string
  onSubmit: (data: ModuleEditorState) => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
  trainingTracks?: Array<{ id: string; title: string; tpa_name: string }>
}

export function ModuleEditorForm({
  moduleId,
  trackId: initialTrackId,
  tpaName: initialTpaName,
  onSubmit,
  onCancel,
  isLoading = false,
  trainingTracks = [],
}: ModuleEditorFormProps) {
  const [formData, setFormData] = useState<ModuleEditorState>({
    track_id: initialTrackId || '',
    additional_track_ids: [],
    title: '',
    description: '',
    content: '',
    order_index: 0,
    duration_hours: 1,
    is_active: true,
  })

  const [selectedTpa, setSelectedTpa] = useState<string>(initialTpaName || '')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [showAssets, setShowAssets] = useState(false)

  useEffect(() => {
    if (moduleId) {
      // Fetch module data if editing
      fetchModuleData()
    }
  }, [moduleId])

  const fetchModuleData = async () => {
    if (!moduleId) return

    try {
      const response = await fetch(`/api/training-modules/${moduleId}`)
      if (!response.ok) throw new Error('Failed to fetch module')

      const { module } = await response.json()
      setFormData({
        id: module.id,
        track_id: module.track_id,
        additional_track_ids: module.additional_track_ids || [],
        title: module.title,
        description: module.description,
        content: module.content,
        order_index: module.order_index,
        duration_hours: module.duration_hours || 1,
        is_active: module.is_active,
      })

      if (module.training_tracks) {
        setSelectedTpa(module.training_tracks.tpa_name)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load module'
      setError(message)
    }
  }

  const handleTpaChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const trackId = e.target.value
    setFormData((prev) => ({ ...prev, track_id: trackId }))

    // Find and set the TPA name
    const track = trainingTracks.find((t) => t.id === trackId)
    if (track) {
      setSelectedTpa(track.tpa_name)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    // Validation
    if (!formData.track_id) {
      setError('Please select a training track')
      return
    }
    if (!formData.title.trim()) {
      setError('Module title is required')
      return
    }

    try {
      await onSubmit(formData)
      setSuccess(moduleId ? 'Module updated successfully!' : 'Module created successfully!')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Operation failed'
      setError(message)
    }
  }


  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Header Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[#1B3A24]">
            {moduleId ? 'Edit Training Module' : 'Create Training Module'}
          </h2>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={formData.is_active}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, is_active: e.target.checked }))
                  }
                  disabled={isLoading}
                  className="sr-only"
                />
                <div
                  className={`
                    h-6 w-11 rounded-full transition-colors
                    ${formData.is_active ? 'bg-[#8DC63F]' : 'bg-[#cbd5e1]'}
                  `}
                />
                <div
                  className={`
                    absolute top-1 h-4 w-4 rounded-full bg-white
                    transition-transform
                    ${formData.is_active ? 'translate-x-6' : 'translate-x-1'}
                  `}
                />
              </div>
              <span className="text-sm font-medium text-[#1B3A24]">
                {formData.is_active ? 'Published' : 'Draft'}
              </span>
            </label>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-700">{error}</p>
          </div>
        )}
        {success && (
          <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-sm text-green-700">{success}</p>
          </div>
        )}
      </div>

      {/* Track & TPA Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-[#1B3A24] mb-2">
            Training Track <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.track_id}
            onChange={handleTpaChange}
            disabled={isLoading}
            className="w-full px-4 py-2.5 border border-[#cbd5e1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D6A3F] focus:border-transparent bg-white text-[#1B3A24]"
          >
            <option value="">Select a training track...</option>
            {trainingTracks.map((track) => (
              <option key={track.id} value={track.id}>
                {track.title} ({track.tpa_name})
              </option>
            ))}
          </select>
          <p className="text-xs text-[#64748b] mt-1">
            Select the certification track for this module
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#1B3A24] mb-2">
            Totally Protected Area (TPA)
          </label>
          <div className="border border-[#cbd5e1] rounded-lg bg-[#f8fafc] overflow-hidden divide-y divide-[#e2e8f0]">
            <div className="px-4 py-2.5 text-[#1B3A24]">
              {selectedTpa || 'Select a track above'}
            </div>
            {formData.additional_track_ids.map((tid, i) => {
              const t = trainingTracks.find(x => x.id === tid)
              const tpaName = t ? t.tpa_name : tid
              return (
                <div key={tid} className="px-4 py-2 flex items-center justify-between">
                  <span className="text-sm text-[#1B3A24]">{tpaName}</span>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, additional_track_ids: prev.additional_track_ids.filter((_, j) => j !== i) }))}
                    className="text-xs text-red-400 hover:text-red-600 font-medium ml-3"
                  >✕</button>
                </div>
              )
            })}
          </div>
          <p className="text-xs text-[#64748b] mt-1">
            Automatically populated from selected track
          </p>
        </div>
      </div>

      {/* Add Another TPA */}
      {trainingTracks.filter(t => t.id !== formData.track_id && !formData.additional_track_ids.includes(t.id)).length > 0 && (
        <div>
          <label className="block text-sm font-semibold text-[#1B3A24] mb-2">Add Another TPA <span className="text-gray-400 font-normal">(optional)</span></label>
          <select
            value=""
            onChange={e => { if (e.target.value) setFormData(prev => ({ ...prev, additional_track_ids: [...prev.additional_track_ids, e.target.value] })) }}
            disabled={isLoading}
            className="w-full px-4 py-2.5 border border-[#cbd5e1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D6A3F] bg-white text-[#1B3A24]"
          >
            <option value="">— Select an additional track —</option>
            {trainingTracks.filter(t => t.id !== formData.track_id && !formData.additional_track_ids.includes(t.id)).map(t => (
              <option key={t.id} value={t.id}>{t.tpa_name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Title & Description */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-[#1B3A24] mb-2">
            Module Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, title: e.target.value }))
            }
            placeholder="e.g., Introduction to Sarawak Flora"
            disabled={isLoading}
            className="w-full px-4 py-2.5 border border-[#cbd5e1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D6A3F] focus:border-transparent bg-white text-[#1B3A24] placeholder-[#94a3b8]"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#1B3A24] mb-2">
            Short Description
          </label>
          <textarea
            value={formData.description}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, description: e.target.value }))
            }
            placeholder="Brief summary of the module (max 200 characters)..."
            maxLength={200}
            rows={2}
            disabled={isLoading}
            className="w-full px-4 py-2.5 border border-[#cbd5e1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D6A3F] focus:border-transparent bg-white text-[#1B3A24] placeholder-[#94a3b8] resize-none"
          />
          <p className="text-xs text-[#64748b] mt-1">
            {formData.description.length}/200 characters
          </p>
        </div>
      </div>

      {/* Module Content */}
      <div>
        <label className="block text-sm font-semibold text-[#1B3A24] mb-2">
          Module Content
        </label>
        <RichTextEditor
          value={formData.content}
          onChange={(content) =>
            setFormData((prev) => ({ ...prev, content }))
          }
          placeholder="Write your module content here... Use markdown for formatting."
          minHeight="min-h-80"
        />
      </div>

      {/* Module Settings */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-semibold text-[#1B3A24] mb-2">
            Estimated Duration (hours)
          </label>
          <input
            type="number"
            value={formData.duration_hours}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                duration_hours: parseFloat(e.target.value) || 0,
              }))
            }
            min="0.5"
            step="0.5"
            disabled={isLoading}
            className="w-full px-4 py-2.5 border border-[#cbd5e1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D6A3F] focus:border-transparent bg-white text-[#1B3A24]"
          />
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#1B3A24] mb-2">
            Module Order
          </label>
          <input
            type="number"
            value={formData.order_index}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                order_index: parseInt(e.target.value) || 0,
              }))
            }
            min="0"
            disabled={isLoading}
            className="w-full px-4 py-2.5 border border-[#cbd5e1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D6A3F] focus:border-transparent bg-white text-[#1B3A24]"
          />
          <p className="text-xs text-[#64748b] mt-1">
            Display order in the track (0 = first)
          </p>
        </div>

        <div className="flex items-end">
          <button
            type="button"
            onClick={() => setShowAssets(!showAssets)}
            className="w-full px-4 py-2.5 bg-[#2D6A3F] text-white font-medium rounded-lg hover:bg-[#1B3A24] transition-colors"
          >
            {showAssets ? '✕ Hide Assets' : '+ Manage Assets'}
          </button>
        </div>
      </div>

      {/* Media Assets Section */}
      {showAssets && moduleId && (
        <div className="space-y-6 p-6 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg">
          <div>
            <h3 className="text-lg font-semibold text-[#1B3A24] mb-4">Module Media</h3>

            {/* Upload */}
            <div className="mb-8">
              <h4 className="text-sm font-semibold text-[#1B3A24] mb-3">Upload Files</h4>
              <ModuleMediaUploader
                moduleId={moduleId}
                onUploadComplete={() => {
                  // Refresh assets list
                }}
              />
            </div>

            {/* Display */}
            <div>
              <h4 className="text-sm font-semibold text-[#1B3A24] mb-3">Uploaded Files</h4>
              <ModuleAssetsDisplay
                moduleId={moduleId}
                canDelete={true}
                onAssetDeleted={() => {
                  // Refresh if needed
                }}
              />
            </div>
          </div>
        </div>
      )}


      {/* Form Actions */}
      <div className="flex items-center justify-between gap-4 pt-6 border-t border-[#e2e8f0]">
        <div className="text-xs text-[#64748b]">
          {moduleId && <span>Module ID: {moduleId}</span>}
        </div>

        <div className="flex items-center gap-3">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-6 py-2.5 border border-[#cbd5e1] text-[#1B3A24] font-medium rounded-lg hover:bg-[#f8fafc] transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="px-8 py-2.5 bg-[#2D6A3F] text-white font-medium rounded-lg hover:bg-[#1B3A24] transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {isLoading ? (
              <>
                <span className="animate-spin">⏳</span> Saving...
              </>
            ) : moduleId ? (
              <>💾 Update Module</>
            ) : (
              <>✨ Create Module</>
            )}
          </button>
        </div>
      </div>
    </form>
  )
}