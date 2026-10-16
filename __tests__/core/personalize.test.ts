/**
 * "Greet by name": the web's cases (conferbot-widget tests/ownerLayout.test.js
 * personalize, personalizeCustomizations).
 */
import { personalize, personalizeCustomizations, visitorVars } from '../../src/core/personalize';

describe('personalize', () => {
  it('fills tokens and falls back', () => {
    const vars = visitorVars({ name: 'Sam Lee', company: 'Acme' });
    expect(vars.first_name).toBe('Sam');
    expect(personalize('Hi {{first_name|there}} 👋', vars)).toBe('Hi Sam 👋');
    expect(personalize('Welcome, {{company}} team', vars)).toBe('Welcome, Acme team');
    const anon = visitorVars(null);
    expect(personalize('Hi {{first_name|there}} 👋', anon)).toBe('Hi there 👋');
    expect(personalize('Hi {{name}}!', anon)).toBe('Hi!');
    expect(personalize('No tokens here', anon)).toBe('No tokens here');
    expect(personalize(undefined, anon)).toBeUndefined();
  });

  it('keeps a value as typed (drawn as text, not markup)', () => {
    expect(personalize('Hi {{name}}', visitorVars({ name: 'Ann & Bo' }))).toBe('Hi Ann & Bo');
  });

  it('takes a name the chat asked for, firstName / lastName, and {{firstName}}', () => {
    expect(visitorVars({}, 'Priya').first_name).toBe('Priya');
    const v = visitorVars({ firstName: 'Ana', lastName: 'Ruiz' });
    expect(v.name).toBe('Ana Ruiz');
    expect(personalize('Hey {{firstName}}', v)).toBe('Hey Ana');
    expect(visitorVars({ organization: 'Globex' }).company).toBe('Globex');
  });
});

describe('personalizeCustomizations', () => {
  it('touches only the visitor-facing texts', () => {
    const c = {
      chatIconCtaText: 'Hi {{first_name|there}}',
      initialPageTitle: 'Hello {{name}}',
      initialPageDescription: 'For {{company|you}}',
      initialPageCardButtonText: 'Chat, {{first_name}}',
      logoText: '{{name}} Bot',
      greetingRules: [{ text: 'Pricing for {{company|your team}}' }, { text: 'Plain' }],
    };
    const out = personalizeCustomizations(c, visitorVars({ firstName: 'Ana', company: 'Globex' }));
    expect(out.chatIconCtaText).toBe('Hi Ana');
    expect(out.initialPageTitle).toBe('Hello Ana');
    expect(out.initialPageDescription).toBe('For Globex');
    expect(out.initialPageCardButtonText).toBe('Chat, Ana');
    expect(out.logoText).toBe('{{name}} Bot');
    expect(out.greetingRules[0].text).toBe('Pricing for Globex');
    expect(out.greetingRules[1]).toBe(c.greetingRules[1]);
    expect(c.chatIconCtaText).toBe('Hi {{first_name|there}}');
  });

  it('passes nothing through', () => {
    expect(personalizeCustomizations(null, {})).toBeNull();
  });
});
