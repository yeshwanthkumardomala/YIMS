// CSV Import/Export Utilities

export interface CSVParseResult<T> {
  data: T[];
  errors: CSVError[];
  warnings: string[];
}

export interface CSVError {
  row: number;
  column?: string;
  message: string;
}

export interface ImportResult {
  success: number;
  failed: number;
  errors: CSVError[];
}

// Parse CSV string to array of objects
export function parseCSV<T extends Record<string, unknown>>(
  csvText: string,
  requiredColumns: string[]
): CSVParseResult<T> {
  const lines = csvText.trim().split('\n');
  const errors: CSVError[] = [];
  const warnings: string[] = [];
  const data: T[] = [];

  if (lines.length < 2) {
    errors.push({ row: 0, message: 'CSV file must have a header row and at least one data row' });
    return { data, errors, warnings };
  }

  // Parse header
  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());

  // Check required columns
  for (const required of requiredColumns) {
    if (!headers.includes(required.toLowerCase())) {
      errors.push({ row: 1, column: required, message: `Missing required column: ${required}` });
    }
  }

  if (errors.length > 0) {
    return { data, errors, warnings };
  }

  // Parse data rows
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCSVLine(line);
    const row: Record<string, unknown> = {};

    for (let j = 0; j < headers.length; j++) {
      const header = headers[j];
      const value = values[j]?.trim() || '';
      row[header] = value;
    }

    data.push(row as T);
  }

  return { data, errors, warnings };
}

// Parse a single CSV line handling quoted values
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    const nextChar = line[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

// Convert array of objects to CSV string
export function toCSV<T extends Record<string, unknown>>(
  data: T[],
  columns: readonly { key: keyof T; label: string }[]
): string {
  const header = columns.map((c) => escapeCSVValue(c.label)).join(',');
  const rows = data.map((row) =>
    columns.map((c) => escapeCSVValue(String(row[c.key] ?? ''))).join(',')
  );
  return [header, ...rows].join('\n');
}

// Escape CSV value (handle commas, quotes, newlines)
function escapeCSVValue(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

// Download CSV file
export function downloadCSV(csvContent: string, filename: string): void {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Item CSV columns
export const ITEM_CSV_COLUMNS = [
  { key: 'code', label: 'Code', required: false },
  { key: 'name', label: 'Name', required: true },
  { key: 'description', label: 'Description', required: false },
  { key: 'category_name', label: 'Category', required: false },
  { key: 'location_name', label: 'Location', required: false },
  { key: 'current_stock', label: 'Current Stock', required: false },
  { key: 'minimum_stock', label: 'Minimum Stock', required: false },
  { key: 'unit', label: 'Unit', required: false },
] as const;

// Location CSV columns
export const LOCATION_CSV_COLUMNS = [
  { key: 'code', label: 'Code', required: false },
  { key: 'name', label: 'Name', required: true },
  { key: 'location_type', label: 'Type', required: true },
  { key: 'parent_name', label: 'Parent Location', required: false },
  { key: 'description', label: 'Description', required: false },
] as const;

// Stock transaction CSV columns
export const STOCK_CSV_COLUMNS = [
  { key: 'item_code', label: 'Item Code', required: true },
  { key: 'item_name', label: 'Item Name', required: false },
  { key: 'transaction_type', label: 'Type', required: true },
  { key: 'quantity', label: 'Quantity', required: true },
  { key: 'notes', label: 'Notes', required: false },
] as const;

// Generate template CSV
export function generateTemplate(type: 'items' | 'locations' | 'stock'): string {
  switch (type) {
    case 'items':
      return 'Name,Description,Category,Location,Current Stock,Minimum Stock,Unit\n"Example Item","An example item","Category Name","Room 101",50,10,pcs';
    case 'locations':
      return 'Name,Type,Parent Location,Description\n"Main Building",building,,"The main building"\n"Room 101",room,"Main Building","First floor room"';
    case 'stock':
      return 'Item Code,Type,Quantity,Notes\nYIMS:ITEM:00001,stock_in,100,"Initial stock"';
    default:
      return '';
  }
}

// Validate item import row
export function validateItemRow(
  row: Record<string, string>,
  rowIndex: number,
  categoryNames: Set<string>,
  locationNames: Set<string>
): CSVError[] {
  const errors: CSVError[] = [];

  if (!row.name?.trim()) {
    errors.push({ row: rowIndex, column: 'Name', message: 'Name is required' });
  }

  if (row.category && !categoryNames.has(row.category.toLowerCase())) {
    errors.push({
      row: rowIndex,
      column: 'Category',
      message: `Category "${row.category}" not found`,
    });
  }

  if (row.location && !locationNames.has(row.location.toLowerCase())) {
    errors.push({
      row: rowIndex,
      column: 'Location',
      message: `Location "${row.location}" not found`,
    });
  }

  const currentStock = parseInt(row['current stock'] || '0');
  if (row['current stock'] && isNaN(currentStock)) {
    errors.push({ row: rowIndex, column: 'Current Stock', message: 'Must be a number' });
  }

  const minStock = parseInt(row['minimum stock'] || '0');
  if (row['minimum stock'] && isNaN(minStock)) {
    errors.push({ row: rowIndex, column: 'Minimum Stock', message: 'Must be a number' });
  }

  return errors;
}

// Validate location import row
export function validateLocationRow(
  row: Record<string, string>,
  rowIndex: number,
  existingLocationNames: Set<string>,
  validTypes: string[]
): CSVError[] {
  const errors: CSVError[] = [];

  if (!row.name?.trim()) {
    errors.push({ row: rowIndex, column: 'Name', message: 'Name is required' });
  }

  if (!row.type?.trim()) {
    errors.push({ row: rowIndex, column: 'Type', message: 'Type is required' });
  } else if (!validTypes.includes(row.type.toLowerCase())) {
    errors.push({
      row: rowIndex,
      column: 'Type',
      message: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
    });
  }

  if (row['parent location'] && !existingLocationNames.has(row['parent location'].toLowerCase())) {
    errors.push({
      row: rowIndex,
      column: 'Parent Location',
      message: `Parent location "${row['parent location']}" not found`,
    });
  }

  return errors;
}

// Validate stock import row
export function validateStockRow(
  row: Record<string, string>,
  rowIndex: number,
  itemCodes: Set<string>,
  validTypes: string[]
): CSVError[] {
  const errors: CSVError[] = [];

  if (!row['item code']?.trim()) {
    errors.push({ row: rowIndex, column: 'Item Code', message: 'Item Code is required' });
  } else if (!itemCodes.has(row['item code'].trim())) {
    errors.push({
      row: rowIndex,
      column: 'Item Code',
      message: `Item with code "${row['item code']}" not found`,
    });
  }

  if (!row.type?.trim()) {
    errors.push({ row: rowIndex, column: 'Type', message: 'Type is required' });
  } else if (!validTypes.includes(row.type.toLowerCase())) {
    errors.push({
      row: rowIndex,
      column: 'Type',
      message: `Invalid type. Must be one of: ${validTypes.join(', ')}`,
    });
  }

  const quantity = parseInt(row.quantity || '0');
  if (!row.quantity?.trim() || isNaN(quantity) || quantity <= 0) {
    errors.push({ row: rowIndex, column: 'Quantity', message: 'Quantity must be a positive number' });
  }

  return errors;
}
