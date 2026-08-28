import React, { useEffect, useImperativeHandle, useState } from 'react';
import { Animated, Text } from 'react-native';

export type LoadMoreState =
  | 'idle'
  | 'dragging'
  | 'armed'
  | 'canceling'
  | 'loading'
  | 'settling'
  | 'finished';

export interface LoadMoreFooterHandle {
  updateState: (state: LoadMoreState) => void;
}

interface LoadMoreFooterProps {
  offset?: Animated.Value;
  maxHeight?: number;
  loadFinished?: boolean;
  loadingMore?: boolean;
  bottomOffset?: number;
}

export type LoadMoreFooterComponent = React.ForwardRefExoticComponent<
  LoadMoreFooterProps & React.RefAttributes<LoadMoreFooterHandle>
> & { height: number };

const _LoadMoreFooter = React.forwardRef<
  LoadMoreFooterHandle,
  LoadMoreFooterProps
>(function LoadMoreFooter(props, ref) {
  const [state, setState] = useState<LoadMoreState>(
    props.loadFinished ? 'finished' : props.loadingMore ? 'loading' : 'idle',
  );

  // 受控 loadingMore/loadFinished 优先决定默认 Footer 的展示状态。
  useEffect(() => {
    setState(props.loadFinished ? 'finished' : props.loadingMore ? 'loading' : 'idle');
  }, [props.loadFinished, props.loadingMore]);

  useImperativeHandle(ref, () => ({
    updateState(newState: LoadMoreState) {
      if (props.loadFinished) return;
      setState(prev => (prev !== newState ? newState : prev));
    },
  }));

  return (
    <Text
      style={{
        flex: 1,
        alignSelf: 'center',
        lineHeight: props.maxHeight,
        textAlign: 'center',
      }}>
      {state}
    </Text>
  );
});

(_LoadMoreFooter as LoadMoreFooterComponent).height = 80;

export const LoadMoreFooter = _LoadMoreFooter as LoadMoreFooterComponent;
