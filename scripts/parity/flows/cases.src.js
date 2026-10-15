// The conformance cases. Each one is a small flow in the exact shape the
// builder saves (elements[0].nodes / .edges), what the visitor does, and -
// written by gen.js from running it through the widget - what happens.
//
// provenance "executed": gen.js runs it through the widget's code (web/) and
// writes `expect` from what the widget did. "read": the harness can't drive
// it (a canvas, a browser API), so `expect` here is written from reading the
// cited code; gen.js copies it as is.
//
// Visitor actions (`inputs[].do`), all played on the widget's own controls:
//   text {value}                 type in the composer and send
//   choose {id|index|value|buttonId}
//                                n-choices / n-select / image-choice / yes-or-no: id;
//                                two/three-choices, select-option, quiz, dynamic: index (0-based);
//                                rating-choice / opinion-scale / user-rating: value;
//                                carousel / product-card: buttonId (none = Continue)
//   check {ids}                  n-check-options: tick these, then Done
//   file {name,size,type}        pick a file (upload answered by server.http.media)
//   skip                         ask-file Skip
//   navigateLink {index} / navigateDone
//   date {value}                 legacy date input ("YYYY-MM-DD")
//   calendar {date, slot?}       calendar day ("YYYY-MM-DD") and slot start ("09:00")
//   consent {agreed} / slider {value} / datetime {value} / rankingMove {id,dir} / rankingSubmit
//   matrix {cells:{rowId:colId|[colIds]}} / otpEmail {email} / otpCode {code} / otpSkip / payCancel
//   serverEvent {event,payload}  a socket event from the server
//   wait                         nothing (let time pass: waitMs)
// `at` on an input is the step that must be waiting for it.
const fs = require('fs');
const path = require('path');

const N = (id, type, data = {}) => ({ id, type, data, position: { x: 0, y: 0 } });
/** An edge as the builder saves it (reactflow): no handle given = the "source" handle. */
const E = (source, target, sourceHandle = 'source') => ({
  id: `e-${source}-${sourceHandle === null ? 'null' : sourceHandle}-${target}`,
  source,
  ...(sourceHandle === undefined ? {} : { sourceHandle }),
  target,
  targetHandle: 'target',
  type: 'customedge',
  animated: true,
});
const NO_HANDLE = undefined;
const W = (text = '<p>Hi</p>') => N('w', 'welcome-node', { text, disableImage: true });
const M = (id, text) => N(id, 'message-node', { text });
const chain = (...ids) => ids.slice(1).map((id, i) => E(ids[i], id));
const flow = (nodes, edges) => ({ nodes, edges });

const SAMPLES = path.join(__dirname, 'samples');
const realNodes = JSON.parse(fs.readFileSync(path.join(SAMPLES, 'real-nodes.json'), 'utf8')).types;
const bot = (id) => JSON.parse(fs.readFileSync(path.join(SAMPLES, `bot-${id}.json`), 'utf8'));
/** A real node's saved data (samples/real-nodes.json), under a short id. */
const real = (type, id = type.replace(/-node$/, '')) => N(id, type, JSON.parse(JSON.stringify(realNodes[type].example.node.data)));
/** Where a real example came from: our QA bot by name, else "real node shape (anonymised)" (anon.js). */
const realSource = (type) => realNodes[type].example.source;

const cases = [];
const add = (c) => cases.push(c);

// ===========================================================================
// Engine
// ===========================================================================
add({
  id: 'engine.start-first-welcome',
  title: 'The chat starts at the first welcome-node in nodes[], wherever it is; a second one is never the start',
  covers: ['welcome-node'],
  flow: flow([M('m0', '<p>not the start</p>'), N('w', 'welcome-node', { text: '<p>Start here</p>', disableImage: true }), N('w2', 'welcome-node', { text: '<p>Other</p>' }), M('m1', '<p>after</p>')], [E('w', 'm1'), E('m0', 'w2')]),
});
add({
  id: 'engine.next-is-first-edge-any-handle',
  title: 'A step that does not branch follows the FIRST edge from it in edges[], whatever its handle',
  covers: ['message-node'],
  flow: flow([W(), M('a', '<p>A</p>'), M('b', '<p>B</p>'), M('c', '<p>C</p>')], [E('w', 'a', 'source-7'), E('w', 'b'), E('a', 'c', NO_HANDLE)]),
});
add({
  id: 'engine.no-edge-ends-chat',
  title: 'No edge out of a step: the chat ends (chat-flow-completed)',
  covers: ['message-node'],
  flow: flow([W(), M('a', '<p>Last</p>')], [E('w', 'a')]),
});
add({
  id: 'engine.edge-to-missing-node-ends-chat',
  title: 'The first edge points at a node that does not exist: the chat ends; the second edge is never tried',
  covers: ['message-node'],
  flow: flow([W(), M('a', '<p>A</p>')], [E('w', 'ghost'), E('w', 'a')]),
});
add({
  id: 'engine.unknown-type-continues-on-first-edge',
  title: 'A step type the widget does not run (real: time-out-node) shows nothing and continues along its first edge',
  covers: ['unknown'],
  source: realSource('time-out-node'),
  flow: flow([W(), real('time-out-node', 'x'), M('after', '<p>after unknown</p>')], [E('w', 'x'), E('x', 'after', 'source-3')]),
});
add({
  id: 'engine.unknown-type-without-edge-ends',
  title: 'An unknown step with no edge out ends the chat (real: ask-custom-node)',
  covers: ['unknown'],
  source: realSource('ask-custom-node'),
  flow: flow([W(), real('ask-custom-node', 'x')], [E('w', 'x')]),
});
add({
  id: 'engine.port-not-wired-ends-chat',
  title: 'A branch taken from a handle with no edge ends the chat - no fallback to another edge',
  covers: ['n-choices-node'],
  flow: flow(
    [W(), N('c', 'n-choices-node', { choicePrompt: '<p>Pick</p>', choices: [{ id: '1', choiceText: 'One' }, { id: '2', choiceText: 'Two' }], answerVariable: 'pick' }), M('one', '<p>one</p>')],
    [E('w', 'c'), E('c', 'one', 'source-1')]
  ),
  inputs: [{ at: 'c', do: 'choose', id: '2' }],
});
add({
  id: 'engine.port-to-missing-node-crashes',
  title: 'A wired branch whose target node is missing: the widget throws (nextNode.type) and the chat stops where it is',
  covers: ['n-choices-node'],
  flow: flow([W(), N('c', 'n-choices-node', { choicePrompt: '<p>Pick</p>', choices: [{ id: '1', choiceText: 'One' }] })], [E('w', 'c'), E('c', 'ghost', 'source-1')]),
  inputs: [{ at: 'c', do: 'choose', id: '1' }],
});
add({
  id: 'engine.welcome-mid-flow-is-passed',
  title: 'A welcome-node reached again (by an edge) is not a display step there: it is passed silently along its first edge',
  covers: ['welcome-node', 'unknown'],
  flow: flow([W('<p>Hi</p>'), M('a', '<p>A</p>'), N('w2', 'welcome-node', { text: '<p>Second welcome</p>' }), M('b', '<p>B</p>')], [...chain('w', 'a', 'w2', 'b')]),
});

// ===========================================================================
// Jump to
// ===========================================================================
add({
  id: 'jump-to.node-id',
  title: 'jump-to-node goes to data.nodeId (real data: only nodeId is saved)',
  covers: ['jump-to-node'],
  flow: flow([W(), N('j', 'jump-to-node', { nodeId: 'target' }), M('skipped', '<p>never</p>'), M('target', '<p>Jumped</p>')], [E('w', 'j'), E('j', 'skipped')]),
});
add({
  id: 'jump-to.fallback-keys',
  title: 'jump-to-node target: data.nodeId, else data.targetNodeId, else data.jumpTo (first non-empty)',
  covers: ['jump-to-node'],
  flow: flow([W(), N('j', 'jump-to-node', { nodeId: '  ', targetNodeId: '', jumpTo: 'target' }), M('target', '<p>Jumped by jumpTo</p>')], [E('w', 'j')]),
});
add({
  id: 'jump-to.missing-target-ends',
  title: 'jump-to-node whose target does not exist ends the chat (it does not follow its own edge)',
  covers: ['jump-to-node'],
  flow: flow([W(), N('j', 'jump-to-node', { nodeId: 'ghost' }), M('next', '<p>never</p>')], [E('w', 'j'), E('j', 'next')]),
});
add({
  id: 'jump-to.into-email-step-sends-nothing',
  title: 'An email-node reached by a jump only moves on: no email-node-trigger is sent (index.ts jump branch)',
  covers: ['jump-to-node', 'email-node'],
  flow: flow([W(), N('j', 'jump-to-node', { nodeId: 'mail' }), N('mail', 'email-node', { to: ['ops@example.com'], subject: 'Lead', body: 'x' }), M('after', '<p>after</p>')], [E('w', 'j'), E('mail', 'after')]),
});

// ===========================================================================
// Variables and interpolation
// ===========================================================================
const askCustom = (id, key, q = '<p>?</p>') => N(id, 'ask-custom-question-node', { questionText: q, answerVariable: key });
add({
  id: 'interpolation.all-spellings',
  title: '{x}, ${x}, {{x}}, ${ANSWERS.x} and $${x} (a literal $ then the value) all fill from the answers',
  covers: ['message-node', 'ask-custom-question-node'],
  flow: flow([W(), askCustom('q', 'price'), M('m', '<p>a {price} b ${price} c {{price}} d ${ANSWERS.price} e $${price}</p>')], chain('w', 'q', 'm')),
  inputs: [{ at: 'q', do: 'text', value: '720' }],
});
add({
  id: 'interpolation.unknown-is-blank-and-gaps-close',
  title: 'An unknown (or unanswered) variable shows nothing and the space/comma it leaves is tidied',
  covers: ['message-node'],
  flow: flow([W(), M('m1', '<p>Hey ${name}, welcome</p>'), M('m2', '<p>Hi {name} there</p>'), M('m3', '<p>{name}</p><p>Thanks {{nobody}}!</p>')], chain('w', 'm1', 'm2', 'm3')),
});
add({
  id: 'interpolation.values-are-escaped',
  title: "A visitor's answer is HTML-escaped when it fills a bot message (never markup)",
  covers: ['message-node', 'ask-custom-question-node'],
  flow: flow([W(), askCustom('q', 'who'), M('m', '<p>You said {who}</p>')], chain('w', 'q', 'm')),
  inputs: [{ at: 'q', do: 'text', value: '<b>bold</b> & "q"' }],
});
add({
  id: 'interpolation.prompts-and-options',
  title: 'Prompts and option labels are filled too (n-choices choicePrompt and choiceText)',
  covers: ['n-choices-node'],
  flow: flow(
    [W(), askCustom('q', 'plan'), N('c', 'n-choices-node', { choicePrompt: '<p>Upgrade {plan}?</p>', choices: [{ id: '1', choiceText: 'Yes, {plan}' }], answerVariable: 'ok' })],
    [...chain('w', 'q', 'c')]
  ),
  inputs: [{ at: 'q', do: 'text', value: 'Pro' }, { at: 'c', do: 'choose', id: '1' }],
});
add({
  id: 'variables.no-answer-variable-stores-nothing',
  title: 'A question without data.answerVariable saves no variable (the answer is still recorded)',
  covers: ['ask-custom-question-node'],
  flow: flow([W(), N('q', 'ask-custom-question-node', { questionText: '<p>Anything?</p>' }), M('m', '<p>[{answer}]</p>')], chain('w', 'q', 'm')),
  inputs: [{ at: 'q', do: 'text', value: 'hello' }],
});
add({
  id: 'variables.same-key-first-wins',
  title: 'Two questions with the same answerVariable: reads see the FIRST entry with that key',
  covers: ['ask-custom-question-node'],
  flow: flow([W(), askCustom('q1', 'x'), askCustom('q2', 'x'), M('m', '<p>x={x}</p>')], chain('w', 'q1', 'q2', 'm')),
  inputs: [{ at: 'q1', do: 'text', value: 'first' }, { at: 'q2', do: 'text', value: 'second' }],
});
add({
  id: 'variables.sensitive-values-masked',
  title: 'A card number typed as an answer is masked in the variable and the record (customizations.redactSensitive unset = on)',
  covers: ['ask-custom-question-node'],
  flow: flow([W(), askCustom('q', 'note'), M('m', '<p>{note}</p>')], chain('w', 'q', 'm')),
  inputs: [{ at: 'q', do: 'text', value: 'my card 4242 4242 4242 4242 ok' }],
});
add({
  id: 'variables.masking-off',
  title: 'customizations.redactSensitive === false keeps the value as typed',
  covers: ['ask-custom-question-node'],
  customizations: { redactSensitive: false },
  flow: flow([W(), askCustom('q', 'note'), M('m', '<p>{note}</p>')], chain('w', 'q', 'm')),
  inputs: [{ at: 'q', do: 'text', value: 'my card 4242 4242 4242 4242 ok' }],
});

