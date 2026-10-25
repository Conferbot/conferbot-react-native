/**
 * Placeholder citation markers in AI answers (#96), the cases of
 * embed-server utils/citationMarkers.js stripPlaceholderMarkers.
 */
import { stripPlaceholderMarkers } from '../../src/core/citationMarkers';

describe('placeholder citation markers', () => {
  it('placeholders go, with the space before them', () => {
    expect(stripPlaceholderMarkers('Wie Sie zit. [n] Als Kunde')).toBe('Wie Sie zit. Als Kunde');
    expect(stripPlaceholderMarkers('zit. [n] Als')).toBe('zit. Als');
    expect(stripPlaceholderMarkers('Plans start at $9 [1, n].')).toBe('Plans start at $9.');
    expect(stripPlaceholderMarkers('Yes [N].')).toBe('Yes.');
    expect(stripPlaceholderMarkers('See the guide [source].')).toBe('See the guide.');
    expect(stripPlaceholderMarkers('Open daily [web:2], weekends too')).toBe('Open daily, weekends too');
  });

  it('numbers, words, links and checkboxes stay', () => {
    expect(stripPlaceholderMarkers('[Klik hier]')).toBe('[Klik hier]');
    expect(stripPlaceholderMarkers('See step [2].')).toBe('See step [2].');
    expect(stripPlaceholderMarkers('[n](https://x)')).toBe('[n](https://x)');
    expect(stripPlaceholderMarkers('- [x] done')).toBe('- [x] done');
    expect(stripPlaceholderMarkers('Nothing here . really')).toBe('Nothing here . really');
  });
});
