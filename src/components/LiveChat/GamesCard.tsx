// @ts-nocheck
/**
 * The waiting games card, drawn from core/gamesCard.ts's state. Ported from
 * the web widget's conferbot-widget src/ts/chat/games/ui.ts and its sheet
 * src/css/polish-games.css: the theme's card surface and text, the bot's
 * accent (pickAccent) for picks, wins and the main button, the bot's font.
 * Motion is the web's and no more: the card rises in, the hands shake for
 * the rock-paper-scissors reveal, a small cheer, confetti on a win; all of
 * it off when the phone asks for reduced motion. Memory cards turn without
 * the web's 3D flip.
 */
import React, { useContext, useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../theme';
import { mix, readableOn } from '../../theme/color';
import ConferBotContext from '../../context/ConferBotContext';
import { GAMES_TEXT, type GamesCard as GamesCardController, type GamesCardState } from '../../core/gamesCard';
import { pickAccent } from '../../core/waitingGames';
import { t as tr } from '../../core/i18n';

/** The card's state, kept in step with the controller. */
const useCardState = (card: GamesCardController | null): GamesCardState | null => {
  const [state, setState] = useState(card ? card.getState() : null);
  useEffect(() => {
    if (!card) return setState(null);
    setState(card.getState());
    return card.subscribe(setState);
  }, [card]);
  return state;
};

const useReducedMotion = () => {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let live = true;
    const a11y: any = AccessibilityInfo;
    Promise.resolve(a11y?.isReduceMotionEnabled?.())
      .then((on) => live && setReduced(!!on))
      .catch(() => {});
    const sub = a11y?.addEventListener?.('reduceMotionChanged', (on) => setReduced(!!on));
    return () => {
      live = false;
      sub?.remove?.();
    };
  }, []);
  return reduced;
};

const useLook = () => {
  const theme = useTheme();
  const ctx = useContext(ConferBotContext);
  const card = theme.colors.surface;
  const ink = theme.colors.text;
  const dark = readableOn(card) === '#ffffff';
  const accent = pickAccent(ctx?.serverCustomizations);
  return {
    theme,
    card,
    ink,
    text: theme.colors.text,
    muted: theme.colors.textSecondary,
    fill: mix(card, ink, dark ? 0.1 : 0.05),
    line: theme.colors.border,
    accent,
    soft: mix(card, accent, 0.09),
    // A cross in the accent on a dark card is lifted so it reads.
    accentInk: dark ? mix(accent, '#ffffff', 0.5) : accent,
    font: ctx?.customizations?.fontFamily ? { fontFamily: ctx.customizations.fontFamily } : null,
    indent: theme.layout.avatarSize + 10 + theme.spacing.chatContentPadding,
    gutter: theme.spacing.chatContentPadding,
  };
};

type Look = ReturnType<typeof useLook>;

const T: React.FC<{ look: Look; style?: any; children: any; [k: string]: any }> = ({ look, style, children, ...rest }) => (
  <Text style={[{ color: look.ink }, look.font, style]} {...rest}>
    {children}
  </Text>
);

