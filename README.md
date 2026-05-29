# SFC Digital Park Guide Platform

**Live Demo:** [https://cos-30049-pre-fyp.vercel.app](https://cos-30049-pre-fyp.vercel.app/)

A full-stack web application for the **Sarawak Forest Corporation (SFC)** that manages park guide certification, training, and real-time AI-based environmental monitoring. Built as part of COS30049 — Computing Technology Innovation Project (Pre-FYP) at Swinburne University of Technology.

## Overview

The platform equips park guides and rangers with structured training and certification pathways, while providing real-time AI monitoring during guided tours to detect and prevent environmental violations such as wildlife disturbance and plant damage.

### Key Features

- **Real-Time AI Monitoring** — Live webcam analysis using YOLOv8 object detection and MediaPipe hand pose estimation to identify violations (plucking plants, disturbing wildlife) directly in the browser
- **Training & Certification** — Self-paced training modules, quizzes, and a multi-track certification pipeline with badge issuance and PDF certificate generation
- **Evidence Management** — Offline-first evidence capture with automatic cloud sync, video clip recording on violation detection, and a review dashboard
- **Role-Based Access** — Superadmin, Head of Department, Senior Guide/Ranger, and Guide/Ranger roles with tailored dashboards
- **Payment Integration** — Stripe-powered certification payments
- **Notifications** — Email (Nodemailer) and SMS/OTP (Twilio) for authentication and alerts

## Tech Stack

### Frontend & Web Application
| Technology | Purpose |
|---|---|
| Next.js 16 | React framework with App Router |
| React 19 | UI components |
| TypeScript | Type safety |
| Tailwind CSS 4 | Styling |
| Recharts | Data visualization |
| pdf-lib | Certificate PDF generation |

### AI / Machine Learning
| Technology | Purpose |
|---|---|
| YOLOv8 (Ultralytics) | Object detection — person, wildlife, plant |
| ONNX Runtime Web | In-browser model inference via Web Workers |
| MediaPipe Tasks Vision | Hand pose estimation (21-point skeleton) |

### Backend & Infrastructure
| Technology | Purpose |
|---|---|
| Supabase (PostgreSQL) | Database, authentication, file storage |
| Stripe | Payment processing |
| Nodemailer | Email notifications |
| Vercel | Deployment |

### ML Training & Testing (Python)
| Technology | Purpose |
|---|---|
| Ultralytics YOLOv8 | Model training and export |
| OpenCV | Image processing |
| scikit-learn | Evaluation metrics |
| Matplotlib / Seaborn | Visualization |

## Project Structure

```
Assignment/
├── COS30049_preFYP/
│   └── digitalparkguide/          # Next.js web application
│       ├── app/                   # Pages & API routes
│       │   ├── monitor/           # Real-time AI monitoring page
│       │   ├── dashboard/         # Role-based dashboards
│       │   ├── training/          # Training modules
│       │   ├── admin/             # Admin interfaces
│       │   ├── quiz/              # Assessment system
│       │   ├── apply-guide/       # Guide applications
│       │   ├── api/               # REST API endpoints
│       │   └── auth/              # Auth callbacks
│       ├── components/            # Reusable React components
│       ├── lib/                   # Utilities & hooks
│       │   ├── useDetection.ts    # YOLO + MediaPipe fusion hook
│       │   ├── evidence.ts        # Evidence capture logic
│       │   ├── evidenceQueue.ts   # Offline queue
│       │   └── supabase/          # Supabase client config
│       ├── supabase/migrations/   # Database migrations
│       ├── public/                # Static assets & ONNX models
```

## How It Works — AI Monitoring

The monitoring system runs entirely in the browser for privacy and low-latency detection:

1. **YOLOv8** detects objects in the webcam feed (person, wildlife, plant) via an ONNX model running in a Web Worker
2. **MediaPipe HandLandmarker** tracks 21 hand keypoints to classify hand poses (resting, approaching, plucking, petting)
3. **Violation logic** fuses both signals:
   - Hand near plant + plucking pose +Ultrasonic Sensor detects motion <20cm → **Plant damage alert**
   - Hand near wildlife + petting pose → **Wildlife disturbance alert**
4. On violation, an **evidence clip** is captured and queued for upload to Supabase Storage

## Getting Started
### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- Python 3.10+ (for ML training/testing only)
- Supabase project with configured auth, storage, and database

The production deployment is live at [https://cos-30049-pre-fyp.vercel.app](https://cos-30049-pre-fyp.vercel.app/).

## User Roles

| Role | Access |
|---|---|
| **Superadmin** | Full platform management, user administration |
| **Head of Department** | Application review, interview scheduling, badge issuance |
| **Senior Guide/Ranger** | Group supervision, evidence review |
| **Guide/Ranger** | Training, quizzes, monitoring, certification |

## Quick Start Tutorial (For Reviewers)

Below is a walkthrough of the platform's main workflows. The live app is at **[https://cos-30049-pre-fyp.vercel.app](https://cos-30049-pre-fyp.vercel.app/)**.

### Test Accounts

| Role | Email | Password |
|---|---|---|
| Superadmin | `superadmin@mail.com` | `Admin@1234` |
| Head of Department | `hod@mail.com` | `@Bcd1234` |
| Senior Guide | `senior@mail.com` | `@Bcd1234` |

> To test the full Guide registration flow, create a new account using the sign-up page.

---

### 1. Public User → Guide Registration

1. Go to the landing page and click **Sign Up**
2. Enter your name, email, and click **Send Verification Link**
3. Confirm via the email you receive (or sign up with Google to skip verification)
4. Set up your password when redirected
5. Once logged in, you land on the public page — view SFC announcements or click **Register as Guide**
6. Fill in the multi-step application form:
   - Personal details (phone number max 15 digits)
   - Background section (special characters like `%`, `#`, `$` are blocked for security)
7. Review your details on the final step, then submit
8. Application status updates as the HoD processes it (Interview Scheduled → Approved)

---

### 2. Head of Department (HoD)

Login with `hod@mail.com` / `@Bcd1234`.

**Processing Guide Applications:**
- Review submitted applications from the dashboard
- Schedule an interview, or directly approve/reject based on uploaded documents
- Applicant receives email notification on status change

**Badge Track (Certification Pipeline):**
- Click **Badge Track** in the sidebar
- View summary counters: Total Certifications, Badges Issued, In Progress, Pending Approval
- Filter by status: All / In Progress / Pending Approval / Badge Holders / Rejected
- Expand any guide entry to see their full pipeline (Payment → Modules → Quiz → Interview → Badge)
- When all steps show green ticks, click **Issue Badge** to generate certificate PDF and notify the guide
- To reject, click **Reject Certification** at the bottom of the expanded entry

---

### 3. Senior Guide

Login with `senior@mail.com` / `@Bcd1234`.

**My Group:**
- Click **My Group** in the sidebar to see assigned guides
- Click a guide's name to expand their profile (assigned TPA, active tracks, module completion %, certification stage)
- A **Needs Attention** badge appears when a guide's progress has stalled

**Scheduling Certification Interviews:**
- Click **Interviews** in the sidebar
- Under **Awaiting Scheduling**, find guides who completed training
- Fill in date, time, location → click **Confirm & Notify Guide**
- Guide receives email with interview details

**Recording Interview Outcomes:**
- Under **Scheduled**, locate the completed interview
- Click **Record Outcome** → select **Passed** or **Failed**
- Add notes (required if marking Failed)
- Passed → guide gets certified and receives park badge
- Failed → guide can resit; notified by email

---

### 4. Superadmin

Login with `superadmin@mail.com` / `Admin@1234`.

**Dashboard Overview:**
- Real-time stats: total users, active tracks, published announcements, active patrols
- Training alerts, incident feed, badge renewal settings

**User Management:**
- Click **Users** → view all registered users with name, ID, role, creation date
- Search by name/ID or filter by role
- Change a user's role via the dropdown (applies immediately)
- Delete a user via the trash icon (confirmation modal appears)
- Superadmin accounts are protected and cannot be modified or deleted

**RBAC (Route Access Control):**
- Click **RBAC** → configure which roles can access which routes
- Routes grouped by: Admin Console, Public, Staff Dashboard, Training
- Change minimum role per route via dropdown
- Use **Disable All / Enable All** for bulk toggling
- Admin Console routes are locked to prevent accidental lockout

**AI Monitor:**
- Click **Monitor** → opens real-time AI surveillance dashboard
- Live video feed with object detection (person, wildlife, plant) and hand skeleton overlay
- Confidence scores displayed per detection
- Evidence clips auto-captured when detections exceed threshold

---

### 5. Guide Training & Certification Flow

After a guide's application is approved:

1. Click **Tracks** in the sidebar
2. Complete **General Modules** (prerequisites) first — click **Enroll**, complete payment
3. Work through all modules; complete any quizzes before marking each module done
4. Once general modules are done, choose a national park track and click **Activate Track** (payment required)
5. Complete all track modules → take the assessment quiz
6. Senior Guide schedules and conducts a certification interview
7. Upon passing, HoD issues the park badge and certificate

## License

This project was developed for academic purposes as part of COS30049 at Swinburne University of Technology.

## Author

**Student ID:** 104404059  
**Course:** COS30049 — Computing Technology Innovation Project  
**University:** Swinburne University of Technology
