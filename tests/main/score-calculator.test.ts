import { describe, it, expect } from 'vitest';
import ScoreCalculator from '../../src/main/score-calculator';

describe('ScoreCalculator', () => {
  it('should start at base score 10000', () => {
    const calc = new ScoreCalculator();
    expect(calc.currentScore).toBe(10000);
    expect(calc.currentLoc).toBe(0);
  });

  it('should restore from saved state', () => {
    const calc = new ScoreCalculator(10500, 250);
    expect(calc.currentScore).toBe(10500);
    expect(calc.currentLoc).toBe(250);
  });

  it('should calculate score delta for line additions', () => {
    const calc = new ScoreCalculator();
    const delta = calc.calculateDelta(5, 0, false, false);
    expect(delta).toBe(10); // 5 lines * 2 points
  });

  it('should calculate score delta for line deletions', () => {
    const calc = new ScoreCalculator();
    const delta = calc.calculateDelta(0, 3, false, false);
    expect(delta).toBe(-6); // 3 lines * -2 points
  });

  it('should calculate score delta for file creation', () => {
    const calc = new ScoreCalculator();
    const delta = calc.calculateDelta(0, 0, true, false);
    expect(delta).toBe(100);
  });

  it('should calculate score delta for file deletion', () => {
    const calc = new ScoreCalculator();
    const delta = calc.calculateDelta(0, 0, false, true);
    expect(delta).toBe(-100);
  });

  it('should calculate combined delta', () => {
    const calc = new ScoreCalculator();
    const delta = calc.calculateDelta(10, 2, true, false);
    expect(delta).toBe(116); // 10*2 - 2*2 + 100
  });

  it('should apply delta and update state', () => {
    const calc = new ScoreCalculator();
    calc.apply(5, 0, false, false);
    expect(calc.currentScore).toBe(10010);
    expect(calc.currentLoc).toBe(5);
  });

  it('should apply file creation delta', () => {
    const calc = new ScoreCalculator();
    calc.apply(50, 0, true, false);
    expect(calc.currentScore).toBe(10200);
    expect(calc.currentLoc).toBe(50);
  });

  it('should track high and low', () => {
    const calc = new ScoreCalculator();
    calc.apply(10, 0, false, false); // 10020
    expect(calc.highScore).toBe(10020);
    expect(calc.lowScore).toBe(10000);

    calc.apply(0, 20, false, false); // 9980
    expect(calc.highScore).toBe(10020);
    expect(calc.lowScore).toBe(9980);
  });
});
