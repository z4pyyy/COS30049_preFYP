// Client-side utility for file uploads to training modules

import { formatFileSize } from '@/lib/file-upload'

export interface UploadProgress {
  progress: number
  loaded: number
  total: number
  fileName: string
}

export class TrainingMediaUploader {
  private moduleId: string
  private onProgress?: (progress: UploadProgress) => void

  constructor(moduleId: string, onProgress?: (progress: UploadProgress) => void) {
    this.moduleId = moduleId
    this.onProgress = onProgress
  }

  /**
   * Upload a file to a training module
   * @param file The file to upload
   * @returns Asset data with storage URL
   */
  async uploadFile(file: File): Promise<{
    id: string
    module_id: string
    file_name: string
    file_type: 'video' | 'pdf' | 'image'
    mime_type: string
    file_size: number
    storage_url: string
    created_at: string
  }> {
    const formData = new FormData()
    formData.append('file', file)

    const xhr = new XMLHttpRequest()

    // Track upload progress
    return new Promise((resolve, reject) => {
      xhr.upload.addEventListener('progress', (event) => {
        if (event.lengthComputable) {
          const progress = Math.round((event.loaded / event.total) * 100)
          this.onProgress?.({
            progress,
            loaded: event.loaded,
            total: event.total,
            fileName: file.name,
          })
        }
      })

      xhr.addEventListener('load', () => {
        if (xhr.status >= 200 && xhr.status < 300) {
          try {
            const response = JSON.parse(xhr.responseText)
            resolve(response.asset)
          } catch {
            reject(new Error('Invalid response format'))
          }
        } else {
          try {
            const error = JSON.parse(xhr.responseText)
            reject(new Error(error.error || 'Upload failed'))
          } catch {
            reject(new Error(`Upload failed with status ${xhr.status}`))
          }
        }
      })

      xhr.addEventListener('error', () => {
        reject(new Error('Network error during upload'))
      })

      xhr.addEventListener('abort', () => {
        reject(new Error('Upload cancelled'))
      })

      xhr.open('POST', `/api/training-modules/${this.moduleId}/assets/upload`)
      xhr.send(formData)
    })
  }

  /**
   * Upload multiple files
   */
  async uploadFiles(files: File[]): Promise<Array<{
    id: string
    module_id: string
    file_name: string
    file_type: 'video' | 'pdf' | 'image'
    mime_type: string
    file_size: number
    storage_url: string
    created_at: string
  }>> {
    const results = []
    for (const file of files) {
      const result = await this.uploadFile(file)
      results.push(result)
    }
    return results
  }
}

/**
 * Format file information for display
 */
export function formatAssetInfo(asset: any): string {
  const size = formatFileSize(asset.file_size)
  return `${asset.file_name} (${size})`
}