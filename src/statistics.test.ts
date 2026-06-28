import { describe, it, expect } from 'vitest';
import { calcMax, calcMin, calcMean, calcMedian } from './statistics';

describe('Statistics calculations', () => {
  it('should calculate max', () => {
    expect(calcMax([1, 5, 3, 9, 2])).toBe(9);
    expect(calcMax([-1, -5, -3])).toBe(-1);
    expect(calcMax([42])).toBe(42);
    expect(Number.isNaN(calcMax([]))).toBe(true);
  });

  it('should calculate min', () => {
    expect(calcMin([1, 5, 3, 9, 2])).toBe(1);
    expect(calcMin([-1, -5, -3])).toBe(-5);
    expect(calcMin([42])).toBe(42);
    expect(Number.isNaN(calcMin([]))).toBe(true);
  });

  it('should calculate mean', () => {
    expect(calcMean([1, 2, 3, 4, 5])).toBe(3);
    expect(calcMean([10, 20])).toBe(15);
    expect(calcMean([42])).toBe(42);
    expect(Number.isNaN(calcMean([]))).toBe(true);
  });

  it('should calculate median', () => {
    // Odd length
    expect(calcMedian([1, 5, 3, 9, 2])).toBe(3);
    // Even length
    expect(calcMedian([1, 2, 3, 4])).toBe(2.5);
    // Unsorted
    expect(calcMedian([10, 2, 30, 4])).toBe(7); // sorted: 2, 4, 10, 30 -> (4+10)/2
    expect(calcMedian([42])).toBe(42);
    expect(Number.isNaN(calcMedian([]))).toBe(true);
  });
});
