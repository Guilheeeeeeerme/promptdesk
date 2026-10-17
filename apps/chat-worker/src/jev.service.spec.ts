import { parseJevMode, JEV_INPUT_USD_PER_MILLION } from './jev.service';
import {
  buildGuidelineQuestions,
  statusFromJevChoice,
} from './jev-guideline.provider';

describe('JevService helpers', () => {
  it('parses modes with active-when-keyed default', () => {
    expect(parseJevMode(undefined, true)).toBe('active');
    expect(parseJevMode('', false)).toBe('off');
    expect(parseJevMode(' shadow ', true)).toBe('shadow');
    expect(() => parseJevMode('on', true)).toThrow(/invalid JEV mode/);
  });

  it('builds closed guideline Choice criteria', () => {
    const q = buildGuidelineQuestions();
    expect(Object.keys(q.status!.criteria).sort()).toEqual([
      'invalid',
      'malicious',
      'valid',
    ]);
  });

  it('maps choice to status', () => {
    expect(statusFromJevChoice('valid')).toBe('valid');
    expect(statusFromJevChoice('nope')).toBeNull();
  });

  it('keeps JEV list price constant', () => {
    expect(JEV_INPUT_USD_PER_MILLION).toBe(0.042);
  });
});
