import { resolveChatBackground, backgroundSvg, gradientStops, rimPoint, PATTERNS, PATTERN_IDS } from '../../src/core/chatBackground';

describe('chat background as the web widget draws it', () => {
  it('is a white solid by default and reads the type in any case', () => {
    expect(resolveChatBackground({})).toEqual({ type: 'solid', color: '#ffffff' });
    expect(resolveChatBackground({ chatBgType: 'Gradient' }).type).toBe('gradient');
    expect(resolveChatBackground({ chatBgType: 'Image', chatBgImg: 'https://x/bg.jpg' }).type).toBe('image');
  });

  it('reads gradient stops, angle and style', () => {
    expect(gradientStops({})).toEqual(['#fffcf1', '#1b55f3']);
    expect(gradientStops({ chatBgGradientStops: ['#111', 'bogus(', '#222', '#333', '#444', '#555'] })).toEqual(['#111', '#222', '#333', '#444']);
    const g = resolveChatBackground({ chatBgType: 'gradient', chatBgGradientAngle: 400, chatBgGradientStyle: 'mesh' });
    expect(g).toMatchObject({ angle: 360, style: 'mesh' });
    expect(resolveChatBackground({ chatBgType: 'gradient', chatBgGradientStyle: 'nope' })).toMatchObject({ style: 'linear', angle: 180 });
  });

  it('masks images only when an opacity is set, and refuses script urls', () => {
    expect(resolveChatBackground({ chatBgType: 'image', chatBgImg: 'https://x/bg.jpg' })).toMatchObject({ mask: null });
    expect(resolveChatBackground({ chatBgType: 'image', chatBgImg: 'https://x/bg.jpg', chatBgMaskOpacity: 95, chatBgMaskColor: '#123456' }))
      .toMatchObject({ mask: { color: '#123456', alpha: 0.9 } });
    expect(resolveChatBackground({ chatBgType: 'image', chatBgImg: 'javascript:alert(1)' })).toEqual({ type: 'solid', color: '#ffffff' });
  });

  it('reads patterns with the web defaults and has every tile', () => {
    expect(resolveChatBackground({ chatBgType: 'pattern' })).toEqual({ type: 'pattern', color: '#ffffff', pattern: 'dots', ink: '#0f172a', alpha: 0.12 });
    expect(PATTERN_IDS.every((id) => PATTERNS[id] && PATTERNS[id].w > 0)).toBe(true);
    expect(PATTERNS.doodles.shapes.length).toBeGreaterThan(5);
  });

  it('draws gradients and patterns as svg', () => {
    expect(rimPoint(0)).toEqual([0.5, 0]);
    expect(rimPoint(90)).toEqual([1, 0.5]);
    const linear = backgroundSvg(resolveChatBackground({ chatBgType: 'gradient' }), 300, 600)!;
    expect(linear).toContain('<linearGradient id="g" x1="0.5" y1="0" x2="0.5" y2="1">');
    const pattern = backgroundSvg(resolveChatBackground({ chatBgType: 'pattern', chatBgPattern: 'grid', chatBgPatternColor: '#ff0000' }), 300, 600)!;
    expect(pattern).toContain('<pattern id="p" patternUnits="userSpaceOnUse" width="24" height="24">');
    expect(pattern).toContain('stroke="#ff0000"');
    expect(backgroundSvg(resolveChatBackground({}), 300, 600)).toBeNull();
  });
});