// ===========================================================================
// Send-response steps
// ===========================================================================
add({
  id: 'welcome.image-and-pacing',
  title: 'welcome-node shows text (+ image unless disableImage) and moves on; typing time follows nodeLogic paceFor',
  covers: ['welcome-node', 'message-node'],
  source: 'builder default (store/dndNodes.ts Welcome)',
  flow: flow(
    [N('w', 'welcome-node', { text: '<p>Welcome to the chatbot!</p>', image: 'https://botdefaults.s3.ap-south-1.amazonaws.com/welcome_gif_1.gif', disableImage: false }), M('m', '<p>A rather longer message so the typing time grows with it, as a person would type.</p>'), M('m2', '<p>ok</p>')],
    chain('w', 'm', 'm2')
  ),
});
add({
  id: 'message.blank-is-skipped',
  title: 'A message-node whose text is blank HTML ("<p><br></p>") is skipped with no typing and no bubble',
  covers: ['message-node'],
  flow: flow([W(), M('blank', '<p><br></p>'), M('m', '<p>shown</p>')], chain('w', 'blank', 'm')),
});
add({
  id: 'image.shows-then-advances',
  title: 'image-node shows data.image and moves on when it loads, or after 4000 ms at most (never loads here)',
  covers: ['image-node'],
  source: realSource('image-node'),
  flow: flow([W(), real('image-node', 'img'), M('m', '<p>after image</p>')], chain('w', 'img', 'm')),
});
add({
  id: 'image.empty-is-skipped',
  title: 'image-node with an empty data.image is skipped (no typing, no bubble)',
  covers: ['image-node'],
  flow: flow([W(), N('img', 'image-node', { image: '' }), M('m', '<p>after</p>')], chain('w', 'img', 'm')),
});
add({
  id: 'video.reads-data-video',
  title: 'video-node plays data.video (mp4 <source>) and moves on at loadedmetadata, or after 4000 ms',
  covers: ['video-node'],
  source: realSource('video-node'),
  flow: flow([W(), real('video-node', 'v'), M('m', '<p>after video</p>')], chain('w', 'v', 'm')),
});
add({
  id: 'audio.reads-data-audio',
  title: 'audio-node shows a player for data.audio and moves on at once',
  covers: ['audio-node'],
  source: 'real node shape (anonymised): 6 of 8 live audio nodes save a URL string',
  flow: flow([W(), N('a', 'audio-node', { audio: 'https://cdn.example.com/media/sample-audio.mp3' }), M('m', '<p>after audio</p>')], chain('w', 'a', 'm')),
});
add({
  id: 'audio.real-list-shape',
  title: 'Real data: some audio-nodes saved data.audio as a list [{id,label,audio}]; the widget does not read it (a broken player) and still moves on',
  covers: ['audio-node'],
  source: realSource('audio-node'),
  flow: flow([W(), real('audio-node', 'a'), M('m', '<p>after audio</p>')], chain('w', 'a', 'm')),
});
add({
  id: 'file.reads-data-file',
  title: 'file-node shows a download card for data.file and moves on at once',
  covers: ['file-node'],
  source: realSource('file-node'),
  flow: flow([W(), real('file-node', 'f'), M('m', '<p>after file</p>')], chain('w', 'f', 'm')),
});
add({
  id: 'html.sanitised-and-filled',
  title: 'html-node: data.html with answers filled (escaped), <script> and on* removed; moves on at once',
  covers: ['html-node'],
  flow: flow([W(), askCustom('q', 'n'), N('h', 'html-node', { html: '<div onclick="x()">Hi {n}<script>alert(1)</script></div>' }), M('m', '<p>after</p>')], chain('w', 'q', 'h', 'm')),
  inputs: [{ at: 'q', do: 'text', value: 'Ana' }],
});
add({
  id: 'user-redirect.shows-link-and-moves-on',
  title: 'user-redirect-node shows redirectPrompt as a link to data.link (filled, query values URL-encoded) and moves on - it does not navigate',
  covers: ['user-redirect-node'],
  flow: flow([W(), askCustom('q', 'ref'), N('r', 'user-redirect-node', { redirectPrompt: '<p>See pricing</p>', link: 'conferbot.com/pricing?ref=${ref}' }), M('m', '<p>after</p>')], chain('w', 'q', 'r', 'm')),
  inputs: [{ at: 'q', do: 'text', value: 'Priya Shah' }],
});
add({
  id: 'navigate.links-then-done',
  title: 'navigate-node: links open pages and do not advance; Done (doneNavigatingText, default "Done") moves on after 600 ms',
  covers: ['navigate-node'],
  flow: flow(
    [W(), N('nav', 'navigate-node', { navigatePrompt: '<p>Have a look</p>', navigateOptions: [{ id: 'a', navigateText: 'Docs', navigateLink: 'https://docs.example.com', openInNewTab: true }, { id: 'b', navigateText: '', navigateLink: 'x' }], doneNavigatingText: '', answerVariable: 'navigate_choice' }), M('m', '<p>after</p>')],
    chain('w', 'nav', 'm')
  ),
  inputs: [{ at: 'nav', do: 'navigateLink', index: 0 }, { at: 'nav', do: 'navigateDone' }],
});

// ===========================================================================
// Ask-question steps
// ===========================================================================
add({
  id: 'ask-name.greets-by-first-name',
  title: 'ask-name-node saves the full answer; nameGreetResponse greets by the capitalised first name after 2000 ms of typing',
  covers: ['ask-name-node'],
  source: 'QA bot "all nodes test"',
  flow: flow([W(), N('q', 'ask-name-node', { questionText: '<p>Whats your name</p>', nameGreetResponse: '<p>Fantastic, {name}</p>', answerVariable: 'name' }), M('m', '<p>[{name}]</p>')], chain('w', 'q', 'm')),
  inputs: [{ at: 'q', do: 'text', value: '  deepak gopal ' }],
});
add({
  id: 'ask-name.default-and-blank-greeting',
  title: 'No nameGreetResponse at all: the default greeting; a cleared one ("<p><br></p>"): no greeting bubble',
  covers: ['ask-name-node'],
  flow: flow([W(), N('q1', 'ask-name-node', { questionText: '<p>Name?</p>', answerVariable: 'name' }), N('q2', 'ask-name-node', { questionText: '<p>Again?</p>', nameGreetResponse: '<p><br></p>', answerVariable: 'name2' }), M('m', '<p>done</p>')], chain('w', 'q1', 'q2', 'm')),
  inputs: [{ at: 'q1', do: 'text', value: 'ana' }, { at: 'q2', do: 'text', value: 'bo' }],
});
add({
  id: 'ask-email.validation-and-typo',
  title: 'ask-email-node: an invalid address shows incorrectEmailResponse; "gmial.com" is refused once with the fix offered, the same address sent again is kept',
  covers: ['ask-email-node'],
  flow: flow([W(), N('q', 'ask-email-node', { questionText: '<p>Email?</p>', incorrectEmailResponse: '<p>Correct email pampu</p>', answerVariable: 'email' }), M('m', '<p>{email}</p>')], chain('w', 'q', 'm')),
  inputs: [
    { at: 'q', do: 'text', value: 'not-an-email' },
    { at: 'q', do: 'text', value: 'ana@gmial.com' },
    { at: 'q', do: 'text', value: 'ana@gmial.com' },
  ],
});
add({
  id: 'ask-email.valid',
  title: 'ask-email-node: a valid address is saved as typed (trimmed)',
  covers: ['ask-email-node'],
  source: realSource('ask-email-node'),
  flow: flow([W(), real('ask-email-node', 'q'), M('m', '<p>ok</p>')], chain('w', 'q', 'm')),
  inputs: [{ at: 'q', do: 'text', value: ' Ana.Smith@Example.org ' }],
});
add({
  id: 'ask-phone.normalised',
  title: 'ask-phone-number-node: "+1 (555) 123-4567" is valid and saved as "+15551234567"; "00 44 20..." as "+4420..."; 5 digits refused',
  covers: ['ask-phone-number-node'],
  flow: flow(
    [W(), N('q', 'ask-phone-number-node', { questionText: '<p>Phone?</p>', answerVariable: 'phone_number' }), N('q2', 'ask-phone-number-node', { questionText: '<p>Other?</p>', invalidPhoneResponse: '<p>That is not a phone</p>', answerVariable: 'phone2' }), M('m', '<p>{phone_number} {phone2}</p>')],
    chain('w', 'q', 'q2', 'm')
  ),
  inputs: [
    { at: 'q', do: 'text', value: '+1 (555) 123-4567' },
    { at: 'q2', do: 'text', value: '12345' },
    { at: 'q2', do: 'text', value: '00 44 20 7946 0958' },
  ],
});
add({
  id: 'ask-number.parse-and-bounds',
  title: 'ask-number-node: "1,200" is 1200 (saved as a number), "3,5" is 3.5; enableConditions min/max refuse out-of-range with invalidNumberResponse ({min}/{max} filled)',
  covers: ['ask-number-node'],
  flow: flow(
    [
      W(),
      N('q', 'ask-number-node', { questionText: '<p>How many?</p>', enableConditions: { format: '', prefix: '', minVal: '', maxVal: '' }, answerVariable: 'n1' }),
      N('q2', 'ask-number-node', { questionText: '<p>Budget?</p>', enableConditions: { minVal: '10', maxVal: '100' }, invalidNumberResponse: '<p>Between {min} and {max} please</p>', answerVariable: 'n2' }),
      N('q3', 'ask-number-node', { questionText: '<p>Rate?</p>', enableConditions: { minVal: '', maxVal: '' }, answerVariable: 'n3' }),
      M('m', '<p>{n1} {n2} {n3}</p>'),
    ],
    chain('w', 'q', 'q2', 'q3', 'm')
  ),
  inputs: [
    { at: 'q', do: 'text', value: 'abc' },
    { at: 'q', do: 'text', value: '1,200' },
    { at: 'q2', do: 'text', value: '500' },
    { at: 'q2', do: 'text', value: '42' },
    { at: 'q3', do: 'text', value: '3,5' },
  ],
});
add({
  id: 'ask-url.bare-host-gets-https',
  title: 'ask-url-node: "conferbot.com/pricing" is saved as "https://conferbot.com/pricing"; "not a url" is refused',
  covers: ['ask-url-node'],
  flow: flow([W(), N('q', 'ask-url-node', { questionText: 'Ask url', answerVariable: 'url' }), M('m', '<p>{url}</p>')], chain('w', 'q', 'm')),
  inputs: [
    { at: 'q', do: 'text', value: 'not a url' },
    { at: 'q', do: 'text', value: 'conferbot.com/pricing' },
  ],
});
add({
  id: 'ask-location.no-validation',
  title: 'ask-location-node takes any text',
  covers: ['ask-location-node'],
  source: 'QA bot "Answer Vars Test"',
  flow: flow([W(), N('q', 'ask-location-node', { questionText: '<p>Ask location</p>', answerVariable: 'location' }), M('m', '<p>{location}</p>')], chain('w', 'q', 'm')),
  inputs: [{ at: 'q', do: 'text', value: '12 Marina Walk, Dubai' }],
});
add({
  id: 'ask-custom.empty-send-ignored',
  title: 'ask-custom-question-node: an empty or blank send is ignored; text is trimmed',
  covers: ['ask-custom-question-node'],
  source: realSource('ask-custom-question-node'),
  flow: flow([W(), real('ask-custom-question-node', 'q'), M('m', '<p>ok</p>')], chain('w', 'q', 'm')),
  inputs: [{ at: 'q', do: 'text', value: '   ' }, { at: 'q', do: 'text', value: '  hello  ' }],
});
add({
  id: 'ask-file.upload',
  title: 'ask-file-node: the picked file is uploaded (POST /api/v1/bot/:id/media) and its URL saved',
  covers: ['ask-file-node'],
  server: { http: { media: { status: 200, body: { url: 'https://api.test/media/abc123' } } } },
  flow: flow([W(), N('q', 'ask-file-node', { questionText: '<p>File please</p>', answerVariable: 'file' }), M('m', '<p>{file}</p>')], chain('w', 'q', 'm')),
  inputs: [{ at: 'q', do: 'file', name: 'cv.pdf', size: 20000, type: 'application/pdf' }],
});
add({
  id: 'ask-file.rules-and-skip',
  title: 'ask-file-node: over maxFileSizeMB or not in allowedFileTypes is refused; "(optional)" in the question offers Skip -> next with no variable',
  covers: ['ask-file-node'],
  flow: flow([W(), N('q', 'ask-file-node', { questionText: '<p>Your logo (optional)</p>', allowedFileTypes: ['png', 'image/jpeg'], maxFileSizeMB: 1, answerVariable: 'logo' }), M('m', '<p>[{logo}]</p>')], chain('w', 'q', 'm')),
  inputs: [
    { at: 'q', do: 'file', name: 'big.png', size: 3 * 1024 * 1024, type: 'image/png' },
    { at: 'q', do: 'file', name: 'doc.pdf', size: 1000, type: 'application/pdf' },
    { at: 'q', do: 'skip' },
  ],
});
add({
  id: 'ask-file.upload-fails',
  title: 'ask-file-node: an upload that fails (no url back) keeps the step waiting; a retry that works moves on',
  covers: ['ask-file-node'],
  server: { http: { media: [{ status: 500, body: { message: 'boom' } }, { status: 200, body: { url: 'https://api.test/media/ok' } }] } },
  flow: flow([W(), N('q', 'ask-file-node', { questionText: '<p>File</p>', answerVariable: 'file' }), M('m', '<p>{file}</p>')], chain('w', 'q', 'm')),
  inputs: [
    { at: 'q', do: 'file', name: 'a.pdf', size: 100, type: 'application/pdf' },
    { at: 'q', do: 'file', name: 'a.pdf', size: 100, type: 'application/pdf' },
  ],
});
add({
  id: 'ask-multiple.one-by-one',
  title: 'ask-multiple-questions-node: data.message, then each question in turn (2000 ms typing each); "email" / "phone" answers are checked; variables registered as nodeId+index',
  covers: ['ask-multiple-questions-node'],
  flow: flow(
    [
      W(),
      N('mq', 'ask-multiple-questions-node', {
        message: 'Answer the following questions',
        questions: [
          { id: '1', questionText: '<p>First quest</p>', answerVariable: 'multi_first' },
          { id: '2', questionText: '<p>Your email</p>', answerVariable: 'email' },
          { id: '3', questionText: '<p>Phone</p>', answerVariable: 'phone' },
        ],
      }),
      M('m', '<p>{multi_first} / {email} / {phone}</p>'),
    ],
    chain('w', 'mq', 'm')
  ),
  inputs: [
    { at: 'mq', do: 'text', value: 'alpha' },
    { at: 'mq', do: 'text', value: 'bad-email' },
    { at: 'mq', do: 'text', value: 'a@b.co' },
    { at: 'mq', do: 'text', value: '+44 20 7946 0958' },
  ],
});
add({
  id: 'calendar.date-only',
  title: 'calendar-node without time selection: the picked day is saved as the formatted date; next after 400 ms',
  covers: ['calendar-node'],
  flow: flow(
    [
      W(),
      N('cal', 'calendar-node', {
        calendarPrompt: '<p>Pick a day</p>',
        timeZone: 'UTC',
        showPastDates: false,
        excludeDays: [''],
        excludeDates: [''],
        showTimeSelection: false,
        weeklyHours: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((dayName, day) => ({ day, dayName, available: day > 0 && day < 6, slots: [{ start: '09:00', end: '17:00' }] })),
        answerVariable: 'calendar_answer',
      }),
      M('m', '<p>{calendar_answer}</p>'),
    ],
    chain('w', 'cal', 'm')
  ),
  inputs: [{ at: 'cal', do: 'calendar', date: '2026-10-20' }],
});
add({
  id: 'calendar.with-slots',
  title: 'calendar-node with showTimeSelection: weekly hours cut into slotDuration slots; the saved value names both clocks',
  covers: ['calendar-node'],
  flow: flow(
    [
      W(),
      N('cal', 'calendar-node', {
        calendarPrompt: '<p>Book a call</p>',
        timeZone: 'Asia/Dubai',
        showPastDates: false,
        excludeDays: [''],
        excludeDates: [''],
        showTimeSelection: true,
        slotDuration: 30,
        bufferMinutes: 0,
        weeklyHours: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((dayName, day) => ({ day, dayName, available: true, slots: [{ start: '09:00', end: '11:00' }] })),
        answerVariable: 'meeting',
      }),
      M('m', '<p>{meeting}</p>'),
    ],
    chain('w', 'cal', 'm')
  ),
  inputs: [{ at: 'cal', do: 'calendar', date: '2026-10-21', slot: '09:30' }],
});

