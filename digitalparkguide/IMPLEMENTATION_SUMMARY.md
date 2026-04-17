# Module Editor Implementation — File Structure & Setup

## 📁 Complete File Structure

```
digitalparkguide/
│
├── supabase/migrations/
│   ├── 001_... (existing)
│   ├── 002_training_modules.sql          ← Module table
│   └── 003_training_module_assets.sql    ← Media files table
│
├── app/api/training-modules/
│   ├── route.ts                          ← GET list, POST create
│   └── [id]/
│       ├── route.ts                      ← GET single, PUT update, DELETE
│       └── assets/
│           ├── route.ts                  ← GET assets, DELETE by ID
│           └── upload.ts                 ← POST upload
│
├── app/dashboard/hod/
│   ├── layout.tsx                        ← HoD layout with nav (NEW)
│   ├── page.tsx                          ← Applications (existing)
│   ├── modules/
│   │   ├── page.tsx                      ← Module management (NEW)
│   │   └── layout.tsx                    ← Module layout (NEW)
│   ├── tracks/
│   │   └── page.tsx                      ← Track viewer (NEW)
│   └── announcements/
│       └── page.tsx                      ← Announcements mgmt (NEW)
│
├── components/
│   ├── RichTextEditor.tsx                ← Markdown editor (NEW)
│   ├── ModuleEditorForm.tsx              ← Complete form (NEW)
│   ├── ModuleMediaUploader.tsx           ← File upload UI (NEW)
│   ├── ModuleAssetsDisplay.tsx           ← File display (NEW)
│   ├── HodNavigation.tsx                 ← HoD nav component (NEW)
│   └── ... (others)
│
├── lib/
│   ├── file-upload.ts                    ← Upload validation (NEW)
│   ├── training-media-uploader.ts        ← Client upload handler (NEW)
│   ├── supabase/
│   │   ├── client.ts
│   │   ├── server.ts
│   │   └── admin.ts
│   └── ... (others)
│
├── types/
│   └── roles.ts                          ← Role definitions (existing)
│
├── MODULE_EDITOR.md                      ← Technical guide (NEW)
├── MODULE_EDITOR_QUICK_START.md          ← User guide (NEW)
└── ... (others)
```

---

## 🔄 Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│         HoD Module Editor UI                               │
│  (ModuleEditorForm + RichTextEditor)                        │
└────────────────────┬────────────────────────────────────────┘
                     │ Form submission
                     ▼
        ┌────────────────────────────┐
        │  ModuleEditorForm.tsx      │
        │  - Validates input         │
        │  - Calls API endpoint      │
        └────────────────┬───────────┘
                         │ API call
                         ▼
        ┌────────────────────────────┐
        │  /api/training-modules/    │
        │  [id]/route.ts             │
        │  - Auth check              │
        │  - Role validation         │
        │  - DB update               │
        └────────────────┬───────────┘
                         │ Success
                         ▼
        ┌────────────────────────────┐
        │  Update UI & Show Success  │
        │  Message                   │
        └────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│         Media Upload Flow                                   │
└────────────────────┬────────────────────────────────────────┘
                     │ User selects file
                     ▼
        ┌────────────────────────────┐
        │  ModuleMediaUploader       │
        │  - Validate file           │
        │  - Show progress           │
        └────────────────┬───────────┘
                         │ FormData
                         ▼
        ┌────────────────────────────┐
        │  /api/training-modules/    │
        │  [id]/assets/upload.ts     │
        │  - Validate file           │
        │  - Upload to Supabase      │
        │  - Save to DB              │
        └────────────────┬───────────┘
                         │ Success
                         ▼
        ┌────────────────────────────┐
        │  ModuleAssetsDisplay       │
        │  - Show uploaded files     │
        │  - Allow delete            │
        └────────────────────────────┘
```

---

## 🚀 Getting Started

### 1. Run Database Migrations

```bash
# In Supabase SQL Editor, run:
-- supabase/migrations/002_training_modules.sql
-- supabase/migrations/003_training_module_assets.sql
```

### 2. Create Storage Bucket

In Supabase Dashboard:
1. Storage → New Bucket
2. Name: `training-media`
3. Access: **Public**

### 3. Start Development Server

```bash
npm run dev
```

### 4. Access Module Editor

1. Log in as HoD user
2. Navigate to: `/dashboard/hod/modules`
3. Or click "📚 Training Modules" in HoD sidebar

---

## 📋 Component Integration

### ModuleEditorForm

```tsx
import { ModuleEditorForm } from '@/components/ModuleEditorForm'

<ModuleEditorForm
  moduleId={id}              // For editing
  trainingTracks={tracks}    // For TPA selector
  onSubmit={handleSave}      // API call wrapper
  onCancel={handleCancel}    // Back button
  isLoading={loading}        // Disable while saving
/>
```

**Includes:**
- RichTextEditor component
- ModuleMediaUploader component (when editing)
- ModuleAssetsDisplay component (when editing)
- Publish/Draft toggle
- TPA selector
- All form fields

---

## 🎯 Key Features

### 1. Rich Text Editor
- Markdown formatting toolbar
- Live preview toggle
- Code block support
- Link insertion
- List formatting

### 2. TPA Management
- Auto-populated from track selection
- Non-editable field
- Ensures module belongs to correct TPA

### 3. Media Management
- Drag-drop upload
- File type & size validation
- Progress tracking
- Display uploaded files
- Delete capability
- Only for existing modules

### 4. Publish/Draft Toggle
- Quick status change
- Affects visibility to guides
- No impact on draft modules
- Can toggle anytime

### 5. Navigation
- Desktop: Left sidebar
- Mobile: Bottom navigation
- Quick access to all HoD sections

---

## 🔐 Security Layers

### Authentication
```
All routes require:
1. Signed-in user (auth.getUser())
2. Valid profile record in db
3. Role check from profiles.role
```

### Authorization
```
Create/Update/Delete:
  - Required: HOD role or higher
  - Response: 403 if insufficient

