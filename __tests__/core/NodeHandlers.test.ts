/**
 * NodeHandlers Tests
 *
 * The display, ask and choice step handlers, read the way the builder saves
 * them (scripts/parity/flows/nodes.spec.json). Whole flows run against the
 * web's outcomes in __tests__/parity/flows.test.ts.
 */

import { ChatState } from '../../src/core/state/ChatState';
import { NodeResult, NodeUIState } from '../../src/core/nodes/NodeHandler';
import {
  MessageHandler,
  ImageHandler,
  VideoHandler,
  AudioHandler,
  FileHandler,
  HTMLHandler,
  RedirectHandler,
} from '../../src/core/nodes/handlers/DisplayNodeHandlers';
import {
  AskEmailHandler,
  AskPhoneHandler,
  AskNameHandler,
  AskNumberHandler,
  AskUrlHandler,
  AskFileHandler,
} from '../../src/core/nodes/handlers/AskNodeHandlers';
import {
  ButtonsHandler,
  RatingHandler,
  DropdownHandler,
  OpinionScaleHandler,
  PictureChoiceHandler,
  YesOrNoChoiceHandler,
  NCheckOptionsHandler,
  CarouselHandler,
} from '../../src/core/nodes/handlers/ChoiceNodeHandlers';
import { createNode } from '../testUtils';

