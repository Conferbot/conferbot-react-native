// Stands in for conferbot-widget/src/index.ts while the fixtures run.
// Every function here is a copy of the widget's own, cited by line (the
// line numbers are those of index.ts on 2026-10-15). Everything it calls -
// _displayBotMessage, the step handlers, the rich steps, loops and
// sub-flows - is the widget's real code, loaded by env.js.
const env = require('./env');
const socket = require('./fakeSocket');

const S = {}; // the widget's module state (index.ts:330-380)
const reset = (fixture) => {
  Object.assign(S, {
    nodes: [],
    edges: [],
    steps: [],
    currentIndex: 0,
    record: [],
    transcript: [],
    answerVariables: [],
    variables: {},
    chatStarted: false,
    hasChatEnded: false,
    showTypingAnimation: false,
    isPreChatQuestionSubmit: false,
    isPostChatSurveyQuestionSubmit: false,
    isUserInputEnabled: true,
    visitorName: null,
    visitorEmail: null,
    visitorPhone: null,
    chatbotId: 'qa-bot',
    chatSessionId: 'qa-session',
    visitorId: 'qa-visitor',
    workspaceId: 'qa-workspace',
    botName: 'QA Bot',
    embedType: 'popup',
    calendarBookings: [],
    integrationWebhooks: [],
    customizationsRef: { fontSize: 14, bubbleBorderRadius: 12, avatarSize: 32, botMsgColor: '#0808EE', botTextColor: '#ffffff', userMsgColor: '#eeeeee', userTextColor: '#111111', ...(fixture.customizations || {}) },
    shadowDOM: null,
    trace: [],
    ended: false,
  });
  const flow = JSON.parse(JSON.stringify(fixture.flow));
  S.nodes = flow.nodes;
  S.edges = flow.edges;
  if (fixture.calendarBookings) S.calendarBookings = fixture.calendarBookings;
  if (fixture.integrationWebhooks) S.integrationWebhooks = fixture.integrationWebhooks;
  // The chat panel: the elements the step code looks up (src/html/*).
  const host = env.win.document.createElement('div');
  env.win.document.body.innerHTML = '';
  env.win.document.body.appendChild(host);
  const root = host.attachShadow({ mode: 'open' });
  root.innerHTML = `<div class="popup__chat__body"><div id="steps"></div></div>
    <div class="popup__composer"><textarea id="inputField"></textarea><button id="sendBtn"></button>
    <input type="file" id="uploadBtn" disabled><svg id="uploadSvg"></svg><div id="uploadNudge" style="display:none"></div>
    <button id="voiceRecordBtn"></button></div>`;
  S.shadowDOM = root;
};

const W = env.widgetRequire;
let M = null; // widget modules, loaded on first use (after the exports exist)
const mods = () => {
  if (M) return M;
  M = {
    cats: W('core/node-processors/nodeTypeCategories.ts'),
    nodeLogic: W('ts/chat/nodeLogic.ts'),
    logicValues: W('ts/chat/handlers/logicValues.ts'),
    privacy: W('ts/chat/privacy/index.ts'),
    chatManager: W('ts/chat/chatManager.ts'),
    display: W('ts/chat/displayStep.ts'),
    handlers: W('ts/chat/handlers/index.ts'),
    integrations: W('ts/chat/handlers/integrations.ts'),
    rich: W('ts/chat/richNodesView.ts'),
    flowRun: W('ts/chat/flowControlRun.ts'),
    meta: W('core/node-processors/chatMetadataBuilder.ts'),
    helpers: W('utils/helpers.ts'),
  };
  // Errors the steps show the visitor: real function, also traced.
  const real = M.helpers._displayErrorMessage;
  M.helpers._displayErrorMessage = (...a) => {
    trace({ kind: 'error', node: S.steps[S.currentIndex]?.id, message: String(a[3] ?? '') });
    return real(...a);
  };
  return M;
};

const trace = (e) => S.trace.push({ t: env.clock.now, ...e });

// ----- index.ts:4099-4200 -----
const _getValueFromAnswerVariableKey = (key) => {
  const v = S.answerVariables.find((x) => x.key === key); // index.ts:4147
  return v ? v.value : null;
};
const redact = () => S.customizationsRef?.redactSensitive !== false;
const _setAnswerVariable = (nodeId, value) => {
  // index.ts:4159 - only an entry registered when the step was shown is filled
  const v = S.answerVariables.find((x) => x.nodeId === nodeId);
  if (v) v.value = redact() ? mods().privacy.maskValue(value) : value;
};
const _setAnswerVariableByKey = (key, value, nodeId) =>
  // index.ts:4175
  mods().logicValues.saveVariableByName(S.answerVariables, key, redact() ? mods().privacy.maskValue(value) : value, nodeId ?? `column_mapped_${key}`);
