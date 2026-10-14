import { resolveCustomizations, headerTitle, avatarRadiusFor, DEFAULT_LOGO } from '../../src/core/customizations';

describe('customizations as the web widget applies them', () => {
  it('uses the web defaults when nothing is set', () => {
    const c = resolveCustomizations({});
    expect(c.hideBrand).toBe(false);
    expect(c.customBrand).toBeNull();
    expect(c.showOnline).toBe(true);
    expect(c.avatarSize).toBe(32);
    expect(c.botBubble).toEqual({ topLeft: 18, topRight: 18, bottomRight: 18, bottomLeft: 6 });
    expect(c.userBubble).toEqual({ topLeft: 18, topRight: 18, bottomRight: 6, bottomLeft: 18 });
    expect(c.optionRadius).toBe(10);
    expect(c.fontSize).toBe(14.5);
    expect(c.fontFamily).toBeNull();
    expect(c.accent).toBe('#0b4eb8');
    expect(c.typingStyle).toBe('dots');
    expect(c.logo).toBe(DEFAULT_LOGO);
    expect(c.avatar).toBe(DEFAULT_LOGO);
  });

  it('treats the server defaults (10, 14, 40, Arial) as unset', () => {
    const c = resolveCustomizations({ bubbleBorderRadius: 10, fontSize: 14, avatarSize: 40, font: 'Arial' });
    expect(c.botBubble.bottomLeft).toBe(6);
    expect(c.fontSize).toBe(14.5);
    expect(c.avatarSize).toBe(32);
    expect(c.fontFamily).toBeNull();
  });

  it("applies the owner's own values", () => {
    const c = resolveCustomizations({
      bubbleBorderRadius: 4, optionBubbleBorderRadius: 20, fontSize: 16, avatarSize: 44, avatarShape: 'square',
      hideBrand: true, enableCustomBrand: true, customBrand: ' Acme ', enableTagline: true, tagline: 'Here 24/7',
      hideAvatar: true, hideLogo: true, logo: 'https://x/l.png', typingStyle: 'wave', headerBgColor: '#123456',
    });
    expect(c.botBubble).toEqual({ topLeft: 4, topRight: 4, bottomRight: 4, bottomLeft: 4 });
    expect(c.optionRadius).toBe(20);
    expect(c.fontSize).toBe(16);
    expect(c.avatarSize).toBe(44);
    expect(c.avatarRadius).toBe(4);
    expect(c.hideBrand).toBe(true);
    expect(c.customBrand).toBe('Acme');
    expect(c.tagline).toBe('Here 24/7');
    expect(c.showOnline).toBe(false);
    expect(c.hideAvatar).toBe(true);
    expect(c.hideLogo).toBe(true);
    expect(c.typingStyle).toBe('wave');
    expect(c.accent).toBe('#123456');
  });

  it('hides Online on request and falls back to the logo for the avatar', () => {
    const c = resolveCustomizations({ hideOnlineStatus: true, logo: 'https://x/l.png' });
    expect(c.showOnline).toBe(false);
    expect(c.avatar).toBe('https://x/l.png');
    expect(resolveCustomizations({ customBrand: 'Acme' }).customBrand).toBeNull();
  });

  it('cuts the title at 18 characters and shapes avatars', () => {
    expect(headerTitle('Live chat test (temporary) quick')).toBe('Live chat test (te...');
    expect(headerTitle('Support')).toBe('Support');
    expect(avatarRadiusFor('circle', 32)).toBe(16);
    expect(avatarRadiusFor('rounded', 32)).toBe(9);
    expect(avatarRadiusFor('square', 32)).toBe(4);
  });
});