// ===========================================================================
// Choice steps
// ===========================================================================
const after = (id) => M(id, `<p>${id}</p>`);
add({
  id: 'n-choices.port-is-choice-id',
  title: 'n-choices-node: each choice leaves by "source-" + its id (ids are "1", "2" or uuids - never the position); blank choices are hidden',
  covers: ['n-choices-node'],
  source: 'QA bot "all nodes test"',
  flow: flow(
    [
      W(),
      N('c', 'n-choices-node', {
        choicePrompt: '<p>Choose node to test</p>',
        choices: [{ id: '1', choiceText: '<p>Message node</p>' }, { id: '2', choiceText: '' }, { id: 'e9237c34-a051-4c2a-84bb-e46659ec9729', choiceText: '<p>Video node</p>' }],
        answerVariable: 'picked',
      }),
      after('one'),
      after('video'),
    ],
    [E('w', 'c'), E('c', 'one', 'source-1'), E('c', 'video', 'source-e9237c34-a051-4c2a-84bb-e46659ec9729')]
  ),
  inputs: [{ at: 'c', do: 'choose', id: 'e9237c34-a051-4c2a-84bb-e46659ec9729' }],
});
add({
  id: 'n-choices.real-node',
  title: 'n-choices-node from a live bot: stored answer is the choice text without HTML',
  covers: ['n-choices-node'],
  source: realSource('n-choices-node'),
  flow: (() => {
    const c = real('n-choices-node', 'c');
    return flow([W(), c, after('next')], [E('w', 'c'), E('c', 'next', `source-${c.data.choices[1].id}`)]);
  })(),
  inputs: [{ at: 'c', do: 'choose', id: realNodes['n-choices-node'].example.node.data.choices[1].id }],
});
add({
  id: 'n-select.first-edge-after-600ms',
  title: 'n-select-option-node: saves the option text (HTML stripped) and moves on along the FIRST edge after 600 ms - options have no ports',
  covers: ['n-select-option-node'],
  source: 'QA bot "Answer Vars Test"',
  flow: flow(
    [W(), N('s', 'n-select-option-node', { selectPrompt: '<p>N select options ans var</p>', options: [{ id: '1', optionText: '<p>option 1</p>' }, { id: '2', optionText: '<p>op &amp; 2</p>' }], answerVariable: 'selected_option' }), after('first'), after('second')],
    [E('w', 's'), E('s', 'first', 'source-1'), E('s', 'second', 'source-2')]
  ),
  inputs: [{ at: 's', do: 'choose', id: '2' }],
});
add({
  id: 'n-check.list-order',
  title: 'n-check-options-node: the ticked options, in LIST order (not click order), joined ", "; first edge after 600 ms',
  covers: ['n-check-options-node'],
  flow: flow(
    [W(), N('k', 'n-check-options-node', { checkOptionsPrompt: '<p>Which?</p>', options: [{ id: '1', optionText: 'Red' }, { id: '2', optionText: '' }, { id: 'g', optionText: 'Green' }, { id: 'b', optionText: '<p>Blue</p>' }], answerVariable: 'selected_options' }), M('m', '<p>{selected_options}</p>')],
    chain('w', 'k', 'm')
  ),
  inputs: [{ at: 'k', do: 'check', ids: ['b', '1'] }],
});
add({
  id: 'image-choice.port-is-image-id',
  title: 'image-choice-node: reads data.images [{id,image,label}]; one with no image or no label is not shown; leaves by "source-" + image id',
  covers: ['image-choice-node'],
  flow: flow(
    [
      W(),
      N('ic', 'image-choice-node', {
        questionText: '<p>Which one?</p>',
        images: [{ id: 'i1', image: 'https://cdn.example/a.png', label: 'Alpha' }, { id: 'i2', image: '', label: 'NoPic' }, { id: 'i3', image: 'https://cdn.example/c.png', label: 'Gamma' }],
        answerVariable: 'selected_image',
      }),
      after('alpha'),
      after('gamma'),
    ],
    [E('w', 'ic'), E('ic', 'alpha', 'source-i1'), E('ic', 'gamma', 'source-i3')]
  ),
  inputs: [{ at: 'ic', do: 'choose', id: 'i3' }],
});
add({
  id: 'yes-no.default-ids',
  title: 'yes-or-no-choice-node: options [{id:"1",label:"Yes"},{id:"2",label:"No"}]; "No" leaves by source-2',
  covers: ['yes-or-no-choice-node'],
  source: realSource('yes-or-no-choice-node'),
  flow: flow(
    [W(), N('yn', 'yes-or-no-choice-node', { questionText: '<p>Ready?</p>', options: [{ id: '1', label: 'Yes' }, { id: '2', label: 'No' }], answerVariable: 'yes_no_answer' }), after('yes'), after('no')],
    [E('w', 'yn'), E('yn', 'yes', 'source-1'), E('yn', 'no', 'source-2')]
  ),
  inputs: [{ at: 'yn', do: 'choose', id: '2' }],
});
add({
  id: 'rating-choice.stars',
  title: 'rating-choice-node (ratingType 5): 4 stars leaves by source-3 (value-1) and saves the NUMBER 4',
  covers: ['rating-choice-node'],
  flow: flow(
    [W(), N('r', 'rating-choice-node', { questionText: '<p>Rate us</p>', ratingType: 5, answerVariable: 'rating_choice' }), after('r3'), after('r4'), M('m', '<p>{rating_choice}</p>')],
    [E('w', 'r'), E('r', 'r3', 'source-2'), E('r', 'r4', 'source-3'), E('r4', 'm')]
  ),
  inputs: [{ at: 'r', do: 'choose', value: 4 }],
});
add({
  id: 'rating-choice.smiley-and-ten',
  title: 'rating-choice-node: ratingType "smiley" is five faces (value 1-5); ratingType 10 is ten numbered buttons',
  covers: ['rating-choice-node'],
  flow: flow(
    [W(), N('r', 'rating-choice-node', { questionText: '<p>Mood?</p>', ratingType: 'smiley', answerVariable: 'mood' }), N('r10', 'rating-choice-node', { questionText: '<p>NPS?</p>', ratingType: 10, answerVariable: 'nps' }), M('m', '<p>{mood} {nps}</p>')],
    [E('w', 'r'), E('r', 'r10', 'source-1'), E('r10', 'm', 'source-8')]
  ),
  inputs: [{ at: 'r', do: 'choose', value: 2 }, { at: 'r10', do: 'choose', value: 9 }],
});
add({
  id: 'opinion-scale.port-is-offset-from-start',
  title: 'opinion-scale-choice-node from 2 to 4: picking 3 leaves by source-1 (value - from) and saves the number 3',
  covers: ['opinion-scale-choice-node'],
  source: 'real node shape (anonymised): opinion-scale {from:2,to:4}',
  flow: flow(
    [W(), N('o', 'opinion-scale-choice-node', { questionText: '<p>Rate this scale</p>', from: 2, fromLabel: '', to: 4, toLabel: '', answerVariable: 'opinion_scale_answer', numOfOptions: 3 }), after('two'), after('three'), M('m', '<p>{opinion_scale_answer}</p>')],
    [E('w', 'o'), E('o', 'two', 'source-0'), E('o', 'three', 'source-1'), E('three', 'm')]
  ),
  inputs: [{ at: 'o', do: 'choose', value: 3 }],
});
add({
  id: 'opinion-scale.blank-range-is-0-to-10',
  title: 'opinion-scale-choice-node with blank from/to: 0 to 10; picking 10 leaves by source-10',
  covers: ['opinion-scale-choice-node'],
  flow: flow([W(), N('o', 'opinion-scale-choice-node', { questionText: '<p>Score?</p>', from: '', to: '', answerVariable: 'score' }), after('ten')], [E('w', 'o'), E('o', 'ten', 'source-10')]),
  inputs: [{ at: 'o', do: 'choose', value: 10 }],
});
add({
  id: 'carousel.path-button',
  title: 'carousel-node: a path button leaves by "source-" + button id and saves "Card title - Button label"; link buttons never move the flow',
  covers: ['carousel-node'],
  flow: flow(
    [
      W(),
      N('car', 'carousel-node', {
        questionText: '<p>Our plans</p>',
        cards: [
          { id: 'c1', image: '', title: 'Starter', description: 'For one', buttons: [{ id: 'b1', label: 'Pick Starter', action: 'path' }, { id: 'l1', label: 'Docs', action: 'link', url: 'docs.example.com' }] },
          { id: 'c2', image: '', title: 'Pro', description: 'For teams', buttons: [{ id: 'b2', label: 'Pick Pro', action: 'path' }] },
          { id: 'c3', image: '', title: '', description: '', buttons: [{ id: 'b3', label: 'Hidden', action: 'path' }] },
        ],
        answerVariable: 'carousel_choice',
      }),
      after('starter'),
      M('pro', '<p>{carousel_choice}</p>'),
    ],
    [E('w', 'car'), E('car', 'starter', 'source-b1'), E('car', 'pro', 'source-b2')]
  ),
  inputs: [{ at: 'car', do: 'choose', buttonId: 'b2' }],
});
add({
  id: 'carousel.links-only-continue',
  title: 'carousel-node with only link buttons: a Continue row leaves by the plain "source" handle and saves no answer',
  covers: ['carousel-node'],
  flow: flow(
    [W(), N('car', 'carousel-node', { questionText: '', cards: [{ id: 'c1', title: 'Read more', description: '', image: '', buttons: [{ id: 'l1', label: 'Open', action: 'link', url: 'https://example.com' }] }], answerVariable: 'carousel_choice' }), M('m', '<p>[{carousel_choice}]</p>')],
    [E('w', 'car'), E('car', 'm', 'source')]
  ),
  inputs: [{ at: 'car', do: 'choose' }],
});

