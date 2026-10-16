/**
 * The core modules' words follow the widget language (core/i18n.ts):
 * German under setWidgetLanguage('de'), the web's own strings (generated
 * from conferbot-widget/src/ts/i18n/de.ts), and English again after.
 */
import { setWidgetLanguage, tFor } from '../../src/core/i18n';
import { HELPFUL_TEXT, FEEDBACK_REASONS, ratedLabel } from '../../src/core/answerFeedback';
import { HANDOVER_TEXT, handoverLineText, joinedText, agentLeftText, handedOverNoteText, HANDED_OVER_NOTE } from '../../src/core/handoverState';
import { requeuedText, blockedText, closedStateOf, LIVE_TEXT } from '../../src/core/liveEvents';
import { MAILCHAT_TEXT, transcriptEmailError } from '../../src/core/emailTranscript';
import { WAIT_TEXT } from '../../src/core/waitArticles';
import { REQUESTS_TEXT, STATE_WORDS, whenWords } from '../../src/core/requests';
import { headerStatus, homePeople, PHRASES } from '../../src/core/replyTime';
import { IDLE_CALL_LINES, idleCallLine } from '../../src/core/launcherIdleCall';
import { GAMES, offerLine, DEFAULT_OFFER_TEXT } from '../../src/core/waitingGames';
import { HAND_NAME, quizVerdict, reactionVerdict, triviaFor, wordsFor, TRIVIA } from '../../src/core/gamesLogic';
import { createGamesCard, GAMES_TEXT } from '../../src/core/gamesCard';
import { EN, numberProblem, fileTypesWords, ownerTextOr } from '../../src/core/flow/inputs';
import { queueLine, csatConfigOf } from '../../src/core/liveChat';
import { HOME_TEXT, askQueryParts } from '../../src/core/home';
import { decideGreeting } from '../../src/core/greeting';
import { replyTimeoutNotice } from '../../src/core/agentBot';
import { t as flowT } from '../../src/core/flow/i18nEn';

const de = (key: Parameters<typeof tFor>[1], vars?: Record<string, any>) => tFor('de', key, vars);

