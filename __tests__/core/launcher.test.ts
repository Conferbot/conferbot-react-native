import { resolveLauncher, normalizeLauncherShape, normalizeLauncherLabel } from '../../src/core/launcher';

describe('launcher as the web draws it on a phone', () => {
  it('is a 50px speech bubble 16px from the bottom right by default', () => {
    const l = resolveLauncher({});
    expect(l.shape).toBe('bubble');
    expect(l.position).toBe('right');
    expect(l.size).toBe(50);
    expect([l.bottom, l.side]).toEqual([16, 16]);
    // The tail on the corner nearest the screen corner.
    expect(l.corners).toEqual({ topLeft: 25, topRight: 25, bottomRight: 6, bottomLeft: 25 });
    expect(resolveLauncher({ widgetPosition: 'left' }).corners.bottomLeft).toBe(6);
  });

  it('keeps an owner-rounded button round', () => {
    expect(normalizeLauncherShape(undefined, 12)).toBe('circle');
    expect(normalizeLauncherShape(undefined, 50)).toBe('bubble');
    expect(normalizeLauncherShape('peek', 12)).toBe('peek');
    expect(resolveLauncher({ widgetBorderRadius: 12, widgetSize: 60 }).corners.topLeft).toBe(12);
  });

  it('uses the phone size and offsets when set, clamped', () => {
    const l = resolveLauncher({ widgetSize: 70, mobileWidgetSize: 200, mobileOffsetBottom: 90, mobileOffsetSide: -5 });
    expect(l.size).toBe(80);
    expect([l.bottom, l.side]).toEqual([90, 0]);
    expect(resolveLauncher({ widgetSize: 64 }).size).toBe(64);
  });

  it('draws squircle, tab and peek', () => {
    expect(resolveLauncher({ launcherShape: 'squircle', widgetSize: 50 }).corners.topLeft).toBe(15);
    const tab = resolveLauncher({ launcherShape: 'tab', widgetSize: 50 });
    expect([tab.width, tab.side, tab.tucked]).toEqual([41, 0, 0]);
    expect(tab.corners).toEqual({ topLeft: 15, topRight: 0, bottomRight: 0, bottomLeft: 15 });
    expect(resolveLauncher({ launcherShape: 'peek', widgetSize: 50 }).tucked).toBe(17);
  });

  it('reads solid and gradient colours, with dark ink on light ones', () => {
    expect(resolveLauncher({ widgetIconBgColor: '#0F766E' }).background).toEqual({ type: 'solid', color: '#0F766E' });
    expect(resolveLauncher({ widgetIconBgColor: '#0F766E' }).ink).toBe('#ffffff');
    expect(resolveLauncher({ widgetIconBgColor: '#fef3c7' }).ink).toBe('#111827');
    const g = resolveLauncher({ widgetIconThemeType: 'Gradient', widgetGradientBgOne: '#7c3aed', widgetGradientBgTwo: '#0d9488' });
    expect(g.background).toEqual({ type: 'gradient', colors: ['#7c3aed', '#0d9488'] });
    expect(g.solid).toBe('#7c3aed');
    expect(resolveLauncher({ headerBgColor: '#123456' }).solid).toBe('#123456');
  });

  it('falls back to the icon for an image, a missing avatar, and the label on phones', () => {
    expect(resolveLauncher({ launcherStyle: 'avatar', avatar: 'https://x/a.png' }).style).toBe('avatar');
    expect(resolveLauncher({ launcherStyle: 'avatar' }).style).toBe('icon');
    expect(resolveLauncher({ launcherStyle: 'avatar', avatar: 'a', widgetIconType: 'Image', widgetIconImage: 'https://x/i.png' }).style).toBe('icon');
    expect(resolveLauncher({ launcherStyle: 'label' }, 400).style).toBe('icon');
    expect(resolveLauncher({ launcherStyle: 'label' }, 800).style).toBe('label');
  });

  it('caps the label and shows the greeting only when turned on', () => {
    expect(normalizeLauncherLabel('  Talk   to the   team about your order today  ')).toBe('Talk to the team about y');
    expect(resolveLauncher({}).label).toBe('Chat with us');
    expect(resolveLauncher({ chatIconCtaText: 'Hi there' }).ctaText).toBeNull();
    expect(resolveLauncher({ chatIconCta: true, chatIconCtaText: 'Hi there' }).ctaText).toBe('Hi there');
  });

  it('reads the motion, subtle by default', () => {
    expect(resolveLauncher({}).animation).toBe('subtle');
    expect(resolveLauncher({ launcherAnimation: 'off' }).animation).toBe('off');
    expect(resolveLauncher({ launcherAnimation: 'wild' }).animation).toBe('subtle');
  });
});
