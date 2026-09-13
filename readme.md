# AdvisingDaddy - NSU Auto-Advise & Course Assistant

**AdvisingDaddy** is a powerful, lightweight browser extension designed for North South University (NSU) students to automate advising course selections, monitor seat availability, watch for newly opened sections, and inject vital course metadata (faculty initials, class days, times, and rooms) directly into the advising portal.

---

## Table of Contents
1. [Key Features](#key-features)
2. [Installation Guide](#installation-guide)
3. [Quick Start Workflow](#quick-start-workflow)
4. [Operation Controller (Toggle Guide)](#operation-controller-toggle-guide)
5. [Course Queue Management](#course-queue-management)
6. [Advising Table Enhancements](#advising-table-enhancements)
7. [In-Page Notification System](#in-page-notification-system)
8. [Frequently Asked Questions (FAQ)](#frequently-asked-questions-faq)
9. [Privacy & Security](#privacy--security)

---

## Key Features

- **Priority-Based Automation:** Specify courses and preferred sections in priority order (e.g., `CSE323` -> `1, 2, 3`).
- **Auto-Save & Submit:** Automatically clicks available sections based on priority and submits the advising slip with built-in human delay simulation.
- **Seat Availability Alerts:** Non-blocking notifications when prioritized sections have open seats.
- **New Section Detection:** Automatically tracks section counts and notifies you when new sections are added for your queued courses.
- **Course Metadata Injection:** Merges offered course information (Faculty Initials, Day, Time, Room, Seats) right into the advising portal table.
- **Live Search by Course & Faculty:** Filter advising rows instantly by course code (e.g. `CSE323`) or faculty name/initials (e.g. `AAA`, `Rahman`).
- **Saved Metadata Viewer:** Dedicated viewer tab with filterable course table, metadata timestamps, and quick data management.
- **Non-Blocking Toasts:** Uses glassmorphic in-page floating banners instead of modal `alert()` popups, ensuring automation loops never freeze.

---

## Installation Guide

### Google Chrome / Brave / Microsoft Edge
1. Download `AdvisingDaddy.zip` from the latest release.
2. Unzip it.
3. Open your browser and navigate to `chrome://extensions`.
4. Enable **Developer mode** using the toggle in the top-right corner.
5. Click **Load unpacked** in the top-left.
6. Select the `AdvisingDaddy` folder.
7. The extension icon will now appear in your browser toolbar (pin it for quick access).

### Mozilla Firefox
1. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on...**.
3. Navigate to the `AdvisingDaddy` directory and select `manifest.json`.

---

## Quick Start Workflow

```
[1. Save Metadata]  --->  [2. Set Queue]  --->  [3. Enable Toggles]  --->  [4. Advise on RDS]
Offered Courses Page      Extension Popup        Inject / Seat / AutoSave       Live Advising Portal
```

1. **Save Course Metadata:**
   - Visit the NSU Offered Courses page (`https://rds4.northsouth.ac.bd/offered_courses`).
   - Click the green **Save Metadata** button at the top of the table.
2. **Add Courses to Your Queue:**
   - Click the **AdvisingDaddy** extension icon in your browser toolbar.
   - Enter your course (e.g., `CSE327`) and preferred sections (e.g., `1, 2, 4`), then click **Add Course to the Queue**.
3. **Configure Your Toggles:**
   - Enable your desired options: **Inject Metadata**, **Seat Alert**, **Auto Save**, or **New Section Alert**.
4. **Open the Advising Portal:**
   - Navigate to `https://rds3.northsouth.edu/students/advising`.
   - The extension will inject metadata, monitor seats, and automate selection according to your preferences.

---

## Operation Controller (Toggle Guide)

The popup features four switches with permanent ambient glows when active, indicating the domain scope of each option:

| Toggle Switch | Domain | Description |
|---|:---:|---|
| **Inject Metadata** | `[all]` | Injects saved faculty initials, days, times, and room numbers into the entire advising table. Includes an **Eye icon (👁)** beside the toggle to view or delete saved metadata in a separate tab. |
| **Seat Alert** | `[queued]` | Continuously checks seat availability for courses in your priority queue and triggers a non-blocking in-page notification when seats open up. |
| **Auto Save** | `[queued]` | When open seats are found for a queued course, clicks the section with the highest priority and automatically submits the advising form. |
| **New Section Alert** | `[queued]` | Compares current sections against historical counts and triggers an alert when a new section opens for any of your queued courses. |

> **Domain Scopes:**
> - `[all]`: Operates globally across the whole offered courses table on the advising page.
> - `[queued]`: Operates strictly on the courses currently in your priority queue.

---

## Course Queue Management

The popup's **Course Queue** allows full management of your desired courses and sections:

- **Add Course:**
  - Input field 1: Course code (e.g. `CSE331`).
  - Input field 2: Comma-separated section list ordered by preference (e.g. `1, 2, 3`).
  - Click **Add Course to the Queue**.
- **Status Badges:**
  - `⏳` (Pending): Course has not yet been registered.
  - `✅` (Completed): One of your prioritized sections is already registered on your advising slip.
- **Inline Section Editing:**
  - Click the **Pencil icon** on any course row to edit its sections directly.
  - Modify the comma-separated section numbers and click **Save**.
- **Remove Course:**
  - Click the **✕** button to delete a specific course from the queue.
- **Clear Whole Queue:**
  - Click the red **Clear Whole Queue** button at the bottom to reset your priority list.

---

## Advising Table Enhancements

When **Inject Metadata `[all]`** is enabled, the advising page (`#courseList`) transforms into an enhanced layout:

1. **Sticky Header & 6 Columns:**
   - Columns: `Course` | `Seats` | `Faculty` | `Day` | `Time` | `Room`.
   - Header stays pinned to the top while scrolling through offered courses.
2. **Real-Time Dual Search Bar:**
   - Integrated search bar positioned directly above the course table.
   - Type a course code (e.g. `CSE323`) to filter sections of that course.
   - Type faculty initials (e.g. `AAA`, `IQN`) to filter all sections taught by that instructor.
   - Includes quick clear button (`✕`) and live match counter.

---

## Saved Metadata Viewer Tab

Clicking the **Eye icon (👁)** beside the Inject Metadata toggle opens the built-in offline viewer (`view_saved_course_metadatas.html`):

- **Meta Information Bar:** Displays total course count, timestamp when data was saved, and the source page URL.
- **Filter Field:** Instant multi-field filtering across course codes, faculty initials, days, times, and rooms.
- **Delete Data Button:** Securely clears saved metadata from storage and updates the popup status immediately.

---

## In-Page Notification System

AdvisingDaddy replaces blocking browser `alert()` dialogs with sleek, glassmorphic in-page floating toasts (`templates/notification_banner.html`):

- **Non-Blocking:** Alerts do not pause JavaScript execution, timers, or automated button clicks.
- **Distinct Visual Cues:**
  - **Seat Available Alert:** Green border/accent (`success`) indicating available seats.
  - **New Section Alert:** Amber border/accent (`warning`) indicating newly published sections.
- **Vertical Stacking:** If both alerts trigger together, they stack neatly without overlapping.
- **Auto-Dismiss & Hover Pause:**
  - Each toast has a 5-second countdown progress bar and a manual dismiss (`✕`) button.
  - Hovering your mouse over a toast pauses the countdown timer so you have time to read or copy course codes.

---

## Frequently Asked Questions (FAQ)

#### Q1: Does the extension freeze my advising page?
**No.** All alerts are delivered via non-blocking DOM banners. JavaScript execution continues uninterrupted so automation and seat checks run without delay.

#### Q2: What happens if I am already registered in a section?
If any section of your queued course is detected on your advising slip (`#advSlip`), the extension marks that course with a `✅` and automatically skips it so lower-priority sections are not added.

#### Q3: How does Auto Save handle multiple priorities?
It checks sections from left to right. Once an available section is clicked, it records the selection, waits for a short safety delay (600–1200ms) to ensure portal AJAX synchronization, and triggers the portal's native `Save` button.

#### Q4: Why is the Inject Metadata toggle disabled?
The toggle is disabled with the label `Inject Metadata (No data saved)` until you visit `https://rds4.northsouth.ac.bd/offered_courses` and click **Save Metadata**. Once saved, the toggle automatically unlocks.

#### Q5: Will my queue and toggle states be saved when I close the browser?
**Yes.** All settings, toggles, priority queues, and saved course metadata are stored in `chrome.storage.local` and persist across browser restarts.

---

## Privacy & Security

- **100% Local & Client-Side:** AdvisingDaddy runs entirely within your browser.
- **No External Servers:** No telemetry, tracking, or personal data is collected or transmitted outside your local environment.
- **Scoped Permissions:** Only requests access to storage, active tab, and NSU advising/offered courses portal domains.