describe('core words in German', () => {
  beforeEach(() => setWidgetLanguage('de', []));
  afterEach(() => setWidgetLanguage('en', []));

  it('Helpful?', () => {
    expect(HELPFUL_TEXT.ask).toBe('Hilfreich?');
    expect(HELPFUL_TEXT.ask).toBe(de('helpful.ask'));
    expect(FEEDBACK_REASONS.map(([, label]) => label)).toEqual([
      de('helpful.reason.wrong'),
      de('helpful.reason.outdated'),
      de('helpful.reason.unanswered'),
      de('helpful.reason.other'),
    ]);
    expect(ratedLabel({ helpful: true } as any)).toBe(de('helpful.rated.up'));
  });

  it('handover lines, joins and leaves', () => {
    expect(handoverLineText(null)).toBe(de('handover.pending'));
    expect(HANDOVER_TEXT.joined).toBe(de('handover.joined'));
    expect(joinedText('Ada')).toBe(`Ada${de('system.joined')}`);
    expect(joinedText('')).toBe(`${de('agent.anAgent')}${de('system.joined')}`);
    expect(agentLeftText(null, false)).toBe(`${de('agent.theAgent')}${de('system.left')}`);
    expect(handedOverNoteText(HANDED_OVER_NOTE)).toBe(de('system.handedOverNote'));
    expect(handedOverNoteText('Own note')).toBe('Own note');
  });

  it('live events and the closed chat', () => {
    expect(requeuedText()).toBe(de('takeover.requeued'));
    expect(requeuedText('Sales')).toBe(de('takeover.requeuedTeam', { team: 'Sales' }));
    expect(blockedText({})).toBe(de('system.closed'));
    expect(LIVE_TEXT.newChat).toBe('Neuen Chat starten');
    const ended = closedStateOf([{ type: 'agent-joined-message' }, { type: 'agent-chat-ended' }] as any);
    if (ended) expect(ended.text).toBe(de('system.chatEnded'));
  });

  it('email transcript: the server reason only in English', () => {
    expect(MAILCHAT_TEXT.title).toBe(de('chat.menu.emailChat'));
    expect(MAILCHAT_TEXT.sent('a@b.co')).toBe(de('mailchat.sent', { email: 'a@b.co' }));
    expect(transcriptEmailError({ ok: false, message: 'Too many requests' })).toBe(de('form.sendFailed'));
    setWidgetLanguage('en', []);
    expect(transcriptEmailError({ ok: false, message: 'Too many requests' })).toBe('Too many requests');
  });

  it('while you wait, requests and timestamps', () => {
    expect(WAIT_TEXT.title).toBe(de('wait.title'));
    expect(WAIT_TEXT.recordText).toBe('Resolved while waiting');
    expect(REQUESTS_TEXT.title).toBe(de('requests.title'));
    expect(REQUESTS_TEXT.seeAll(4)).toBe(de('requests.seeAll', { n: 4 }));
    expect(STATE_WORDS.solved.label).toBe(de('requests.solved.label'));
    const now = new Date(2026, 9, 16, 15, 0).getTime();
    expect(whenWords(now - 5 * 60000, now)).toBe(de('when.minutesAgo', { n: 5 }));
    expect(whenWords(now - 10 * 1000, now)).toBe(de('when.justNow'));
    expect(whenWords(new Date(2026, 9, 15, 12).getTime(), now)).toBe(de('when.yesterday'));
  });

  it('reply time on the header and the home card', () => {
    expect(headerStatus(null)?.text).toBe(de('status.online'));
    expect(PHRASES.few_minutes).toBe(de('reply.phrase.few_minutes'));
    expect(homePeople({ mode: 'auto', handover: true, state: 'online', bucket: 'few_minutes' }).text).toBe(
      de('reply.usually', { phrase: de('reply.phrase.few_minutes') })
    );
  });

  it('the idle call, the games and their lists', () => {
    expect(IDLE_CALL_LINES.knock).toBe(de('idle.knock'));
    expect(idleCallLine('psst', '')).toBe(de('idle.psst'));
    expect(GAMES[0].name).toBe(de('games.rps.name'));
    expect(offerLine(DEFAULT_OFFER_TEXT)).toBe(de('games.offer'));
    expect(offerLine('Spiel?')).toBe('Spiel?');
    expect(HAND_NAME.rock).toBe(de('games.rps.rock'));
    expect(quizVerdict(3, 3)).toBe(de('games.verdict.perfect'));
    expect(reactionVerdict(200)).toBe(de('games.reaction.fast'));
    expect(triviaFor('de')).not.toBe(TRIVIA);
    expect(wordsFor('xx')).toBe(wordsFor('en'));
    expect(GAMES_TEXT.pausedNamed('Ada')).toBe(de('games.paused.named', { name: 'Ada' }));
    // The emoji riddles are English wordplay: not offered in German.
    expect(createGamesCard({ customizations: { waitingGames: { games: ['emoji'] } } })).toBeNull();
    const card = createGamesCard({ customizations: {}, setTimer: () => 0, clearTimer: () => undefined })!;
    expect(card.getState().title).toBe(de('games.offer'));
    expect(card.getState().chips.map((c) => c.id)).not.toContain('emoji');
  });

  it('step checks, keeping an owner text that is the stock English', () => {
    expect(EN.emailInvalid).toBe(de('validation.email'));
    expect(numberProblem('abc', {})).toBe(de('validation.numberLike'));
    expect(numberProblem('1', { enableConditions: { minVal: 5 } })).toBe(de('validation.numberMin', { min: 5 }));
    expect(fileTypesWords(['image/', 'pdf'])).toBe(`${de('file.images')} ${de('common.or')} PDF`);
    expect(ownerTextOr('Please enter a valid email address', EN.emailInvalid)).toBe(de('validation.email'));
    expect(ownerTextOr('Bitte prüfen', EN.emailInvalid)).toBe('Bitte prüfen');
    expect(flowT('otp.resend')).toBe(de('otp.resend'));
  });

  it('queue, rating, home and greeting', () => {
    expect(queueLine({ status: 'waiting', position: 1 } as any)).toBe(de('queue.next'));
    expect(queueLine({ status: 'waiting', position: 3 } as any)).toBe(de('queue.position', { n: 3, ord: '3rd' }));
    expect(csatConfigOf({ enabled: true })?.titleText).toBe(de('csat.title'));
    expect(csatConfigOf({ enabled: true, titleText: 'Wie war es?' })?.titleText).toBe('Wie war es?');
    expect(HOME_TEXT.helpCentre).toBe(de('home.helpCentre'));
    expect(HOME_TEXT.welcomeBackName('Jamie')).toBe(de('home.welcomeBackName', { name: 'Jamie' }));
    const [before, after] = askQueryParts();
    expect(`${before}Q${after}`).toBe(de('home.askQuery', { query: 'Q' }));
    const g = decideGreeting({ chatIconCta: true, chatIconCtaText: 'Hi 👋, how can I help?' }, {} as any);
    expect(g?.text).toBe(de('greeting.stock'));
    expect(replyTimeoutNotice(1).text).toBe(de('chat.replyTimeout'));
  });
});
