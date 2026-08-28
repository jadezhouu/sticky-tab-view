import React from 'react';

type TGestureCallback = (...args: unknown[]) => void;

class PanGesture {
  start?: TGestureCallback;
  update?: TGestureCallback;
  end?: TGestureCallback;
  finalize?: TGestureCallback;
  enabled = jest.fn(() => this);
  maxPointers = jest.fn(() => this);
  activeOffsetX = jest.fn(() => this);
  activeOffsetY = jest.fn(() => this);
  onStart = jest.fn((callback: TGestureCallback) => {
    this.start = callback;
    return this;
  });
  onUpdate = jest.fn((callback: TGestureCallback) => {
    this.update = callback;
    return this;
  });
  onEnd = jest.fn((callback: TGestureCallback) => {
    this.end = callback;
    return this;
  });
  onFinalize = jest.fn((callback: TGestureCallback) => {
    this.finalize = callback;
    return this;
  });
}

class TapGesture {
  end?: TGestureCallback;
  enabled = jest.fn(() => this);
  onEnd = jest.fn((callback: TGestureCallback) => {
    this.end = callback;
    return this;
  });
}

export const __panGestures: PanGesture[] = [];
export const __tapGestures: TapGesture[] = [];
export const State = {
  UNDETERMINED: 0,
  FAILED: 1,
  BEGAN: 2,
  CANCELLED: 3,
  ACTIVE: 4,
  END: 5,
} as const;
export const Gesture = {
  Pan: () => {
    const gesture = new PanGesture();
    __panGestures.push(gesture);
    return gesture;
  },
  Tap: () => {
    const gesture = new TapGesture();
    __tapGestures.push(gesture);
    return gesture;
  },
  Simultaneous: (...gestures: unknown[]) => gestures,
};
export const GestureDetector = ({ children }: { children?: React.ReactNode }) => <>{children}</>;
export type PanGestureHandlerEventPayload = {
  translationX: number;
  translationY: number;
  absoluteX: number;
  absoluteY: number;
  velocityX: number;
  velocityY: number;
};
