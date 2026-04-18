# HoD Module Editor — Quick Start Guide

## 🚀 Getting Started

### Access the Module Editor

1. Log in as HOD user
2. Navigate to Dashboard → Training Modules
3. URL: `/dashboard/hod/modules`

### Create Your First Module

```
1. Click "✨ Create New Module"
2. Select Training Track → TPA auto-fills
3. Enter Title: "Introduction to Park Biodiversity"
4. Enter Description: "Learn about local flora and fauna"
5. Write Content using rich text editor
6. Set Duration: 2 hours
7. Set Order: 0 (first in track)
8. Toggle Status: Published ✓
9. Click "✨ Create Module"
```

### Add Media Files

After creating the module:

```
1. Click "✎ Edit" on the module
2. Click "➕ Manage Assets"
3. Drag/drop or click to upload:
   - Training video (MP4/WebM, max 500MB)
   - Guide PDF (max 50MB)
   - Reference image (max 10MB)
4. Files appear in "Uploaded Files" section
5. Can delete files by clicking 🗑️
```

---

## 📝 Rich Text Editor Features

### Text Formatting

**Toolbar Buttons:**
- **B** = Bold: `**text**`
- **I** = Italic: `*text*`
- **U** = Underline: `<u>text</u>`

### Structure Formatting

- **H₁**, **H₂**, **H₃** = Headings
- **•** = Bullet list: `- item`
- **1** = Numbered list: `1. item`
- **<>** = Code block: ` ``` code ``` `
- **🔗** = Link: `[text](url)`

### Preview

Click **👁️ Preview** to see formatted content
Click **📝 Edit** to return to editing

---

## 🎯 Key Fields Explained

| Field | Required | Details |
|-------|----------|---------|
| Training Track | Yes | Determines TPA & certification track |
| Module Title | Yes | Display name for guides |
| Description | No | Short summary (max 200 chars) |
| Content | No | Full module content with markdown |
| Duration | No | Estimated hours to complete |
| Order | No | Display order (0 = first) |
| Status | No | Published (visible) or Draft (HoD only) |

---

## 🔧 Common Tasks

### Task: Publish a Draft Module

1. Navigate to `/dashboard/hod/modules`
2. Click **✎ Edit** on the draft module
3. Toggle **Draft** → **Published** (top-right)
4. Click **💾 Update Module**

### Task: Reorder Modules in a Track

1. Edit each module in the track
2. Change the **Module Order** field:
   ```
   Module A: Order = 0
   Module B: Order = 1
   Module C: Order = 2
   ```
3. Click **💾 Update Module** for each

### Task: Add a Video to a Module

1. Edit the module
2. Click **➕ Manage Assets**
3. Upload MP4 file (drag or click)
4. Wait for upload to complete (progress bar)
5. File appears in **Uploaded Files** section
6. Get shareable link from **storage_url**

### Task: Delete and Recreate Module

```typescript
// Deleting removes:
- Module record
- All module settings
- All attached media files
- ALL guide progress for this module ⚠️
```

---

## 👁️ Module Status & Visibility

### Published Module (✓)
- ✅ Visible to all Guides
- ✅ Counted in training progress
- ✅ Can be started by guides
- ✅ Can be changed to Draft anytime

### Draft Module (⊝)
- ❌ Hidden from Guides
- ❌ Not counted in progress
- ❌ Only editable by HoD
- ✅ Can be edited without affecting guides

---

## 📄 Markdown Syntax Reference

```markdown
# H1 Heading
## H2 Heading
### H3 Heading

**Bold text** makes important points stand out

*Italic text* for emphasis

- Bullet item 1
- Bullet item 2
  - Nested item

1. First step
2. Second step
3. Third step

[Click here](https://example.com)

```
Code example
```

Combine **bold** and *italic* for **_strong emphasis_**
```

---

## 🎓 Example: Complete Module

