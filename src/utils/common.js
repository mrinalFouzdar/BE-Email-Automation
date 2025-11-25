"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDate = parseDate;
exports.formatToISO = formatToISO;
exports.parseGmailHeaderDate = parseGmailHeaderDate;
// Convert Gmail RFC822 date → JS Date → ISO string
function parseDate(dateStr) {
    if (!dateStr)
        return new Date().toISOString(); // fallback
    try {
        // Example Gmail date format:
        // Sun, 23 Nov 2025 09:32:59 +0000 (UTC)
        const cleaned = dateStr.replace(/\(.*?\)/g, "").trim();
        return new Date(cleaned).toISOString(); // ISO8601 for Postgres
    }
    catch (e) {
        console.error("Failed to parse Gmail date:", dateStr);
        return new Date().toISOString();
    }
}
;
function formatToISO(date) {
    return date.toISOString();
}
function parseGmailHeaderDate(value) {
    const cleaned = value?.replace(/\(.*?\)/g, "").trim() || "";
    return new Date(cleaned);
}
