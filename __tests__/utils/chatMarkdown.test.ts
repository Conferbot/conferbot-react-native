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

  it('parses lists, headings and paragraphs', () => {
    const blocks = parseChatMarkdown('## Plans\nWe have:\n- Pro\n+ Plus\n2. Team\n\nBye');
    expect(blocks.map((b) => b.kind)).toEqual(['heading', 'paragraph', 'bullet', 'bullet', 'number', 'paragraph']);
    expect(blocksToPlainText(blocks)).toBe('Plans\nWe have:\n• Pro\n• Plus\n2. Team\nBye');
  });

  it('headings: # and ## drawn as level 4 (the web folds h1/h2), 3-6 keep theirs', () => {
    const levels = parseChatMarkdown('# A\n## B\n### C\n#### D\n##### E\n###### F').map((b: any) => b.level);
    expect(levels).toEqual([4, 4, 3, 4, 5, 6]);
    expect(htmlToMarkdown('<h2>Plans</h2><h3>Pro</h3><h6>small</h6>')).toBe('#### Plans\n\n### Pro\n\n###### small');
    expect(parseChatMarkdown('#hashtag')[0].kind).toBe('paragraph');
  });

  it('tables, as the web draws markdown tables', () => {
    const [t] = parseChatMarkdown('| Plan | Price |\n|---|:---:|\n| **Pro** | $49 |\n| Team |') as any[];
    expect(t.kind).toBe('table');
    expect(t.head).toEqual([[{ kind: 'text', text: 'Plan' }], [{ kind: 'text', text: 'Price' }]]);
    expect(t.rows).toEqual([
      [[{ kind: 'bold', text: 'Pro' }], [{ kind: 'text', text: '$49' }]],
      // A short row is filled to the head's width.
      [[{ kind: 'text', text: 'Team' }], []],
    ]);
    // A row without its rule is not a table.
    expect(parseChatMarkdown('| a | b |\n| c | d |')[0].kind).toBe('paragraph');
  });

  it("a person's HTML table, its cells' pipes kept", () => {
    const md = htmlToMarkdown('<table><thead><tr><th>Plan</th><th>Note</th></tr></thead><tbody><tr><td><b>Pro</b></td><td>a | b</td></tr></tbody></table>');
    expect(md).toBe('| Plan | Note |\n| --- | --- |\n| **Pro** | a \\| b |');
    const [t] = parseChatMarkdown(md) as any[];
    expect(t.rows[0][1]).toEqual([{ kind: 'text', text: 'a | b' }]);
  });

  it('blockquote, pre and strikethrough from a person\'s HTML', () => {
    expect(htmlToMarkdown('<blockquote><p>Quoted</p><p>twice</p></blockquote><p>After</p>')).toBe('> Quoted\n> twice\n\nAfter');
    expect(htmlToMarkdown('<pre>npm i\n  **x**</pre>')).toBe('```\nnpm i\n  **x**\n```');
    expect(htmlToMarkdown('<p><s>$59</s> <del>old</del> $49</p>')).toBe('~~$59~~ ~~old~~ $49');
    const blocks = parseChatMarkdown('> Quoted\n> twice\n\n```\nnpm i\n  **x**\n```\nok ~~no~~') as any[];
    expect(blocks.map((b) => b.kind)).toEqual(['quote', 'pre', 'paragraph']);
    expect(blocks[0].inlines).toEqual([{ kind: 'text', text: 'Quoted\ntwice' }]);
    expect(blocks[1].text).toBe('npm i\n  **x**');
    expect(blocks[2].inlines).toEqual([{ kind: 'text', text: 'ok ' }, { kind: 'strike', text: 'no' }]);
    expect(blocksToPlainText(blocks)).toBe('Quoted\ntwice\nnpm i\n  **x**\nok no');
  });
});