/** A quiet tile (a pick, an option, a cell). */
const Tile: React.FC<{ look: Look; onPress?: () => void; onPressIn?: () => void; disabled?: boolean; style?: any; label?: string; testID?: string; children: any }> = ({
  look,
  onPress,
  onPressIn,
  disabled,
  style,
  label,
  testID,
  children,
}) => (
  <TouchableOpacity
    activeOpacity={0.75}
    onPress={onPress}
    onPressIn={onPressIn}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
    accessibilityState={{ disabled: !!disabled }}
    testID={testID}
    style={[{ backgroundColor: look.fill, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, style]}
  >
    {children}
  </TouchableOpacity>
);

// ------------------------------------------------------------ boards

const RpsView = ({ b, look, act, reduced, testID }) => {
  const shake = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!b.shaking || reduced) return;
    shake.setValue(0);
    const anim = Animated.loop(
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 150, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 150, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
      { iterations: 3 }
    );
    anim.start();
    return () => anim.stop();
  }, [b.shaking, reduced]);
  const lift = { transform: [{ translateY: shake.interpolate({ inputRange: [0, 1], outputRange: [0, -12] }) }, { rotate: shake.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-10deg'] }) }] };
  const big = (who: 'you' | 'bot') => {
    const won = (who === 'you' && b.outcome === 'win') || (who === 'bot' && b.outcome === 'lose');
    const lost = (who === 'you' && b.outcome === 'lose') || (who === 'bot' && b.outcome === 'win');
    return { opacity: lost ? 0.45 : 1, transform: [...(who === 'bot' ? [{ scaleX: -1 }] : []), { scale: won ? 1.18 : 1 }] };
  };
  return (
    <View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 22, paddingTop: 6, paddingBottom: 12 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Animated.View style={b.shaking ? lift : null}>
          <T look={look} style={[{ fontSize: 40, lineHeight: 46 }, big('you')]}>{b.you}</T>
        </Animated.View>
        <T look={look} style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.9, color: look.muted }}>VS</T>
        <Animated.View style={b.shaking ? lift : null}>
          <T look={look} style={[{ fontSize: 40, lineHeight: 46 }, big('bot')]}>{b.bot}</T>
        </Animated.View>
      </View>
      <View style={{ flexDirection: 'row', gap: 6 }} accessibilityLabel={tr('games.rps.pick')}>
        {b.hands.map((h) => (
          <Tile key={h.hand} look={look} disabled={b.busy} onPress={() => act({ type: 'rps', hand: h.hand })} style={{ flex: 1, paddingVertical: 8, paddingHorizontal: 4, gap: 3, opacity: b.busy ? 0.6 : 1 }} label={h.name} testID={`${testID}-rps-${h.hand}`}>
            <T look={look} style={{ fontSize: 22, lineHeight: 26 }}>{h.emoji}</T>
            <T look={look} style={{ fontSize: 11.5, fontWeight: '600' }}>{h.name}</T>
          </Tile>
        ))}
      </View>
    </View>
  );
};

