# Training Media Upload API — Quick Reference

## 🚀 Getting Started

### Prerequisites
1. Run database migration: `supabase/migrations/003_training_module_assets.sql`
2. Create Supabase storage bucket named `training-media` (public access)
3. User must have HOD role or higher

---

## 📤 Upload File

### Endpoint
```
POST /api/training-modules/{moduleId}/assets/upload
```

### Request
```typescript
const formData = new FormData()
formData.append('file', file) // File object

const response = await fetch(
  `/api/training-modules/${moduleId}/assets/upload`,
  {
    method: 'POST',
    body: formData,
    // Don't set Content-Type header - browser will set it with boundary
  }
)
```

### Success Response (201)
```json
{
  "asset": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "module_id": "550e8400-e29b-41d4-a716-446655440001",
    "file_name": "guide_training.mp4",
    "file_type": "video",
    "mime_type": "video/mp4",
    "file_size": 104857600,
    "storage_url": "https://your-project.supabase.co/storage/v1/object/public/training-media/...",
    "created_at": "2026-04-16T10:30:00.000Z"
  }
}
```

### Error Responses

**400 - Invalid File**
```json
{
  "error": "File size exceeds 500MB limit for video files."
}
```

**401 - Unauthorized**
```json
{
  "error": "Unauthorized"
}
```

**403 - Insufficient Permissions**
```json
{
  "error": "Insufficient permissions. HOD role required."
}
```

**404 - Module Not Found**
```json
{
  "error": "Training module not found"
}
```

---

## 📋 Get Module Assets

### Endpoint
```
GET /api/training-modules/{moduleId}/assets
```

### Request
```typescript
const response = await fetch(`/api/training-modules/${moduleId}/assets`)
const data = await response.json()
```

### Response (200)
```json
{
  "assets": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "module_id": "550e8400-e29b-41d4-a716-446655440001",
      "file_name": "guide_training.mp4",
      "file_type": "video",
      "mime_type": "video/mp4",
      "file_size": 104857600,
      "storage_path": "training-modules/.../guide_training.mp4",
      "storage_url": "https://...",
      "duration_seconds": null,
      "uploaded_by": "550e8400-e29b-41d4-a716-446655440002",
      "created_at": "2026-04-16T10:30:00.000Z",
      "updated_at": "2026-04-16T10:30:00.000Z"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440003",
      "module_id": "550e8400-e29b-41d4-a716-446655440001",
      "file_name": "biodiversity_guide.pdf",
      "file_type": "pdf",
      "mime_type": "application/pdf",
      "file_size": 5242880,
      "storage_path": "training-modules/.../biodiversity_guide.pdf",
      "storage_url": "https://...",
      "duration_seconds": null,
      "uploaded_by": "550e8400-e29b-41d4-a716-446655440002",
      "created_at": "2026-04-16T11:00:00.000Z",
      "updated_at": "2026-04-16T11:00:00.000Z"
    }
  ]
}
```

### Query Parameters
- None (all assets for module are returned)

### Access Control
- **GUIDE+**: Can view assets from active modules
- **HOD+**: Can view all assets regardless of module status

---

## 🗑️ Delete Asset

### Endpoint
```
DELETE /api/training-modules/{moduleId}/assets?asset_id={assetId}
```

### Request
```typescript
const response = await fetch(
  `/api/training-modules/${moduleId}/assets?asset_id=${assetId}`,
  { method: 'DELETE' }
)
```

### Success Response (200)
```json
{
  "success": true
}
```

### Error Responses

**400 - Missing Parameter**
```json
{
  "error": "asset_id query parameter required"
}
```

**403 - Insufficient Permissions**
```json
{
  "error": "Insufficient permissions. HOD role required."
}
```

**404 - Asset Not Found**
```json
{
  "error": "Asset not found"
}
```

---

## 📝 Supported Files

### Videos
- **MIME Types**: `video/mp4`, `video/webm`, `video/quicktime`
- **Extensions**: .mp4, .webm, .mov
- **Max Size**: 500 MB

### PDFs
- **MIME Types**: `application/pdf`
- **Extensions**: .pdf
- **Max Size**: 50 MB

### Images
- **MIME Types**: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
- **Extensions**: .jpg, .jpeg, .png, .webp, .gif
- **Max Size**: 10 MB

---

## 🔧 Using the Client Utility

### Initialize Uploader
```typescript
import { TrainingMediaUploader } from '@/lib/training-media-uploader'

const moduleId = 'your-module-id'

const uploader = new TrainingMediaUploader(
  moduleId,
  (progress) => {
    console.log(`${progress.fileName}: ${progress.progress}%`)
  }
)
```

### Single File Upload
```typescript
try {
  const asset = await uploader.uploadFile(file)
  console.log('File uploaded:', asset.storage_url)
} catch (error) {
  console.error('Upload failed:', error.message)
}
```

### Multiple Files
```typescript
try {
  const assets = await uploader.uploadFiles([file1, file2, file3])
  console.log('All files uploaded:', assets)
} catch (error) {
  console.error('Upload failed:', error.message)
}
```

### Client-Side Validation
```typescript
import { validateFile } from '@/lib/file-upload'

const result = validateFile(file)
if (!result.valid) {
  console.error(result.error)
  return
}

// File is valid, proceed with upload
```

---

## 🔐 Security Features

1. **Authentication Required**
   - All routes require authenticated user

2. **Role-Based Access**
   - Upload/Delete: HOD+ only
   - View: GUIDE+ (active modules) / HOD+ (all modules)

3. **File Validation**
   - MIME type checking (server-side)
   - File size limits enforced
   - File name sanitization

4. **Database Access Control**
   - RLS policies on `training_module_assets` table
   - Module-level access checks

---

## 🐛 Troubleshooting

| Issue | Solution |
|-------|----------|
| "File size exceeds limit" | Check file size against limits above |
| "Unsupported file type" | Ensure MIME type is in supported list |
| "Profile not found" | Ensure user is logged in |
| "Insufficient permissions" | User must be HOD or Superadmin |
| 404 on module | Verify moduleId is correct and exists |
| Storage upload fails | Check `training-media` bucket exists and is public |

---

## 📂 Storage Organization

Files stored in Supabase as:
```
training-media/
  {moduleId}/
    video/
      {timestamp}_{filename}.mp4
    pdf/
      {timestamp}_{filename}.pdf
    image/
      {timestamp}_{filename}.jpg
```

---

## 🔗 Related Files
- Migrations: `supabase/migrations/003_training_module_assets.sql`
- Utilities: `lib/file-upload.ts`, `lib/training-media-uploader.ts`
- Components: `components/ModuleMediaUploader.tsx`, `components/ModuleAssetsDisplay.tsx`
- Full Docs: `TRAINING_MEDIA_UPLOAD.md`