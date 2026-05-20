# NSU Advising Addon

Simple Chrome extension to help monitor and add preferred NSU advising sections.

## What it does
- Saves your course and section priority list (example: `BIO103` -> `1,2,3`).
- Checks sections from left to right by priority.
- If a higher-priority section is already in your advising slip, lower ones are skipped for both seat available alert and auto-save.
- Alerts you when seats are available.
- Can auto-select and submit when auto-save is enabled.
- Can alert you when a new section appears for the queued courses.

## Current toggles
- `Addon Service Enabled`: Master switch for automation.
- `New Section Alert Enabled`: Alerts when a new section appears for queued courses.
- `Auto Save Enabled`:
- ON: clicks available section based on priority and submits.
- OFF: only alerts seat availability (no auto submit).

## Installation
Install from the GitHub **Releases** section where packaged files will be uploaded:

1. Go to this repository's **Releases** page.
2. Download the **Chrome** package (`.zip` file).
3. Download the **Firefox** package (`.xpi` file).
4. Install the file for your browser:
- Chrome: open `chrome://extensions`, enable Developer mode, then use **Load unpacked** after extracting the zip.
- Firefox: open `about:debugging#/runtime/this-firefox`, click **Load Temporary Add-on**, then select the `.xpi` file.

## Usage
1. Open NSU advising page: `https://rds3.northsouth.edu/students/advising`.
2. In addon popup, add course code and section list.
3. Turn on the toggles you want, then refresh/revisit advising page.

## Notes
- Runs only on NSU advising URL (plus local test HTML path in manifest).
- Data is saved in extension local storage (`chrome.storage.local` / `browser.storage.local`).
- Clear button removes only course list/completed status, not toggle settings.
