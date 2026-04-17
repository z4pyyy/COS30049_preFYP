# HoD Module Editor — Complete Implementation Guide

## Overview

The HoD (Head of Department) Module Editor is a comprehensive UI for managing training modules with:
- ✓ Rich text editor with markdown support and live preview
- ✓ TPA (Totally Protected Area) selector linked to training tracks
- ✓ Media file attachment management (videos, PDFs, images)
- ✓ Publish/Draft toggle for module status
- ✓ Module ordering and estimated duration
- ✓ Full CRUD operations with authentication

---

## File Structure

```
app/dashboard/hod/
├── layout.tsx                    # HoD section layout with navigation
├── modules/
│   ├── page.tsx                  # Module management list & editor
│   └── layout.tsx                # Module section layout
├── tracks/
│   └── page.tsx                  # Training tracks management
└── announcements/
    └── page.tsx                  # Platform announcements

components/
├── RichTextEditor.tsx            # Rich text editor with markdown
├── ModuleEditorForm.tsx          # Complete module editor form
├── ModuleMediaUploader.tsx       # File upload component
├── ModuleAssetsDisplay.tsx       # Display uploaded files
└── HodNavigation.tsx             # HoD sidebar & mobile nav
```

---

## Components

### 1. **RichTextEditor**
Rich text editor with markdown support.

```tsx
import { RichTextEditor } from '@/components/RichTextEditor'

<RichTextEditor
  value={content}
  onChange={setContent}
  placeholder="Enter module content..."
  minHeight="min-h-80"
/>
```

**Features:**
- Toolbar with formatting buttons: Bold, Italic, Headings, Lists, Code
- Live markdown preview toggle
- Tab support for indentation
- Markdown-to-HTML preview rendering

### 2. **ModuleEditorForm**
Complete form for creating/editing modules.

```tsx
import { ModuleEditorForm } from '@/components/ModuleEditorForm'

<ModuleEditorForm
  moduleId={moduleId}
  trackId={trackId}
  tpaName={tpaName}
  trainingTracks={tracks}
  onSubmit={handleSubmit}
  onCancel={handleCancel}
  isLoading={isLoading}
/>
```

**Features:**
- TPA selector (auto-populated from track selection)
- Title and description fields
- Rich text content editor
- Duration and order settings
- Publish/Draft toggle
- Media management section (for existing modules)

### 3. **ModuleMediaUploader**
Drag-and-drop file upload component.

```tsx
import { ModuleMediaUploader } from '@/components/ModuleMediaUploader'

<ModuleMediaUploader
  moduleId={moduleId}
  onUploadComplete={(asset) => console.log('Uploaded:', asset)}
/>
```

### 4. **ModuleAssetsDisplay**
Display and manage uploaded files.

```tsx
import { ModuleAssetsDisplay } from '@/components/ModuleAssetsDisplay'

<ModuleAssetsDisplay
  moduleId={moduleId}
  canDelete={true}
  onAssetDeleted={() => console.log('Asset deleted')}
/>
```

### 5. **HodNavigation**
Navigation sidebar and mobile nav for HoD dashboard.

```tsx
import { HodSidebar, HodMobileNav } from '@/components/HodNavigation'

// Desktop sidebar
<HodSidebar />

// Mobile bottom nav
<HodMobileNav />
```

---

## Pages

### Module Management (`/dashboard/hod/modules`)

**Operations:**

1. **List View** (default)
   - Displays all modules in a table
   - Shows title, status, creation date
   - Edit/Delete actions
   - Create new module button

2. **Create View** (`?action=new`)
   - Empty module editor form
   - After saving, redirects to edit view

3. **Edit View** (`?action=edit&id=<moduleId>`)
   - Pre-filled form with module data
   - Media management section (upload/delete files)
   - Update and cancel actions

### Training Tracks (`/dashboard/hod/tracks`)

Display all available training tracks with details:
- Track title
- TPA name
- Duration
- Status (open/closed)

### Announcements (`/dashboard/hod/announcements`)

Create and manage platform announcements:
- Quick create form
- List of announcements with status
- Category filter support

---

## API Integration

### Create Module

```typescript
POST /api/training-modules
Content-Type: application/json

{
  "track_id": "uuid",
  "title": "Module Title",
  "description": "Short description",
  "content": "Module content with **markdown**",
  "order_index": 0,
  "duration_hours": 2.5,
  "is_active": true
}
```

### Update Module

```typescript
PUT /api/training-modules/{moduleId}
Content-Type: application/json

{
  "title": "Updated Title",
  "description": "Updated",
  "content": "Updated content",
  "is_active": true,
  ...
}
```

### Delete Module

