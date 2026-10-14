import { buildHandoverTimeoutPayload, waitMinutesOf } from '../../src/core/handoverPayload';

describe('handover max wait', () => {
  it('reads minutes as the builder wrote them', () => {
    expect(waitMinutesOf('0.5')).toBe(0.5);
    expect(waitMinutesOf(3)).toBe(3);
    expect(waitMinutesOf(undefined)).toBe(2);
    expect(waitMinutesOf('x')).toBe(2);
  });

  it('asks the server to decide once it passes', () => {
    expect(buildHandoverTimeoutPayload('s1', { assignmentType: 'manual', assignedAgents: ['a2'], agentAssignmentStrategy: 'round_robin' }, 'w1')).toEqual({
      chatSessionId: 's1',
      assignmentData: { assignmentType: 'manual', assignmentStrategy: 'round_robin', assignedAgents: ['a2'] },
      workspaceId: 'w1',
    });
  });
});
