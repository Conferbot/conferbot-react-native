import { htmlToMarkdown, parseChatMarkdown, parseInline, blocksToPlainText } from '../../src/utils/chatMarkdown';

describe('chat markdown', () => {
  it('turns the inbox HTML into markdown', () => {
    expect(htmlToMarkdown('<p>Hi <strong>Sam</strong></p><p>See <a href="https://a.co/x">this</a> &amp; that</p>')).toBe('Hi **Sam**\n\nSee [this](https://a.co/x) & that');
    expect(htmlToMarkdown('<ul><li>One</li><li>Two</li></ul>')).toBe('- One\n\n- Two');
    expect(htmlToMarkdown('<a href="javascript:alert(1)">click</a>')).toBe('click');
    expect(htmlToMarkdown('<p>**Pro** is $49</p>')).toBe('**Pro** is $49');
  });

  it('parses inline runs', () => {
    expect(parseInline('a **b** _c_ `d` [e](https://e.co) https://f.co/x.')).toEqual([
      { kind: 'text', text: 'a ' },
      { kind: 'bold', text: 'b' },
      { kind: 'text', text: ' ' },
      { kind: 'italic', text: 'c' },
      { kind: 'text', text: ' ' },
      { kind: 'code', text: 'd' },
      { kind: 'text', text: ' ' },
      { kind: 'link', text: 'e', url: 'https://e.co' },
      { kind: 'text', text: ' ' },
      { kind: 'link', text: 'https://f.co/x', url: 'https://f.co/x' },
      { kind: 'text', text: '.' },
    ]);
    expect(parseInline('snake_case_name stays')).toEqual([{ kind: 'text', text: 'snake_case_name stays' }]);
    expect(parseInline('[x](javascript:1)')).toEqual([{ kind: 'text', text: 'x' }]);
  });

  it('parses lists and paragraphs', () => {
    const blocks = parseChatMarkdown('## Plans\nWe have:\n- Pro\n2. Team\n\nBye');
    expect(blocks.map((b) => b.kind)).toEqual(['paragraph', 'bullet', 'number', 'paragraph']);
    expect(blocksToPlainText(blocks)).toBe('Plans\nWe have:\n• Pro\n2. Team\nBye');
  });
});
