import React from 'react';
import type { MascotArm, MascotLook } from '../../core/mascotArt';
import type { MascotMood } from '../../core/mascotMoods';
import { useReducedMotion } from '../FloatingWidget/fxAnimated';
import { MascotFigure, MascotSvg, useMascotLayers } from './MascotFigure';
import { useMascotMood } from './useMascotMood';

export interface MascotProps {
  /** The owner's mascot (useConferBot().customizations.mascot, or HomeModel.mascot.look). */
  look: Partial<MascotLook>;
  /** The colour it is drawn in when the owner chose none (the launcher's). */
  accent: string;
  /** The box's side (px). */
  size?: number;
  /** idle (blinks), wave, think or happy. */
  mood?: MascotMood;
  /** The arm's pose (the whole figure only). */
  arm?: MascotArm;
  /** Head and body only, framed tight. */
  bust?: boolean;
  /** How many waves before it rests (wave). */
  waveCount?: number;
  testID?: string;
}

/**
 * The owner's mascot (web art3d.ts mascot()), for an app's own screens -
 * the home screen's `renderMascot`, say - in one of its moods. Needs
 * react-native-svg; draws nothing without it. Reduced motion: still.
 */
export const Mascot: React.FC<MascotProps> = ({ look, accent, size = 64, mood = 'idle', arm = mood === 'wave' ? 'wave' : 'down', bust = false, waveCount, testID = 'cb-mascot' }) => {
  const reduced = useReducedMotion();
  const layers = useMascotLayers(accent, arm, look, bust);
  const m = useMascotMood({ mood, size, look, arm, bust, waveCount, reduced });
  if (!MascotSvg) return null;
  return <MascotFigure layers={layers} size={size} styles={m.styles} grin={m.grin} Svg={MascotSvg} testID={testID} />;
};