const TttView = ({ b, look, act, testID }) => {
  const label = (i: number) =>
    tr('games.ttt.cell', { row: Math.floor(i / 3) + 1, col: (i % 3) + 1, state: tr(b.cells[i] === 'X' ? 'games.ttt.yours' : b.cells[i] === 'O' ? 'games.ttt.bots' : 'games.ttt.empty') });
  return (
    <View style={{ width: '100%', maxWidth: 210, alignSelf: 'center', flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessibilityLabel={tr('games.ttt.board')}>
      {b.cells.map((c, i) => {
        const inLine = b.line.includes(i);
        return (
          <Tile
            key={i}
            look={look}
            disabled={!!c || b.over || b.thinking}
            onPress={() => act({ type: 'ttt', i })}
            label={label(i)}
            testID={`${testID}-ttt-${i}`}
            style={{
              width: '31%',
              aspectRatio: 1,
              backgroundColor: inLine ? (c === 'O' ? look.muted : look.accent) : look.fill,
              opacity: b.over && !inLine ? 0.5 : 1,
            }}
          >
            <T look={look} style={{ fontSize: 26, fontWeight: '700', color: inLine ? '#ffffff' : c === 'X' ? look.accentInk : look.muted }}>
              {c === 'X' ? '✕' : c === 'O' ? '◯' : ''}
            </T>
          </Tile>
        );
      })}
    </View>
  );
};

const MemoryView = ({ b, look, act, testID }) => (
  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessibilityLabel={tr('games.memory.cards')}>
    {b.cards.map((c, i) => (
      <Tile
        key={i}
        look={look}
        disabled={c.matched}
        onPress={() => act({ type: 'memory', i })}
        label={tr(c.matched ? 'games.memory.cardMatched' : 'games.memory.card', { n: i + 1, face: c.up ? c.face : tr('games.memory.faceDown') })}
        testID={`${testID}-mem-${i}`}
        style={{
          width: '22.6%',
          aspectRatio: 1,
          backgroundColor: c.up ? (c.matched ? look.soft : look.fill) : look.accent,
          borderWidth: c.matched ? 1.5 : 0,
          borderColor: mix(look.card, look.accent, 0.45),
        }}
      >
        <T look={look} style={c.up ? { fontSize: 24 } : { fontSize: 18, fontWeight: '700', color: 'rgba(255,255,255,0.75)' }}>
          {c.up ? c.face : '?'}
        </T>
      </Tile>
    ))}
  </View>
);

const ChoiceView = ({ b, look, act, testID }) => {
  const emoji = b.game === 'emoji';
  return (
    <View style={{ gap: 8 }}>
      {b.tag ? (
        <View style={{ alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: look.soft }}>
          <T look={look} style={{ fontSize: 10.5, fontWeight: '700', color: look.text }}>{b.tag}</T>
        </View>
      ) : null}
      {b.big ? (
        <T look={look} style={{ fontSize: 40, lineHeight: 46, textAlign: 'center', letterSpacing: 3 }} accessibilityLabel={tr('games.emoji.label', { emoji: b.big })}>
          {b.big}
        </T>
      ) : null}
      <T look={look} style={emoji ? { textAlign: 'center', color: look.muted, fontSize: 12 } : { fontSize: 13.5, fontWeight: '600', lineHeight: 19 }}>{b.q}</T>
      <View style={{ flexDirection: emoji ? 'row' : 'column', flexWrap: 'wrap', gap: 6 }} accessibilityLabel={b.q}>
        {b.options.map((o, i) => {
          const done = b.picked !== null;
          const right = done && i === b.answer;
          const wrong = done && i === b.picked && i !== b.answer;
          return (
            <Tile
              key={i}
              look={look}
              disabled={done}
              onPress={() => act({ type: 'choice', i })}
              label={o}
              testID={`${testID}-opt-${i}`}
              style={{
                width: emoji ? '48.5%' : '100%',
                flexDirection: 'row',
                justifyContent: emoji ? 'center' : 'flex-start',
                paddingVertical: 9,
                paddingHorizontal: 10,
                backgroundColor: right ? look.accent : look.fill,
                opacity: done && !right && !wrong ? 0.5 : wrong ? 0.6 : 1,
              }}
            >
              <T look={look} style={{ flexShrink: 1, fontSize: 13, fontWeight: '600', color: right ? '#ffffff' : look.ink, textDecorationLine: wrong ? 'line-through' : 'none' }}>{o}</T>
              {right ? <T look={look} style={{ marginLeft: emoji ? 4 : 'auto', paddingLeft: 6, color: '#ffffff', fontWeight: '600' }}>✓</T> : null}
            </Tile>
          );
        })}
      </View>
    </View>
  );
};

const ReactionView = ({ b, look, act, testID }) => {
  const go = b.state === 'go';
  const wait = b.state === 'wait';
  return (
    <TouchableOpacity
      activeOpacity={0.9}
      // On press, not on release, so the time is the visitor's.
      onPressIn={() => act({ type: 'reaction' })}
      disabled={b.state === 'done'}
      accessibilityRole="button"
      accessibilityLabel={b.line}
      testID={`${testID}-pad`}
      style={{
        height: 128,
        borderRadius: 16,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        backgroundColor: go ? '#16a34a' : wait ? look.fill : look.soft,
        borderWidth: go ? 0 : 1,
        borderColor: wait ? look.line : mix(look.card, look.accent, 0.18),
      }}
    >
      <T look={look} style={{ fontSize: 30, lineHeight: 34 }}>{b.big}</T>
      <T look={look} style={{ fontSize: 13.5, fontWeight: '600', color: go ? '#ffffff' : look.ink }}>{b.line}</T>
    </TouchableOpacity>
  );
};

const ScrambleView = ({ b, look, act, testID }) => {
  const shake = useRef(new Animated.Value(0)).current;
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    shake.setValue(0);
    Animated.timing(shake, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  }, [b.nope]);
  const nudge = { transform: [{ translateX: shake.interpolate({ inputRange: [0, 0.2, 0.4, 0.6, 0.8, 1], outputRange: [0, -5, 5, -3, 3, 0] }) }] };
  return (
    <View style={{ gap: 10 }}>
      <T look={look} style={{ fontSize: 30, lineHeight: 34, textAlign: 'center' }} accessibilityElementsHidden importantForAccessibility="no">{b.hint}</T>
      <Animated.View style={[{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5 }, nudge]} accessibilityLabel={tr('games.scramble.slots')}>
        {b.letters.map((_, i) => {
          const t = b.placed[i];
          const filled = t !== undefined;
          const solvedLook = b.solved && !b.revealed;
          return (
            <TouchableOpacity
              key={i}
              onPress={() => act({ type: 'slot', i })}
              disabled={!filled || b.solved}
              accessibilityRole="button"
              accessibilityLabel={filled ? tr('games.scramble.space', { n: i + 1, letter: b.letters[t] }) : tr('games.scramble.spaceEmpty', { n: i + 1 })}
              testID={`${testID}-slot-${i}`}
              style={{
                width: 34,
                height: 40,
                borderRadius: 9,
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: solvedLook ? look.accent : b.revealed ? look.fill : filled ? look.soft : 'transparent',
                borderWidth: solvedLook || b.revealed ? 0 : 1.5,
                borderColor: filled ? mix(look.card, look.accent, 0.55) : look.line,
              }}
            >
              <T look={look} style={{ fontSize: 16, fontWeight: '700', color: solvedLook ? '#ffffff' : b.revealed ? look.muted : look.ink }}>{filled ? b.letters[t] : ''}</T>
            </TouchableOpacity>
          );
        })}
      </Animated.View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 5 }} accessibilityLabel={tr('games.scramble.letters')}>
        {b.letters.map((L, i) => {
          const used = b.placed.includes(i);
          return (
            <TouchableOpacity
              key={i}
              onPress={() => act({ type: 'tile', i })}
              disabled={used || b.solved}
              accessibilityRole="button"
              accessibilityLabel={tr('games.scramble.letter', { letter: L })}
              testID={`${testID}-tile-${i}`}
              style={{ width: 36, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: look.fill, opacity: used ? 0.2 : 1, transform: [{ scale: used ? 0.9 : 1 }] }}
            >
              <T look={look} style={{ fontSize: 16, fontWeight: '700' }}>{L}</T>
            </TouchableOpacity>
          );
        })}
      </View>
      <View style={{ alignItems: 'center' }}>
        <FootButton look={look} label={b.skipLabel} onPress={() => act({ type: 'skip' })} testID={`${testID}-skip`} disabled={b.solved} />
      </View>
    </View>
  );
};

