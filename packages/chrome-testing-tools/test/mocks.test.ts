import { mockBrowser, mockChrome } from '../src/mocks';

describe('mocks', () => {
  it('should be defined', () => {
    expect(mockBrowser).toBeDefined();
    expect(mockChrome).toBeDefined();
  });
});