// ===========================================================================
// Logic steps
// ===========================================================================
const cond = (id, data) => N(id, 'condition-node', { isNumber: false, customLeftValue: false, operator: '=', customRightValue: true, ...data });
/** ask a value, test it, show which way it went. */
const condCase = (id, title, answer, data, extra = {}) =>
  add({
    id,
    title,
    covers: ['condition-node'],
    flow:
      answer === null
        ? flow([W(), cond('cd', data), M('yes', '<p>yes</p>'), M('no', '<p>no</p>')], [E('w', 'cd'), E('cd', 'yes', 'source-0'), E('cd', 'no', 'source-1')])
        : flow([W(), askCustom('q', 'v'), cond('cd', data), M('yes', '<p>yes</p>'), M('no', '<p>no</p>')], [E('w', 'q'), E('q', 'cd'), E('cd', 'yes', 'source-0'), E('cd', 'no', 'source-1')]),
    inputs: answer === null ? [] : [{ at: 'q', do: 'text', value: answer }],
    ...extra,
  });
condCase('condition.equals-string', 'condition-node "=": left is the variable named in leftValue; right a typed literal; true -> source-0', 'Pro', { leftValue: 'v', rightValue: 'Pro' });
condCase('condition.equals-numeric-text', 'condition-node "=" in text mode compares as numbers when both sides are numbers ("1.0" = "1")', '1.0', { leftValue: 'v', rightValue: '1' });
condCase('condition.case-sensitive-by-default', 'condition-node text compare is case-sensitive unless caseInsensitive', 'pro', { leftValue: 'v', rightValue: 'Pro' });
condCase('condition.case-insensitive', 'condition-node caseInsensitive:true', 'pro', { leftValue: 'v', rightValue: 'Pro', caseInsensitive: true });
condCase('condition.not-equals-alias', 'condition-node "not_equals" (snake alias of "!=")', 'Basic', { leftValue: 'v', operator: 'not_equals', rightValue: 'Pro' });
condCase('condition.greater-number-mode', 'condition-node isNumber ">": 1500 > 1000', '1500', { isNumber: true, leftValue: 'v', operator: '>', rightValue: '1000' });
condCase('condition.greater-text-not-numeric-is-false', 'condition-node ">" in text mode with a non-number side is false', 'abc', { leftValue: 'v', operator: '>', rightValue: '1' });
condCase('condition.lte-word-alias', 'condition-node "less_than_or_equal" alias', '3', { isNumber: true, leftValue: 'v', operator: 'less_than_or_equal', rightValue: '3' });
condCase('condition.contains', 'condition-node "contains"', 'I want pricing info', { leftValue: 'v', operator: 'contains', rightValue: 'pricing' });
condCase('condition.does-not-contain', 'condition-node "does not contain" (and not_contains)', 'hello', { leftValue: 'v', operator: 'not_contains', rightValue: 'pricing' });
condCase('condition.starts-ends', 'condition-node "starts with"', 'ACME-42', { leftValue: 'v', operator: 'starts with', rightValue: 'ACME-' });
condCase('condition.ends-with-snake', 'condition-node "ends_with"', 'report.pdf', { leftValue: 'v', operator: 'ends_with', rightValue: '.pdf' });
condCase('condition.matches-regex', 'condition-node "matches": rightValue is a regular expression', 'AB-1234', { leftValue: 'v', operator: 'matches', rightValue: '^[A-Z]{2}-\\d{4}$' });
condCase('condition.bad-regex-false', 'condition-node "matches" with an invalid pattern is false (no error)', 'x', { leftValue: 'v', operator: 'matches', rightValue: '([' });
condCase('condition.is-set', 'condition-node "is_set": left has a non-blank value', 'x', { leftValue: 'v', operator: 'is_set', rightValue: '' });
condCase('condition.is-not-set-unknown-var', 'condition-node "is_not_set" on a variable never answered', null, { leftValue: 'nobody', operator: 'is_not_set', rightValue: '' });
condCase('condition.wrapped-left-name', 'condition-node leftValue "${v}" or "{v}" still names the variable', 'Pro', { leftValue: '${v}', rightValue: 'Pro' });
condCase('condition.right-is-variable', 'condition-node customRightValue:false: the right side is a variable too', 'Pro', { leftValue: 'v', customRightValue: false, rightValue: 'v' });
condCase('condition.unknown-left-literal-number', 'condition-node: a left value that names no variable but is a number is taken as typed', null, { leftValue: '5', isNumber: true, operator: '>', rightValue: '3' });
condCase('condition.right-literal-interpolated', 'condition-node typed right value fills ${x} from the answers', 'Pro', { leftValue: 'v', rightValue: '${v}' });
condCase('condition.unknown-operator-false', 'condition-node with an unknown operator is false', 'x', { leftValue: 'v', operator: 'approx', rightValue: 'x' });
add({
  id: 'condition.rating-stars-compare-as-number',
  title: 'condition-node: a rating (saved as a number) compared "> 3" works; stars typed as the right value ("⭐⭐⭐") read as 3',
  covers: ['condition-node', 'rating-choice-node'],
  flow: flow(
    [W(), N('r', 'rating-choice-node', { questionText: '<p>Rate</p>', ratingType: 5, answerVariable: 'stars' }), cond('cd', { leftValue: 'stars', operator: '>', rightValue: '⭐⭐⭐' }), M('yes', '<p>yes</p>'), M('no', '<p>no</p>')],
    [E('w', 'r'), E('r', 'cd', 'source-3'), E('cd', 'yes', 'source-0'), E('cd', 'no', 'source-1')]
  ),
  inputs: [{ at: 'r', do: 'choose', value: 4 }],
});
add({
  id: 'condition.real-number-compare',
  title: 'condition-node from a live bot: number_1 = number_2 with both sides variables (isNumber)',
  covers: ['condition-node', 'ask-number-node'],
  source: 'QA bot "Condition Node Test"',
  flow: (() => {
    const b = bot('65b2808a3bb00a3a2d47166c');
    const pick = (suffix) => b.nodes.find((n) => n.id.endsWith(suffix));
    const ids = ['1706197443462', '1706197504665', '1706197521460', '1706197547971', '1706197553524'].map(pick);
    const keep = new Set(ids.map((n) => n.id));
    return flow([W(), ...ids], [E('w', ids[0].id), ...b.edges.filter((e) => keep.has(e.source) && keep.has(e.target))]);
  })(),
  inputs: [{ do: 'text', value: '7' }, { do: 'text', value: '7.0' }],
});
add({
  id: 'condition.legacy-shape-is-true',
  title: 'Real data: an old condition-node saved as {varName, condition, value} is read as an empty rule, which is TRUE (source-0); with no source-0 edge the chat ends',
  covers: ['condition-node'],
  source: 'QA bot "testing"',
  flow: flow([W(), N('cd', 'condition-node', { varName: 'score', condition: '=', value: '3' }), M('two', '<p>source-2 path</p>'), M('one', '<p>source-1 path</p>')], [E('w', 'cd'), E('cd', 'two', 'source-2'), E('cd', 'one', 'source-1')]),
});
add({
  id: 'boolean-logic.operators',
  title: 'boolean-logic-node: values are variables or typed; "no"/"off"/"0"/"" are false; NOT is "left and not right"; true -> source-0',
  covers: ['boolean-logic-node'],
  flow: flow(
    [
      W(),
      askCustom('q', 'agree'),
      N('b1', 'boolean-logic-node', { leftValue: 'agree', operator: 'AND', rightValue: 'true' }),
      N('b2', 'boolean-logic-node', { leftValue: 'agree', operator: 'NOT', rightValue: 'off' }),
      N('b3', 'boolean-logic-node', { leftValue: 'missing_var', operator: 'xor', rightValue: 'yes' }),
      M('end', '<p>all true</p>'),
      M('f1', '<p>f1</p>'),
      M('f2', '<p>f2</p>'),
      M('f3', '<p>f3</p>'),
    ],
    [E('w', 'q'), E('q', 'b1'), E('b1', 'b2', 'source-0'), E('b1', 'f1', 'source-1'), E('b2', 'b3', 'source-0'), E('b2', 'f2', 'source-1'), E('b3', 'end', 'source-0'), E('b3', 'f3', 'source-1')]
  ),
  inputs: [{ at: 'q', do: 'text', value: 'Yes' }],
});
add({
  id: 'boolean-logic.false-branch',
  title: 'boolean-logic-node: "No" is false, so AND is false -> source-1',
  covers: ['boolean-logic-node'],
  flow: flow([W(), askCustom('q', 'agree'), N('b', 'boolean-logic-node', { leftValue: 'agree', operator: 'AND', rightValue: 'true' }), M('t', '<p>t</p>'), M('f', '<p>f</p>')], [E('w', 'q'), E('q', 'b'), E('b', 't', 'source-0'), E('b', 'f', 'source-1')]),
  inputs: [{ at: 'q', do: 'text', value: 'No' }],
});
add({
  id: 'math.operations',
  title: 'math-operation-node: leftValue op rightValue (variables or numbers, "1,200" ok); saved by name data.answerVariable (default "math_operations"); "/0" or a non-number gives ""',
  covers: ['math-operation-node'],
  flow: flow(
    [
      W(),
      N('q', 'ask-number-node', { questionText: '<p>Qty?</p>', enableConditions: { minVal: '', maxVal: '' }, answerVariable: 'qty' }),
      N('m1', 'math-operation-node', { leftValue: 'qty', operator: '*', rightValue: '1,200', answerVariable: 'total' }),
      N('m2', 'math-operation-node', { leftValue: 'total', operator: '/', rightValue: '0' }),
      N('m3', 'math-operation-node', { leftValue: 'nobody', operator: '+', rightValue: '1', answerVariable: 'bad' }),
      M('m', '<p>total={total} default=[{math_operations}] bad=[{bad}]</p>'),
    ],
    chain('w', 'q', 'm1', 'm2', 'm3', 'm')
  ),
  inputs: [{ at: 'q', do: 'text', value: '3' }],
});
add({
  id: 'math.counter-in-a-loop-back',
  title: 'math-operation-node saving to its own input counts up without duplicating the variable ("n = n + 1" twice)',
  covers: ['math-operation-node', 'variable-node'],
  flow: flow(
    [W(), N('v', 'variable-node', { name: 'n', value: '0', isNumber: true }), N('i1', 'math-operation-node', { leftValue: 'n', operator: '+', rightValue: '1', answerVariable: 'n' }), N('i2', 'math-operation-node', { leftValue: 'n', operator: '+', rightValue: '1', answerVariable: 'n' }), M('m', '<p>n={n}</p>')],
    chain('w', 'v', 'i1', 'i2', 'm')
  ),
});
add({
  id: 'variable.fill-and-number',
  title: 'variable-node: data.value with {x}/${x} filled; isNumber turns "42" into 42; saved by data.name',
  covers: ['variable-node'],
  flow: flow(
    [W(), askCustom('q', 'first'), N('v1', 'variable-node', { name: 'greeting', value: 'Hello {first}!', isNumber: false }), N('v2', 'variable-node', { name: 'answer', value: '42', isNumber: true }), N('v3', 'variable-node', { name: '', value: 'ignored' }), M('m', '<p>{greeting} {answer}</p>')],
    chain('w', 'q', 'v1', 'v2', 'v3', 'm')
  ),
  inputs: [{ at: 'q', do: 'text', value: 'Ana' }],
});
add({
  id: 'random-flow.by-branch-id',
  title: 'random-flow-node: picks a wired branch by weight (Math.random 0.8 of weights 1:1 -> the second); leaves by "source-" + branch id',
  covers: ['random-flow-node'],
  random: [0.8],
  flow: flow([W(), N('r', 'random-flow-node', { branches: [{ id: 'a', weight: 1 }, { id: 'b', weight: 1 }] }), after('A'), after('B')], [E('w', 'r'), E('r', 'A', 'source-a'), E('r', 'B', 'source-b')]),
});
add({
  id: 'random-flow.legacy-position-handles',
  title: 'random-flow-node saved before branches had ids: edges use "source-" + position (real: branches {id:"0"},{id:"1"} -> source-0/1)',
  covers: ['random-flow-node'],
  source: realSource('random-flow-node'),
  random: [0.1],
  flow: flow([W(), N('r', 'random-flow-node', { branches: [{ weight: 3 }, { weight: 1 }] }), after('first'), after('second')], [E('w', 'r'), E('r', 'first', 'source-0'), E('r', 'second', 'source-1')]),
});
add({
  id: 'random-flow.unwired-branch-skipped',
  title: 'random-flow-node: a branch with no edge is never picked; no wired branch at all ends the chat',
  covers: ['random-flow-node'],
  random: [0.1],
  flow: flow([W(), N('r', 'random-flow-node', { branches: [{ id: 'a', weight: 9 }, { id: 'b', weight: 1 }] }), after('B'), N('r2', 'random-flow-node', { branches: [{ id: 'x', weight: 1 }] })], [E('w', 'r'), E('r', 'B', 'source-b'), E('B', 'r2')]),
});
const weekly = (start, end) => ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map((dayName, day) => ({ day, dayName, available: day >= 1 && day <= 5, slots: [{ start, end }] }));
add({
  id: 'business-hours.open',
  title: 'business-hours-node: open now by the owner\'s clock (Thu 2026-10-15 10:00 UTC = 14:00 Asia/Dubai, slot 09:00-17:00) -> source-0',
  covers: ['business-hours-node'],
  flow: flow([W(), N('bh', 'business-hours-node', { timezone: 'Asia/Dubai', excludeDays: [''], excludeDates: [''], weeklyHours: weekly('09:00', '17:00') }), after('open'), after('closed')], [E('w', 'bh'), E('bh', 'open', 'source-0'), E('bh', 'closed', 'source-1')]),
});
add({
  id: 'business-hours.closed-and-excluded',
  title: 'business-hours-node: the same hours with today in excludeDates ("15-10-2026" form) -> closed, source-1',
  covers: ['business-hours-node'],
  flow: flow([W(), N('bh', 'business-hours-node', { timezone: 'Asia/Dubai', excludeDays: [''], excludeDates: ['15-10-2026'], weeklyHours: weekly('09:00', '17:00') }), after('open'), after('closed')], [E('w', 'bh'), E('bh', 'open', 'source-0'), E('bh', 'closed', 'source-1')]),
});
add({
  id: 'business-hours.overnight-slot',
  title: "business-hours-node: at 2026-10-15 10:00 UTC it is 00:00 Friday in Pacific/Kiritimati (UTC+14); Thursday's overnight 22:00-02:00 slot is still open -> source-0",
  covers: ['business-hours-node'],
  flow: flow([W(), N('bh', 'business-hours-node', { timezone: 'Pacific/Kiritimati', excludeDays: [], excludeDates: [], weeklyHours: weekly('22:00', '02:00') }), after('open'), after('closed')], [E('w', 'bh'), E('bh', 'open', 'source-0'), E('bh', 'closed', 'source-1')]),
});
add({
  id: 'delay.waits-then-first-edge',
  title: 'delay-node: shows nothing, waits data.delay seconds, then the first edge',
  covers: ['delay-node'],
  flow: flow([W(), N('d', 'delay-node', { delay: 3 }), after('later')], chain('w', 'd', 'later')),
});