```
Title: Wildlife Photography Ethics
Description: Learn ethical practices for photographing park wildlife
TPA: Bako National Park
Duration: 1.5 hours
Order: 2

Content (Markdown):
# Wildlife Photography Ethics in Bako

## Introduction
Learn the principles of ethical wildlife photography...

## Key Rules
1. Maintain distance from animals
2. Never use flash on sensitive species
3. Never disturb nesting areas

## Best Practices
- **Timing**: Early morning or late afternoon (golden hour)
- *Patience*: Wait for natural behavior
- Focus on conservation, not trophy shots

## Resources
[Ethical Photography Guide](https://example.com)
```

---

## ⚠️ Important Notes

### Before Publishing

- [ ] All content is accurate and up-to-date
- [ ] Links are working correctly
- [ ] Media files are relevant
- [ ] No confidential information included

### Module Deletion

Publishing and unpublishing is **safe** ✓
Creating and editing is **safe** ✓
**Deleting is permanent** ⚠️

### Media File Limits

- Videos: 500 MB max (MP4/WebM)
- PDFs: 50 MB max
- Images: 10 MB max (JPEG/PNG/WebP)

---

## 🐛 Troubleshooting

### Upload Shows Error "File size exceeds limit"
→ Check file size against limits above
→ Compress video or reduce image dimensions
→ Split large PDFs into multiple files

### Cannot Click "Manage Assets"
→ You must **save the module first**
→ Media management only works on existing modules
→ Save with "✨ Create Module" or "💾 Update Module"

### Module Not Showing in Track
→ Check **is_active** status (must be Published ✓)
→ Verify module is assigned to correct track
→ Check module **order_index** is sequential

### Guides Cannot See Published Module
→ Verify module status is Published ✓
→ Check Guide role exists and is set properly
→ Verify module is in correct training track

---

## 📊 Dashboard Navigation

```
HoD Dashboard
│
├── 📋 Applications (default)
│   └── Review guide/ranger applications
│
├── 📚 Training Modules ← You are here
│   ├── Create/Edit modules
│   ├── Manage media files
│   └── Publish/unpublish
│
├── 🏆 Training Tracks
│   └── View available tracks
│
└── 📢 Announcements
    └── Send platform-wide notices
```

---

## 📱 Mobile vs Desktop

| Feature | Desktop | Mobile |
|---------|---------|--------|
| Sidebar Nav | ✓ Left sidebar | ✗ Bottom nav |
| Rich Editor | ✓ Full toolbar | ⇓ Compact |
| File Upload | ✓ Drag-drop | ✓ Tap upload |
| Media Mgmt | ✓ Full section | ✓ Scrollable |
| Preview | ✓ Side-by-side | ✓ Full screen |

---

## 🎯 Best Practices

✅ **DO:**
- Give modules clear, descriptive titles
- Break long content into multiple modules
- Use headings to organize content
- Include media for complex topics
- Review before publishing
- Test links in preview

❌ **DON'T:**
- Create modules without a track
- Leave required fields empty
- Use only caps for entire content
- Publish without reviewing
- Delete production modules during testing
- Upload extremely large files

---

## 💡 Tips & Tricks

### Quick Format
Use keyboard instead of toolbar:
- Highlight text and type `**text**` for bold
- Use preview to see formatting in real-time

### Media Organization
Files auto-organized in storage:
```
training-media/
  {moduleId}/
    video/
      ...
    pdf/
      ...
    image/
      ...
```

### Module Templates
Keep a "Template" module as reference:
1. Create module with standard sections
2. Copy content when creating similar modules
3. Customize for specific topic

---

## 🔗 Related Pages

- [Module Editor Documentation](MODULE_EDITOR.md)
- [API Reference](API_REFERENCE.md)
- [File Upload Guide](TRAINING_MEDIA_UPLOAD.md)
- [Project Architecture](CLAUDE.md)

---

## ❓ Need Help?

1. Check [Module Editor Documentation](MODULE_EDITOR.md) for technical details
2. Review markdown syntax reference above
3. Check file size limits for media uploads
4. Verify your HoD role is assigned correctly