const FootButton = ({ look, label, primary = false, onPress, testID, disabled = false }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    accessibilityRole="button"
    accessibilityLabel={label}
    testID={testID}
    style={{
      paddingVertical: 7,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: primary ? look.accent : 'transparent',
      borderWidth: primary ? 0 : 1,
      borderColor: look.line,
      opacity: disabled ? 0.5 : 1,
    }}
  >
    <T look={look} style={{ fontSize: 12.5, fontWeight: '600', color: primary ? '#ffffff' : look.text }}>{label}</T>
  </TouchableOpacity>
);

// ------------------------------------------------------------ confetti (web ui.ts confetti)

const PIECES = 34;
const Confetti = ({ look, burst }) => {
  const [run, setRun] = useState(0);
  const progress = useRef(new Animated.Value(0)).current;
  const pieces = useRef(
    Array.from({ length: PIECES }, (_, i) => ({
      x: Math.random() * 100,
      dx: (Math.random() - 0.5) * 120,
      r: Math.random() * 720 - 360,
      d: Math.random() * 0.15,
      round: i % 3 === 0,
    }))
  ).current;
  useEffect(() => {
    if (!burst) return;
    setRun((n) => n + 1);
    progress.setValue(0);
    const anim = Animated.timing(progress, { toValue: 1, duration: 1750, easing: Easing.bezier(0.25, 0.6, 0.4, 1), useNativeDriver: true });
    anim.start(({ finished }) => finished && setRun(0));
    return () => anim.stop();
  }, [burst]);
  if (!run) return null;
  const tints = [look.accent, '#f5a524', mix(look.accent, '#ffffff', 0.55), '#ff6b6b', '#22c55e'];
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {pieces.map((p, i) => {
        const t = progress.interpolate({ inputRange: [0, p.d, 1], outputRange: [0, 0, 1], extrapolate: 'clamp' });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              top: -12,
              left: `${p.x}%`,
              width: p.round ? 8 : 7,
              height: p.round ? 8 : 11,
              borderRadius: p.round ? 4 : 2,
              backgroundColor: tints[i % tints.length],
              opacity: t.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
              transform: [
                { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, p.dx] }) },
                { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, 300] }) },
                { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.r}deg`] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
};

// ------------------------------------------------------------ the card

export const GamesCardView: React.FC<{ card: GamesCardController | null; testID?: string }> = ({ card, testID = 'cb-games' }) => {
  const look = useLook();
  const state = useCardState(card);
  const reduced = useReducedMotion();
  const rise = useRef(new Animated.Value(0)).current;
  const cheer = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced) return rise.setValue(1);
    Animated.timing(rise, { toValue: 1, duration: 450, easing: Easing.bezier(0.22, 1, 0.36, 1), useNativeDriver: true }).start();
  }, []);
  useEffect(() => {
    if (!state?.cheer || reduced) return;
    cheer.setValue(0);
    Animated.sequence([
      Animated.timing(cheer, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.timing(cheer, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start();
  }, [state?.cheer]);

  if (!card || !state || state.view === 'gone') return null;
  const act = (a) => card.input(a);
  const b = state.board;
  const win = state.result === 'win';

  return (
    <View style={{ paddingLeft: look.indent, paddingRight: look.gutter, marginTop: 6, marginBottom: 12 }} testID={testID}>
      <Animated.View
        accessibilityLabel={GAMES_TEXT.card}
        style={{
          width: '100%',
          maxWidth: 320,
          padding: 12,
          borderRadius: 18,
          overflow: 'hidden',
          backgroundColor: look.card,
          borderWidth: win ? 1.5 : 1,
          borderColor: win ? mix(look.card, look.accent, 0.55) : look.line,
          opacity: rise,
          transform: [
            { translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) },
            { scale: cheer.interpolate({ inputRange: [0, 1], outputRange: [1, 1.015] }) },
          ],
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 }}>
            {state.titleEmoji ? <T look={look} style={{ fontSize: 17 }} accessibilityElementsHidden importantForAccessibility="no">{state.titleEmoji}</T> : null}
            <T look={look} style={{ flexShrink: 1, fontSize: 14, fontWeight: '700', lineHeight: 18 }} testID={`${testID}-title`} accessibilityRole="header">
              {state.title}
            </T>
          </View>
          {state.meta ? <T look={look} style={{ fontSize: 11.5, fontWeight: '600', color: look.muted, fontVariant: ['tabular-nums'] }} testID={`${testID}-meta`}>{state.meta}</T> : null}
          {state.closable ? (
            <TouchableOpacity onPress={() => card.dismiss()} accessibilityRole="button" accessibilityLabel={GAMES_TEXT.close} hitSlop={8} testID={`${testID}-close`} style={{ width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginRight: -4 }}>
              <T look={look} style={{ fontSize: 14, color: look.muted }}>✕</T>
            </TouchableOpacity>
          ) : null}
        </View>

        {state.view === 'menu' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }} accessibilityLabel={GAMES_TEXT.pick}>
            {state.chips.map((g, i) => {
              const wide = i === state.chips.length - 1 && state.chips.length % 2 === 1;
              return (
                <TouchableOpacity
                  key={g.id}
                  onPress={() => card.open(g.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${g.name}. ${g.blurb}`}
                  testID={`${testID}-chip-${g.id}`}
                  style={{
                    width: wide ? '100%' : '48.5%',
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                    paddingVertical: 9,
                    paddingHorizontal: 10,
                    borderRadius: 12,
                    backgroundColor: look.soft,
                    borderWidth: 1,
                    borderColor: mix(look.card, look.accent, 0.16),
                  }}
                >
                  <T look={look} style={{ fontSize: 18 }}>{g.emoji}</T>
                  <T look={look} numberOfLines={2} style={{ flexShrink: 1, fontSize: 12.5, fontWeight: '600', lineHeight: 16 }}>{g.name}</T>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : state.view === 'game' && b ? (
          <View pointerEvents={state.settled ? 'none' : 'auto'}>
            {b.kind === 'rps' && <RpsView b={b} look={look} act={act} reduced={reduced} testID={testID} />}
            {b.kind === 'ttt' && <TttView b={b} look={look} act={act} testID={testID} />}
            {b.kind === 'memory' && <MemoryView b={b} look={look} act={act} testID={testID} />}
            {b.kind === 'choice' && <ChoiceView b={b} look={look} act={act} testID={testID} />}
            {b.kind === 'reaction' && <ReactionView b={b} look={look} act={act} testID={testID} />}
            {b.kind === 'scramble' && <ScrambleView b={b} look={look} act={act} testID={testID} />}
          </View>
        ) : null}

        {state.status ? (
          <T
            look={look}
            accessibilityLiveRegion="polite"
            testID={`${testID}-status`}
            style={{ marginTop: 10, fontSize: 12.5, lineHeight: 18, color: state.result ? look.ink : look.text, fontWeight: state.result ? '600' : '400' }}
          >
            {state.status}
          </T>
        ) : null}

        {state.foot.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'flex-end', gap: 6, marginTop: 10 }}>
            {state.foot.map((f) => (
              <FootButton key={f.key} look={look} label={f.label} primary={f.primary} onPress={() => card.press(f.key)} testID={`${testID}-${f.key}`} />
            ))}
          </View>
        ) : null}

        {!reduced ? <Confetti look={look} burst={state.confetti} /> : null}
      </Animated.View>
    </View>
  );
};

/** The card the provider has up (useConferBot().gamesCard). */
export const GamesCard: React.FC<{ testID?: string }> = ({ testID }) => {
  const ctx = useContext(ConferBotContext);
  return <GamesCardView card={ctx?.gamesCard || null} testID={testID} />;
};

export default GamesCard;
