import { isEmptyString, isValidUrl } from '../src/validation';

describe('isEmptyString', () => {
  it('should return true for empty string', () => {
    expect(isEmptyString('')).toBe(true);
  });

  it('should return true for string with only spaces', () => {
    expect(isEmptyString('   ')).toBe(true);
  });

  it('should return false for non-empty string', () => {
    expect(isEmptyString('hello')).toBe(false);
  });

  it('should return false for string with non-space characters', () => {
    expect(isEmptyString('  hello  ')).toBe(false);
  });
});

describe('isValidUrl', () => {
  it('should return true for valid URL', () => {
    expect(isValidUrl('https://www.example.com')).toBe(true);
  });

  it('should return false for invalid URL', () => {
    expect(isValidUrl('invalid-url')).toBe(false);
  });

  it('should return false for empty string', () => {
    expect(isValidUrl('')).toBe(false);
  });

  it('should return true for URL with query parameters', () => {
    expect(isValidUrl('https://www.example.com?param=value')).toBe(true);
  });
});
