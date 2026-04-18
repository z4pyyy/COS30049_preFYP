# Training Media Upload — Setup Checklist ✓

Complete these steps to enable training media upload functionality.

## Phase 1: Database Setup

- [ ] **Run Migration**
  - Open Supabase SQL Editor
  - Copy contents of `supabase/migrations/003_training_module_assets.sql`
  - Click "Run"
  - Verify no errors
  
- [ ] **Verify Table Created**
  - Go to Supabase → Tables
  - Confirm `training_module_assets` table exists
  - Check columns: `id`, `module_id`, `file_name`, `file_type`, `mime_type`, `file_size`, `storage_path`, `storage_url`, `uploaded_by`, `created_at`, `updated_at`

## Phase 2: Supabase Storage Setup

- [ ] **Create Storage Bucket**
  - Go to Supabase → Storage
  - Click "New Bucket"
  - Name: `training-media` (exactly this)
  - Access: **Public**
  - Click "Create Bucket"

- [ ] **Verify Bucket**
  - Refresh page
  - Confirm `training-media` bucket appears in list
  - Click bucket → verify it's set to public

## Phase 3: Application Setup

- [ ] **Verify Environment Variables**
  - Check `.env.local` for:
    ```
    NEXT_PUBLIC_SUPABASE_URL=...
    NEXT_PUBLIC_SUPABASE_ANON_KEY=...
    ```
  - Both should be non-empty

- [ ] **Start Dev Server**
  - Terminal: `npm run dev`
  - Wait for "Ready in X.Xs"
  - Access http://localhost:3000

- [ ] **Verify API Routes**
  - Routes should be at:
    ```
    POST   /api/training-modules/[id]/assets/upload
    GET    /api/training-modules/[id]/assets
    DELETE /api/training-modules/[id]/assets
    ```
  - Check `.next/dev/types/validator.ts` for no TypeScript errors

## Phase 4: Testing

### Test Upload with cURL
```bash
# Get a module ID first, then:
curl -X POST http://localhost:3000/api/training-modules/{moduleId}/assets/upload \
  -H "Authorization: Bearer {user-token}" \
  -F "file=@/path/to/video.mp4"
```

### Test with Component
- [ ] Import `ModuleMediaUploader` component:
  ```typescript
  import { ModuleMediaUploader } from '@/components/ModuleMediaUploader'
  ```

- [ ] Add to page:
  ```tsx
  <ModuleMediaUploader 
    moduleId="your-module-id"
    onUploadComplete={(asset) => console.log(asset)}
  />
  ```

- [ ] Try uploading a file:
  - Click or drag file
  - Watch progress bar
  - Verify success message

## Phase 5: Permissions Testing

- [ ] **Test with HOD User**
  - Login as HOD
  - Upload should work ✓

- [ ] **Test with GUIDE User**
  - Login as GUIDE
  - Upload should show "Insufficient permissions" ✓
  - View should work ✓

- [ ] **Test with PUBLIC_USER**
  - Login as PUBLIC_USER
  - Everything should show 403 ✓

## Phase 6: Asset Management

- [ ] **Test Listing Assets**
  ```typescript
  const response = await fetch(`/api/training-modules/${moduleId}/assets`)
  const { assets } = await response.json()
  console.log(assets) // Should show uploaded files
  ```

- [ ] **Test Deleting Asset**
  ```typescript
  const response = await fetch(
    `/api/training-modules/${moduleId}/assets?asset_id=${assetId}`,
    { method: 'DELETE' }
  )
  ```

- [ ] **Verify Files in Storage**
  - Supabase → Storage → `training-media`
  - Should see folder structure:
    ```
    {moduleId}/
      video/
        1713...video.mp4
      pdf/
        1713...guide.pdf
    ```

## Phase 7: UI Integration

- [ ] **Add Upload UI to Module Editor**
  - Import `ModuleMediaUploader` 
  - Add to training module create/edit page

- [ ] **Add Assets Display**
  - Import `ModuleAssetsDisplay`
  - Show uploaded files with preview
  - Allow delete for HOD

## Phase 8: Documentation

- [ ] **Review Documentation**
  - Read `TRAINING_MEDIA_UPLOAD.md` for complete guide
  - Read `API_REFERENCE.md` for API details
  - Check `components/ModuleMediaUploader.tsx` for example code

- [ ] **Update Project Docs**
  - Add to `CLAUDE.md` or main README
  - Document file types and limits
  - Link to setup guide

## Troubleshooting

| Issue | Checklist |
|-------|-----------|
| "File size exceeds limit" | Verify size against FILE_SIZE_LIMITS in `lib/file-upload.ts` |
| 403 on upload | Ensure user has HOD role: `SELECT role FROM profiles WHERE id = user_id;` |
| "Bucket does not exist" | Verify bucket name is exactly `training-media` (lowercase) |
| Storage URL is null | Check bucket is set to Public access |
| TypeScript errors | Run `npx tsc --noEmit` to verify compilation |
| 404 on module | Verify moduleId is valid UUID in database |

## Verification Checklist

- [ ] Database table created with correct schema
- [ ] Supabase storage bucket `training-media` is public
- [ ] Environment variables are set correctly
- [ ] TypeScript compiles without errors
- [ ] API routes respond correctly (200/201/403 as expected)
- [ ] Files are uploaded to storage
- [ ] Files are recorded in database
- [ ] Role-based access control works
- [ ] UI components display correctly
- [ ] Delete functionality works
- [ ] Documentation is accessible

## Quick Test Script

Save as `test-upload.sh` and run:
```bash
#!/bin/bash

REPO_ROOT="C:\Users\ziyang\Herd\COS30049_preFYP\digitalparkguide"
cd "$REPO_ROOT"

echo "✓ Checking TypeScript..."
npx tsc --noEmit || exit 1

echo "✓ Checking files exist..."
test -f supabase/migrations/003_training_module_assets.sql || exit 1
test -f lib/file-upload.ts || exit 1
test -f app/api/training-modules/[id]/assets/upload.ts || exit 1

echo "✓ All setup verified!"
```

## Next Steps

After completing setup:
1. Integrate upload UI into training module page
2. Add video player component for viewing uploaded videos
3. Implement asset preview/thumbnail generation
4. Add batch upload capability
5. Set up cleanup job for orphaned files