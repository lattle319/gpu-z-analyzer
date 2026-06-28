import { describe, it, expect } from 'vitest';
import {
  decodeShiftJIS,
  parseCsvLine,
  splitLines,
  isNumeric,
  formatDatasetName,
  parseGpuZLog,
  parseDate
} from './parser';

describe('parser functions', () => {
  it('should decode Shift-JIS correctly', () => {
    // 0x82 0xA0 in Shift-JIS is 'あ'
    const shiftJisBytes = new Uint8Array([0x82, 0xA0]);
    const decoded = decodeShiftJIS(shiftJisBytes.buffer);
    expect(decoded).toBe('あ');
  });

  it('should parse CSV lines correctly', () => {
    expect(parseCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
    expect(parseCsvLine('a, b ,c')).toEqual(['a', ' b ', 'c']);
    expect(parseCsvLine('"a","b","c"')).toEqual(['a', 'b', 'c']);
    expect(parseCsvLine('a,"b,c",d')).toEqual(['a', 'b,c', 'd']);
    expect(parseCsvLine('a,"b""c",d')).toEqual(['a', 'b"c', 'd']);
    expect(parseCsvLine('a,b,c,')).toEqual(['a', 'b', 'c', '']);
  });

  it('should split lines correctly', () => {
    expect(splitLines('a\nb\nc')).toEqual(['a', 'b', 'c']);
    expect(splitLines('a\r\nb\r\nc')).toEqual(['a', 'b', 'c']);
  });

  it('should validate numeric values', () => {
    expect(isNumeric('123')).toBe(true);
    expect(isNumeric('123.45')).toBe(true);
    expect(isNumeric('-123.45')).toBe(true);
    expect(isNumeric('0')).toBe(true);
    expect(isNumeric('  123  ')).toBe(true);
    expect(isNumeric('abc')).toBe(false);
    expect(isNumeric('')).toBe(false);
    expect(isNumeric('   ')).toBe(false);
    expect(isNumeric('123a')).toBe(false);
  });

  it('should format dataset name correctly', () => {
    const date = new Date(2023, 10, 24, 15, 30, 45); // Month is 0-indexed, so 10 is Nov
    expect(formatDatasetName(date)).toBe('20231124-153045');
  });

  it('should parse date correctly', () => {
    const dateStr = '2023-11-24 15:30:45';
    const date = parseDate(dateStr);
    expect(date.getFullYear()).toBe(2023);
    expect(date.getMonth()).toBe(10);
    expect(date.getDate()).toBe(24);
    expect(date.getHours()).toBe(15);
    expect(date.getMinutes()).toBe(30);
    expect(date.getSeconds()).toBe(45);
  });

  it('should parse a simple GPU-Z log', () => {
    const logData = `        Date        , GPU Clock [MHz] , Memory Clock [MHz] , GPU Temperature [°C] ,   ,
2023-01-01 12:00:00 , 1500.0          , 2000.0             , 45.5                 ,   ,
2023-01-01 12:00:01 , 1510.0          , 2000.0             , 46.0                 ,   ,
`;
    const parsed = parseGpuZLog(logData);

    // Dataset name should be based on the first data row: 20230101-120000
    const keys = Object.keys(parsed);
    expect(keys.length).toBe(1);
    const datasetName = keys[0];
    expect(datasetName).toBe('20230101-120000');

    const dataset = parsed[datasetName];

    // Check columns
    // Columns should be trimmed. The empty column should be dropped.
    expect(dataset['GPU Clock [MHz]']).toBeDefined();
    expect(dataset['Memory Clock [MHz]']).toBeDefined();
    expect(dataset['GPU Temperature [°C]']).toBeDefined();
    expect(dataset['']).toBeUndefined();

    // Check lengths
    expect(dataset.DATE.length).toBe(2);
    expect((dataset['GPU Clock [MHz]'] as number[]).length).toBe(2);

    // Check values
    expect((dataset['GPU Clock [MHz]'] as number[])[0]).toBe(1500.0);
    expect((dataset['GPU Clock [MHz]'] as number[])[1]).toBe(1510.0);
  });

  it('should handle header splits correctly', () => {
    const logData = `        Date        , GPU Clock [MHz]
2023-01-01 12:00:00 , 1500.0
2023-01-01 12:00:01 , 1510.0
        Date        , GPU Clock [MHz] , Memory Clock [MHz]
2023-01-01 12:05:00 , 1400.0          , 2000.0
`;
    const parsed = parseGpuZLog(logData);

    const keys = Object.keys(parsed);
    expect(keys.length).toBe(2);

    expect(keys[0]).toBe('20230101-120000');
    expect(keys[1]).toBe('20230101-120500');

    expect(parsed[keys[0]]['GPU Clock [MHz]']).toBeDefined();
    expect(parsed[keys[0]]['Memory Clock [MHz]']).toBeUndefined();

    expect(parsed[keys[1]]['GPU Clock [MHz]']).toBeDefined();
    expect(parsed[keys[1]]['Memory Clock [MHz]']).toBeDefined();
  });

  it('should drop non-numeric columns based on first row', () => {
    const logData = `        Date        , GPU Clock [MHz] , Status
2023-01-01 12:00:00 , 1500.0          , OK
2023-01-01 12:00:01 , 1510.0          , ERR
`;
    const parsed = parseGpuZLog(logData);
    const keys = Object.keys(parsed);
    const dataset = parsed[keys[0]];

    expect(dataset['GPU Clock [MHz]']).toBeDefined();
    expect(dataset['Status']).toBeUndefined(); // Should be dropped
  });
});