// ===========================================================================
// Legacy (v1) steps - still in live bots
// ===========================================================================
add({
  id: 'legacy.two-choices',
  title: 'two-choices-node: choiceText1 -> source-1, choiceText2 -> source-2; disableSecondChoice hides the second; no variable is saved',
  covers: ['two-choices-node'],
  source: realSource('two-choices-node'),
  flow: flow([W(), N('t', 'two-choices-node', { choicePrompt: 'Let\'s begin?', choiceText1: 'Yes!', choiceText2: 'Later', disableSecondChoice: false }), after('yes'), after('later')], [E('w', 't', 'source-1'), E('t', 'yes', 'source-1'), E('t', 'later', 'source-2')]),
  inputs: [{ at: 't', do: 'choose', index: 1 }],
});
add({
  id: 'legacy.three-choices',
  title: 'three-choices-node: choiceText1..3 -> source-1..3',
  covers: ['three-choices-node'],
  flow: flow([W(), N('t', 'three-choices-node', { choicePrompt: 'Pick', choiceText1: 'A', choiceText2: 'B', choiceText3: 'C' }), after('a'), after('b'), after('c')], [E('w', 't'), E('t', 'a', 'source-1'), E('t', 'b', 'source-2'), E('t', 'c', 'source-3')]),
  inputs: [{ at: 't', do: 'choose', index: 2 }],
});
add({
  id: 'legacy.select-option',
  title: 'select-option-node: option1..option5 (disableOption3..5), saved text; FIRST edge after 600 ms',
  covers: ['select-option-node'],
  source: realSource('select-option-node'),
  flow: flow([W(), N('s', 'select-option-node', { selectPrompt: 'Size?', option1: 'S', option2: 'M', option3: 'L', disableOption3: false, disableOption4: true, disableOption5: true }), after('next')], [E('w', 's'), E('s', 'next', 'source-1')]),
  inputs: [{ at: 's', do: 'choose', index: 2 }],
});
add({
  id: 'legacy.user-input-email',
  title: 'user-input-node type "email": checked, incorrectEmailResponse on a bad one; first edge after 500 ms; no variable',
  covers: ['user-input-node'],
  source: realSource('user-input-node'),
  flow: flow([W(), N('u', 'user-input-node', { type: 'email', inputPrompt: 'Your email?', incorrectEmailResponse: 'Bad email' }), after('next')], [E('w', 'u'), E('u', 'next', 'source-1')]),
  inputs: [{ at: 'u', do: 'text', value: 'nope' }, { at: 'u', do: 'text', value: 'a@b.io' }],
});
add({
  id: 'legacy.user-input-name-greet',
  title: 'user-input-node type "name": greets with nameGreet (first name) after 1000 ms typing; next after 2000 ms',
  covers: ['user-input-node'],
  flow: flow([W(), N('u', 'user-input-node', { type: 'name', inputPrompt: 'Name?', nameGreet: 'Nice to meet you, {name}' }), after('next')], [E('w', 'u'), E('u', 'next', 'source-1')]),
  inputs: [{ at: 'u', do: 'text', value: 'maria lopez' }],
});
add({
  id: 'legacy.user-range',
  title: 'user-range-node: below minVal -> source-1, within -> source-2, above maxVal -> source-3; text refused',
  covers: ['user-range-node'],
  flow: flow([W(), N('rg', 'user-range-node', { rangePrompt: 'Budget?', type: '', range: '', minVal: '100', maxVal: '500' }), after('low'), after('mid'), after('high')], [E('w', 'rg'), E('rg', 'low', 'source-1'), E('rg', 'mid', 'source-2'), E('rg', 'high', 'source-3')]),
  inputs: [{ at: 'rg', do: 'text', value: 'lots' }, { at: 'rg', do: 'text', value: '1,000' }],
});
add({
  id: 'legacy.user-rating',
  title: 'user-rating-node type "star": five buttons, the value is the number; first edge',
  covers: ['user-rating-node'],
  source: realSource('user-rating-node'),
  flow: flow([W(), N('ur', 'user-rating-node', { ratingPrompt: 'Rate?', type: 'star', range: '' }), after('next')], [E('w', 'ur'), E('ur', 'next', 'source-1')]),
  inputs: [{ at: 'ur', do: 'choose', value: 4 }],
});
add({
  id: 'legacy.quiz-scoring-real-bot',
  title: 'Real quiz bot: right answers leave by source-2 into a variable-node that ADDS to the score (quiz special case); wrong by source-1; the old-shape condition at the end is TRUE and has no source-0 edge, so the chat ends',
  covers: ['quiz-node', 'variable-node', 'condition-node', 'two-choices-node'],
  source: 'QA bot "testing"',
  flow: (() => {
    const b = bot('627217bd9454945bbbc90ece');
    // The quiz came from a template other bots copied: its node ids also appear
    // in customer bots, so they are renamed (by order, deterministic).
    const ids = new Map(b.nodes.map((n, i) => [n.id, `quiz-${i + 1}-${n.type.replace(/-node$/, '')}`]));
    const nodes = b.nodes.map((n) => ({ ...n, id: ids.get(n.id) }));
    const edges = b.edges.map((e, i) => ({ ...e, id: `quiz-edge-${i + 1}`, source: ids.get(e.source) ?? e.source, target: ids.get(e.target) ?? e.target }));
    return flow(nodes, edges);
  })(),
  // Ready (two-choices) -> quiz 1 right (option3) -> quiz 2 wrong -> quiz 3 right
  inputs: [{ do: 'choose', index: 0 }, { do: 'choose', index: 2 }, { do: 'choose', index: 0 }, { do: 'choose', index: 2 }],
});
// ===========================================================================
// Rich steps (ts/chat/richNodes.ts + richNodesView.ts)
// ===========================================================================
const QA = bot('6ac12071ad600df5f50db1d6');
/** A node of the real "QA - All Nodes" bot, as saved. */
const qa = (id) => JSON.parse(JSON.stringify(QA.nodes.find((n) => n.id === id)));
const QA_SRC = 'QA bot "QA - All Nodes"';
add({
  id: 'dynamic-choices.from-variable',
  title: 'dynamic-choices-node: options from the JSON list in data.sourceVariable (labelField/valueField); saves the value, and <var>_label when it differs; -> source',
  covers: ['dynamic-choices-node', 'variable-node'],
  flow: flow(
    [
      W(),
      N('v', 'variable-node', { name: 'plans', value: '{"items":[{"name":"Starter","code":"st"},{"name":"Pro","code":"pro"},{"name":""}]}', isNumber: false }),
      N('d', 'dynamic-choices-node', { questionText: '<p>Pick a plan</p>', source: 'variable', sourceVariable: 'plans', listPath: 'items', labelField: 'name', valueField: 'code', maxOptions: 10, emptyMessage: '<p>Nothing</p>', answerVariable: 'plan' }),
      M('m', '<p>{plan} / {plan_label}</p>'),
      M('empty', '<p>empty path</p>'),
    ],
    [E('w', 'v'), E('v', 'd'), E('d', 'm', 'source'), E('d', 'empty', 'source-empty')]
  ),
  inputs: [{ at: 'd', do: 'choose', index: 1 }],
});
add({
  id: 'dynamic-choices.empty-list',
  title: 'dynamic-choices-node with nothing in the list: says emptyMessage and leaves by source-empty (or "source" when only that is wired)',
  covers: ['dynamic-choices-node'],
  flow: flow(
    [W(), N('d', 'dynamic-choices-node', { questionText: '<p>Pick</p>', source: 'variable', sourceVariable: 'nothing', emptyMessage: '<p>Sorry, nothing to choose.</p>', answerVariable: 'x' }), M('m', '<p>fell back to source</p>')],
    [E('w', 'd'), E('d', 'm', 'source')]
  ),
});
add({
  id: 'hidden-fields.url-params',
  title: 'hidden-fields-node: shows nothing; saves query parameters of the page (utm_source...), the page URL and the referrer by name; -> source',
  covers: ['hidden-fields-node'],
  flow: flow(
    [
      W(),
      N('h', 'hidden-fields-node', { params: [{ id: 'p1', name: 'utm_source', variable: 'utm_source' }, { id: 'p2', name: 'gclid', variable: 'gclid' }, { id: 'p3', name: 'utm_campaign', variable: 'campaign' }], capturePageUrl: true, pageUrlVariable: 'page_url', captureReferrer: true, referrerVariable: 'referrer' }),
      M('m', '<p>{utm_source} / {campaign} / [{gclid}] / {page_url} / {referrer}</p>'),
    ],
    chain('w', 'h', 'm')
  ),
});
const consentNode = (data) => N('cs', 'consent-node', { questionText: '<p>Before we start</p>', consentText: 'I agree to the [Terms](https://example.com/terms) and [Privacy Policy](https://example.com/privacy).', required: true, continueLabel: 'Continue', answerVariable: 'consent', ...data });
add({
  id: 'consent.required',
  title: 'consent-node required: Continue without the box ticked shows a hint and stays; ticked -> saves true and consent_at, -> source',
  covers: ['consent-node'],
  flow: flow([W(), consentNode({}), M('m', '<p>consent={consent}</p>')], [E('w', 'cs'), E('cs', 'm', 'source')]),
  inputs: [{ at: 'cs', do: 'consent', agreed: false }, { at: 'cs', do: 'consent', agreed: true }],
});
add({
  id: 'consent.optional-declined',
  title: 'consent-node required:false: Continue unticked saves false and still leaves by source (there is no "declined" handle)',
  covers: ['consent-node'],
  flow: flow([W(), consentNode({ required: false }), M('m', '<p>consent={consent}</p>')], [E('w', 'cs'), E('cs', 'm', 'source')]),
  inputs: [{ at: 'cs', do: 'consent', agreed: false }],
});
add({
  id: 'product-card.buy-button',
  title: 'product-card-node: a path button leaves by "source-" + button id and saves its label',
  covers: ['product-card-node'],
  source: realSource('product-card-node'),
  flow: flow(
    [W(), N('p', 'product-card-node', { questionText: '<p>Our pick</p>', image: '', title: 'Pro plan', price: '$49/mo', description: 'For teams', buttons: [{ id: 'buy', label: 'Buy now', action: 'path' }, { id: 'more', label: 'Details', action: 'link', url: 'https://example.com' }], answerVariable: 'product_action' }), M('m', '<p>{product_action}</p>')],
    [E('w', 'p'), E('p', 'm', 'source-buy')]
  ),
  inputs: [{ at: 'p', do: 'choose', buttonId: 'buy' }],
});
add({
  id: 'slider.value',
  title: 'slider-node: min/max/step/unit; the picked value snapped to the step is saved as a number; -> source',
  covers: ['slider-node'],
  flow: flow([W(), N('s', 'slider-node', { questionText: '<p>Team size?</p>', min: 0, max: 50, step: 5, defaultValue: null, unit: 'people', unitPosition: 'suffix', submitLabel: 'Send', answerVariable: 'slider_value' }), M('m', '<p>{slider_value}</p>')], [E('w', 's'), E('s', 'm')]),
  inputs: [{ at: 's', do: 'slider', value: 23 }],
});
add({
  id: 'datetime.date-rules',
  title: 'datetime-node (date): a disabled weekday is refused with a message; a valid day is saved as "YYYY-MM-DD" with <var>_display',
  covers: ['datetime-node'],
  flow: flow(
    [W(), N('dt', 'datetime-node', { questionText: '<p>When?</p>', mode: 'date', minDate: 'today', maxDate: '+30', disabledWeekdays: [0, 6], minTime: '', maxTime: '', timeStep: 30, locale: '', submitLabel: 'Send', answerVariable: 'picked_date' }), M('m', '<p>{picked_date} | {picked_date_display}</p>')],
    [E('w', 'dt'), E('dt', 'm')]
  ),
  inputs: [{ at: 'dt', do: 'datetime', value: '2026-10-17' }, { at: 'dt', do: 'datetime', value: '2026-10-19' }],
});
add({
  id: 'datetime.time-mode',
  title: 'datetime-node (time): minTime/maxTime; "08:00" refused, "14:30" saved',
  covers: ['datetime-node'],
  flow: flow([W(), N('dt', 'datetime-node', { questionText: '<p>What time?</p>', mode: 'time', minTime: '09:00', maxTime: '17:00', answerVariable: 'at' }), M('m', '<p>{at}</p>')], [E('w', 'dt'), E('dt', 'm')]),
  inputs: [{ at: 'dt', do: 'datetime', value: '08:00' }, { at: 'dt', do: 'datetime', value: '14:30' }],
});
add({
  id: 'ranking.reorder',
  title: 'ranking-node: items reordered (move "Support" up twice); saves the list of texts in the final order; -> source',
  covers: ['ranking-node'],
  flow: flow(
    [W(), N('rk', 'ranking-node', { questionText: '<p>Rank these</p>', items: [{ id: 'a', text: 'Price' }, { id: 'b', text: 'Speed' }, { id: 'c', text: 'Support' }], submitLabel: 'Submit', answerVariable: 'ranking' }), M('m', '<p>{ranking}</p>')],
    [E('w', 'rk'), E('rk', 'm')]
  ),
  inputs: [{ at: 'rk', do: 'rankingMove', id: 'c', dir: -1 }, { at: 'rk', do: 'rankingMove', id: 'c', dir: -1 }, { at: 'rk', do: 'rankingSubmit' }],
});
add({
  id: 'otp.verified',
  title: 'otp-node (real): email sent (POST otp/send), code verified (POST otp/verify) -> saves the email and <var>_verified=true, leaves by source',
  covers: ['otp-node'],
  source: QA_SRC,
  server: { http: { 'otp/send': { status: 200, body: { sent: true, sentTo: 'a***@acme.io', resendIn: 30 } }, 'otp/verify': { status: 200, body: { verified: true, email: 'ana@acme.io' } } } },
  flow: flow([W(), qa('otp'), qa('otpOk'), qa('otpFail')], [E('w', 'otp'), E('otp', 'otpOk', 'source'), E('otp', 'otpFail', 'source-failed')]),
  inputs: [{ at: 'otp', do: 'otpEmail', email: 'Ana@Acme.io' }, { at: 'otp', do: 'otpCode', code: '123456' }],
});
add({
  id: 'otp.wrong-code-then-locked',
  title: 'otp-node: a wrong code says how many tries are left; "locked" ends the step on source-failed with <var>_verified=false',
  covers: ['otp-node'],
  source: QA_SRC,
  server: { http: { 'otp/send': { status: 200, body: { sent: true } }, 'otp/verify': [{ status: 400, body: { code: 'wrong_code', attemptsLeft: 2 } }, { status: 423, body: { code: 'locked' } }] } },
  flow: flow([W(), qa('otp'), qa('otpOk'), qa('otpFail')], [E('w', 'otp'), E('otp', 'otpOk', 'source'), E('otp', 'otpFail', 'source-failed')]),
  inputs: [{ at: 'otp', do: 'otpEmail', email: 'ana@acme.io' }, { at: 'otp', do: 'otpCode', code: '111111' }, { at: 'otp', do: 'otpCode', code: '222222' }],
});
add({
  id: 'otp.skip-without-failed-edge-takes-source',
  title: 'otp-node skipped (allowSkip) when only "source" is wired: the widget falls back to source - the verified path (goPort fallback)',
  covers: ['otp-node'],
  source: QA_SRC,
  flow: flow([W(), qa('otp2'), qa('otp2Ok')], [E('w', 'otp2'), E('otp2', 'otp2Ok', 'source')]),
  inputs: [{ at: 'otp2', do: 'otpSkip' }],
});
add({
  id: 'otp.send-fails-network',
  title: 'otp-node: otp/send unreachable shows an error and keeps waiting (no path taken)',
  covers: ['otp-node'],
  flow: flow([W(), qa('otp'), qa('otpOk'), qa('otpFail')], [E('w', 'otp'), E('otp', 'otpOk', 'source'), E('otp', 'otpFail', 'source-failed')]),
  inputs: [{ at: 'otp', do: 'otpEmail', email: 'ana@acme.io' }],
});
add({
  id: 'address.manual',
  title: 'address-node (real): typed by hand; saves the formatted address and <var>_line1/_city/_postal/_country; -> source',
  covers: ['address-node'],
  source: QA_SRC,
  flow: flow([W(), qa('addr2'), qa('addr2Msg')], [E('w', 'addr2'), E('addr2', 'addr2Msg')]),
  inputs: [{ at: 'addr2', do: 'addressManual', line1: '221B Baker Street', city: 'London', postal: 'NW1 6XE', country: 'United Kingdom' }],
});
add({
  id: 'address.search-and-pick',
  title: 'address-node (real): search answered by POST geo/search; the picked result (with lat/lng, country code) is saved',
  covers: ['address-node'],
  source: QA_SRC,
  server: { http: { 'geo/search': { status: 200, body: { results: [{ formatted: 'Marina Walk, Dubai Marina, Dubai, United Arab Emirates', line1: 'Marina Walk', city: 'Dubai', region: 'Dubai', postal: '', country: 'United Arab Emirates', countryCode: 'AE', lat: 25.0805, lng: 55.1403 }] } } } },
  flow: flow([W(), qa('addr'), qa('addrMsg')], [E('w', 'addr'), E('addr', 'addrMsg')]),
  inputs: [{ at: 'addr', do: 'addressSearch', q: 'marina walk' }, { at: 'addr', do: 'addressPick', index: 0 }],
});
add({
  id: 'matrix.single-require-all',
  title: 'matrix-node (real): Submit with a row missing is refused; all rows -> saves {row text: column text}; -> source',
  covers: ['matrix-node'],
  source: QA_SRC,
  flow: flow([W(), qa('mx'), qa('mxMsg')], [E('w', 'mx'), E('mx', 'mxMsg')]),
  inputs: (() => {
    const mx = qa('mx').data;
    const c = mx.columns;
    return [
      { at: 'mx', do: 'matrix', cells: { r0: c[3].id, r1: c[2].id } },
      { at: 'mx', do: 'matrix', cells: { r2: c[1].id } },
    ];
  })(),
});
add({
  id: 'matrix.multiple',
  title: 'matrix-node (real, mode multiple): each row saves a list of columns in scale order',
  covers: ['matrix-node'],
  source: QA_SRC,
  flow: flow([W(), qa('mx2'), qa('mx2Msg')], [E('w', 'mx2'), E('mx2', 'mx2Msg')]),
  inputs: (() => {
    const c = qa('mx2').data.columns;
    return [{ at: 'mx2', do: 'matrix', cells: { r0: [c[1].id, c[0].id], r1: [c[0].id] } }];
  })(),
});
add({
  id: 'matrix.nothing-to-rate',
  title: 'matrix-node with no rows (or fewer than 2 columns) shows nothing and leaves by source at once',
  covers: ['matrix-node'],
  flow: flow([W(), N('mx', 'matrix-node', { questionText: '<p>Rate</p>', rows: [], columns: [{ id: 'c0', text: 'Ok' }], answerVariable: 'm' }), M('m', '<p>skipped</p>')], [E('w', 'mx'), E('mx', 'm')]),
});
add({
  id: 'ai-extract.ok',
  title: 'ai-extract-node (real): the visitor answers in the composer; POST ai/extract; every field saved by name plus <var> (object) and <var>_missing; ok -> source',
  covers: ['ai-extract-node'],
  source: QA_SRC,
  server: { http: { 'ai/extract': { status: 200, body: { ok: true, values: { name: 'Ana Lima', email: 'ana@acme.io', company: 'Acme', team_size: 12 }, missing: [] } } } },
  flow: flow([W(), qa('ax'), qa('axOk'), qa('axMiss')], [E('w', 'ax'), E('ax', 'axOk', 'source'), E('ax', 'axMiss', 'source-missing')]),
  inputs: [{ at: 'ax', do: 'text', value: "I'm Ana Lima from Acme, ana@acme.io, team of 12" }],
});
add({
  id: 'ai-extract.missing',
  title: 'ai-extract-node (real): a required field missing -> source-missing; the server unreachable is the same path',
  covers: ['ai-extract-node'],
  source: QA_SRC,
  server: { http: { 'ai/extract': 'network' } },
  flow: flow([W(), qa('ax'), qa('axOk'), qa('axMiss')], [E('w', 'ax'), E('ax', 'axOk', 'source'), E('ax', 'axMiss', 'source-missing')]),
  inputs: [{ at: 'ax', do: 'text', value: 'just browsing' }],
});
add({
  id: 'ai-route.intent',
  title: 'ai-route-node (real): POST ai/route answers an intent id; leaves by "source-" + intent id; saves <var> (intent name) and <var>_confidence',
  covers: ['ai-route-node'],
  source: QA_SRC,
  server: { http: { 'ai/route': { status: 200, body: { intentId: 'i2', intent: 'Support', confidence: 0.91 } } } },
  flow: flow([W(), qa('ar'), qa('arSales'), qa('arSupport'), qa('arBilling'), qa('arNo')], [E('w', 'ar'), ...QA.edges.filter((e) => e.source === 'ar')]),
  inputs: [{ at: 'ar', do: 'text', value: 'my invoices page is broken' }],
});
add({
  id: 'ai-route.no-match-fallback',
  title: 'ai-route-node (real): no match -> source-fallback; <var> is "" ',
  covers: ['ai-route-node'],
  source: QA_SRC,
  server: { http: { 'ai/route': { status: 200, body: { fallback: true, confidence: 0.2 } } } },
  flow: flow([W(), qa('ar'), qa('arSales'), qa('arSupport'), qa('arBilling'), qa('arNo')], [E('w', 'ar'), ...QA.edges.filter((e) => e.source === 'ar')]),
  inputs: [{ at: 'ar', do: 'text', value: 'hmm' }],
});
add({
  id: 'ai-route.intent-not-wired-no-fallback-ends',
  title: 'ai-route-node: a matched intent with no edge goes to source-fallback; with no fallback edge either the chat ENDS (no other fallback)',
  covers: ['ai-route-node'],
  server: { http: { 'ai/route': { status: 200, body: { intentId: 'i3', intent: 'Billing', confidence: 0.8 } } } },
  flow: flow([W(), qa('ar'), qa('arSales')], [E('w', 'ar'), E('ar', 'arSales', 'source-i1'), E('ar', 'arSales', 'source')]),
  inputs: [{ at: 'ar', do: 'text', value: 'refund please' }],
});
add({
  id: 'ai-route.source-last-message',
  title: 'ai-route-node with source "last_message": asks nothing, reads the visitor\'s latest message',
  covers: ['ai-route-node'],
  server: { http: { 'ai/route': { status: 200, body: { intentId: 'i1', intent: 'Sales', confidence: 0.7 } } } },
  flow: (() => {
    const ar = qa('ar');
    ar.data.source = 'last_message';
    return flow([W(), askCustom('q', 'need', '<p>What do you need?</p>'), ar, qa('arSales'), qa('arNo')], [E('w', 'q'), E('q', 'ar'), E('ar', 'arSales', 'source-i1'), E('ar', 'arNo', 'source-fallback')]);
  })(),
  inputs: [{ at: 'q', do: 'text', value: 'pricing for 20 seats' }],
});
add({
  id: 'kb-answer.found',
  title: 'kb-answer-node (real): POST kb/answer; the answer is shown with its sources; saves <var>, <var>_found=true, <var>_sources; -> source',
  covers: ['kb-answer-node'],
  source: QA_SRC,
  server: { http: { 'kb/answer': { status: 200, body: { found: true, answer: 'Refunds are issued within 7 days.', sources: [{ title: 'Refund policy', url: 'https://help.example.com/refunds' }] } } } },
  flow: flow([W(), qa('kb'), qa('kbOk'), qa('kbNo')], [E('w', 'kb'), E('kb', 'kbOk', 'source'), E('kb', 'kbNo', 'source-notfound')]),
  inputs: [{ at: 'kb', do: 'text', value: 'how do refunds work?' }],
});
add({
  id: 'kb-answer.not-found-falls-back',
  title: 'kb-answer-node: not found -> source-notfound, or "source" when only that is wired (the found path)',
  covers: ['kb-answer-node'],
  source: QA_SRC,
  server: { http: { 'kb/answer': { status: 200, body: { found: false } } } },
  flow: flow([W(), qa('kb'), qa('kbOk')], [E('w', 'kb'), E('kb', 'kbOk', 'source')]),
  inputs: [{ at: 'kb', do: 'text', value: 'xyzzy' }],
});
add({
  id: 'signature.typed',
  title: 'signature-node (real): typed name drawn as a signature, uploaded (POST media); saves the URL and <var>_at/_method/_name; -> source',
  covers: ['signature-node'],
  source: QA_SRC,
  server: { http: { media: { status: 200, body: { url: 'https://api.test/media/sig1' } } } },
  flow: flow([W(), qa('sg2'), qa('sg2Msg')], [E('w', 'sg2'), E('sg2', 'sg2Msg')]),
  inputs: [{ at: 'sg2', do: 'signEmpty' }, { at: 'sg2', do: 'signTyped', name: 'A' }, { at: 'sg2', do: 'signTyped', name: 'Ana Lima' }],
});
const pay = (data = {}) => N('pay', 'payment-node', { questionText: "<p>You're almost done - complete the payment below.</p>", credentialId: 'cred', amountMode: 'fixed', amount: '25', currency: 'usd', productName: 'Setup fee', buttonLabel: 'Pay now', timeoutMinutes: 15, answerVariable: 'payment', ...data });
add({
  id: 'payment.paid',
  title: 'payment-node: POST pay/start; the visitor opens Checkout; the status poll (POST pay/status, every 5 s) reports "paid" -> source; saves <var> {status,amount,currency,...}, <var>_status, <var>_amount',
  covers: ['payment-node'],
  server: { http: { 'pay/start': { status: 200, body: { paymentId: 'pi_1', url: 'https://checkout.stripe.com/c/pay/cs_1', amount: 2500, currency: 'usd', status: 'open' } }, 'pay/status': { status: 200, body: { status: 'paid', paymentId: 'pi_1', amount: 2500, currency: 'usd', receiptUrl: 'https://pay.stripe.com/receipts/r1' } } } },
  flow: flow([W(), pay(), M('ok', '<p>Paid {payment_amount} {payment_currency}</p>'), M('no', '<p>failed</p>')], [E('w', 'pay'), E('pay', 'ok', 'source'), E('pay', 'no', 'source-failed')]),
  inputs: [{ at: 'pay', do: 'payOpen' }, { at: 'pay', do: 'wait', waitMs: 6000 }],
});
add({
  id: 'payment.cancelled-without-failed-edge-ends',
  title: 'payment-node cancelled with no source-failed edge: the chat ENDS - it never falls back to the paid path',
  covers: ['payment-node'],
  server: { http: { 'pay/start': { status: 200, body: { paymentId: 'pi_2', url: 'https://checkout.stripe.com/c/pay/cs_2', amount: 2500, currency: 'usd', status: 'open' } }, 'pay/status': { status: 200, body: { status: 'cancelled', paymentId: 'pi_2' } } } },
  flow: flow([W(), pay(), M('ok', '<p>paid path</p>')], [E('w', 'pay'), E('pay', 'ok', 'source')]),
  inputs: [{ at: 'pay', do: 'payCancel' }],
});
add({
  id: 'payment.timeout-falls-to-failed',
  title: 'payment-node timed out with no source-timeout edge: source-failed',
  covers: ['payment-node'],
  server: { http: { 'pay/start': { status: 200, body: { paymentId: 'pi_3', url: 'https://checkout.stripe.com/c/pay/cs_3', amount: 2500, currency: 'usd', status: 'open' } }, 'pay/status': [{ status: 200, body: { status: 'open', paymentId: 'pi_3' } }, { status: 200, body: { status: 'expired', paymentId: 'pi_3' } }] } },
  flow: flow([W(), pay({ timeoutMinutes: 1 }), M('ok', '<p>paid</p>'), M('fail', '<p>failed path</p>')], [E('w', 'pay'), E('pay', 'ok', 'source'), E('pay', 'fail', 'source-failed')]),
  inputs: [{ at: 'pay', do: 'wait', waitMs: 70000 }],
});
add({
  id: 'payment.not-configured',
  title: 'payment-node: pay/start answers not_configured -> the card says so and the step fails (source-failed) after 1600 ms',
  covers: ['payment-node'],
  server: { http: { 'pay/start': { status: 400, body: { code: 'not_configured' } } } },
  flow: flow([W(), pay(), M('ok', '<p>paid</p>'), M('fail', '<p>failed path</p>')], [E('w', 'pay'), E('pay', 'ok', 'source'), E('pay', 'fail', 'source-failed')]),
});