```typescript
DELETE /api/training-modules/{moduleId}
```

### Upload Media

```typescript
POST /api/training-modules/{moduleId}/assets/upload
Content-Type: multipart/form-data

file: <File>
```

### List Assets

```typescript
GET /api/training-modules/{moduleId}/assets
```

### Delete Asset

```typescript
DELETE /api/training-modules/{moduleId}/assets?asset_id={assetId}
```

---

## Rich Text Formatting

The RichTextEditor supports markdown syntax:

```markdown
# Heading 1
## Heading 2
### Heading 3

**Bold text**
*Italic text*
<u>Underlined text</u>

- Bullet item 1
- Bullet item 2

1. Numbered item
2. Another item

[Link text](https://example.com)

```
Code block
```

**Bold** and *italic* can be combined
```

When clicking "Preview", markdown is rendered to HTML with proper styling.

---

## Publish/Draft Toggle

The module status is controlled by the toggle in the top-right of the editor:

- **Published** (✓): Module is visible to guides and active for learning
- **Draft** (⊝): Module is only visible to HoD for editing

Status can be changed at any time. Guides can only see published modules.

---

## Module Ordering

Set `order_index` to control display order within a training track:

- `0` = First module
- `1` = Second module
- etc.

Modules with the same index are ordered by creation date.

---

## Using the Module Editor

### Create a New Module

1. Navigate to `/dashboard/hod/modules`
2. Click "✨ Create New Module"
3. Select a training track (TPA is auto-populated)
4. Enter title and description
5. Write content in the rich text editor
6. Set estimated duration and order
7. Click "✨ Create Module"
8. After saving, you can add media files

### Edit an Existing Module

1. Click "✎ Edit" on any module in the list
2. Modify any field
3. To manage media:
   - Click "➕ Manage Assets"
   - Upload files or delete existing ones
   - Only available after initial save
4. Click "💾 Update Module" to save changes

### Upload Media

1. In edit view, click "➕ Manage Assets"
2. Drag files or click to browse
3. Supported formats:
   - Videos: MP4, WebM (max 500MB)
   - PDFs: PDF files (max 50MB)
   - Images: JPEG, PNG, WebP (max 10MB)

### Delete a Module

1. In the modules list, click "🗑️ Delete" on any module
2. Confirm the deletion
3. Module and all associated media are permanently removed

---

## Form Validation

The form validates:

- ✓ Track selection is required
- ✓ Module title is required (max length: 255)
- ✓ Description is limited to 200 characters
- ✓ Duration is positive number
- ✓ Order index is non-negative integer

Validation errors are displayed in a red alert box.

---

## Responsive Design

- **Desktop**: Sidebar navigation + full editor width
- **Tablet**: Stacked layout with sidebar
- **Mobile**: Bottom navigation + full-width editor

Media uploads work on all devices with drop zone shown on larger screens.

---

## Security

- **Authentication**: All routes require logged-in user
- **Authorization**: Only HoD+ can create/edit/delete modules
- **Role Check**: Performed on both client and server
- **CSRF**: Protected by Supabase session management

---

## Styling

All components use Tailwind CSS with project design tokens:

- **Primary Green**: `#2D6A3F` (hover/active states)
- **Dark Green**: `#1B3A24` (headings, text)
- **Lime Green**: `#8DC63F` (success, published status)
- **Amber**: `#F0A500` (draft, warning)
- **Neutral Gray**: `#64748b`, `#94a3b8`, `#cbd5e1`

---

## Keyboard Shortcuts (in Rich Text Editor)

- **Tab** → Indent
- **Preview Button** → Toggle markdown preview
- **Toolbar Buttons** → Apply formatting

---

## Error Handling

Common errors and solutions:

| Error | Cause | Solution |
|-------|-------|----------|
| "Track not found" | Invalid track_id | Select valid track from dropdown |
| "Unauthorized" | Not logged in | Log in to HoD account |
| "Insufficient permissions" | Not HoD role | Contact administrator |
| "Module not found" | moduleId expired | Refresh page and try again |
| "File size exceeds limit" | File too large | Compress or use smaller file |

---

## Feature Roadmap

Future enhancements:
- [ ] Batch upload multiple files
- [ ] Module template library
- [ ] Auto-save drafts
- [ ] Module versioning/history
- [ ] Peer review workflow
- [ ] Module rating by guides
- [ ] Analytics on module engagement

---

## Related Documentation

- [Training Module API](/app/api/training-modules/route.ts)
- [File Upload Guide](TRAINING_MEDIA_UPLOAD.md)
- [API Reference](API_REFERENCE.md)
- [Project Architecture](CLAUDE.md)