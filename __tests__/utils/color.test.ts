import { toHex6, mix } from '../../src/theme/color';

describe('theme colours', () => {
  it('normalizes server colours to six-digit hex', () => {
    expect(toHex6('#fff')).toBe('#ffffff');
    expect(toHex6('#0B4EB8')).toBe('#0b4eb8');
    expect(toHex6('#0b4eb880')).toBe('#0b4eb8');
    expect(toHex6('rgb(11, 78, 184)')).toBe('#0b4eb8');
    expect(toHex6('rgba(255,0,0,0.5)')).toBe('#ff0000');
    expect(toHex6('blue')).toBeNull();
    expect(toHex6(undefined)).toBeNull();
  });

  it('a two-digit alpha appended to it is a valid colour', () => {
    expect(/^#[0-9a-f]{8}$/.test(`${toHex6('#fff')}BF`.toLowerCase())).toBe(true);
  });

  it('mixes toward another colour', () => {
    expect(mix('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mix('#0b4eb8', '#ffffff', 0)).toBe('#0b4eb8');
    expect(mix('nope', '#ffffff', 0.5)).toBe('nope');
  });
});
