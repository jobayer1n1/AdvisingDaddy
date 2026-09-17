# AdvisingDaddy - NSU Auto-Advise & Course Assistant

> **AdvisingDaddy** is a comprehensive, client-side browser extension and course planning suite engineered specifically for North South University (NSU) students. It automates course advising, monitors seat openings in real-time, alerts on newly opened sections, detects schedule and final exam clashes, and enhances both the NSU Advising Portal and Offered Courses system with powerful search, sorting, and metadata injection.

---

## Table of Contents

- [AdvisingDaddy - NSU Auto-Advise \& Course Assistant](#advisingdaddy---nsu-auto-advise--course-assistant)
  - [Table of Contents](#table-of-contents)
  - [Key Features Overview](#key-features-overview)
  - [Installation \& Setup](#installation--setup)
    - [Google Chrome / Brave / Microsoft Edge](#google-chrome--brave--microsoft-edge)
    - [Mozilla Firefox (Desktop \& Android)](#mozilla-firefox-desktop--android)
  - [Core Architecture \& Workflow](#core-architecture--workflow)
  - [Step-by-Step User Guide](#step-by-step-user-guide)
    - [Step 1: Extract \& Save Course Metadata](#step-1-extract--save-course-metadata)
    - [Step 2: Use Advising Daddy Course Planner](#step-2-use-advising-daddy-course-planner)
    - [Step 3: Configure the Operation Controller (Popup)](#step-3-configure-the-operation-controller-popup)
    - [Step 4: Live Advising on RDS](#step-4-live-advising-on-rds)
  - [Feature Reference Manual](#feature-reference-manual)
    - [1. Offered Courses Scraper \& Bridge](#1-offered-courses-scraper--bridge)
    - [2. Interactive Planner (`advising_daddy.html`)](#2-interactive-planner-advising_daddyhtml)
    - [3. Time Clash Detection Engine](#3-time-clash-detection-engine)
    - [4. Same-Day Final Exam Conflict Predictor](#4-same-day-final-exam-conflict-predictor)
    - [5. Drag-and-Drop Priority Management](#5-drag-and-drop-priority-management)
    - [6. Cross-Listed (Slash-Separated) Course Handling](#6-cross-listed-slash-separated-course-handling)
    - [7. Enhanced Live Advising Table (`#courseList`)](#7-enhanced-live-advising-table-courselist)
    - [8. Real-Time Dual Search \& Multi-Field Sorting](#8-real-time-dual-search--multi-field-sorting)
      - [Dual Search Features:](#dual-search-features)
      - [Table Sorting:](#table-sorting)
    - [9. Automation \& Auto-Save Engine](#9-automation--auto-save-engine)
    - [10. Seat Availability \& New Section Monitors](#10-seat-availability--new-section-monitors)
    - [11. Glassmorphic HUD Toast System](#11-glassmorphic-hud-toast-system)
  - [Operation Controller (Toggle Guide)](#operation-controller-toggle-guide)
  - [Search Query Cheat Sheet](#search-query-cheat-sheet)
  - [Frequently Asked Questions (FAQ)](#frequently-asked-questions-faq)
      - [Q1: Will using this extension freeze or slow down my browser?](#q1-will-using-this-extension-freeze-or-slow-down-my-browser)
      - [Q2: What happens if two sections of my queued course are open?](#q2-what-happens-if-two-sections-of-my-queued-course-are-open)
      - [Q3: What if I am already enrolled in a section?](#q3-what-if-i-am-already-enrolled-in-a-section)
      - [Q4: Why does the "Inject Metadata" toggle say "(No data saved)"?](#q4-why-does-the-inject-metadata-toggle-say-no-data-saved)
      - [Q5: Are my queue and toggle settings preserved when I close the browser?](#q5-are-my-queue-and-toggle-settings-preserved-when-i-close-the-browser)
      - [Q6: Can I use Advising Daddy on mobile?](#q6-can-i-use-advising-daddy-on-mobile)
  - [Privacy, Security \& Permissions](#privacy-security--permissions)

---

## Key Features Overview

| Feature Category | Capabilities Included |
|---|---|
| **Intelligent Automation** | Priority-based section selection (`1, 2, 3...`), human-delay simulation (`300ms–1200ms`) to evade bot detection, advising slip verification to prevent accidental overwrites, and automated form submission. |
| **Course Planner Suite** | Standalone offline-capable web dashboard (`advising_daddy.html`) featuring real-time catalog search, sorting, priority ranking, and full bi-directional synchronization with your extension queue. |
| **Conflict Detection** | Instant detection of **Time Overlaps** (same day & overlapping hours) and **NSU Same-Day Final Exam Clashes** (odd-distance slot parity algorithm). |
| **Drag-and-Drop Reordering** | Reorder overall course priority vertically; reorder preferred section sequence horizontally with drag-and-drop chips. |
| **Portal Injection** | Transforms the standard 2-column RDS advising table into a sticky 6-column layout with **Course**, **Seats**, **Faculty**, **Day**, **Time**, and **Room**. |
| **Interactive RDS Table** | Clicking anywhere on an injected metadata cell (Faculty/Day/Time/Room) automatically selects the course section. |
| **Universal Dual Search** | Multi-token, order-independent search matching course codes, dot sections (`cse331.1`), faculty initials (`muo`), days (`st`, `mw`), and rooms. |
| **Active Sorting** | Sort both the Planner and live Advising tables by section number, faculty initials, NSU canonical days, or available seats. |
| **Real-Time Alert Monitors** | Automated background checks for newly opened sections and seat availability with non-blocking floating HUD toasts. |
| **Cross-Listed Course Parser** | Automatically expands slash-separated courses (e.g. `CSE325/CSE425`) into standalone selectable options. |

---

## Installation & Setup

Download the latest release from the [GitHub Releases](https://github.com/jobayer1n1/AutoAdviseNSU/releases/latest) page.

### Google Chrome / Brave / Microsoft Edge
1. Download **`AdvisingDaddy.zip`** from the [latest GitHub Release](https://github.com/jobayer1n1/AutoAdviseNSU/releases/latest).
2. Extract the downloaded `AdvisingDaddy.zip` file on your computer.
3. Open your Chromium-based browser and navigate to the extensions management page:
   - Chrome: `chrome://extensions`
   - Brave: `brave://extensions`
   - Edge: `edge://extensions`
4. Enable **Developer mode** using the toggle switch in the upper-right corner.
5. Click the **Load unpacked** button in the upper-left corner.
6. Select the extracted `AdvisingDaddy` folder.
7. Click the extension puzzle piece icon in the browser toolbar and **Pin** AdvisingDaddy for quick access.

### Mozilla Firefox (if available)
> [!NOTE]
> Firefox builds are provided when available (`AdvisingDaddy.xpi` in GitHub Releases). Primary development and testing are focused on Chromium-based browsers.

1. Download **`AdvisingDaddy.xpi`** (if available) from the [latest GitHub Release](https://github.com/jobayer1n1/AutoAdviseNSU/releases/latest).
2. If installing an `.xpi` package:
   - Drag and drop `AdvisingDaddy.xpi` into Firefox, or open `about:addons`, click the gear icon (⚙️), and select **Install Add-on From File...**.
3. If loading temporarily for testing:
   - Open Firefox and navigate to `about:debugging#/runtime/this-firefox`.
   - Click **Load Temporary Add-on...**.
   - Select the `manifest.json` file inside the extracted folder or the `.xpi` package.
4. **Firefox for Android**: Compatible with Firefox Nightly via custom add-on collection using Gecko ID `advisingdaddynsu@jobayer.dev` (when available).

---

## Core Architecture & Workflow

```
┌────────────────────────────────┐       ┌────────────────────────────────┐
│   1. NSU Offered Courses Page  │       │ 2. Advising Daddy Planner      │
│  rds4.northsouth.ac.bd/offered │       │  (Offline Dashboard / Tab)     │
│  - Click "Save Metadata"       │──────>│  - Search & filter catalog     │
│  - Multi-tier scraper runs     │       │  - Check time & exam clashes   │
│  - Catalog stored in storage   │       │  - Drag & drop queue & chips   │
└────────────────────────────────┘       └───────────────┬────────────────┘
                                                         │
                                                         ▼
┌────────────────────────────────┐       ┌────────────────────────────────┐
│ 4. Live Advising Portal (RDS)  │       │ 3. Operation Controller Popup  │
│  rds3.northsouth.edu/advising  │       │  - Enable Auto Save / Alerts   │
│  - 6-column sticky table       │<──────│  - View completed badges (✅) │
│  - Dual search & sorting       │       │  - Inline section editor (✏️)  │
│  - Automated clicks & submit   │       │  - Open Planner launch button  │
└────────────────────────────────┘       └────────────────────────────────┘
```

---

## Step-by-Step User Guide

### Step 1: Extract & Save Course Metadata
1. Navigate to the official NSU Offered Courses page:
   `https://rds4.northsouth.ac.bd/offered_courses`
2. Once the table finishes loading, look above the search input on the top right or table wrap. You will see a blue button: **Save Metadata**.
3. Click **Save Metadata**.
4. The button displays a spinning indicator while extracting course rows (including unpaginated sections via the DataTables API bridge), turns **green** with a checkmark upon success, and announces the total number of saved courses (e.g., `Saved 1,420 courses!`).
5. Your course catalog (faculty, class times, days, rooms, seats) is now saved securely in your browser's local storage.

> [!NOTE]
> You only need to perform Step 1 once per semester or whenever the registrar releases updated section offerings.

---

### Step 2: Use Advising Daddy Course Planner
1. Click the **AdvisingDaddy** extension icon in your browser toolbar.
2. Click the **Open Planner** button (represented by an external link / window icon in the header or beside the Inject Metadata toggle).
3. The standalone **Advising Daddy** tab opens:
   - **Catalog Table**: Browse through all offered courses with serial, course code, section, faculty, day, time, room, and seat count.
   - **Search**: Use multi-word queries like `cse331.1`, `cse225 muo`, or `st tnf` to filter entries instantly.
   - **Clash Warnings**: Check for red `!` icons (time clash) and amber `F` icons (same-day final exam clash). Click on any warning to see a popup listing conflicting courses.
   - **Add to Queue**: Click the **`+`** button on any course row. If the course is cross-listed (e.g. `CSE325/CSE425`), a dropdown allows you to choose your intended course code.
   - **Reorder Priorities**:
     - Drag course cards **up or down** in the right-hand panel to adjust overall advising order.
     - Drag section chips **left or right** inside any course to adjust section preference.
   - **Section Popover**: Click any section chip to see faculty, day, time, room, and seat count.

---

### Step 3: Configure the Operation Controller (Popup)
Open the extension popup to view and manage your automation settings:

1. **Verify Your Queue**: All courses and section priorities configured in the Planner appear immediately in your popup queue.
2. **Add or Edit Courses Manually**:
   - Enter course code (e.g., `CSE331`) and preferred sections (e.g., `1, 2, 4`).
   - Click **Add Course to the Queue**.
   - To modify sections for an existing course, click the **Pencil icon (✏️)**, update the comma-separated numbers, and click **Save**.
3. **Turn On Required Toggles**:
   - **Inject Metadata `[all]`**: Injects faculty, time, day, and room into the advising table.
   - **Seat Alert `[queued]`**: Notifies you when a prioritized section has open seats.
   - **Auto Save `[queued]`**: Automatically selects available sections and clicks the portal's Save button.
   - **New Section Alert `[queued]`**: Alerts you if the department adds a new section for your queued courses.

---

### Step 4: Live Advising on RDS
1. Log in to your NSU Student Portal and open the advising page:
   `https://rds3.northsouth.edu/students/advising`
2. **Visual Enhancements in Action**:
   - The advising table (`#courseList`) expands with a sticky 6-column header (`Course | Seats | Faculty | Day | Time | Room`).
   - A real-time search bar and sorting dropdown appear directly above the table.
3. **Automation Execution**:
   - If **Auto Save** is enabled, AdvisingDaddy inspects your queue from top to bottom.
   - For each course, it evaluates sections in priority order (left to right).
   - Once an open section is found, it waits for a natural human delay (`300ms–1200ms`), clicks the course section, waits for portal AJAX synchronization (`600ms–1200ms`), and automatically clicks **Save**.
   - If a course is already confirmed on your advising slip (`#advSlip`), AdvisingDaddy marks it with a green checkmark (`✅`) in your popup and safely skips it.

---

## Feature Reference Manual

### 1. Offered Courses Scraper & Bridge
- **Location**: `https://rds4.northsouth.ac.bd/offered_courses`
- **Scraping Engine**: Uses a multi-tier fallback mechanism:
  1. **DataTables API Bridge (`scripts/offered_bridge.js`)**: Communicates with the in-page jQuery DataTables instance to extract all rows across all pagination pages in a fraction of a second without clicking through pages.
  2. **Direct HTML Fetch**: Fetches unpaginated table HTML in the background if the bridge is unavailable.
  3. **DOM Parser Fallback**: Scrapes visible DOM elements.
- **Save Button**: Injected next to the search filter with micro-interactions (idle state, loading spinner, success pop, and error shake).

---

### 2. Interactive Planner (`advising_daddy.html`)
The built-in course planner is accessible at any time without having the advising portal open:
- **Offline Catalog**: Browse the entire semester's course catalog with zero network latency.
- **Pagination & Show More**: Displays 10 courses by default for fast initial rendering, with a **Show More** button to paginate 10 more rows per click, or displays all matching results when searching.
- **Metadata Information Bar**: Displays total courses stored, exact save timestamp, and source URL.
- **Delete Data Button**: Includes a red button in the top right to completely purge stored metadata with a single confirmation.

---

### 3. Time Clash Detection Engine
When building your advising routine, scheduling two classes at the same time results in registration errors.

- **How it works**: Every time a course is in your plan, AdvisingDaddy cross-references every other section in the catalog. If another section shares the same day (e.g. `ST` or `MW`) and its class time overlaps with an already-queued course, a **Red Warning Icon `!`** appears next to the course code.
- **Interactive Clash Popover**: Click or focus on the `!` icon to trigger an accessible popover that specifies the exact conflicting course, section, faculty, day, and time range:
  ```
  Time clash with:
  • CSE331.1 TNF (ST 09:40 AM – 11:10 AM)
  ```

---

### 4. Same-Day Final Exam Conflict Predictor
NSU schedules final exams based on class meeting days and standard time slots. Students enrolled in multiple courses on the same day can end up with multiple final exams on the exact same date if the time slots match NSU's exam schedule parity!

- **NSU Standard Slots**:
  `08:00:00` (Slot 0), `09:40:00` (Slot 1), `11:20:00` (Slot 2), `13:00:00` (Slot 3), `14:40:00` (Slot 4), `16:20:00` (Slot 5), `18:00:00` (Slot 6), `19:40:00` (Slot 7).
- **Parity Calculation**: Two non-lab courses sharing the same meeting day (e.g. `ST`) have a **same-day final exam** when the absolute difference between their slot indices is an **odd number**:
  $$\Delta = | \text{Slot}_A - \text{Slot}_B | \pmod 2 == 1$$
- **Visual Alert**: An **Amber Warning Icon `F`** appears next to any section that would trigger a same-day final with an existing course in your plan.
- **Interactive Final Exam Popover**: Click the `F` icon to see which planned course triggers the exam conflict:
  ```
  Same-day final with:
  • CSE311.2 AAA (ST 08:00 AM – 09:30 AM)
  ```
- **Lab Course Filtering**: Lab courses (ending with `L`, e.g., `CSE331L`) are automatically exempt from final exam conflict calculations because NSU lab exams are scheduled separately during regular lab hours.

---

### 5. Drag-and-Drop Priority Management
AdvisingDaddy provides dual-axis drag-and-drop prioritization inside the Planner side-panel:

1. **Course Priority (Vertical Drag)**:
   - Grab any course row by its `⋮⋮` handle.
   - Drag it up or down to change the course execution order.
   - Tabular rank badges (`1.`, `2.`, `3.`) update instantly.
2. **Section Preference (Horizontal Drag)**:
   - Each section is represented as a rounded chip.
   - Click and drag a chip left or right to change section preference.
   - The leftmost chip has highest priority (`1st choice`); rightmost chips act as backups.
   - Click the `✕` on any chip to remove that section; click the chip body to inspect its full timetable details in a popover.

---

### 6. Cross-Listed (Slash-Separated) Course Handling
Certain courses at NSU are cross-listed under two different departments (e.g. `CSE325/CSE425`, `ENV107/GEO205`, `BIO103/ENV102`).

- **Automated Row Splitting**: During metadata extraction, AdvisingDaddy automatically expands cross-listed entries into separate rows for each course code while preserving faculty, section, day, time, and room.
- **Planner Selection Dropdown**: If a cross-listed course is added, an inline dropdown selector allows you to pick which department code to register for.
- **Automation Safety Guard**: The extension detects composite slash codes in your queue and ensures automated clicks only target your chosen code, eliminating invalid RDS submissions.

---

### 7. Enhanced Live Advising Table (`#courseList`)
When **Inject Metadata `[all]`** is turned on:
- **Expanded Frame**: The portal frame is adjusted from cramped defaults up to `1240px` / `98vw` so data is never cut off.
- **Sticky 6-Column Layout**:
  - `Course` (85px, bold)
  - `Seats` (60px, center)
  - `Faculty` (55px, center)
  - `Day` (40px, center)
  - `Time` (155px, center, formatted to 12-hour AM/PM)
  - `Room` (65px, center)
- **Full Cell Clickability**: You do not have to aim specifically for the small course code text. Clicking on the Faculty, Day, Time, or Room cells automatically dispatches a click event to the native course checkbox/link, making manual course selection twice as fast.

---

### 8. Real-Time Dual Search & Multi-Field Sorting
Both the **Live Advising Portal** and the **Advising Daddy Planner** feature instant filtering:

#### Dual Search Features:
- **Multi-Token Query**: Split by spaces, matches across any order.
- **Combined Filters**: Combine course code, section, day, and faculty in one search:
  - `cse331.1` $\rightarrow$ Course `CSE331`, Section `1`
  - `cse225 muo` $\rightarrow$ Course `CSE225` taught by faculty `MUO`
  - `st tnf` $\rightarrow$ Classes on Sunday/Tuesday taught by `TNF`
  - `eng103.6 mw` $\rightarrow$ Course `ENG103`, Section `6` on Monday/Wednesday
- **Escape & Clear Button**: Press `Escape` or click the `✕` button to instantly clear the search bar.
- **Live Counter**: Displays the exact number of matching courses found.

#### Table Sorting:
Use the sorting controls to reorder courses on the fly:
- **Section (asc)**: Reorders numerically (`1, 2, 3... 10`).
- **Day**: Follows NSU's weekly cycle: `A` $\rightarrow$ `S` $\rightarrow$ `M` $\rightarrow$ `T` $\rightarrow$ `W` $\rightarrow$ `R` $\rightarrow$ `RA` $\rightarrow$ `ST` $\rightarrow$ `MW`.
- **Seats (desc)**: Puts courses with the most available seats at the very top.
- **Faculty (A–Z)**: Sorts alphabetically by faculty initials.
- **Sort: default**: Restores the portal's original course listing order.

---

### 9. Automation & Auto-Save Engine
When **Auto Save `[queued]`** is toggled on:
1. AdvisingDaddy reads your queue and scans `#courseList`.
2. It evaluates sections strictly according to your defined priority order.
3. If a section is full, it moves to your next backup section.
4. When an open section is found:
   - Simulates human reaction time (`300ms–1200ms`).
   - Clicks the course row.
   - Waits for RDS AJAX state synchronization (`600ms–1200ms`).
   - Clicks the native `input[type="submit"]` Save button (`saveadvising`).
5. **Slip Verification**: If a course is already registered on `#advSlip`, it is automatically skipped to prevent accidental course drops or section downgrades.

---

### 10. Seat Availability & New Section Monitors
- **Seat Alert `[queued]`**:
  - Continuously reads seat ratios `Occupied(Total)` (e.g. `34(35)`).
  - If seats open up for any prioritized section, triggers an instant **Seat Available** toast with course and section numbers.
  - Automatically suppresses alerts for CSE Lab courses to prevent notification spam.
- **New Section Alert `[queued]`**:
  - Compares the active course table against stored section count baselines.
  - If the department opens Section 12 for `CSE327` mid-advising, AdvisingDaddy instantly identifies the new section code and triggers a warning toast.

---

### 11. Glassmorphic HUD Toast System
AdvisingDaddy never uses browser `alert()` or `confirm()` dialogs on live advising pages because native dialogs freeze JavaScript timers and break automation routines.

Instead, notifications use in-page floating glassmorphic banners (`templates/notification_banner.html`):
- **HUD Badges**:
  - `SEAT UNLOCKED` (Green / Success)
  - `NEW SECTION DETECTED` (Amber / Warning)
  - `ACTION REQUIRED` / `SYSTEM ALERT` (Danger / Info)
- **Countdown Progress Track**: A visible 4px draining progress bar counts down 5 seconds.
- **Hover to Pause**: Move your mouse over any toast to pause the dismiss timer, giving you time to read or copy course details.
- **Non-Blocking Stack**: Toasts appear in the top-right corner (`z-index: 2147483647`) and stack neatly without obstructing the advising interface.

---

## Operation Controller (Toggle Guide)

The popup features four master toggles with ambient glow indicators:

| Toggle Switch | Scope | Default | Functionality |
|---|:---:|:---:|---|
| **Inject Metadata** | `[all]` | `OFF` | Injects faculty, time, day, and room into all courses on the advising page. Disabled automatically if no metadata has been saved yet. Click the **Launch Icon** beside it to open the Planner. |
| **Seat Alert** | `[queued]` | `OFF` | Checks seat availability for your queued courses and triggers a green HUD toast when a prioritized seat opens. |
| **Auto Save** | `[queued]` | `OFF` | Automatically selects available sections in priority order and submits the advising form. |
| **New Section Alert** | `[queued]` | `OFF` | Monitors section counts and alerts when NSU adds a new section to any course in your queue. |

> **Scope Definitions:**
> - `[all]`: Applies globally to the entire advising table on the page.
> - `[queued]`: Operates exclusively on courses you have added to your priority list.

---

## Search Query Cheat Sheet

Use these search patterns in both the Advising Daddy Planner and the live RDS Advising Table:

| Search Query | Target Matches |
|---|---|
| `cse331` | All sections of `CSE331` |
| `cse331.2` | Specifically Section 2 of `CSE331` |
| `muo` | All courses taught by faculty `MUO` |
| `cse225 muo` | Sections of `CSE225` taught by faculty `MUO` |
| `st` | All courses scheduled on Sunday/Tuesday |
| `mw tnf` | All courses on Monday/Wednesday taught by `TNF` |
| `cse327.1 st` | Section 1 of `CSE327` on Sunday/Tuesday |
| `nac610` | All classes scheduled in room `NAC610` |

---

## Frequently Asked Questions (FAQ)

#### Q1: Will using this extension freeze or slow down my browser?
**No.** All routines are lightweight and asynchronous. Scrapers use native DOM parsers and direct DataTables API bridges, while all notifications are non-blocking HTML toasts that do not interrupt page scripts.

#### Q2: What happens if two sections of my queued course are open?
Auto Save checks sections from left to right according to your priority order (e.g. `1, 3, 5`). It will choose Section 1. If Section 1 is full, it will choose Section 3.

#### Q3: What if I am already enrolled in a section?
If any section of a queued course is present on your advising slip (`#advSlip`), AdvisingDaddy marks it with a green checkmark (`✅`) in your popup and skips that course entirely. It will never accidentally drop or swap your confirmed courses.

#### Q4: Why does the "Inject Metadata" toggle say "(No data saved)"?
The toggle is disabled until you visit the NSU Offered Courses page (`https://rds4.northsouth.ac.bd/offered_courses`) and click the **Save Metadata** button. Once saved, the toggle activates permanently.

#### Q5: Are my queue and toggle settings preserved when I close the browser?
**Yes.** All course queues, section priorities, toggle states, and course catalogs are stored in `chrome.storage.local` and persist across browser restarts until you clear them.

#### Q6: Can I use Advising Daddy on mobile?
**Yes.** AdvisingDaddy is compatible with Firefox for Android (via Firefox Nightly add-on collection) using the Gecko ID `advisingdaddynsu@jobayer.dev`.

---

## Privacy, Security & Permissions

- **100% Client-Side**: AdvisingDaddy runs completely inside your browser. No external servers, analytics, tracking, or cloud databases are used.
- **Zero Data Collection**: Your student ID, registered courses, grades, and credentials are never stored or transmitted anywhere.
- **Minimal Permissions**:
  - `storage`: Saves course metadata, priority queues, and toggle preferences locally.
  - `activeTab` / `tabs`: Allows opening the Planner tab and interacting with NSU advising tabs.
  - `host_permissions`: Strictly limited to NSU portal domains (`rds3.northsouth.edu/*`, `rds4.northsouth.ac.bd/*`) and local development ports (`http://localhost:8000/*`, `http://127.0.0.1:8000/*`).

---

<p align="center">
 &copy; Jobayer
</p>
