// Excel (.xlsx) Export Utility using JSZip
import JSZip from 'jszip';

export interface ExcelColumn {
  readonly key: string;
  readonly label: string;
}

export interface ExcelSheet {
  name: string;
  data: Record<string, unknown>[];
  columns: readonly ExcelColumn[];
}

// Escape XML special characters
function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Convert column index to Excel column letter (0 = A, 1 = B, ..., 26 = AA, etc.)
function getColumnLetter(index: number): string {
  let letter = '';
  while (index >= 0) {
    letter = String.fromCharCode((index % 26) + 65) + letter;
    index = Math.floor(index / 26) - 1;
  }
  return letter;
}

// Generate sheet XML content
function generateSheetXml(sheet: ExcelSheet): string {
  const { data, columns } = sheet;
  
  let rows = '';
  
  // Header row
  rows += '<row r="1">';
  columns.forEach((col, colIdx) => {
    const cellRef = `${getColumnLetter(colIdx)}1`;
    rows += `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(col.label)}</t></is></c>`;
  });
  rows += '</row>';
  
  // Data rows
  data.forEach((row, rowIdx) => {
    const rowNum = rowIdx + 2;
    rows += `<row r="${rowNum}">`;
    columns.forEach((col, colIdx) => {
      const cellRef = `${getColumnLetter(colIdx)}${rowNum}`;
      const value = row[col.key];
      const stringValue = value !== null && value !== undefined ? String(value) : '';
      
      // Check if it's a number
      if (typeof value === 'number' && !isNaN(value)) {
        rows += `<c r="${cellRef}"><v>${value}</v></c>`;
      } else {
        rows += `<c r="${cellRef}" t="inlineStr"><is><t>${escapeXml(stringValue)}</t></is></c>`;
      }
    });
    rows += '</row>';
  });
  
  const lastCol = getColumnLetter(columns.length - 1);
  const lastRow = data.length + 1;
  
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="A1:${lastCol}${lastRow}"/>
  <sheetViews>
    <sheetView tabSelected="1" workbookViewId="0">
      <selection activeCell="A1" sqref="A1"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <sheetData>${rows}</sheetData>
</worksheet>`;
}

// Generate the workbook XML
function generateWorkbookXml(sheets: readonly ExcelSheet[]): string {
  const sheetRefs = sheets
    .map((sheet, idx) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${idx + 1}" r:id="rId${idx + 1}"/>`)
    .join('');
  
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetRefs}</sheets>
</workbook>`;
}

// Generate workbook relationships
function generateWorkbookRels(sheets: readonly ExcelSheet[]): string {
  const rels = sheets
    .map((_, idx) => `<Relationship Id="rId${idx + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${idx + 1}.xml"/>`)
    .join('');
  
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${rels}
</Relationships>`;
}

// Generate content types
function generateContentTypes(sheets: readonly ExcelSheet[]): string {
  const sheetTypes = sheets
    .map((_, idx) => `<Override PartName="/xl/worksheets/sheet${idx + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
    .join('');
  
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  ${sheetTypes}
</Types>`;
}

// Generate root relationships
function generateRootRels(): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

/**
 * Generate and download an Excel file with multiple sheets
 */
export async function downloadExcel(
  sheets: readonly ExcelSheet[],
  filename: string
): Promise<void> {
  const zip = new JSZip();
  
  // Add root relationships
  zip.file('_rels/.rels', generateRootRels());
  
  // Add content types
  zip.file('[Content_Types].xml', generateContentTypes(sheets));
  
  // Add workbook
  zip.file('xl/workbook.xml', generateWorkbookXml(sheets));
  
  // Add workbook relationships
  zip.file('xl/_rels/workbook.xml.rels', generateWorkbookRels(sheets));
  
  // Add worksheets
  sheets.forEach((sheet, idx) => {
    zip.file(`xl/worksheets/sheet${idx + 1}.xml`, generateSheetXml(sheet));
  });
  
  // Generate the ZIP file as a blob
  const blob = await zip.generateAsync({ type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  
  // Download the file
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Download a single-sheet Excel file
 */
export async function downloadExcelSingleSheet<T extends Record<string, unknown>>(
  data: T[],
  columns: readonly ExcelColumn[],
  filename: string,
  sheetName = 'Data'
): Promise<void> {
  await downloadExcel([{ name: sheetName, data, columns }], filename);
}
