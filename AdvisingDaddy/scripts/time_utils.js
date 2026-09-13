// scripts/time_utils.js

export function parseDayFromTime(timeText) {
    const value = (timeText || "").trim();
    const match = value.match(/^([A-Za-z]+)\s+/);
    return match ? match[1].toUpperCase() : "";
}

export function to24HourTimeString(timeString) {
    const str = (timeString || "").trim();
    const directMatch = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (directMatch) {
        const pad = (num) => String(num).padStart(2, "0");
        return `${pad(directMatch[1])}:${pad(directMatch[2])}:${pad(directMatch[3] ? directMatch[3] : 0)}`;
    }

    const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
    if (!match) return null;

    let hours = Number(match[1]);
    const minutes = Number(match[2]);
    const seconds = match[3] ? Number(match[3]) : 0;
    const period = match[4].toUpperCase();

    if (period === "AM" && hours === 12) hours = 0;
    if (period === "PM" && hours !== 12) hours += 12;

    const pad = (num) => String(num).padStart(2, "0");
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function parseTimeRange(timeText) {
    const value = (timeText || "").trim();
    const withoutDay = value.replace(/^[A-Za-z]+\s+/, "").trim();
    const match = withoutDay.match(/^(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)\s*-\s*(\d{1,2}:\d{2}(?::\d{2})?\s*(?:AM|PM)?)$/i);
    if (!match) return [];

    let startStr = match[1].trim();
    const endStr = match[2].trim();

    if (!/AM|PM/i.test(startStr) && /AM|PM/i.test(endStr)) {
        const endPeriod = /AM|PM/i.exec(endStr)?.[0] || "AM";
        startStr += ` ${endPeriod}`;
    }

    const start = to24HourTimeString(startStr);
    const end = to24HourTimeString(endStr);
    if (!start || !end) return [];
    return [start, end];
}

export function formatToAmPm(timeStr) {
    if (!timeStr) return "";
    const str = String(timeStr).trim();
    if (/AM|PM/i.test(str)) return str;

    const match = str.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
    if (!match) return str;

    let hours = parseInt(match[1], 10);
    const minutes = match[2];
    const period = hours >= 12 ? "PM" : "AM";

    if (hours === 0) {
        hours = 12;
    } else if (hours > 12) {
        hours -= 12;
    }

    const padH = String(hours).padStart(2, "0");
    return `${padH}:${minutes} ${period}`;
}

export function formatDisplayTime(timeVal) {
    if (!timeVal) return "-";
    if (Array.isArray(timeVal)) {
        if (timeVal.length === 2) {
            const start = formatToAmPm(timeVal[0]);
            const end = formatToAmPm(timeVal[1]);
            return `${start} - ${end}`;
        }
        return timeVal.map(formatToAmPm).join(" - ");
    }
    const str = String(timeVal).trim();
    const rangeMatch = str.match(/^(\d{1,2}:\d{2}(?::\d{2})?)\s*-\s*(\d{1,2}:\d{2}(?::\d{2})?)$/);
    if (rangeMatch) {
        return `${formatToAmPm(rangeMatch[1])} - ${formatToAmPm(rangeMatch[2])}`;
    }
    return str;
}