const _setUserMetaData = (type, value) => {
  // index.ts:4180
  if (type === 'name') S.visitorName = value;
  else if (type === 'email') S.visitorEmail = value;
};
const _nodeRecord = (node) => {
  // index.ts:4138
  const renderedText = mods().nodeLogic.renderedTextFor(node, _getValueFromAnswerVariableKey);
  return { ...node, ...(renderedText !== undefined ? { renderedText } : {}), time: new Date().toISOString() };
};
const _pushDataToRecord = (object) => {
  // index.ts:4360
  object.time = new Date().toISOString();
  if (redact()) mods().privacy.maskRecordEntry(object);
  const kind = (r) => `${r?.type ?? ''}|${r?.shape ?? ''}`;
  const i = S.record.findIndex((r) => r.id === object.id && kind(r) === kind(object));
  if (i !== -1) S.record[i] = { ...S.record[i], ...object, data: { ...S.record[i].data, ...object.data } };
  else S.record.push(object);
  if (String(object?.shape || object?.type || '').startsWith('user')) trace({ kind: 'answer', node: object.id, shape: object.shape || object.type });
};
const _handleAddToTranscript = (by, message) => {
  // index.ts:4442
  S.transcript.push({ by, message });
  _sendResponse();
};
const _sendResponse = () => socket.emit('response-record', {}); // index.ts:4502 (payload not compared)
const _toggleInputElements = (disabled) => {
  // index.ts:4585
  S.isUserInputEnabled = !disabled;
  const input = S.shadowDOM.querySelector('#inputField');
  if (input) input.disabled = disabled;
  const up = S.shadowDOM.querySelector('#uploadBtn');
  const uploadOff = disabled || S.customizationsRef?.enableVisitorFileUpload === false;
  if (up) {
    up.disabled = uploadOff;
    if (uploadOff) up.setAttribute('disabled', 'true');
    else up.removeAttribute('disabled');
  }
};
const _handleEmailNode = () => {
  // index.ts:6485
  const step = S.steps[S.currentIndex];
  const data = { nodeData: step.data, botName: S.botName, transcript: S.transcript, visitorName: S.visitorName || '', visitorEmail: S.visitorEmail || '' };
  S.answerVariables.forEach((v) => (data[v.key] = v.value));
  data.answerVariables = S.answerVariables;
  data.chatDate = new Date().toISOString();
  data.workspaceId = S.workspaceId;
  socket.emit('email-node-trigger', data);
  _findAndDisplayNode();
};
const _handleZapierTrigger = (nodeData, payload) => {
  // index.ts:6519
  if (!S.integrationWebhooks || !S.chatbotId) return;
  const hook = S.integrationWebhooks.find((w) => w.nodeId === nodeData.nodeId && w.botId === S.chatbotId && w.active);
  if (!hook) return;
  nodeData.webhookURL = hook.webhookURL;
  socket.emit('zapier-node-trigger', { nodeData, payload, chatSessionId: S.chatSessionId, workspaceId: S.workspaceId });
  _findAndDisplayNode();
};

