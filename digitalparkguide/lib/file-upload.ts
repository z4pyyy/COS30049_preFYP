// File upload validation and utilities

// File size limits (in bytes)
export const FILE_SIZE_LIMITS = {
  video: 500 * 1024 * 1024,    // 500 MB
  pdf: 50 * 1024 * 1024,       // 50 MB
  image: 10 * 1024 * 1024,     // 10 MB
}

// Allowed MIME types
export const ALLOWED_MIME_TYPES = {
  video: ['video/mp4', 'video/webm', 'video/quicktime'],
  pdf: ['application/pdf'],
  image: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'],
}

// Map MIME type to file type
const MIME_TO_FILE_TYPE: Record<string, 'video' | 'pdf' | 'image'> = {
  'video/mp4': 'video',
  'video/webm': 'video',
  'video/quicktime': 'video',
  'application/pdf': 'pdf',
  'image/jpeg': 'image',
  'image/png': 'image',
  'image/webp': 'image',
  'image/gif': 'image',
}

export interface FileValidationResult {
  valid: boolean
  error?: string
  fileType?: 'video' | 'pdf' | 'image'
}

/**
 * Validates file before upload
 * @param file The file to validate
 * @returns Validation result with file type if valid
 */
export function validateFile(file: File): FileValidationResult {
  const mimeType = file.type
  const fileSize = file.size

  // Check if MIME type is allowed
  if (!MIME_TO_FILE_TYPE[mimeType]) {
    return {
      valid: false,
      error: `Unsupported file type: ${mimeType}. Allowed types: MP4/WebM (video), PDF, and JPEG/PNG/WebP (images).`,
    }
  }

  const fileType = MIME_TO_FILE_TYPE[mimeType]

  // Check file size limit
  const limit = FILE_SIZE_LIMITS[fileType]
  if (fileSize > limit) {
    const limitMB = Math.round(limit / (1024 * 1024))
    return {
      valid: false,
      error: `File size exceeds ${limitMB}MB limit for ${fileType} files.`,
    }
  }

  return { valid: true, fileType }
}

/**
 * Generates a unique storage path for the file
 * @param moduleId Training module ID
 * @param fileType Type of file
 * @param fileName Original file name
 * @returns Storage path
 */
export function generateStoragePath(
  moduleId: string,
  fileType: 'video' | 'pdf' | 'image',
  fileName: string
): string {
  const timestamp = Date.now()
  const sanitizedName = fileName
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '_')
    .slice(0, 50)
  
  return `training-modules/${moduleId}/${fileType}/${timestamp}_${sanitizedName}`
}

/**
 * Extracts file extension from mime type
 */
export function getFileExtension(mimeType: string): string {
  const extensions: Record<string, string> = {
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/quicktime': 'mov',
    'application/pdf': 'pdf',
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'image/gif': 'gif',
  }
  return extensions[mimeType] || 'bin'
}

/**
 * Formats bytes to human-readable size
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}