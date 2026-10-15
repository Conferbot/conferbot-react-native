/**
 * The initiate-handover payload, as the web widget sends it
 * (conferbot-widget buildAllMetaData + _handleHumanHandoverNode, and
 * src/ts/chat/handlers/special.ts startHandover): used by
 * the human-handover node and by an AI agent bot's silent start.
 */
import type { ChatState } from './state/ChatState';

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown, fallback = ''): string => (typeof v === 'string' && v ? v : fallback);

export const buildHandoverPayload = (
  state: ChatState,
  data: Record<string, any>,
  extra: Record<string, unknown> = {}
) => {
  const workspaceId = state.getVariable('_workspaceId') || '';
  const chatMetaData = {
    version: 'v2',
    workspaceId,
    chatSessionId: state.sessionId,
    botId: state.botId,
    botName: state.getVariable('_botName') || '',
    chatDate: new Date().toISOString(),
    deviceInfo: 'ReactNative',
    location: Intl.DateTimeFormat().resolvedOptions().timeZone,
    record: state.getRecord(),
    answerVariables: state.getAnswerVariables(),
    transcript: state.getTranscript(),
  };
  return {
    workspaceId,
    chatbotId: state.botId,
    chatbotName: chatMetaData.botName,
    chatSessionId: state.sessionId,
    chatMetaData,
    metaData: {
      visitorId: state.getVariable('_visitorId') || state.sessionId,
      chatDate: chatMetaData.chatDate,
      deviceInfo: chatMetaData.deviceInfo,
      location: chatMetaData.location,
    },
    priority: str(data.priority, 'normal'),
    // Minutes as the builder wrote them ("0.5" is half a minute), as the web sends it.
    maxWaitTime: waitMinutesOf(data.maxWaitTime),
    assignmentType: str(data.assignmentType, 'auto'),
    assignmentStrategy: str(data.agentAssignmentStrategy),
    assignedAgents: arr(data.assignedAgents),
    assignedAIAgents: arr(data.assignedAIAgents),
    // The step's notification settings, as the web sends them: an explicit
    // enableHandoverEmail false is what keeps the team's email off.
    enableHandoverEmail: data.enableHandoverEmail,
    enableHandoverSound: data.enableHandoverSound,
    checkedSoundTab: data.checkedSoundTab,
    selectedSound: data.selectedSound,
    customHandoverSoundUrl: data.customHandoverSoundUrl,
    // Assignment overrides for this step, only when set (a step that follows
    // the workspace setting sends what it always did).
    ...(data.assignmentMethod && data.assignmentMethod !== 'workspace' ? { assignmentMethod: data.assignmentMethod } : {}),
    ...(Array.isArray(data.requiredSkills) && data.requiredSkills.length ? { requiredSkills: data.requiredSkills } : {}),
    ...extra,
  };
};

/** Minutes as the builder wrote them ("0.5" is half a minute); 2 when unset. */
export const waitMinutesOf = (v: unknown): number => (Number(v) > 0 ? Number(v) : 2);

/**
 * handover-timeout, sent once the handover step's max wait passes with
 * nobody joined: the server then decides (no-agents-available), as the web
 * widget's maxWaitTimer does.
 */
export const buildHandoverTimeoutPayload = (chatSessionId: string, data: Record<string, any> | undefined, workspaceId: string) => ({
  chatSessionId,
  assignmentData: {
    assignmentType: data?.assignmentType,
    assignmentStrategy: data?.agentAssignmentStrategy,
    assignedAgents: data?.assignedAgents,
  },
  workspaceId,
});


/**
 * initiate-handover for the standalone useHandover hook, which has no
 * ChatState: the same shape as buildHandoverPayload with what the hook
 * knows (the session, the bot, the pre-chat answers). The server has no
 * handover:request; it reads chatMetaData.botId and chatSessionId.
 */
export const buildStandaloneHandoverPayload = (o: {
  sessionId: string;
  botId: string;
  workspaceId?: string;
  preChatData?: Record<string, unknown> | null;
  department?: string;
  priority?: string;
  maxWaitMinutes?: number;
  now?: Date;
}) => {
  const chatDate = (o.now || new Date()).toISOString();
  const workspaceId = o.workspaceId || '';
  const location = (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return '';
    }
  })();
  return {
    workspaceId,
    chatbotId: o.botId,
    chatbotName: '',
    chatSessionId: o.sessionId,
    chatMetaData: {
      version: 'v2',
      workspaceId,
      chatSessionId: o.sessionId,
      botId: o.botId,
      botName: '',
      chatDate,
      deviceInfo: 'ReactNative',
      location,
      visitorInfo: o.preChatData || {},
      record: [],
      answerVariables: [],
      transcript: [],
    },
    metaData: { visitorId: o.sessionId, chatDate, deviceInfo: 'ReactNative', location },
    priority: str(o.priority, 'normal'),
    maxWaitTime: waitMinutesOf(o.maxWaitMinutes),
    assignmentType: 'auto',
    assignmentStrategy: '',
    assignedAgents: [],
    assignedAIAgents: [],
    ...(o.department ? { department: o.department } : {}),
  };
};