// ----- index.ts:4641 _nodeCategorizeHelper -----
const PROMPT = {
  'two-choices-node': 'choicePrompt', 'three-choices-node': 'choicePrompt', 'select-option-node': 'selectPrompt',
  'user-rating-node': 'ratingPrompt', 'user-input-node': 'inputPrompt', 'user-range-node': 'rangePrompt', 'quiz-node': 'quizPrompt',
  'message-node': 'text', 'image-node': 'image', 'video-node': 'video', 'audio-node': 'audio', 'file-node': 'file',
  'user-redirect-node': 'redirectPrompt', 'html-node': 'html', 'navigate-node': 'navigatePrompt',
};
const ASK_WITH_VAR = {
  'ask-name-node': 'questionText', 'ask-email-node': 'questionText', 'ask-phone-number-node': 'questionText', 'ask-number-node': 'questionText',
  'ask-url-node': 'questionText', 'ask-location-node': 'questionText', 'ask-custom-question-node': 'questionText', 'ask-file-node': 'questionText',
  'calendar-node': 'calendarPrompt', 'n-select-option-node': 'selectPrompt', 'n-check-options-node': 'checkOptionsPrompt', 'n-choices-node': 'choicePrompt',
  'image-choice-node': 'questionText', 'rating-choice-node': 'questionText', 'yes-or-no-choice-node': 'questionText', 'opinion-scale-choice-node': 'questionText',
};
const register = (nodeId, key) => S.answerVariables.push({ nodeId, key, value: null });
const _nodeCategorizeHelper = (by, node) => {
  if (by !== 'bot') return;
  const d = node.data;
  if (PROMPT[node.type]) return _handleAddToTranscript('bot', d[PROMPT[node.type]]);
  if (ASK_WITH_VAR[node.type]) {
    _handleAddToTranscript('bot', d[ASK_WITH_VAR[node.type]]);
    if (d.answerVariable) register(node.id, d.answerVariable);
    return;
  }
  switch (node.type) {
    case 'ask-multiple-questions-node': // index.ts:4793
      _handleAddToTranscript('bot', d.message);
      d.questions.forEach((q) => _handleAddToTranscript('bot', q.questionText));
      d.questions.forEach((q, i) => q.answerVariable && register(node.id + i, q.answerVariable));
      return;
    case 'carousel-node': // index.ts:4892
      _handleAddToTranscript('bot', d?.questionText || mods().display && W('ts/chat/nodeKit.ts').carouselCards(d).map((c) => c.title).filter(Boolean).join(', '));
      if (d?.answerVariable) register(node.id, d.answerVariable);
      return;
    case 'human-handover-node': // index.ts:4958
      if (d.enablePreChatQuestions && d.preChatQuestions.length > 0)
        d.preChatQuestions.forEach((q) => {
          _handleAddToTranscript('bot', q.questionText);
          if (q.answerVariable) register(q.id, q.answerVariable);
        });
      if (d.enablePostChatSurveyQuestions && d.postChatSurveyQuestions.length > 0)
        d.postChatSurveyQuestions.forEach((q) => {
          _handleAddToTranscript('bot', q.questionText);
          if (q.answerVariable) register(q.id, q.answerVariable);
        });
      return;
    default:
      mods().rich.categorizeRichNode(node, register); // index.ts:4999
  }
};

