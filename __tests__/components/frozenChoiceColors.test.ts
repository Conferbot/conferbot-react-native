/**
 * An answered choice step's pills (components/MessageList frozenChoiceColors):
 * the picked one in the visitor's bubble colours, so it stays readable when
 * the bot bubble and the theme's page are the same colour (#89).
 */
import { frozenChoiceColors } from '../../src/components/MessageList/MessageList';
import { defaultTheme } from '../../src/theme/defaultTheme';

const sketch = {
  ...defaultTheme,
  colors: {
    ...defaultTheme.colors,
    // The sketch theme with the owner's colours: the bot bubble is the page colour.
    primary: '#fffdf5',
    textInverse: '#fffdf5',
    userBubble: '#fde68a',
    userBubbleText: '#3b2f0b',
    optionBubble: '#ffffff',
    optionBubbleText: '#1e3a8a',
  },
};

describe('frozenChoiceColors', () => {
  it('the picked pill in the visitor bubble colours, not the bot colour on the page colour', () => {
    expect(frozenChoiceColors(sketch as any, true)).toEqual({ background: '#fde68a', text: '#3b2f0b' });
  });

  it('the other pills in the option colours', () => {
    expect(frozenChoiceColors(sketch as any, false)).toEqual({ background: '#ffffff', text: '#1e3a8a' });
  });
});
