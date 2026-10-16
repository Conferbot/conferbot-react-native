/**
 * An agent message's markdown drawn natively (components/AgentReply/ChatText):
 * the web's agentHtml.ts set - tables, headings, quotes, code, strikethrough
 * - and a fallback reply muted.
 */
import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';
import { ChatText } from '../../src/components/AgentReply/ChatText';

const draw = (text: string, extra: any = {}) =>
  render(<ChatText text={text} color="#111111" fontSize={15} lineHeight={21} {...extra} />);

describe('ChatText', () => {
  it('draws a table sideways-scrollable, head in bold', () => {
    const { getByTestId, getByText } = draw('| Plan | Price |\n|---|---|\n| Pro | $49 |');
    expect(getByTestId('cb-md-table')).toBeTruthy();
    expect(StyleSheet.flatten(getByText('Plan').props.style).fontWeight).toBe('700');
    expect(getByText('$49')).toBeTruthy();
  });

  it('draws headings larger and bold, as headers', () => {
    const { getByText } = draw('### Pricing\nBody');
    const style = StyleSheet.flatten(getByText('Pricing').props.style);
    expect(style.fontWeight).toBe('700');
    expect(style.fontSize).toBeGreaterThan(15);
    expect(getByText('Pricing').props.accessibilityRole).toBe('header');
  });

  it('draws strikethrough, quotes and preformatted text', () => {
    const { getByText } = draw('Was ~~$59~~\n\n> Quoted\n\n```\nnpm i\n```');
    expect(StyleSheet.flatten(getByText('$59').props.style).textDecorationLine).toBe('line-through');
    expect(getByText('Quoted')).toBeTruthy();
    expect(StyleSheet.flatten(getByText('npm i').props.style).fontFamily).toBe('Courier');
  });

  it('a fallback reply is italic and faded', () => {
    const { getByText, toJSON } = draw('Sorry, I had trouble answering.', { muted: true });
    expect(StyleSheet.flatten(getByText('Sorry, I had trouble answering.').props.style).fontStyle).toBe('italic');
    expect(StyleSheet.flatten((toJSON() as any).props.style).opacity).toBe(0.85);
    const plain = draw('Fine.');
    expect(StyleSheet.flatten(plain.getByText('Fine.').props.style).fontStyle).toBeUndefined();
  });
});
