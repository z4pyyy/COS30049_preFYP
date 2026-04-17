# Training Media Upload — Setup & Implementation Guide

## Overview
This feature enables HoD users to upload training videos (MP4/WebM), PDFs, and images (JPEG/PNG/WebP) to training modules with automatic size validation.

## File Size Limits
- **Videos**: 500 MB
- **PDFs**: 50 MB
- **Images**: 10 MB

## Allowed File Types
- **Videos**: MP4, WebM, MOV (MIME: video/mp4, video/webm, video/quicktime)
- **PDFs**: PDF (MIME: application/pdf)
- **Images**: JPEG, PNG, WebP, GIF (MIME: image/*)

---

## Setup Instructions

### 1. Create Supabase Storage Bucket

In your Supabase dashboard, create a new storage bucket:

1. Go to **Storage** → **Buckets**
2. Create a new bucket named `training-media`
3. Set the bucket to **Public** (to allow public URL access)
4. Keep default settings for other options

### 2. Update Environment Variables (.env.local)

Ensure these variables are set (they should already be in your project):
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

### 3. Database Migration

Run the migration to create the `training_module_assets` table:

```bash
# In Supabase SQL Editor, run:
-- supabase/migrations/003_training_module_assets.sql
```

Or use Supabase CLI:
```bash
supabase migration up
```

---

## API Routes

### Upload File
**Route**: `POST /api/training-modules/[id]/assets/upload`

**Request**:
- Content-Type: multipart/form-data
- Field: `file` (File)

**Response** (201):
```json
{
  "asset": {
    "id": "uuid",
    "module_id": "uuid",
    "file_name": "video.mp4",
    "file_type": "video",
    "mime_type": "video/mp4",
    "file_size": 104857600,
    "storage_url": "https://...",
    "created_at": "2026-04-16T00:00:00Z"
  }
}
```

**Error Responses**:
- 400: Invalid file type or exceeds size limit
- 401: Unauthorized
- 403: Insufficient permissions (HOD+ required)
- 404: Module not found

---

### Get Module Assets
**Route**: `GET /api/training-modules/[id]/assets`

**Response** (200):
```json
{
  "assets": [
    {
      "id": "uuid",
      "module_id": "uuid",
      "file_name": "guide_training.mp4",
      "file_type": "video",
      "mime_type": "video/mp4",
      "file_size": 104857600,
      "storage_url": "https://...",
      "created_at": "2026-04-16T00:00:00Z",
      "uploaded_by": "uuid"
    }
  ]
}
```

---

### Delete Asset
**Route**: `DELETE /api/training-modules/[id]/assets?asset_id=<id>`

**Query Parameters**:
- `asset_id`: UUID of the asset to delete

**Response** (200):
```json
{
  "success": true
}
```

**Error Responses**:
- 403: Insufficient permissions (HOD+ required)
- 404: Asset not found

---

## Client-Side Usage

### Basic File Upload

```typescript
import { TrainingMediaUploader } from '@/lib/training-media-uploader'

// Initialize uploader
const uploader = new TrainingMediaUploader(
  moduleId,
  (progress) => {
    console.log(`Uploading ${progress.fileName}: ${progress.progress}%`)
  }
)

// Upload file
try {
  const asset = await uploader.uploadFile(file)
  console.log('File uploaded:', asset.storage_url)
} catch (error) {
  console.error('Upload failed:', error.message)
}
```

### Upload Multiple Files

```typescript
const files = [file1, file2, file3]
const assets = await uploader.uploadFiles(files)
```

---

## Validation Logic

The upload validation happens in two places:

### 1. Client-Side (Optional but Recommended)
```typescript
import { validateFile } from '@/lib/file-upload'

const result = validateFile(file)
if (!result.valid) {
  console.error(result.error) // "File size exceeds 500MB limit for video files."
}
```

### 2. Server-Side (Mandatory)
All uploads are validated server-side, with file type and size checks before storage upload.

---

## Storage Path Structure

Files are organized in Supabase storage as:
```
training-media/
├── {moduleId}/
│   ├── video/
│   │   └── {timestamp}_{filename}.mp4
│   ├── pdf/
│   │   └── {timestamp}_{filename}.pdf
│   └── image/
│       └── {timestamp}_{filename}.jpg
```

---

## Security Features

1. **Role-Based Access**
   - Only HOD+ can upload/delete files
   - GUIDE+ can view files from active modules
   - Non-HOD users can only view files from active modules

2. **File Type Validation**
   - MIME type checking (server-side)
   - File size limits enforced

3. **RLS Policies**
   - Database-level access control via Row-Level Security
   - Prevents unauthorized access to assets

4. **Storage Organization**
   - Files automatically organized by module and type
   - Unique file names prevent collisions

---

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Unsupported file type" | Invalid MIME type | Use supported formats (MP4, PDF, JPEG, etc.) |
| "File size exceeds limit" | File too large | Check FILE_SIZE_LIMITS in lib/file-upload.ts |
| "Profile not found" | User not properly authenticated | Ensure user is logged in and profile exists |
| "Insufficient permissions" | Not HOD role | Only HoD and Superadmin can upload |

---

## Troubleshooting

### Files not uploading to storage
- Verify `training-media` bucket exists and is public
- Check environment variables are correct
- Ensure Supabase credentials have storage permissions

### Database errors
- Run the migration (`003_training_module_assets.sql`)
- Check that auth user is created
- Verify RLS policies are enabled

### TypeScript errors
- Regenerate types: `npx supabase gen types typescript > types/supabase.ts`
- Ensure Node.js Buffer is available in your runtime

---

## Maintenance

### Cleaning Up Old Files
To delete orphaned files from storage after module deletion, consider implementing a cleanup function:

```typescript
// Delete all assets for a module
const { data: assets } = await supabase
  .from('training_module_assets')
  .select('storage_path')
  .eq('module_id', moduleId)

for (const asset of assets) {
  await supabase.storage
    .from('training-media')
    .remove([asset.storage_path])
}
```

---

## Related Files

- Database: `supabase/migrations/003_training_module_assets.sql`
- Utilities: `lib/file-upload.ts`, `lib/training-media-uploader.ts`
- API Routes:
  - `app/api/training-modules/[id]/assets/upload.ts`
  - `app/api/training-modules/[id]/assets/route.ts`