// ----- index.ts:5539-6060: the engine -----
const show = (node) => {
  // _displayBotMessageAndScroll (chatManager.ts:8) -> displayStep.ts _displayBotMessage
  S.showTypingAnimation = true;
  mods().chatManager._displayBotMessageAndScroll(S.showTypingAnimation, S.embedType, S.customizationsRef, S.steps, S.currentIndex);
};
const ctx = () => ({ chatSessionId: S.chatSessionId, chatbotId: S.chatbotId, workspaceId: S.workspaceId });
/** The dispatch shared by _findAndDisplayNode, ...WithPort and _handleJumpToNode. */
const dispatch = (n, via) => {
  const m = mods();
  const H = m.handlers;
  trace({ kind: 'enter', node: n.id, type: n.type, via });
  if (m.cats.isDisplayNode(n.type)) {
    show(n);
    _nodeCategorizeHelper('bot', n);
  } else if (n.type === 'condition-node') H._handleConditionNode();
  else if (n.type === 'boolean-logic-node') H._handleBooleanLogicNode();
  else if (n.type === 'random-flow-node') H._handleRandomFlowNode();
  else if (n.type === 'math-operation-node') H._handleMathOperationNode();
  else if (n.type === 'variable-node') H._handleVariableNode();
  else if (n.type === 'email-node') {
    // index.ts:6280 - reached by a jump, the email step only moves on
    if (via === 'jump') _findAndDisplayNode();
    else _handleEmailNode();
  } else if (n.type === 'jump-to-node') _handleJumpToNode(m.logicValues.jumpTargetOf(n?.data));
  else if (n.type === 'webhook-node') {
    H._handleWebhookNode(n?.data, n?.id, S.answerVariables);
    _findAndDisplayNode();
  } else if (n.type === 'business-hours-node') H._handleBusinessHoursNode(n?.data);
  else if (n.type === 'delay-node') H._handleDelayNode(n?.data);
  else if (n.type === 'human-handover-node') {
    if (n?.data?.enablePreChatQuestions || n?.data?.enablePostChatSurveyQuestions) {
      S.isPreChatQuestionSubmit = true;
      _nodeCategorizeHelper('bot', n);
    }
    n.data.chatSessionId = S.chatSessionId;
    n.data.chatbotId = S.chatbotId;
    const { chatMetaData, metaData } = m.meta.buildAllMetaData({ workspaceId: S.workspaceId, chatSessionId: S.chatSessionId, chatbotId: S.chatbotId, botName: S.botName, record: S.record, answerVariables: S.answerVariables, transcript: S.transcript });
    H._handleHumanHandoverNode(S.shadowDOM, S.embedType, S.customizationsRef, n?.data, chatMetaData, metaData, socket);
  } else if (n.type === 'gpt-node') H._handleGPTNode(S.shadowDOM, S.embedType, n?.data);
  else if (n.type === 'zapier-node') H._handleZapierNode(n?.data);
  else if (n.type === 'gmail-node') H._handleGmailNode(socket, n?.id, n?.data, ctx());
  else if (n.type === 'google-sheets-node') H._handleGoogleSheetsNode(socket, n?.id, n?.data, ctx());
  else if (n.type === 'google-calendar-node') H._handleGoogleCalendarNode(socket, n?.id, n?.data, ctx(), S.shadowDOM, S.embedType);
  else if (n.type === 'google-meet-node') H._handleGoogleMeetNode(socket, n?.id, n?.data, ctx(), S.shadowDOM, S.embedType);
  else if (n.type === 'google-docs-node') H._handleGoogleDocsNode(socket, n?.id, n?.data, ctx());
  else if (n.type === 'google-drive-node') H._handleGoogleDriveNode(socket, n?.id, n?.data, ctx());
  else if (n.type === 'slack-node') H._handleSlackNode(socket, n?.id, n?.data, ctx());
  else if (n.type === 'discord-node') H._handleDiscordNode(socket, n?.id, n?.data, ctx());
  else if (n.type === 'airtable-node') H._handleAirtableNode(socket, n?.id, n?.data, ctx());
  else if (n.type === 'hubspot-node') H._handleHubSpotNode(socket, n?.id, n?.data, ctx());
  else if (n.type === 'notion-node') H._handleNotionNode(socket, n?.id, n?.data, ctx());
  else if (n.type === 'zohocrm-node') H._handleZohoCRMNode(socket, n?.id, n?.data, ctx());
  else if (n.type === 'stripe-node') H._handleStripeNode(socket, n?.id, n?.data, ctx(), S.shadowDOM, S.embedType);
  else if (H.isResultIntegrationStep(n.type)) H._handleResultIntegrationNode(socket, n, S.edges, ctx());
  else _passUnknownStep(n);
};
const endChat = () => {
  // index.ts:5800 / 6033
  if (mods().flowRun.returnFromSubflowPath()) return;
  S.hasChatEnded = true;
  S.ended = true;
  _sendResponse();
  socket.emit('chat-flow-completed', { chatSessionId: S.chatSessionId });
  trace({ kind: 'end' });
};
const enterNode = (next, via) => {
  S.steps.push(next);
  S.record.push(_nodeRecord(next));
  S.currentIndex++;
  dispatch(next, via);
};
const _findAndDisplayNode = () => {
  // index.ts:5539
  if (S.ended) return;
  if (S.steps.length === 0 && !S.chatStarted) {
    // index.ts:5569 - the first welcome-node starts the chat
    const welcome = S.nodes.filter((n) => n?.type === 'welcome-node')[0];
    S.steps.push(welcome);
    S.record.push(_nodeRecord(welcome));
    S.transcript = [{ by: 'bot', message: S.nodes.find((n) => n.type === 'welcome-node').data.text }];
    S.chatStarted = true;
    S.showTypingAnimation = true;
    trace({ kind: 'enter', node: welcome.id, type: welcome.type, via: 'start' });
    mods().display._displayBotMessage(S.shadowDOM, S.showTypingAnimation, S.embedType, S.customizationsRef, S.steps, S.currentIndex);
    _sendResponse();
    return;
  }
  // index.ts:4628 _findNextElement: the FIRST edge from the step, any handle
  const node = S.steps[S.currentIndex];
  const edge = S.edges.find((e) => e.source === node?.id);
  if (edge) S.record.push(edge);
  const next = S.nodes.find((n) => n.id === edge?.target);
  if (next) enterNode(next, edge.sourceHandle ? `edge:${edge.sourceHandle}` : 'edge');
  else endChat();
};
const _passUnknownStep = (node) => {
  // index.ts:5827
  if (mods().rich.runRichLogicNode(node)) return;
  console.warn(`[conferbot] step "${node?.type}" is not supported here; continuing the flow`);
  trace({ kind: 'unsupported', node: node?.id, type: node?.type });
  setTimeout(() => _findAndDisplayNode(), 0);
};
const _findAndDisplayNodeWithPort = (sourceHandle) => {
  // index.ts:5835 - the edge from this exact handle; none ends the chat
  if (S.ended) return;
  const e = S.edges.find((x) => x?.sourceHandle === sourceHandle && x?.source === S.steps[S.currentIndex].id);
  trace({ kind: 'port', node: S.steps[S.currentIndex].id, handle: sourceHandle ?? null, wired: !!e });
  if (e) {
    S.record.push(e);
    const next = S.nodes?.find((n) => n?.id === e.target);
    if (!next) {
      // nextNode.type on undefined: the widget throws here (index.ts:5866)
      trace({ kind: 'crash', node: S.steps[S.currentIndex].id, reason: 'edge target missing' });
      return;
    }
    enterNode(next, `port:${sourceHandle}`);
  } else endChat();
};
const _handleJumpToNode = (nodeId) => {
  // index.ts:6238 - a missing target ends the chat
  const node = S.nodes.find((n) => n.id === nodeId);
  if (node) {
    S.currentIndex++;
    S.steps.push(node);
    S.record.push(_nodeRecord(node));
    dispatch(node, 'jump');
  } else endChat();
};

