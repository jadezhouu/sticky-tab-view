import React from 'react';

export const View = 'View';
export const Text = 'Text';
export const ActivityIndicator = 'ActivityIndicator';
export const Pressable = 'Pressable';
export const Image = 'Image';

export const StyleSheet = {
  absoluteFill: { bottom: 0, left: 0, position: 'absolute' as const, right: 0, top: 0 },
  create: <T,>(styles: T): T => styles,
  flatten: (style: unknown): Record<string, unknown> => {
    if (Array.isArray(style)) return Object.assign({}, ...style.filter(Boolean));
    return (style as Record<string, unknown>) ?? {};
  },
};

export const Keyboard = { dismiss: jest.fn() };

export const Animated = {
  Value: class Value {
    constructor(public value = 0) {}
  },
};

export type ViewProps = React.ComponentProps<'div'>;
export type ViewStyle = Record<string, unknown>;
export type LayoutChangeEvent = {
  nativeEvent: { layout: { width: number; height: number } };
};