describe('Node Handlers', () => {
  let chatState: ChatState;

  beforeEach(() => {
    chatState = new ChatState('test-session', 'test-bot');
  });

  const ask = (handler: any, node: any) => {
    if (node.data?.answerVariable) chatState.registerAnswerVariable(node.id, node.data.answerVariable);
    return handler.handle(node, chatState);
  };

  // ========================================
  // DISPLAY NODE HANDLERS
  // ========================================

  describe('Display Node Handlers', () => {
    it('message-node shows data.text with the answers filled in, as a bubble', async () => {
      chatState.saveVariableByName('name', 'Ana');
      const result: any = await new MessageHandler().handle(createNode('message-node', { text: '<p>Hi {name}, <b>welcome</b></p>' }), chatState);
      expect(result.uiState).toMatchObject({ type: 'message', text: 'Hi Ana, welcome' });
      expect(chatState.getTranscript().pop()?.text).toBe('Hi Ana, welcome');
    });

    it('message-node never skips a message equal to the last choice (web shows it)', async () => {
      chatState.setVariable('_lastUserChoice', 'A');
      const result = await new MessageHandler().handle(createNode('message-node', { text: 'A' }), chatState);
      expect(result.type).toBe('displayUI');
    });

    it('image-node reads data.image and draws it as a picture, not "[Image]"', async () => {
      const result: any = await new ImageHandler().handle(createNode('image-node', { image: 'https://cdn.example/a.png' }), chatState);
      expect(result.uiState).toMatchObject({ type: 'image', url: 'https://cdn.example/a.png' });
      const entry = chatState.getTranscript().pop();
      expect(entry?.text).toBe('');
      expect(entry?.data?.imageUrl).toBe('https://cdn.example/a.png');
    });

    it('video / audio / file read data.video / data.audio / data.file and never stall', async () => {
      const v: any = await new VideoHandler().handle(createNode('video-node', { video: 'https://cdn.example/v.mp4' }), chatState);
      const a: any = await new AudioHandler().handle(createNode('audio-node', { audio: [{ id: 1, audio: 'x' }] }), chatState);
      const f: any = await new FileHandler().handle(createNode('file-node', { file: 'https://cdn.example/files/guide.pdf' }), chatState);
      expect(v.uiState).toMatchObject({ type: 'video', url: 'https://cdn.example/v.mp4' });
      expect(a.type).toBe('displayUI');
      expect(f.uiState).toMatchObject({ type: 'file', url: 'https://cdn.example/files/guide.pdf', filename: 'guide.pdf' });
    });

    it('html-node fills the answers (escaped) and removes scripts and handlers', async () => {
      chatState.saveVariableByName('n', '<b>x</b>');
      const result: any = await new HTMLHandler().handle(createNode('html-node', { html: '<p onclick="x()">Hi {n}</p><script>bad()</script>' }), chatState);
      expect(result.uiState.content).toBe('<p>Hi &lt;b&gt;x&lt;/b&gt;</p>');
    });

    it('user-redirect-node shows a link to data.link (query values encoded) and moves on - it never navigates', async () => {
      chatState.saveVariableByName('ref', 'Priya Shah');
      const result: any = await new RedirectHandler().handle(
        createNode('user-redirect-node', { redirectPrompt: '<p>Open</p>', link: 'example.com/p?ref={ref}' }),
        chatState
      );
      expect(result.type).toBe('displayUI');
      expect(chatState.getTranscript().pop()?.data?.linkUrl).toBe('https://example.com/p?ref=Priya%20Shah');
    });
  });

  // ========================================
  // ASK NODE HANDLERS
  // ========================================

  describe('Ask Node Handlers', () => {
    it('asks data.questionText and saves the answer in the variable it registered', async () => {
      const node = createNode('ask-email-node', { questionText: '<p>Your email?</p>', answerVariable: 'email' }, { id: 'q' });
      const ui: any = await ask(new AskEmailHandler(), node);
      expect(ui.uiState).toMatchObject({ type: 'textInput', question: 'Your email?', inputType: 'email' });
      const result = await new AskEmailHandler().handleResponse(' ana@example.org ', node, chatState);
      expect(result).toEqual(NodeResult.next({ email: 'ana@example.org' }));
      expect(chatState.getAnswer('email')).toBe('ana@example.org');
      expect(chatState.getRecord().find((r: any) => r.shape === 'user-ask-email-response')?.text).toBe('ana@example.org');
    });

    it('without data.answerVariable nothing is stored', async () => {
      const node = createNode('ask-email-node', { questionText: 'Email?' }, { id: 'q' });
      await ask(new AskEmailHandler(), node);
      await new AskEmailHandler().handleResponse('ana@example.org', node, chatState);
      expect(chatState.getAnswerVariables()).toHaveLength(0);
    });

    it('refuses a bad e-mail (incorrectEmailResponse) and keeps waiting', async () => {
      const node = createNode('ask-email-node', { incorrectEmailResponse: '<p>Nope</p>' }, { id: 'q' });
      const result: any = await new AskEmailHandler().handleResponse('not-an-email', node, chatState);
      expect(result).toMatchObject({ type: 'invalid', message: '<p>Nope</p>' });
    });

    it('offers the fix for a domain typo once, then keeps the address', async () => {
      const node = createNode('ask-email-node', {}, { id: 'q' });
      const first: any = await new AskEmailHandler().handleResponse('ana@gmial.com', node, chatState);
      expect(first.message).toContain('ana@gmail.com');
      expect((await new AskEmailHandler().handleResponse('ana@gmial.com', node, chatState)).type).toBe('proceed');
    });

    it('ask-name saves the full answer and greets by the first name after typing', async () => {
      const node = createNode('ask-name-node', { answerVariable: 'name' }, { id: 'q' });
      await ask(new AskNameHandler(), node);
      await new AskNameHandler().handleResponse('  deepak gopal ', { ...node, ctx: { typing: async () => undefined } }, chatState);
      expect(chatState.getAnswer('name')).toBe('deepak gopal');
      expect(chatState.getTranscript().pop()?.text).toBe('Nice to meet you, Deepak');
    });

    it('ask-phone normalises the number; ask-number saves a number; ask-url adds https', async () => {
      const phone = createNode('ask-phone-number-node', { answerVariable: 'phone' }, { id: 'p' });
      await ask(new AskPhoneHandler(), phone);
      await new AskPhoneHandler().handleResponse('+1 (555) 123-4567', phone, chatState);
      expect(chatState.getAnswer('phone')).toBe('+15551234567');

      const num = createNode('ask-number-node', { answerVariable: 'n', enableConditions: { minVal: 10, maxVal: 100 } }, { id: 'n' });
      await ask(new AskNumberHandler(), num);
      expect((await new AskNumberHandler().handleResponse('500', num, chatState)).type).toBe('invalid');
      await new AskNumberHandler().handleResponse('1,0', num, chatState);
      expect((await new AskNumberHandler().handleResponse('42', num, chatState)).type).toBe('proceed');
      expect(chatState.getAnswer('n')).toBe(42);

      const url = createNode('ask-url-node', { answerVariable: 'site' }, { id: 'u' });
      await ask(new AskUrlHandler(), url);
      await new AskUrlHandler().handleResponse('conferbot.com/pricing', url, chatState);
      expect(chatState.getAnswer('site')).toBe('https://conferbot.com/pricing');
    });

    it('ask-file refuses a file that is too big on the card and uploads the rest', async () => {
      const upload = jest.fn(async () => ({ ok: true, url: 'https://cdn.example/f.pdf' }));
      const node = { ...createNode('ask-file-node', { answerVariable: 'file', maxFileSizeMB: 1 }, { id: 'f' }), ctx: { upload } };
      await ask(new AskFileHandler(), node);
      const big: any = await new AskFileHandler().handleResponse({ file: { name: 'a.png', size: 3 * 1024 * 1024, type: 'image/png' } }, node, chatState);
      expect(big).toMatchObject({ type: 'invalid', inCard: true });
      await new AskFileHandler().handleResponse({ file: { name: 'a.pdf', size: 100, type: 'application/pdf' } }, node, chatState);
      expect(chatState.getAnswer('file')).toBe('https://cdn.example/f.pdf');
    });
  });

  // ========================================
  // CHOICE NODE HANDLERS
  // ========================================

  describe('Choice Node Handlers', () => {
    it('n-choices reads choices[].choiceText (blank hidden) and leaves by "source-" + the choice id', async () => {
      const node = createNode(
        'n-choices-node',
        { choicePrompt: '<p>Pick</p>', choices: [{ id: '1', choiceText: '<p>One</p>' }, { id: '2', choiceText: '' }, { id: 'u-3', choiceText: 'Three' }], answerVariable: 'pick' },
        { id: 'c' }
      );
      const ui: any = await ask(new ButtonsHandler(), node);
      expect(ui.uiState.buttons.map((b: any) => b.id)).toEqual(['1', 'u-3']);
      const result = await new ButtonsHandler().handleResponse({ buttonId: 'u-3' }, node, chatState);
      expect(result).toEqual(NodeResult.port('source-u-3'));
      expect(chatState.getAnswer('pick')).toBe('Three');
    });

    it('image-choice reads data.images and leaves by "source-" + the image id', async () => {
      const node = createNode('image-choice-node', { images: [{ id: 'i1', image: 'https://x/a.png', label: 'A' }], answerVariable: 'img' }, { id: 'ic' });
      const ui: any = await ask(new PictureChoiceHandler(), node);
      expect(ui.uiState.choices).toHaveLength(1);
      expect(await new PictureChoiceHandler().handleResponse({ choiceId: 'i1' }, node, chatState)).toEqual(NodeResult.port('source-i1'));
    });

    it('yes-or-no defaults to Yes "1" / No "2"', async () => {
      const node = createNode('yes-or-no-choice-node', { answerVariable: 'yn' }, { id: 'yn' });
      await ask(new YesOrNoChoiceHandler(), node);
      expect(await new YesOrNoChoiceHandler().handleResponse({ buttonId: '2' }, node, chatState)).toEqual(NodeResult.port('source-2'));
      expect(chatState.getAnswer('yn')).toBe('No');
    });

    it('rating-choice saves the NUMBER and leaves by source-<value-1>', async () => {
      const node = createNode('rating-choice-node', { ratingType: 5, answerVariable: 'stars' }, { id: 'r' });
      const ui: any = await ask(new RatingHandler(), node);
      expect(ui.uiState.maxRating).toBe(5);
      expect(await new RatingHandler().handleResponse({ rating: 4 }, node, chatState)).toEqual(NodeResult.port('source-3'));
      expect(chatState.getAnswer('stars')).toBe(4);
    });

    it('opinion-scale leaves by source-<value-from>; a blank range is 0 to 10', async () => {
      const node = createNode('opinion-scale-choice-node', { from: 2, to: 4, answerVariable: 'o' }, { id: 'o' });
      await ask(new OpinionScaleHandler(), node);
      expect(await new OpinionScaleHandler().handleResponse({ value: 3 }, node, chatState)).toEqual(NodeResult.port('source-1'));
      const blank: any = await new OpinionScaleHandler().handle(createNode('opinion-scale-choice-node', { from: '', to: '' }), chatState);
      expect([blank.uiState.min, blank.uiState.max]).toEqual([0, 10]);
    });

    it('n-select-option has no ports: the first edge 600 ms after the pick', async () => {
      const node = createNode('n-select-option-node', { selectPrompt: 'Pick', options: [{ id: '1', optionText: '<p>op &amp; 1</p>' }], answerVariable: 's' }, { id: 's' });
      await ask(new DropdownHandler(), node);
      expect(await new DropdownHandler().handleResponse({ optionId: '1' }, node, chatState)).toEqual(NodeResult.delayedProceed(null, 600));
      expect(chatState.getAnswer('s')).toBe('op & 1');
    });

    it('n-check-options saves the ticked texts in list order', async () => {
      const node = createNode('n-check-options-node', { options: [{ id: 'a', optionText: 'Red' }, { id: 'b', optionText: 'Blue' }], answerVariable: 'k' }, { id: 'k' });
      await ask(new NCheckOptionsHandler(), node);
      await new NCheckOptionsHandler().handleResponse({ buttonIds: ['b', 'a'] }, node, chatState);
      expect(chatState.getAnswer('k')).toBe('Red, Blue');
    });

    it('carousel: a path button leaves by "source-" + its id; only links: Continue by "source"', async () => {
      const node = createNode(
        'carousel-node',
        { cards: [{ id: 'c1', title: 'Pro', buttons: [{ id: 'b1', label: 'Pick', action: 'path' }] }], answerVariable: 'car' },
        { id: 'car' }
      );
      await ask(new CarouselHandler(), node);
      expect(await new CarouselHandler().handleResponse({ buttonId: 'b1' }, node, chatState)).toEqual(NodeResult.port('source-b1'));
      expect(chatState.getAnswer('car')).toBe('Pro - Pick');
      const links = createNode('carousel-node', { cards: [{ id: 'c1', title: 'Docs', buttons: [{ id: 'l', label: 'Open', action: 'link', url: 'example.com' }] }] });
      expect(await new CarouselHandler().handleResponse({ action: 'continue' }, links, chatState)).toEqual(NodeResult.port('source'));
    });
  });

  // ========================================
  // NODE RESULT FACTORY TESTS
  // ========================================

  describe('NodeResult Factory Functions', () => {
    it('should create displayUI result', () => {
      const uiState: NodeUIState.Message = {
        type: 'message',
        nodeId: 'test',
        text: 'Hello',
      };
      const result = NodeResult.displayUI(uiState);

      expect(result.type).toBe('displayUI');
      expect(result.uiState).toBe(uiState);
    });

    it('should create proceed result', () => {
      const result = NodeResult.proceed('next-node', { key: 'value' });

      expect(result.type).toBe('proceed');
      expect(result.nextNodeId).toBe('next-node');
      expect(result.data).toEqual({ key: 'value' });
    });

    it('should create proceed result with null nextNodeId', () => {
      const result = NodeResult.proceed(null);

      expect(result.type).toBe('proceed');
      expect(result.nextNodeId).toBeNull();
    });

    it('should create delayedProceed result', () => {
      const result = NodeResult.delayedProceed('next-node', 1000, { data: 'test' });

      expect(result.type).toBe('delayedProceed');
      expect(result.nextNodeId).toBe('next-node');
      expect(result.delayMs).toBe(1000);
      expect(result.data).toEqual({ data: 'test' });
    });

    it('should create jumpTo result', () => {
      const result = NodeResult.jumpTo('target-node', { reason: 'jump' });

      expect(result.type).toBe('jumpTo');
      expect(result.targetNodeId).toBe('target-node');
      expect(result.data).toEqual({ reason: 'jump' });
    });

    it('should create error result', () => {
      const result = NodeResult.error('Something went wrong', false, { code: 500 });

      expect(result.type).toBe('error');
      expect(result.message).toBe('Something went wrong');
      expect(result.recoverable).toBe(false);
      expect(result.details).toEqual({ code: 500 });
    });

    it('should create recoverable error by default', () => {
      const result = NodeResult.error('Error message');

      expect(result.recoverable).toBe(true);
    });
  });

  // ========================================
  // NODE UI STATE FACTORY TESTS
  // ========================================

  describe('NodeUIState Factory Functions', () => {
    it('should create message UI state', () => {
      const state = NodeUIState.message('node-1', 'Hello!', true);

      expect(state.type).toBe('message');
      expect(state.nodeId).toBe('node-1');
      expect(state.text).toBe('Hello!');
      expect(state.typing).toBe(true);
    });

    it('should create image UI state', () => {
      const state = NodeUIState.image('node-1', 'http://example.com/img.jpg', 'Alt text', 'Caption');

      expect(state.type).toBe('image');
      expect(state.url).toBe('http://example.com/img.jpg');
      expect(state.alt).toBe('Alt text');
      expect(state.caption).toBe('Caption');
    });

    it('should create textInput UI state', () => {
      const state = NodeUIState.textInput('node-1', 'Enter email', 'email', 'email', {
        placeholder: 'you@example.com',
      });

      expect(state.type).toBe('textInput');
      expect(state.question).toBe('Enter email');
      expect(state.variableName).toBe('email');
      expect(state.inputType).toBe('email');
      expect(state.placeholder).toBe('you@example.com');
    });

    it('should create buttons UI state', () => {
      const buttons = [
        { id: '1', label: 'Yes', value: true },
        { id: '2', label: 'No', value: false },
      ];
      const state = NodeUIState.buttons('node-1', 'Choose', buttons, 'choice');

      expect(state.type).toBe('buttons');
      expect(state.question).toBe('Choose');
      expect(state.buttons).toBe(buttons);
      expect(state.variableName).toBe('choice');
    });

    it('should create loading UI state', () => {
      const state = NodeUIState.loading('node-1', 'Processing...');

      expect(state.type).toBe('loading');
      expect(state.nodeId).toBe('node-1');
      expect(state.message).toBe('Processing...');
    });
  });
});
