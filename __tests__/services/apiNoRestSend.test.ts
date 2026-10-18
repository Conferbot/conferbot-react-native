/**
 * services/api.ts has no REST message send: the mobile route
 * POST /api/v1/mobile/session/:id/message is store-only (it takes
 * { record, answerVariables } and never runs the bot, embed-server #194),
 * so messages go over the socket only (#92).
 */
import * as fs from 'fs';
import * as path from 'path';
import ConferBotAPI from '../../src/services/api';

describe('REST client', () => {
  it('has no message-sending helper', () => {
    expect((ConferBotAPI.prototype as unknown as Record<string, unknown>).sendMessage).toBeUndefined();
  });

  it('never posts to the store-only message route', () => {
    const src = fs.readFileSync(path.join(__dirname, '../../src/services/api.ts'), 'utf8');
    expect(src).not.toMatch(/post\([^)]*\/message`/);
  });
});
