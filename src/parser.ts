/**
 * データ構造
 */
export type AppData = {
  [filename: string]: {
    [dataname: string]: {
      DATE: Date[];
      [columnName: string]: number[] | Date[];
    };
  };
};

export type FileData = {
  [dataname: string]: {
    DATE: Date[];
    [columnName: string]: number[] | Date[];
  };
};

/**
 * Shift-JISのArrayBufferを文字列にデコードします。
 * @param buffer Shift-JISでエンコードされたデータを含むArrayBuffer
 * @returns デコードされた文字列
 */
export function decodeShiftJIS(buffer: ArrayBuffer): string {
  const decoder = new TextDecoder('shift-jis');
  return decoder.decode(buffer);
}

/**
 * 標準的なCSVのルールに従って、単一のCSV行をパースします。
 * 引用符で囲まれたフィールド、エスケープされた引用符、空のフィールドを処理します。
 */
export function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let inQuotes = false;
  let currentField = '';

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          currentField += '"';
          i++; // Skip the escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        currentField += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        fields.push(currentField);
        currentField = '';
      } else {
        currentField += char;
      }
    }
  }
  fields.push(currentField);

  // GPU-Z logs often have trailing commas. They will manifest as an empty string at the end.
  return fields;
}

/**
 * テキストを行に分割し、CRLFとLFの両方を処理します。
 */
export function splitLines(text: string): string[] {
  return text.split(/\r?\n/);
}

/**
 * 値が数値としてパース可能かどうかを検証します。
 */
export function isNumeric(val: string): boolean {
  if (val.trim() === '') return false;
  const num = Number(val);
  return !isNaN(num);
}

/**
 * 文字列をDateオブジェクトに変換します。通常はYYYY-MM-DD HH:MM:SS形式です。
 */
export function parseDate(dateStr: string): Date {
  return new Date(dateStr);
}

/**
 * Dateオブジェクトを "yyyymmdd-HHMMSS" 形式にフォーマットします。
 */
export function formatDatasetName(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, '0');
  const yyyy = date.getFullYear();
  const mm = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const HH = pad(date.getHours());
  const MM = pad(date.getMinutes());
  const SS = pad(date.getSeconds());
  return `${yyyy}${mm}${dd}-${HH}${MM}${SS}`;
}

/**
 * GPU-Zログの生テキストをパースし、FileDataを返します。
 */
export function parseGpuZLog(text: string): FileData {
  const lines = splitLines(text);
  const fileData: FileData = {};

  let currentHeaders: string[] = [];
  let currentValidColumns: { index: number, name: string }[] = [];
  let currentDatasetName: string | null = null;

  // To detect header, usually we can check if the first column contains "Date" or doesn't parse as date/number
  // Or simply, any line that has "Date" in the first column is a header.

  for (const line of lines) {
    if (line.trim() === '') continue;

    const fields = parseCsvLine(line);

    // Check if it's a header line
    // GPU-Z headers start with "Date" (ignoring spaces)
    if (fields[0] && fields[0].trim().toUpperCase() === 'DATE') {
      currentHeaders = fields.map(f => f.trim());
      currentValidColumns = [];
      currentDatasetName = null; // Will be set on the first data row
      continue;
    }

    // It's a data row
    if (!currentHeaders || currentHeaders.length === 0) {
      // Skipping data without headers
      continue;
    }

    // If it's the first data row for the current header block
    if (!currentDatasetName) {
      const dateStr = fields[0]?.trim();
      if (!dateStr) continue;

      const date = parseDate(dateStr);
      if (isNaN(date.getTime())) continue; // Invalid date

      currentDatasetName = formatDatasetName(date);

      // Determine valid columns based on this first data row
      for (let i = 1; i < currentHeaders.length; i++) {
        const headerName = currentHeaders[i];
        if (!headerName) continue; // Drop empty header names

        const val = fields[i];
        if (val !== undefined && isNumeric(val)) {
          currentValidColumns.push({ index: i, name: headerName });
        }
      }

      // Initialize the dataset structure
      if (!fileData[currentDatasetName]) {
        fileData[currentDatasetName] = { DATE: [] };
        for (const col of currentValidColumns) {
          fileData[currentDatasetName][col.name] = [];
        }
      }
    }

    // Add the row to the current dataset
    const dateStr = fields[0]?.trim();
    if (!dateStr) continue;
    const date = parseDate(dateStr);
    if (isNaN(date.getTime())) continue;

    const dataset = fileData[currentDatasetName];
    dataset.DATE.push(date);

    for (const col of currentValidColumns) {
      const valStr = fields[col.index];
      const val = valStr !== undefined ? Number(valStr) : NaN;
      (dataset[col.name] as number[]).push(val);
    }
  }

  return fileData;
}