// ===========================================================================
// Loops and sub-flows (ts/chat/flowControl.ts)
// ===========================================================================
add({
  id: 'loop.count',
  title: 'loop-node (count 3): each arrival starts a round on source-loop setting <v>_index (1-based), <v>_item, <v>_count; then source-done',
  covers: ['loop-node'],
  flow: flow(
    [W(), N('lp', 'loop-node', { mode: 'count', count: 3, variable: 'round', maxIterations: 20 }), M('body', '<p>Round {round_index} of {round_count}</p>'), M('done', '<p>done</p>')],
    [E('w', 'lp'), E('lp', 'body', 'source-loop'), E('body', 'lp'), E('lp', 'done', 'source-done')]
  ),
});
add({
  id: 'loop.each-list',
  title: 'loop-node (each): goes through a list variable (comma text, JSON array or array) - <v>_item is each item',
  covers: ['loop-node', 'variable-node'],
  flow: flow(
    [W(), N('v', 'variable-node', { name: 'fruits', value: 'Apples, Pears', isNumber: false }), N('lp', 'loop-node', { mode: 'each', listVariable: '{fruits}', variable: 'f' }), M('body', '<p>{f_index}: {f_item}</p>'), M('done', '<p>done</p>')],
    [E('w', 'v'), E('v', 'lp'), E('lp', 'body', 'source-loop'), E('body', 'lp'), E('lp', 'done', 'source-done')]
  ),
});
add({
  id: 'loop.safety-cap',
  title: 'loop-node: count "{n}" (5) above maxIterations (2) stops at the cap: 2 rounds then source-done',
  covers: ['loop-node'],
  flow: flow(
    [W(), N('v', 'variable-node', { name: 'n', value: '5', isNumber: true }), N('lp', 'loop-node', { mode: 'count', count: '{n}', variable: 'i', maxIterations: 2 }), N('body', 'math-operation-node', { leftValue: 'i_index', operator: '*', rightValue: '10', answerVariable: 'last' }), M('done', '<p>last={last} count={i_count}</p>')],
    [E('w', 'v'), E('v', 'lp'), E('lp', 'body', 'source-loop'), E('body', 'lp'), E('lp', 'done', 'source-done')]
  ),
});
add({
  id: 'subflow.run-and-return',
  title: 'run-subflow-node sets the inputs, jumps to the subflow-node; at the end of that path the outputs are copied back and the flow continues from Run sub-flow\'s "source" edge',
  covers: ['run-subflow-node', 'subflow-node', 'subflow-return-node'],
  flow: flow(
    [
      W(),
      N('run', 'run-subflow-node', { subflowId: 'sf', inputs: [{ name: 'who', value: 'Ana' }], outputs: [{ name: 'greeting', variable: 'result' }] }),
      M('back', '<p>Back: {result}</p>'),
      N('sf', 'subflow-node', { name: 'Greet' }),
      N('set', 'variable-node', { name: 'greeting', value: 'Hello {who}', isNumber: false }),
      N('ret', 'subflow-return-node', {}),
      M('never', '<p>never</p>'),
    ],
    [E('w', 'run'), E('run', 'back'), E('sf', 'set'), E('set', 'ret'), E('ret', 'never')]
  ),
});
add({
  id: 'subflow.path-end-returns',
  title: 'A sub-flow whose path just ends (no Return step) also returns to Run sub-flow',
  covers: ['run-subflow-node', 'subflow-node'],
  flow: flow(
    [W(), N('run', 'run-subflow-node', { subflowId: 'sf', inputs: [], outputs: [] }), M('back', '<p>back</p>'), N('sf', 'subflow-node', { name: 'Inner' }), M('in', '<p>inside</p>')],
    [E('w', 'run'), E('run', 'back'), E('sf', 'in')]
  ),
});
add({
  id: 'subflow.missing-target',
  title: 'run-subflow-node naming a sub-flow that does not exist: source-error when wired, else it carries on by "source"',
  covers: ['run-subflow-node'],
  flow: flow([W(), N('run', 'run-subflow-node', { subflowId: 'gone' }), M('err', '<p>error path</p>'), M('ok', '<p>ok path</p>')], [E('w', 'run'), E('run', 'ok', 'source'), E('run', 'err', 'source-error')]),
});
add({
  id: 'subflow.return-outside-a-subflow',
  title: 'subflow-return-node reached outside any sub-flow just follows its first edge',
  covers: ['subflow-return-node'],
  flow: flow([W(), N('ret', 'subflow-return-node', {}), M('m', '<p>after</p>')], chain('w', 'ret', 'm')),
});

