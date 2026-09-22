// scripts/advising_table/styles.js
// Injects the advising-page layout and component styles exactly once.

/* ── styles ────────────────────────────────────────────────── */
export function applyAdvisingLayoutStyles() {
    if (document.getElementById("advising-injected-styles")) return;
    const style = document.createElement("style");
    style.id = "advising-injected-styles";
    style.textContent = `
        #mainBody {
            width: min(1240px, 98vw) !important;
        }
        #advisingframe {
            width: 100% !important;
        }
        #advisingframe .right {
            width: 540px !important;
        }
        #coursesbox {
            width: 100% !important;
            display: flex !important;
            flex-direction: column !important;
        }
        #coursemiddlebar {
            width: 100% !important;
            height: auto !important;
            display: flex !important;
            flex-direction: column !important;
        }
        #advCourseSearchContainer {
            padding: 8px 10px 6px 10px;
            background: #ffffff;
            border-bottom: 1px solid #d0d7de;
            display: flex;
            flex-direction: column;
            gap: 3px;
            box-sizing: border-box;
            width: 100%;
        }
        #advCourseSearchInput {
            width: 100% !important;
            box-sizing: border-box !important;
            padding: 6px 28px 6px 30px !important;
            border: 1px solid #c0c6cf !important;
            border-radius: 6px !important;
            font-size: 13px !important;
            font-family: inherit !important;
            outline: none !important;
            transition: border-color 0.2s, box-shadow 0.2s !important;
            background: #fdfdfd !important;
            color: #24292f !important;
        }
        #advCourseSearchInput:focus {
            border-color: #003e7e !important;
            box-shadow: 0 0 0 3px rgba(0, 62, 126, 0.15) !important;
            background: #ffffff !important;
        }
        #advCourseSearchClear {
            position: absolute !important;
            right: 8px !important;
            background: none !important;
            border: none !important;
            color: #8c959f !important;
            font-size: 13px !important;
            cursor: pointer !important;
            display: none;
            padding: 2px 6px !important;
            line-height: 1 !important;
        }
        #advCourseSearchClear:hover {
            color: #24292f !important;
        }
        #advCourseSearchFooter {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            width: 100%;
            min-height: 18px;
        }
        #advCourseSearchCount {
            font-size: 11px;
            color: #57606a;
            padding-left: 2px;
            display: none;
        }
        #advCourseSortSelect {
            font-size: 11px !important;
            font-family: inherit !important;
            padding: 2px 4px !important;
            border: 1px solid #c0c6cf !important;
            border-radius: 4px !important;
            background: #fdfdfd !important;
            color: #24292f !important;
            cursor: pointer !important;
            outline: none !important;
        }
        #advCourseSortSelect:focus {
            border-color: #003e7e !important;
            box-shadow: 0 0 0 2px rgba(0, 62, 126, 0.15) !important;
        }
        #coursemiddlebar .body, #offeredCourses {
            width: calc(100% - 10px) !important;
            height: 460px !important;
            overflow-x: auto !important;
            overflow-y: auto !important;
            margin: 5px 5px !important;
        }
        #courseList {
            width: 100% !important;
            border-collapse: collapse !important;
            table-layout: fixed !important;
        }
        #courseList thead th {
            position: sticky;
            top: 0;
            background: #003e7e;
            color: #ffffff;
            font-size: 12px;
            font-weight: 600;
            padding: 6px 4px;
            text-align: center;
            z-index: 5;
            border-bottom: 2px solid #00254c;
            white-space: nowrap;
        }
        #courseList th, #courseList td {
            box-sizing: border-box !important;
            vertical-align: middle !important;
        }
        #courseList th:first-child,
        #courseList tbody td:first-child {
            width: 85px !important;
            min-width: 85px !important;
            max-width: 85px !important;
            text-align: left !important;
            padding: 4px 2px 4px 6px !important;
            font-weight: bold !important;
            white-space: nowrap !important;
        }
        #courseList th:nth-child(2),
        #courseList tbody td:nth-child(2) {
            width: 60px !important;
            min-width: 60px !important;
            max-width: 60px !important;
            text-align: center !important;
            padding: 4px 4px !important;
            white-space: nowrap !important;
        }
        #courseList th:nth-child(3),
        #courseList tbody td:nth-child(3) {
            width: 55px !important;
            text-align: center !important;
            padding: 4px 2px !important;
            white-space: nowrap !important;
        }
        #courseList th:nth-child(4),
        #courseList tbody td:nth-child(4) {
            width: 40px !important;
            text-align: center !important;
            padding: 4px 2px !important;
            white-space: nowrap !important;
        }
        #courseList th:nth-child(5),
        #courseList tbody td:nth-child(5) {
            width: 155px !important;
            text-align: center !important;
            padding: 4px 2px !important;
            white-space: nowrap !important;
        }
        #courseList th:nth-child(6),
        #courseList tbody td:nth-child(6) {
            width: 65px !important;
            text-align: center !important;
            padding: 4px 2px !important;
            white-space: nowrap !important;
        }
        #courseList tbody td {
            font-size: 12px !important;
            border-bottom: 1px solid #e1e4e8 !important;
        }
        /* Only sections you can add (portal class cstat0) look clickable.
           Full sections (cstat1) keep whatever cursor the portal gives them,
           so our injected cells match the portal instead of promising a click
           that does nothing. */
        #courseList tbody tr.cstat0 td {
            cursor: pointer;
        }
        /* ── search row (non-portal: input + sort share one row) ─ */
        #advSearchRow {
            display: flex;
            align-items: center;
            gap: 6px;
            width: 100%;
            margin-bottom: 4px;
        }
        #advSearchRow #advCourseSortSelect {
            flex: 0 0 auto;
        }
        /* ── portal mode: make #searchDiv a flex row so the sort
           select sits directly to the right of #searchText ─────── */
        #searchDiv {
            display: flex !important;
            align-items: center !important;
            gap: 8px !important;
            flex-wrap: nowrap !important;
        }
        #searchDiv #advCourseSortSelect {
            flex: 0 0 auto;
            margin: 0 !important;
        }
        /* ── search info footer ─────────────────────────────── */
        #advCourseSearchInfo {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }
        #advCourseSearchFooter #advCourseSearchClear {
            position: static !important;
            padding: 0 !important;
            font-size: 11px !important;
        }
        /* ── toolbar buttons ────────────────────────────────── */
        #advCourseFetchBtn, #advAutoFetchBtn {
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            gap: 5px !important;
            font-family: inherit !important;
            font-size: 11px !important;
            font-weight: 500 !important;
            line-height: 1 !important;
            padding: 5px 10px !important;
            border: 1px solid #d0d7de !important;
            border-radius: 6px !important;
            background: linear-gradient(180deg, #ffffff 0%, #f6f8fa 100%) !important;
            color: #24292f !important;
            cursor: pointer !important;
            box-shadow: 0 1px 0 rgba(27, 31, 36, 0.04) !important;
            transition: background 0.15s, border-color 0.15s, color 0.15s, box-shadow 0.15s !important;
            white-space: nowrap !important;
        }
        #advCourseFetchBtn:hover:not(:disabled), #advAutoFetchBtn:hover {
            background: #f3f6f9 !important;
            border-color: #003e7e !important;
            color: #003e7e !important;
        }
        #advCourseFetchBtn:active:not(:disabled), #advAutoFetchBtn:active {
            background: #eaeef2 !important;
            box-shadow: inset 0 1px 2px rgba(27, 31, 36, 0.12) !important;
        }
        #advCourseFetchBtn:focus-visible, #advAutoFetchBtn:focus-visible {
            outline: none !important;
            border-color: #003e7e !important;
            box-shadow: 0 0 0 3px rgba(0, 62, 126, 0.15) !important;
        }
        #advCourseFetchBtn:disabled {
            opacity: 0.6;
            cursor: default !important;
        }
        #advCourseFetchBtn .adv-btn-icon { display: inline-flex; }
        #advCourseFetchBtn .adv-btn-icon.adv-spin { animation: advSpin 1s linear infinite; }
        @keyframes advSpin { to { transform: rotate(360deg); } }

        /* ── gear button + notification badge ───────────────── */
        #advAutoFetchWrap {
            display: inline-flex;
            align-items: center;
            flex: 0 0 auto;
            /* relative so the badge can be pinned to the gear corner */
            position: relative;
        }
        #advAutoFetchBtn {
            padding: 4px 6px !important;
            color: #57606a !important;
        }
        #advAutoFetchBtn.active { color: #003e7e !important; }
        #advAutoFetchBtn[aria-expanded="true"] {
            border-color: #003e7e !important;
            background: #eef4fb !important;
            color: #003e7e !important;
        }
        /* countdown badge — notification bubble pinned to top-right of the gear */
        #advAutoFetchCountdown {
            position: absolute;
            top: -5px;
            right: -5px;
            z-index: 10;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 14px;
            height: 14px;
            padding: 0 3px;
            font-size: 8px;
            font-weight: 800;
            line-height: 1;
            font-variant-numeric: tabular-nums;
            white-space: nowrap;
            color: #ffffff;
            background: #e3322d;
            border: 1.5px solid #ffffff;
            border-radius: 7px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.3);
            letter-spacing: 0em;
            animation: adv-cd-pulse 1s ease-in-out infinite;
            pointer-events: none;
            /* subpixel sharpness */
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            will-change: transform, opacity;
            transform: translateZ(0);
        }
        #advAutoFetchCountdown[hidden] { display: none; }
        @keyframes adv-cd-pulse {
            0%, 100% { transform: scale(1);   opacity: 1; }
            50%       { transform: scale(1.1); opacity: 0.85; }
        }

        /* ── auto-fetch popover ─────────────────────────────── */
        #advAutoFetchPanel {
            position: absolute;
            top: calc(100% - 1px);
            left: 10px;
            z-index: 31;
            width: 258px;
            box-sizing: border-box;
            background: #ffffff;
            border: 1px solid #d0d7de;
            border-radius: 8px;
            box-shadow: 0 12px 32px rgba(31, 35, 40, 0.18);
            padding: 10px 12px 12px;
            font-size: 12px;
            color: #24292f;
        }
        #advAutoFetchPanel[hidden] { display: none; }
        #advAutoFetchPanel .adv-af-head {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 10px;
        }
        #advAutoFetchPanel .adv-af-title {
            font-size: 12px;
            font-weight: 600;
        }
        #advAutoFetchPanel .adv-af-close {
            margin-left: auto;
            border: none;
            background: none;
            color: #8c959f;
            font-size: 12px;
            line-height: 1;
            cursor: pointer;
            padding: 2px 5px;
            border-radius: 4px;
        }
        #advAutoFetchPanel .adv-af-close:hover {
            color: #24292f;
            background: #eaeef2;
        }
        #advAutoFetchPanel .adv-af-row {
            display: grid;
            grid-template-columns: 32px 1fr 32px;
            align-items: center;
            gap: 8px;
            margin-bottom: 8px;
        }
        #advAutoFetchPanel .adv-af-row > label {
            font-size: 11px;
            font-weight: 500;
            color: #57606a;
        }
        #advAutoFetchPanel .adv-af-val {
            font-size: 11px;
            font-weight: 600;
            text-align: right;
            font-variant-numeric: tabular-nums;
        }
        #advAutoFetchPanel .adv-af-hint {
            margin-top: 4px;
            font-size: 10.5px;
            line-height: 1.35;
            color: #8c959f;
        }
        #advAutoFetchPanel input[type="range"] {
            -webkit-appearance: none;
            appearance: none;
            width: 100%;
            height: 4px;
            margin: 0;
            border-radius: 999px;
            background: #e1e4e8;
            outline: none;
            cursor: pointer;
        }
        #advAutoFetchPanel input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 13px;
            height: 13px;
            border-radius: 50%;
            background: #ffffff;
            border: 2px solid #003e7e;
            box-shadow: 0 1px 3px rgba(27, 31, 36, 0.25);
            cursor: pointer;
            transition: transform 0.12s;
        }
        #advAutoFetchPanel input[type="range"]::-webkit-slider-thumb:hover { transform: scale(1.12); }
        #advAutoFetchPanel input[type="range"]::-moz-range-track {
            height: 4px;
            border-radius: 999px;
            background: transparent;
        }
        #advAutoFetchPanel input[type="range"]::-moz-range-thumb {
            width: 13px;
            height: 13px;
            border-radius: 50%;
            background: #ffffff;
            border: 2px solid #003e7e;
            box-shadow: 0 1px 3px rgba(27, 31, 36, 0.25);
            cursor: pointer;
        }
        #advAutoFetchPanel input[type="range"]:focus-visible {
            box-shadow: 0 0 0 3px rgba(0, 62, 126, 0.15);
        }

        /* ── switch ─────────────────────────────────────────── */
        #advAutoFetchPanel .adv-af-switch {
            position: relative;
            display: inline-flex;
            align-items: center;
            cursor: pointer;
        }
        #advAutoFetchPanel .adv-af-switch input {
            position: absolute;
            opacity: 0;
            width: 0;
            height: 0;
        }
        #advAutoFetchPanel .adv-af-track {
            position: relative;
            width: 30px;
            height: 16px;
            border-radius: 999px;
            background: #d0d7de;
            transition: background 0.15s;
        }
        #advAutoFetchPanel .adv-af-track::after {
            content: "";
            position: absolute;
            top: 2px;
            left: 2px;
            width: 12px;
            height: 12px;
            border-radius: 50%;
            background: #ffffff;
            box-shadow: 0 1px 2px rgba(27, 31, 36, 0.3);
            transition: transform 0.15s;
        }
        #advAutoFetchPanel .adv-af-switch input:checked + .adv-af-track { background: #003e7e; }
        #advAutoFetchPanel .adv-af-switch input:checked + .adv-af-track::after { transform: translateX(14px); }
        #advAutoFetchPanel .adv-af-switch input:focus-visible + .adv-af-track {
            box-shadow: 0 0 0 3px rgba(0, 62, 126, 0.2);
        }
        #advCourseFetchStatus {
            font-size: 11px;
            color: #57606a;
        }
        #advCourseFetchStatus[role="button"] {
            cursor: pointer;
            text-decoration: underline dotted;
            text-underline-offset: 2px;
        }
        #advCourseFetchStatus[role="button"]:hover {
            text-decoration-style: solid;
        }
        #advCourseSearchContainer {
            position: relative;
        }
        /* ── "N changes" details panel ──────────────────────── */
        #advCourseFetchDetails {
            position: absolute;
            top: calc(100% - 1px);
            left: 10px;
            right: 10px;
            z-index: 30;
            max-height: 320px;
            overflow: auto;
            box-sizing: border-box;
            background: #ffffff;
            border: 1px solid #d0d7de;
            border-radius: 8px;
            box-shadow: 0 12px 32px rgba(31, 35, 40, 0.18);
            padding: 0;
            font-size: 12px;
            color: #24292f;
        }
        #advCourseFetchDetails[hidden] {
            display: none;
        }
        #advCourseFetchDetails .adv-fd-head {
            position: sticky;
            top: 0;
            z-index: 1;
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 12px;
            background: #f6f8fa;
            border-bottom: 1px solid #d8dee4;
            border-radius: 8px 8px 0 0;
        }
        #advCourseFetchDetails .adv-fd-head b {
            font-size: 12px;
            font-weight: 600;
        }
        #advCourseFetchDetails .adv-fd-time {
            color: #57606a;
            font-size: 11px;
            font-variant-numeric: tabular-nums;
        }
        #advCourseFetchDetails .adv-fd-close {
            margin-left: auto;
            border: none;
            background: none;
            color: #8c959f;
            font-size: 12px;
            line-height: 1;
            cursor: pointer;
            padding: 2px 5px;
            border-radius: 4px;
            transition: background 0.15s, color 0.15s;
        }
        #advCourseFetchDetails .adv-fd-close:hover {
            color: #24292f;
            background: #eaeef2;
        }
        #advCourseFetchDetails .adv-fd-summary {
            padding: 10px 12px 2px;
            font-weight: 600;
        }
        #advCourseFetchDetails .adv-fd-summary:last-child {
            padding-bottom: 12px;
        }
        #advCourseFetchDetails .adv-fd-error {
            padding: 10px 12px 12px;
            color: #cf222e;
            word-break: break-word;
        }
        #advCourseFetchDetails .adv-fd-section {
            padding: 0 12px 8px;
        }
        #advCourseFetchDetails h4 {
            margin: 10px 0 4px;
            font-size: 10.5px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            color: #57606a;
        }
        #advCourseFetchDetails table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;   /* same column positions in every section */
        }
        #advCourseFetchDetails td:nth-child(1) { width: 110px; }
        #advCourseFetchDetails td:nth-child(2) { width: 150px; }
        #advCourseFetchDetails td {
            padding: 3px 8px 3px 0;
            border-bottom: 1px solid #eaeef2;
            vertical-align: top;
        }
        #advCourseFetchDetails tr:last-child td { border-bottom: none; }
        #advCourseFetchDetails td.k {
            font-weight: 600;
            overflow-wrap: anywhere;
        }
        #advCourseFetchDetails .adv-chip {
            display: inline-block;
            padding: 1px 7px;
            margin: 0 4px 2px 0;
            border-radius: 999px;
            background: #eef1f4;
            border: 1px solid #e1e4e8;
            font-size: 10.5px;
            font-weight: 500;
            line-height: 1.5;
        }
        #advCourseFetchDetails .adv-chip.full { background: #ffebe9; border-color: #ffcecb; color: #a40e26; }
        #advCourseFetchDetails .adv-chip.open { background: #dafbe1; border-color: #aceebb; color: #116329; }
        #advCourseFetchDetails .adv-chip.new  { background: #ddf4ff; border-color: #b6e3ff; color: #0550ae; }
        #advCourseFetchStatus.changed {
            color: #003e7e;
            font-weight: 600;
        }
        #advCourseFetchStatus.error {
            color: #cf222e;
            font-weight: 600;
            cursor: help;
        }
        @keyframes advFlash {
            from { background-color: #fff3b0; }
            to   { background-color: transparent; }
        }
        #courseList td.adv-changed {
            animation: advFlash 3s ease-out;
        }
        #courseList tbody tr[data-search-hidden="true"] {
            display: none !important;
        }
    `;
    document.head.appendChild(style);
}
