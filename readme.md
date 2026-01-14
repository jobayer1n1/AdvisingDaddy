# 🎓 NSU Advising Automator - Documentation

A Chrome Extension built to automate course selection on the North South University advising portal. It intelligently monitors sections, seat availability, handles section priorities, and automates the submission process based on user-defined preferences.

---

## 📂 Addon Structure

| File | Description |
| --- | --- |
| `manifest.json` | Configuration file defining permissions, host matching, and extension metadata (Manifest V3). |
| `content.js` | The automation engine. Runs directly on the advising page to parse the DOM, check seats, and click buttons. |
| `popup.html` | The user interface structure for adding course priorities and toggling settings. |
| `popup.js` | Handles UI logic, saves user preferences to `chrome.storage`, and updates status labels. |
| `popup.css` | Styling for the popup, including the priority list and toggle switches. |

---

## 🛠️ Installation Guide

1. **Download the zip file from releases and unzip it:** Ensure all files (`manifest.json`, `content.js`, `popup.html`, `popup.js`, `popup.css`) are in a single folder named `AutoAdvise`.
2. **Open Extensions Menu:** Open Chrome and navigate to `chrome://extensions/`.
3. **Developer Mode:** Toggle **Developer mode** to ON (top right corner).
4. **Load Extension:** Click **Load unpacked** and select your folder.
5. **Verify:** The extension icon should appear in your toolbar.

---

## ⚙️ Logic & Algorithms

### 1. Automation Control (Master Switch)

* **Logic:** The content script checks the `automationEnabled` flag in `chrome.storage.local` immediately upon loading.
* **Behavior:**
* **IF TRUE:** The script executes the scanning and clicking logic.
* **IF FALSE:** The script logs "Automation Paused" and terminates immediately, allowing manual user interaction.



### 2. New Section Alert

* **Logic:** It stores each courses section count added by the user. If the section count increases, it raises a alert and skip furthur script execution. You have to reload to continue automation.



### 3. Priority Handling

* **Input Format:** Users input a Course Name (e.g., `BIO103`) and a list of Sections (e.g., `1, 2, 3`).
* **Execution Order:** The script iterates through the course list from top to bottom.
* **Section Selection:** For each course, it tries sections **left-to-right**.
1. Check Section 1 availability.
2. If full, check Section 2.
3. If Section 2 is available, **Click** -> **Stop** (move to next course).


* *Constraint:* It never attempts to add multiple sections for the same course.



### 4. Duplicate Prevention (Exact Match)

To prevent the "Already Registered" error:

* **Parsing:** The script scrapes the `#advSlip` table (the list of added courses).
* **Comparison:** It compares the target `COURSE.SECTION` (e.g., `BIO103.8`) against the registered list.
* **Rule:** It only skips the action if the **exact** section is found. If you have `BIO103.8` but want `BIO103.9`, it will still attempt to add `9` (unless you remove `8` manually or via script, though currently it only adds).

### 5. Seat Availability Parsing

* **DOM Target:** It looks for the second `<td>` in every row of `#courseList`.
* **Text Format:** Strictly parses `occupied(total)` (e.g., `35(40)`).
* **Calculation:** A seat is considered **Available** if:
```javascript
occupied < total

```



### 6. Finalization & Auto-Reload

* **Submission:** If any course was successfully clicked/added during the cycle, the script clicks the `#submit` button.
* **Reload Loop:** After submission (or if no seats were found), the script checks the `autoReloadEnabled` flag. If true, it refreshes the page to restart the cycle and catch newly opened seats.

---

## 🖥️ UI Features (`popup.html` & `popup.js`)

1. **Master Toggle:**
* Enables/Disables the entire script.
* **Dynamic Label:** Text changes from "Automation Disabled" (Red) to "Automation Enabled" (Green) dynamically using DOM manipulation.


2. **AlertStatusToggle:**
* Enables/Disable alert for new sections.
* **Dynamic Label:** same as Master Toggle

2. **Course Input:**
* Accepts case-insensitive input (e.g., `bio103` becomes `BIO103`).
* Sanitizes section lists (removes extra spaces).


3. **Status Indicators:**
* Uses HTML Entities (e.g., `&#9989;` for ✅) to ensure cross-platform compatibility and avoid UTF-8 encoding issues.
* Shows a checkmark next to courses detected in the `#advSlip`.



---

## 🔍 Technical Constraints & Requirements

* **URL Matching:** Strictly runs only on `https://rds3.northsouth.edu/students/advising*`.
* **DOM Dependency:** Relies on specific IDs:
* `#advSlip` (Registered courses table)
* `#courseList` (Available courses table)
* `#submit` (Save button)


* **Storage:** Uses `chrome.storage.local` to persist user preferences across browser restarts.

---

## 🐛 Troubleshooting

| Issue | Solution |
| --- | --- |
| **Console Empty** | Ensure you are inspecting the **Webpage** for automation logs and the **Popup** for UI logs. Enable "Preserve log" in DevTools. |
| **Garbage Icons (âœ–)** | The code now uses HTML Entities (`&#10006;`) instead of raw emojis to fix encoding errors. |
| **Not Clicking** | Check if "Master Switch" is Green. Ensure the course text in the table matches your input exactly (e.g., spacing). |
| **"Could not load icon"** | Remove the `"icons"` section from `manifest.json` or ensure image files exist in the `/images` folder. |