// ===========================================================================
// Integrations and server steps
// ===========================================================================
add({
  id: 'email-node.sends-and-continues',
  title: 'email-node: emits email-node-trigger with the answers and moves on at once',
  covers: ['email-node'],
  source: realSource('email-node'),
  flow: flow([W(), askCustom('q', 'topic'), real('email-node', 'mail'), M('m', '<p>sent</p>')], chain('w', 'q', 'mail', 'm')),
  inputs: [{ at: 'q', do: 'text', value: 'demo' }],
});
add({
  id: 'webhook.fire-and-forget',
  title: 'webhook-node: called from the page (token then request) without waiting - the flow moves on at once; its answerVariable is filled later if the call works',
  covers: ['webhook-node'],
  flow: flow([W(), N('wh', 'webhook-node', { authentication: { username: 'u', password: 'p', tokenUrl: 'https://api.example.com/token' }, url: 'https://api.example.com/x', method: 'POST', headers: [], body: '', includeAnswerVariables: true, answerVariable: 'webhookresponse' }), M('m', '<p>[{webhookresponse}]</p>')], chain('w', 'wh', 'm')),
});
add({
  id: 'zapier.continues',
  title: 'zapier-node: sends the answers in the background (when a webhook is set up for the node) and moves on',
  covers: ['zapier-node'],
  flow: flow([W(), N('z', 'zapier-node', { botId: 'qa-bot', nodeId: 'z', tokenData: {} }), M('m', '<p>after</p>')], chain('w', 'z', 'm')),
});
add({
  id: 'gpt.reply-shown',
  title: 'gpt-node: POST /bot/:id/gpt with the transcript; the reply is shown after 1000 ms typing, then the first edge',
  covers: ['gpt-node'],
  server: { http: { gpt: { status: 200, body: { reply: 'Sure - here is a short answer.' } } } },
  flow: flow([W(), askCustom('q', 'ask'), N('g', 'gpt-node', { context: 'Be brief', selectedModel: 'gpt-4o-mini', responseVariable: '' }), M('m', '<p>after</p>')], chain('w', 'q', 'g', 'm')),
  inputs: [{ at: 'q', do: 'text', value: 'What is Conferbot?' }],
});
add({
  id: 'gpt.error-continues',
  title: 'gpt-node: a failed call shows nothing and moves on',
  covers: ['gpt-node'],
  server: { http: { gpt: { status: 500, body: {} } } },
  flow: flow([W(), N('g', 'gpt-node', { context: '' }), M('m', '<p>after</p>')], chain('w', 'g', 'm')),
});
add({
  id: 'native-integration.background',
  title: 'hubspot-node: emits execute-integration and moves on at once (it does not wait); when integration-result arrives its answerVariable/answerValue is saved by name',
  covers: ['hubspot-node'],
  server: { integration: { hubspot: { success: true, answerVariable: 'hubspot_data', answerValue: { id: '901' } } } },
  flow: flow([W(), N('hubspot', 'hubspot-node', { credentialId: 'c', operation: 'createContact', answerVariable: 'hubspot_data' }), M('m', '<p>{hubspot_data}</p>')], chain('w', 'hubspot', 'm')),
});
add({
  id: 'result-integration.success',
  title: 'mailchimp-node: success -> the "source" edge (or an old edge with no handle)',
  covers: ['mailchimp-node'],
  server: { integration: { mc: { success: true } } },
  flow: flow([W(), N('mc', 'mailchimp-node', { credentialId: 'c', operation: 'upsertMember', listId: 'l', email: '{email}', answerVariable: 'mailchimp_member_id' }), M('ok', '<p>ok</p>'), M('bad', '<p>bad</p>')], [E('w', 'mc'), E('mc', 'bad', 'source-failure'), E('mc', 'ok', NO_HANDLE)]),
});
add({
  id: 'result-integration.failure-and-fallback',
  title: 'segment-node failed -> source-failure; salesforce-node failed with no failure edge -> its success edge',
  covers: ['segment-node', 'salesforce-node'],
  server: { integration: { sg: { success: false, error: 'boom' }, sf: { success: false } } },
  flow: flow(
    [W(), N('sg', 'segment-node', { credentialId: 'c', operation: 'identify' }), M('sgBad', '<p>segment failed</p>'), N('sf', 'salesforce-node', { credentialId: 'c', operation: 'createLead' }), M('sfOk', '<p>salesforce success path</p>')],
    [E('w', 'sg'), E('sg', 'sgBad', 'source-failure'), E('sgBad', 'sf'), E('sf', 'sfOk', 'source')]
  ),
});
add({
  id: 'human-handover.pre-chat-then-no-agents',
  title: 'human-handover-node: pre-chat questions first (email checked), then handoverMessage and initiate-handover; nobody free -> fallbackMessage, then the first edge',
  covers: ['human-handover-node'],
  server: { handover: 'no-agents' },
  customizations: { chatLeaveMessage: false },
  flow: flow(
    [
      W(),
      N('ho', 'human-handover-node', {
        handoverMessage: '<p>Connecting you…</p>',
        maxWaitTime: 2,
        fallbackMessage: '<p>All agents are busy.</p>',
        assignmentType: 'auto',
        enablePreChatQuestions: true,
        preChatQuestions: [{ id: 'pq1', questionText: '<p>Your email?</p>', answerVariable: 'email' }],
        enablePostChatSurveyQuestions: false,
        postChatSurveyQuestions: [],
      }),
      M('after', '<p>after handover {email}</p>'),
    ],
    chain('w', 'ho', 'after')
  ),
  inputs: [{ at: 'ho', do: 'text', value: 'bad' }, { at: 'ho', do: 'text', value: 'ana@acme.io' }],
});

