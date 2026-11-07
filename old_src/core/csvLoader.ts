/**
 * CSV Loader utility for runtime (browser).
 *
 * Provides helpers for parsing CSV text into arrays of objects,
 * and optionally fetching CSV files from the data/ directory.
 */

/**
 * Parse raw CSV text into an array of objects.
 * Handles quoted fields, commas inside quotes, and empty fields.
 *
 * @param {string} csvText - raw CSV content
 * @returns {object[]} array of row objects keyed by header names
 */
export function parseCSVText(csvText: string): Record<string, string>[] {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) return [];

    const headers = lines[0].split(",").map(h => h.trim());
    const data: Record<string, string>[] = [];

    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const values: string[] = [];
        let current = "";
        let inQuote = false;

        for (let j = 0; j < line.length; j++) {
            const char = line[j];
            if (char === '"') {
                if (inQuote && line[j + 1] === '"') {
                    current += '"';
                    j++;
                } else {
                    inQuote = !inQuote;
                }
            } else if (char === ',' && !inQuote) {
                values.push(current.trim());
                current = "";
            } else {
                current += char;
            }
        }
        values.push(current.trim());

        const obj: Record<string, string> = {};
        headers.forEach((header, index) => {
            let value = values[index];
            if (value === undefined || value === null) value = '';
            if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
            }
            value = value.trim();
            if (!header || value === "") return;
            obj[header] = value;
        });

        data.push(obj);
    }

    return data;
}

/**
 * Fetch and parse a CSV file from a URL.
 *
 * @param {string} url - URL or relative path to the CSV file (e.g. "data/units.csv")
 * @returns {Promise<object[]>} parsed CSV rows
 */
export async function loadCSV(url: string): Promise<Record<string, string>[]> {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to load CSV: ${url} (${response.status})`);
    }
    const text = await response.text();
    return parseCSVText(text);
}

/**
 * Build a lookup map from a parsed CSV array, keyed by the given field.
 *
 * @param {object[]} rows - parsed CSV rows
 * @param {string} keyField - field name to use as key (default "id")
 * @returns {Object<string, object>} map of key → row object
 */
export function buildLookupMap<T extends Record<string, unknown>>(rows: T[], keyField = "id"): Record<string, T> {
    const map: Record<string, T> = {};
    for (const row of rows) {
        const key = row[keyField];
        if (typeof key === "string" && key) map[key] = row;
    }
    return map;
}
