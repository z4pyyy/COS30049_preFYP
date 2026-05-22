'use client'

import { useState, useEffect } from 'react'
import ThemedSelect from '@/components/ThemedSelect'
import { RichTextEditor } from './RichTextEditor'

export interface GeneralModuleEditorState {
  id?: string
  title: string
  description: string
  content: string
  tpa_ids: string[]
  order_index: number
  duration_hours: number
  is_active: boolean
  price_myr: number
}

interface GeneralModuleEditorFormProps {
  moduleId?: string
  onSubmit: (data: GeneralModuleEditorState) => Promise<void>
  onCancel?: () => void
  isLoading?: boolean
  trainingTracks?: Array<{ id: string; title: string; tpa_name: string }>
}

export function GeneralModuleEditorForm({
  moduleId,
  onSubmit,
  onCancel,
  isLoading = false,
  trainingTracks = [],
}: GeneralModuleEditorFormProps) {
  const [formData, setFormData] = useState<GeneralModuleEditorState>({
    title: '',
    description: '',
    content: '',
    tpa_ids: [],
    order_index: 0,
    duration_hours: 1,
    is_active: true,
    price_myr: 0,
  })

  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    if (moduleId) fetchModuleData()
  }, [moduleId])

  const fetchModuleData = async () => {
    if (!moduleId) return
    try {
      const response = await fetch(`/api/general-modules/${moduleId}`)
      if (!response.ok) throw new Error('Failed to fetch module')
      const { module } = await response.json()
      setFormData({
        id: module.id,
        title: module.title,
        description: module.description || '',
        content: module.content || '',
        tpa_ids: module.tpa_ids || [],
        order_index: module.order_index,
        duration_hours: module.duration_hours || 1,
        is_active: module.is_active,
        price_myr: module.price_myr ?? 0,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load module')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (!formData.title.trim()) {
      setError('Module title is required')
      return
    }

    try {
      await onSubmit(formData)
      setSuccess(moduleId ? 'Module updated successfully!' : 'Module created successfully!')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Operation failed')
    }
  }

  const uniqueTpas = Array.from(
    new Map(trainingTracks.map(t => [t.tpa_name, t])).values()
  )

  const selectedTpaNames = formData.tpa_ids
    .map(id => trainingTracks.find(t => t.id === id)?.tpa_name)
    .filter(Boolean) as string[]

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[#1B3A24]">
            {moduleId ? 'Edit General Module' : 'Create General Module'}
          </h2>
          <label className="flex items-center gap-2 cursor-pointer">
            <div className="relative">
              <input
                type="checkbox"
                checked={formData.is_active}
                onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                disabled={isLoading}
                className="sr-only"
              />
              <div className={`h-6 w-11 rounded-full transition-colors ${formData.is_active ? 'bg-[#8DC63F]' : 'bg-[#cbd5e1]'}`} />
              <div className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${formData.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
            </div>
            <span className="text-sm font-medium text-[#1B3A24]">
              {formData.is_active ? 'Published' : 'Draft'}
            </span>
          </label>
        </div>

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

      {/* TPA Association */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-[#1B3A24] mb-2">
            Associated TPAs <span className="text-gray-400 font-normal">(optional — empty = applies to all)</span>
          </label>
          <div className="border border-[#cbd5e1] rounded-lg bg-[#f8fafc] overflow-hidden divide-y divide-[#e2e8f0]">
            {formData.tpa_ids.length === 0 ? (
              <div className="px-4 py-2.5 text-[#64748b] text-sm">
                Universal — applies to all TPAs
              </div>
            ) : (
              formData.tpa_ids.map((tid, i) => {
                const track = trainingTracks.find(t => t.id === tid)
                return (
                  <div key={tid} className="px-4 py-2 flex items-center justify-between">
                    <span className="text-sm text-[#1B3A24]">
                      {track ? `${track.title} (${track.tpa_name})` : tid}
                    </span>
                    <button
                      type="button"
                      onClick={() => setFormData(prev => ({ ...prev, tpa_ids: prev.tpa_ids.filter((_, j) => j !== i) }))}
                      className="text-xs text-red-400 hover:text-red-600 font-medium ml-3"
                    >✕</button>
                  </div>
                )
              })
            )}
          </div>
          <p className="text-xs text-[#64748b] mt-1">
            Leave empty for universal modules. Add specific TPAs to restrict.
          </p>
        </div>

        {trainingTracks.filter(t => !formData.tpa_ids.includes(t.id)).length > 0 && (
          <div>
            <label className="block text-sm font-semibold text-[#1B3A24] mb-2">Add TPA</label>
            <ThemedSelect
              value=""
              onChange={v => { if (v) setFormData(prev => ({ ...prev, tpa_ids: [...prev.tpa_ids, v] })) }}
              disabled={isLoading}
              options={[
                { value: '', label: '— Select a training track —' },
                ...trainingTracks.filter(t => !formData.tpa_ids.includes(t.id)).map(t => ({
                  value: t.id,
                  label: `${t.title} (${t.tpa_name})`,
                })),
              ]}
            />
          </div>
        )}
      </div>

      {/* Title & Description */}
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-[#1B3A24] mb-2">
            Module Title <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={formData.title}
            onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
            placeholder="e.g., Sarawak Biodiversity Awareness"
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
            onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
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
          onChange={(content) => setFormData(prev => ({ ...prev, content }))}
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
            onChange={(e) => setFormData(prev => ({ ...prev, duration_hours: parseFloat(e.target.value) || 0 }))}
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
            onChange={(e) => setFormData(prev => ({ ...prev, order_index: parseInt(e.target.value) || 0 }))}
            min="0"
            disabled={isLoading}
            className="w-full px-4 py-2.5 border border-[#cbd5e1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D6A3F] focus:border-transparent bg-white text-[#1B3A24]"
          />
          <p className="text-xs text-[#64748b] mt-1">
            Display order in the list (0 = first)
          </p>
        </div>

        <div>
          <label className="block text-sm font-semibold text-[#1B3A24] mb-2">
            Price (RM)
          </label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-[#94a3b8] font-medium">RM</span>
            <input
              type="number"
              value={formData.price_myr}
              onChange={(e) => setFormData(prev => ({ ...prev, price_myr: parseFloat(e.target.value) || 0 }))}
              min="0"
              step="1"
              disabled={isLoading}
              className="w-full pl-12 pr-4 py-2.5 border border-[#cbd5e1] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#2D6A3F] focus:border-transparent bg-white text-[#1B3A24]"
            />
          </div>
          <p className="text-xs text-[#64748b] mt-1">
            Set to 0 for free modules
          </p>
        </div>
      </div>

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
              <><span className="animate-spin">⏳</span> Saving...</>
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
