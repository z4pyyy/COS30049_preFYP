// Example: Training Module Assets Display Component
// This shows how to display and delete uploaded files

'use client'

import { useEffect, useState } from 'react'
import { formatFileSize } from '@/lib/file-upload'

interface Asset {
  id: string
  file_name: string
  file_type: 'video' | 'pdf' | 'image'
  mime_type: string
  file_size: number
  storage_url: string
  created_at: string
  uploaded_by?: string
}

interface ModuleAssetsDisplayProps {
  moduleId: string
  canDelete?: boolean
  onAssetDeleted?: (assetId: string) => void
}

export function ModuleAssetsDisplay({
  moduleId,
  canDelete = false,
  onAssetDeleted,
}: ModuleAssetsDisplayProps) {
  const [assets, setAssets] = useState<Asset[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  useEffect(() => {
    fetchAssets()
  }, [moduleId])

  const fetchAssets = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/training-modules/${moduleId}/assets`)
      
      if (!response.ok) {
        throw new Error('Failed to fetch assets')
      }

      const data = await response.json()
      setAssets(data.assets || [])
      setError(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to load assets'
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteAsset = async (assetId: string) => {
    if (!confirm('Are you sure you want to delete this file?')) {
      return
    }

    setDeleting(assetId)
    try {
      const response = await fetch(
        `/api/training-modules/${moduleId}/assets?asset_id=${assetId}`,
        { method: 'DELETE' }
      )

      if (!response.ok) {
        throw new Error('Failed to delete asset')
      }

      setAssets((prev) => prev.filter((a) => a.id !== assetId))
      onAssetDeleted?.(assetId)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to delete asset'
      alert(`Error: ${message}`)
    } finally {
      setDeleting(null)
    }
  }

  const getFileIcon = (fileType: string) => {
    switch (fileType) {
      case 'video':
        return '🎥'
      case 'pdf':
        return '📄'
      case 'image':
        return '🖼️'
      default:
        return '📎'
    }
  }

  const getFileTypeBadgeColor = (fileType: string) => {
    switch (fileType) {
      case 'video':
        return 'bg-blue-100 text-blue-800'
      case 'pdf':
        return 'bg-red-100 text-red-800'
      case 'image':
        return 'bg-green-100 text-green-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin">⏳</div>
        <span className="ml-2 text-[#64748b]">Loading assets...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
        <p className="text-sm text-red-700">{error}</p>
        <button
          onClick={fetchAssets}
          className="mt-2 text-sm text-red-600 hover:text-red-700 font-medium"
        >
          Retry
        </button>
      </div>
    )
  }

  if (assets.length === 0) {
    return (
      <div className="p-8 text-center border border-dashed border-[#cbd5e1] rounded-lg">
        <p className="text-[#64748b]">No files uploaded yet</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-[#1B3A24]">Uploaded Files ({assets.length})</h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {assets.map((asset) => (
          <div
            key={asset.id}
            className="flex items-start gap-4 p-4 border border-[#e2e8f0] rounded-lg hover:bg-[#f8fafc] transition-colors"
          >
            {/* File Icon */}
            <div className="text-3xl">{getFileIcon(asset.file_type)}</div>

            {/* File Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <a
                    href={asset.storage_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-medium text-[#2D6A3F] hover:underline truncate block"
                  >
                    {asset.file_name}
                  </a>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-1 rounded font-medium ${getFileTypeBadgeColor(asset.file_type)}`}>
                      {asset.file_type.toUpperCase()}
                    </span>
                    <span className="text-xs text-[#64748b]">
                      {formatFileSize(asset.file_size)}
                    </span>
                  </div>
                </div>

                {/* Delete Button */}
                {canDelete && (
                  <button
                    onClick={() => handleDeleteAsset(asset.id)}
                    disabled={deleting === asset.id}
                    className="flex-shrink-0 p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                    title="Delete file"
                  >
                    {deleting === asset.id ? '⏳' : '🗑️'}
                  </button>
                )}
              </div>

              {/* Timestamp */}
              <p className="text-xs text-[#94a3b8] mt-2">
                {new Date(asset.created_at).toLocaleDateString()} •{' '}
                {new Date(asset.created_at).toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}