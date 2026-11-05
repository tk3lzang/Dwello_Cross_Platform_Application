/**
 * Dwello Brand Logo Component
 * Section 1 & UI Snapshot Fidelity
 * Accurately reproduces the Dwello house + pin negative-space mark.
 */

import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

interface DwelloLogoProps {
  size?: number;
  houseColor?: string;
  pinColor?: string;
  innerDotColor?: string;
}

export function DwelloLogo({
  size = 80,
  houseColor = '#FF385C',
  pinColor = '#FFFFFF',
  innerDotColor = '#FF385C',
}: DwelloLogoProps) {
  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
        {/* House Body */}
        <Path
          d="M 100 18 L 190 94 L 160 94 L 160 184 L 40 184 L 40 94 L 10 94 Z"
          fill={houseColor}
        />
        {/* Map Pin */}
        <Path
          d="M 100 156 C 96 148 68 116 68 92 C 68 74.3 82.3 60 100 60 C 117.7 60 132 74.3 132 92 C 132 116 104 148 100 156 Z"
          fill={pinColor}
        />
        {/* Inner Pin Hole / Dot */}
        <Circle cx="100" cy="92" r="12" fill={innerDotColor} />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});
