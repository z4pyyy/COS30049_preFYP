// Example: Training Module Media Upload Component
// This is a reference implementation showing how to use the upload APIs

'use client'

import { useState } from 'react'
import { TrainingMediaUploader, UploadProgress } from '@/lib/training-media-uploader'
import { validateFile, formatFileSize, FILE_SIZE_LIMITS } from '@/lib/file-upload'

interface ModuleMediaUploaderProps {
  moduleId: string
  onUploadComplete?: (asset: any) => void
}

export function ModuleMediaUploader({ moduleId, onUploadComplete }: ModuleMediaUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleUpload = async (file: File) => {
    setError(null)
    setSuccess(null)

    // Validate file
    const validation = validateFile(file)
    if (!validation.valid) {
      setError(validation.error || 'Validation failed')
      return
    }

    setIsUploading(true)
    try {
      const uploader = new TrainingMediaUploader(moduleId, setUploadProgress)
      const asset = await uploader.uploadFile(file)
      
      setSuccess(`File "${file.name}" uploaded successfully!`)
      onUploadComplete?.(asset)
      setUploadProgress(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed'
      setError(message)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = e.dataTransfer.files
    if (files.length > 0) {
      handleUpload(files[0])
    }
  }

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files
    if (files && files.length > 0) {
      handleUpload(files[0])
    }
  }

  const getAcceptedFormats = () => {
    return '.mp4,.webm,.mov,.pdf,.jpg,.jpeg,.png,.webp,.gif'
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Upload Area */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`
          relative border-2 border-dashed rounded-lg p-8 text-center
          transition-colors cursor-pointer
          ${isDragging 
            ? 'border-[#2D6A3F] bg-[#2D6A3F]/5' 
            : 'border-[#cbd5e1]'
          }
          ${isUploading ? 'opacity-50 cursor-not-allowed' : ''}
        `}
      >
        <input
          type="file"
          onChange={handleFileInput}
          disabled={isUploading}
          accept={getAcceptedFormats()}
          className="hidden"
          id="file-input"
        />

        <label
          htmlFor="file-input"
          className={`block cursor-pointer ${isUploading ? 'cursor-not-allowed' : ''}`}
        >
          <div className="flex flex-col items-center gap-4">
            <svg
              className="w-12 h-12 text-[#2D6A3F]"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            <div>
              <p className="text-lg font-semibold text-[#1B3A24]">
                Drop your file here or click to browse
              </p>
              <p className="text-sm text-[#64748b] mt-1">
                Supported: MP4, WebM, MOV (video), PDF, JPEG, PNG (images)
              </p>
              <p className="text-xs text-[#94a3b8] mt-2">
                Max size: Videos 500MB, PDFs 50MB, Images 10MB
              </p>
            </div>
          </div>
        </label>
      </div>

      {/* Upload Progress */}
      {uploadProgress && (
        <div className="mt-6 p-4 bg-[#f0f4f8] rounded-lg">
          <p className="text-sm font-medium text-[#1B3A24] mb-2">
            {uploadProgress.fileName}
          </p>
          <div className="w-full bg-[#e2e8f0] rounded-full h-2 overflow-hidden">
            <div
              className="bg-[#2D6A3F] h-full transition-all duration-300"
              style={{ width: `${uploadProgress.progress}%` }}
            />
          </div>
          <p className="text-xs text-[#64748b] mt-2">
            {uploadProgress.progress}% •{' '}
            {formatFileSize(uploadProgress.loaded)} / {formatFileSize(uploadProgress.total)}
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Success Message */}
      {success && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-700">{success}</p>
        </div>
      )}

      {/* Size Limits Reference */}
      <div className="mt-6 p-4 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg">
        <p className="text-xs font-semibold text-[#64748b] uppercase mb-3">File Limits</p>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <p className="text-2xl font-bold text-[#2D6A3F]">500MB</p>
            <p className="text-xs text-[#64748b]">Videos</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[#2D6A3F]">50MB</p>
            <p className="text-xs text-[#64748b]">PDFs</p>
          </div>
          <div>
            <p className="text-2xl font-bold text-[#2D6A3F]">10MB</p>
            <p className="text-xs text-[#64748b]">Images</p>
          </div>
        </div>
      </div>
    </div>
  )
}