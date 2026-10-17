import React, { useMemo } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { mascotLayers, type MascotArm, type MascotLayers, type MascotLook } from '../../core/mascotArt';
import { loadSvg } from '../../optional/svg';

export type SvgXmlComponent = React.ComponentType<{ xml: string; width: number | string; height: number | string }>;

// react-native-svg draws the mascot when the app has it; without it there is no mascot (the plain look stays).
let SvgXmlImpl: SvgXmlComponent | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  SvgXmlImpl = loadSvg().SvgXml;
} catch {
  SvgXmlImpl = null;
}
/** react-native-svg's SvgXml, or null when the app does not have it. */
export const MascotSvg: SvgXmlComponent | null = SvgXmlImpl;

/** Animated styles for the parts the web animates (.cb-m-body, -arm, -look, -lid, -brow, -shadow, the mouths). */
export interface MascotPartStyles {
  body?: any;
  arm?: any;
  look?: any;
  lid?: any;
  brow?: any;
  shadow?: any;
  smile?: any;
  o?: any;
  grin?: any;
}

/**
 * The owner's mascot (core/mascotArt), its layers stacked back to front in a
 * size x size box, each moving part in its own animated layer. Without
 * styles it stands still with its eyes open and its usual smile; `grin`
 * puts the big smile on (the happy mood).
 */
export const MascotFigure: React.FC<{
  layers: MascotLayers;
  size: number;
  styles?: MascotPartStyles | null;
  grin?: boolean;
  Svg: SvgXmlComponent;
  testID?: string;
}> = ({ layers, size, styles, grin = false, Svg, testID }) => {
  const st = styles || {};
  const layer = (xml: string | null, style?: any, key?: string) =>
    xml ? (
      <Animated.View key={key} pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>
        <Svg xml={xml} width={size} height={size} />
      </Animated.View>
    ) : null;
  return (
    <View pointerEvents="none" style={{ width: size, height: size }} testID={testID}>
      {layer(layers.shadow, st.shadow)}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, st.body]}>
        {layer(layers.tail)}
        {layer(layers.armBack, st.arm)}
        {layer(layers.body)}
        {layer(layers.look, st.look)}
        {layer(layers.face)}
        {/* The blinking lids rest open (scaleY 0 on the web): not drawn until a blink moves them. */}
        {st.lid ? layer(layers.lids, st.lid) : null}
        {layer(layers.cover)}
        {layer(layers.brows, st.brow)}
        {layer(layers.armFront, st.arm)}
        {layer(layers.smile, st.smile ?? { opacity: grin ? 0 : 1 })}
        {st.o ? layer(layers.o, st.o) : null}
        {st.grin || grin ? layer(layers.grin, st.grin ?? { opacity: 1 }) : null}
        {layer(layers.top)}
      </Animated.View>
    </View>
  );
};

/** The layers for a look, worked out once per look, pose and colour. */
export const useMascotLayers = (accent: string, arm: MascotArm, look: Partial<MascotLook> | undefined, bust = false): MascotLayers =>
  useMemo(
    () => mascotLayers(accent, arm, look, { bust }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [accent, arm, look?.shape, look?.eyes, look?.accessory, look?.color, bust]
  );
