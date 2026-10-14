/**
 * The initiate-handover payload, as the web widget sends it
 * (conferbot-widget buildAllMetaData + _handleHumanHandoverNode): used by
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
    maxWaitTime: typeof data.maxWaitTime === 'number' ? data.maxWaitTime : 2,
    assignmentType: str(data.assignmentType, 'auto'),
    assignmentStrategy: str(data.agentAssignmentStrategy),
    assignedAgents: arr(data.assignedAgents),
    assignedAIAgents: arr(data.assignedAIAgents),
    ...extra,
  };
};