add({
  id: 'native-integration.chain',
  title: 'gmail, google-sheets, google-docs, google-drive, slack, discord, airtable, notion, zohocrm: each emits execute-integration and moves on at once along its first edge; results that arrive later fill variables (sheets columnMappedValues too); a failure changes nothing',
  covers: ['gmail-node', 'google-sheets-node', 'google-docs-node', 'google-drive-node', 'slack-node', 'discord-node', 'airtable-node', 'notion-node', 'zohocrm-node'],
  server: { integration: { slack: { success: false, error: 'channel_not_found' }, sheets: { success: true, answerVariable: 'sheets_data', answerValue: [['a', 1]], columnMappedValues: { plan: 'Pro' } }, notion: 'none' } },
  flow: flow(
    [
      W(),
      N('gmail', 'gmail-node', { credentialId: 'c', to: '{email}', subject: 'Hi', body: 'x' }),
      N('sheets', 'google-sheets-node', { credentialId: 'c', operation: 'read', spreadsheetId: 's', sheetName: 'Sheet1', answerVariable: 'sheets_data' }),
      N('docs', 'google-docs-node', { credentialId: 'c', operation: 'create', title: 'Lead', answerVariable: 'docs_data' }),
      N('drive', 'google-drive-node', { credentialId: 'c', operation: 'upload', name: 'a.txt', answerVariable: 'drive_data' }),
      N('slack', 'slack-node', { credentialId: 'c', operation: 'sendMessage', channel: '#leads', message: 'New lead', answerVariable: 'slack_data' }),
      N('discord', 'discord-node', { credentialId: 'c', operation: 'sendMessage', channelId: '1', message: 'x', answerVariable: 'discord_data' }),
      N('airtable', 'airtable-node', { credentialId: 'c', operation: 'list', baseId: 'b', tableName: 't', answerVariable: 'airtable_data' }),
      N('notion', 'notion-node', { credentialId: 'c', operation: 'listDatabases', answerVariable: 'notion_data' }),
      N('zoho', 'zohocrm-node', { credentialId: 'c', operation: 'createLead', answerVariable: 'zohocrm_result' }),
      M('m', '<p>plan={plan}</p>'),
    ],
    chain('w', 'gmail', 'sheets', 'docs', 'drive', 'slack', 'discord', 'airtable', 'notion', 'zoho', 'm')
  ),
});
add({
  id: 'stripe-node.link-is-not-a-gate',
  title: 'stripe-node (createPaymentLink): shows the payment link the server made and moves on 500 ms later - it does not wait for the payment (payment-node does)',
  covers: ['stripe-node'],
  source: realSource('stripe-node'),
  server: { integration: { stripe: { success: true, data: { url: 'https://buy.stripe.com/test_123', id: 'plink_1' }, message: 'Pay here' } } },
  flow: flow([W(), N('stripe', 'stripe-node', { credentialId: 'c', operation: 'createPaymentLink', priceId: 'price_1', currency: 'usd', productName: 'Plan', answerVariable: 'stripe_result' }), M('m', '<p>after link</p>')], chain('w', 'stripe', 'm')),
});
add({
  id: 'google-calendar.list-continues',
  title: 'google-calendar-node with an operation other than "book": runs on the server in the background and moves on at once',
  covers: ['google-calendar-node'],
  flow: flow([W(), N('gcal', 'google-calendar-node', { credentialId: 'c', operation: 'list', calendarId: 'primary', answerVariable: 'calendar_data' }), M('m', '<p>after</p>')], chain('w', 'gcal', 'm')),
});
add({
  id: 'google-meet.create',
  title: 'google-meet-node (create): waits for the server result, then moves on',
  covers: ['google-meet-node'],
  server: { integration: { meet: { success: true, data: { meetingUri: 'https://meet.google.com/abc-defg-hij' }, answerVariable: 'meet_data', answerValue: 'https://meet.google.com/abc-defg-hij' } } },
  flow: flow([W(), N('meet', 'google-meet-node', { credentialId: 'c', operation: 'create', accessType: 'open', answerVariable: 'meet_data' }), M('m', '<p>{meet_data}</p>')], chain('w', 'meet', 'm')),
});

// ===========================================================================
// A whole real flow
// ===========================================================================
add({
  id: 'real.qa-all-nodes-tour',
  title: 'The real "QA - All Nodes" bot end to end (OTP, address, matrix, AI extract/route, KB, signature) with scripted server answers',
  covers: ['otp-node', 'address-node', 'matrix-node', 'ai-extract-node', 'ai-route-node', 'kb-answer-node', 'signature-node', 'message-node', 'welcome-node'],
  source: QA_SRC,
  server: {
    http: {
      'otp/send': { status: 200, body: { sent: true } },
      'otp/verify': { status: 200, body: { verified: true, email: 'ana@acme.io' } },
      'ai/extract': { status: 200, body: { ok: false, values: { name: 'Ana' }, missing: ['email'] } },
      'ai/route': [{ status: 200, body: { intentId: 'i1', intent: 'Sales', confidence: 0.88 } }, { status: 200, body: { fallback: true } }],
      'kb/answer': [{ status: 200, body: { found: true, answer: 'Yes.', sources: [] } }, { status: 200, body: { found: false } }],
      media: { status: 200, body: { url: 'https://api.test/media/sig' } },
    },
  },
  flow: flow(QA.nodes, QA.edges),
  inputs: (() => {
    const mx = QA.nodes.find((n) => n.id === 'mx').data.columns;
    const mx2 = QA.nodes.find((n) => n.id === 'mx2').data.columns;
    return [
      { at: 'otp', do: 'otpEmail', email: 'ana@acme.io' },
      { at: 'otp', do: 'otpCode', code: '123456' },
      { at: 'otp2', do: 'otpSkip' },
      { at: 'addr', do: 'addressManual', line1: '12 Marina Walk', city: 'Dubai', country: 'United Arab Emirates' },
      { at: 'addr2', do: 'addressManual', line1: '1 Main St', city: 'Austin', postal: '78701' },
      { at: 'mx', do: 'matrix', cells: { r0: mx[0].id, r1: mx[1].id, r2: mx[2].id } },
      { at: 'mx2', do: 'matrix', cells: { r0: [mx2[0].id], r1: [mx2[1].id] } },
      { at: 'ax', do: 'text', value: 'I am Ana' },
      { at: 'ar', do: 'text', value: 'pricing' },
      { at: 'ar2', do: 'text', value: 'nothing' },
      { at: 'kb', do: 'text', value: 'refunds?' },
      { at: 'kb2', do: 'text', value: 'xyzzy' },
      { at: 'sg', do: 'signTyped', name: 'Ana Lima', fullName: 'Ana Lima' },
      { at: 'sg2', do: 'signTyped', name: 'AL' },
    ];
  })(),
});

module.exports = cases;
