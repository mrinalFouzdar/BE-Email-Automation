

// Convert Gmail RFC822 date → JS Date → ISO string
function parseDate(dateStr: string): string {
  if (!dateStr) return new Date().toISOString(); // fallback

  try {
    // Example Gmail date format:
    // Sun, 23 Nov 2025 09:32:59 +0000 (UTC)
    const cleaned = dateStr.replace(/\(.*?\)/g, "").trim();

    return new Date(cleaned).toISOString(); // ISO8601 for Postgres
  } catch (e) {
    console.error("Failed to parse Gmail date:", dateStr);
    return new Date().toISOString();
  }
};


function formatToISO(date: Date): string {
  return date.toISOString();
}


function parseGmailHeaderDate(value?: string): Date {
  const cleaned = value?.replace(/\(.*?\)/g, "").trim() || "";
  return new Date(cleaned);
}
export {
  parseDate,
  formatToISO,
  parseGmailHeaderDate
};