const exportsObj = {
  __esModule: true,
  get nodes() {
    return S.nodes;
  },
  get edges() {
    return S.edges;
  },
  getGlobals: () => ({ ...S, steps: S.steps, record: S.record, nodes: S.nodes, edges: S.edges }),
  _getCurrentStepsAndIndex: () => ({ steps: S.steps, currentIndex: S.currentIndex }),
  _getVariables: () => S.variables,
  _setVariables: (k, v) => (S.variables[k] = v),
  _getAnswerVariables: () => S.answerVariables,
  _getValueFromAnswerVariableKey,
  _setAnswerVariable,
  _setAnswerVariableByKey,
  _setUserMetaData,
  _pushDataToRecord,
  _handleAddToTranscript,
  _sendResponse,
  _toggleInputElements,
  _getTranscript: () => S.transcript,
  _getRecord: () => S.record,
  _getCustomizationsRef: () => S.customizationsRef,
  _getBotId: () => S.chatbotId,
  _getChatSessionId: () => S.chatSessionId,
  _getVisitorId: () => S.visitorId,
  _getVisitorEmail: () => S.visitorEmail,
  _setIsPreOrPostChatQuestionSubmit: (type, value) => {
    if (type === 'pre') S.isPreChatQuestionSubmit = value;
    else if (type === 'post') S.isPostChatSurveyQuestionSubmit = value;
  },
  _setIsChatInputEnabled: (v) => (S.isUserInputEnabled = v),
  _sendCalendarSlotSelectionRecord: (d) => socket.emit('calendar-slot-selection-record', d),
  _displayNextNode: () => _findAndDisplayNode(),
  _findAndDisplayNode,
  _findAndDisplayNodeWithPort,
  _handleJumpToNode,
  _handleZapierTrigger,
  _trackUserMessage: () => {},
  _trackGoalCompletion: () => {},
  _isChatPanelOpen: () => true,
  _getAgentBot: () => null,
  _getAgentBotDetails: () => null,
  _aiHandedOver: () => false,
  _isAgentBotAIActive: () => false,
  _handoverPhase: () => 'none',
  _settleHandover: () => {},
  _canOpenArticles: () => false,
  _openArticleById: () => {},
  _markRichAnswered: () => {},
  _rememberContinuation: () => {},
  _reportSiteLearning: () => {},
  _sendAnswerFeedback: () => {},
  _getKnowledgeBaseReferences: () => [],
};
const missing = new Set();
const exportsProxy = new Proxy(exportsObj, {
  get(t, k) {
    if (k in t) return t[k];
    if (typeof k === 'symbol' || k === 'then') return undefined;
    missing.add(String(k));
    return () => undefined;
  },
});

env.runtime = { S, reset, exportsProxy, missing, trace, mods, _findAndDisplayNode, _findAndDisplayNodeWithPort, dispatch };
module.exports = env.runtime;