View:
  - Published modules: GUIDE+ can see
  - Draft modules: HOD only
  - All modules: SUPERADMIN can see
```

### Media Upload
```
1. File type validation (MIME check)
2. File size limits enforced
3. Organized storage paths
4. Database metadata tracking
5. RLS policies on assets table
```

---

## 📊 API Endpoints Summary

| Method | Endpoint | Permission | Description |
|--------|----------|-----------|-------------|
| GET | `/api/training-modules` | GUIDE+ | List modules |
| POST | `/api/training-modules` | HOD+ | Create module |
| GET | `/api/training-modules/[id]` | GUIDE+ | Get single module |
| PUT | `/api/training-modules/[id]` | HOD+ | Update module |
| DELETE | `/api/training-modules/[id]` | HOD+ | Delete module |
| POST | `/api/training-modules/[id]/assets/upload` | HOD+ | Upload file |
| GET | `/api/training-modules/[id]/assets` | GUIDE+ | List assets |
| DELETE | `/api/training-modules/[id]/assets` | HOD+ | Delete asset |

---

## 📱 Responsive Breakpoints

```
Mobile (<768px):
  - Full-width editor
  - Bottom navigation
  - Stacked form fields
  - Compact toolbar

Tablet (768px-1024px):
  - Side-by-side where possible
  - Sidebar on small tablets
  - Bottom nav on mobile sizes

Desktop (>1024px):
  - Fixed left sidebar
  - Full-width content area
  - Full toolbar visible
  - Drag-drop enabled
```

---

## 🧪 Testing Checklist

- [ ] Create new module (all fields)
- [ ] Edit existing module
- [ ] Change publish status
- [ ] Upload video file
- [ ] Upload PDF file
- [ ] Upload image file
- [ ] Delete module
- [ ] Delete asset
- [ ] Test as GUIDE user (403 on create)
- [ ] Test as PUBLIC_USER (403 on create)
- [ ] Test markdown formatting
- [ ] Test preview toggle
- [ ] Test on mobile device
- [ ] Test media upload on mobile
- [ ] Verify storage paths created
- [ ] Verify DB records created

---

## 🐛 Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| Module not showing after create | Verify is_active = true |
| Cannot upload media | Save module first, then edit |
| File upload fails | Check file size & format |
| 403 error on create | Verify user has HOD role |
| Editor not loading | Check browser console for errors |
| Markdown not rendering | Use correct syntax, see reference |
| Mobile nav not working | Check viewport/breakpoint |

---

## 📚 Documentation Index

- [Module Editor Guide](MODULE_EDITOR.md) - Technical details
- [Quick Start](MODULE_EDITOR_QUICK_START.md) - User guide
- [API Reference](API_REFERENCE.md) - Endpoint docs
- [File Upload Guide](TRAINING_MEDIA_UPLOAD.md) - Media details
- [Project Architecture](CLAUDE.md) - Overall structure

---

## 🎓 Next Steps

1. ✅ Create training modules through UI
2. ✅ Upload related media files
3. ⏳ Build guide dashboard to display modules
4. ⏳ Create module progress tracking
5. ⏳ Add quiz/assessment system
6. ⏳ Implement certification workflow

---

## 💾 Database Schema Reference

### training_modules

```sql
CREATE TABLE public.training_modules (
  id UUID PRIMARY KEY,
  track_id UUID REFERENCES training_tracks(id),
  title TEXT NOT NULL,
  description TEXT,
  content TEXT,
  order_index INT,
  duration_hours DECIMAL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### training_module_assets

```sql
CREATE TABLE public.training_module_assets (
  id UUID PRIMARY KEY,
  module_id UUID REFERENCES training_modules(id),
  file_name TEXT NOT NULL,
  file_type TEXT,           -- 'video'|'pdf'|'image'
  mime_type TEXT,
  file_size INT,
  storage_path TEXT UNIQUE,
  storage_url TEXT,
  duration_seconds INT,
  uploaded_by UUID,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

---

## 🔗 File References

**Components:**
- [RichTextEditor.tsx](components/RichTextEditor.tsx)
- [ModuleEditorForm.tsx](components/ModuleEditorForm.tsx)
- [ModuleMediaUploader.tsx](components/ModuleMediaUploader.tsx)
- [ModuleAssetsDisplay.tsx](components/ModuleAssetsDisplay.tsx)
- [HodNavigation.tsx](components/HodNavigation.tsx)

**Pages:**
- [HoD Modules](app/dashboard/hod/modules/page.tsx)
- [HoD Layout](app/dashboard/hod/layout.tsx)
- [Tracks](app/dashboard/hod/tracks/page.tsx)
- [Announcements](app/dashboard/hod/announcements/page.tsx)

**Utilities:**
- [file-upload.ts](lib/file-upload.ts)
- [training-media-uploader.ts](lib/training-media-uploader.ts)

**API:**
- [/api/training-modules/route.ts](app/api/training-modules/route.ts)
- [/api/training-modules/[id]/route.ts](app/api/training-modules/[id]/route.ts)
- [/api/training-modules/[id]/assets/upload.ts](app/api/training-modules/[id]/assets/upload.ts)
- [/api/training-modules/[id]/assets/route.ts](app/api/training-modules/[id]/assets/route.ts)