import { LAUNCHER_ICONS } from '../../src/core/launcherIcons.data';
import { launcherIconSvg, launcherIconById, DEFAULT_LAUNCHER_ICON } from '../../src/core/launcherIcons';

describe('launcher icons', () => {
  it('has the web widget\'s 56 icons, ids 1 to 56', () => {
    expect(LAUNCHER_ICONS).toHaveLength(56);
    const ids = new Set(LAUNCHER_ICONS.map((i) => i.id));
    for (let n = 1; n <= 56; n++) expect(ids.has(`WidgetBubbleIcon${n}`)).toBe(true);
  });

  it('falls back to the glossy bubble, as the web does', () => {
    expect(DEFAULT_LAUNCHER_ICON).toBe('WidgetBubbleIcon40');
    expect(launcherIconById('nope').id).toBe('WidgetBubbleIcon40');
    expect(launcherIconById(undefined).id).toBe('WidgetBubbleIcon40');
    expect(launcherIconById('WidgetBubbleIcon7').id).toBe('WidgetBubbleIcon7');
  });

  it('draws in the ink with cut-outs in the launcher colour', () => {
    const svg = launcherIconSvg('WidgetBubbleIcon40', '#ffffff', '#0F766E', 35);
    expect(svg).toContain('viewBox="0 0 24 24"');
    expect(svg).toContain('width="35"');
    expect(svg).toContain('stop-color="#ffffff"');
    expect(svg).toContain('stop-color="#0F766E"');
    expect(svg).not.toContain('currentColor');
    expect(svg).not.toContain('var(');
  });

  it('leaves out the parts that only show while animating', () => {
    const wink = LAUNCHER_ICONS.find((i) => i.ops.some((o) => o.op === 0))!;
    const hidden = wink.ops.filter((o) => o.op === 0).length;
    const drawn = (launcherIconSvg(wink.id, '#fff', '#000').match(/<path /g) || []).length;
    expect(drawn).toBe(wink.ops.length - hidden + (launcherIconSvg(wink.id, '#fff', '#000').match(/<clipPath/g) || []).length);
  });

  it('every op has a path and every gradient reference exists', () => {
    for (const icon of LAUNCHER_ICONS) {
      for (const o of icon.ops) {
        expect(o.d.length).toBeGreaterThan(3);
        for (const p of [o.fill, o.stroke]) if (p && p.g !== undefined) expect(icon.grads[p.g]).toBeDefined();
      }
    }
  });
});
