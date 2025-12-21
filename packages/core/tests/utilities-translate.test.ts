import { test, expect, describe } from 'bun:test';
import * as TranslateUtils from '../src/utilities-translate-bundle';

describe('Bundled translate utilities', () => {
  test('exports processDocuments function', () => {
    expect(typeof TranslateUtils.processDocuments).toBe('function');
  });

  test('exports requestDocument function', () => {
    expect(typeof TranslateUtils.requestDocument).toBe('function');
  });

  test('exports request function', () => {
    expect(typeof TranslateUtils.request).toBe('function');
  });

  test('exports requestText function', () => {
    expect(typeof TranslateUtils.requestText).toBe('function');
  });

  test('exports requestJSON function', () => {
    expect(typeof TranslateUtils.requestJSON).toBe('function');
  });

  test('exports getItemArray function', () => {
    expect(typeof TranslateUtils.getItemArray).toBe('function');
  });

  test('exports getVersion function', () => {
    expect(typeof TranslateUtils.getVersion).toBe('function');
    // Should return a version string
    expect(TranslateUtils.getVersion()).toMatch(/\d+\.\d+/);
  });

  test('exports doGet function', () => {
    expect(typeof TranslateUtils.doGet).toBe('function');
  });

  test('exports doPost function', () => {
    expect(typeof TranslateUtils.doPost).toBe('function');
  });

  test('exports ZU re-export', () => {
    expect(TranslateUtils.ZU).toBeDefined();
    expect(typeof TranslateUtils.ZU).toBe('object');
  });
});
