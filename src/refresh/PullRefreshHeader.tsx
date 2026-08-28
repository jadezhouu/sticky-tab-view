import React, { useImperativeHandle, useState } from 'react';
import { SharedValue } from 'react-native-reanimated';
import { Text, View } from 'react-native';

export type PullHeaderState =
  | 'idle'
  | 'dragging'
  | 'armed'
  | 'canceling'
  | 'refreshing'
  | 'settling';

export interface PullRefreshHeaderHandle {
  updateState: (state: PullHeaderState) => void;
}

export interface PullRefreshHeaderProps {
  offset?: SharedValue<number>;
  maxHeight?: number;
  bottomOffset?: number;
}

// 用于在 props 类型中描述"可挂载在函数/类上的静态高度字段"
export type PullRefreshHeaderComponent = React.ForwardRefExoticComponent<
  PullRefreshHeaderProps & React.RefAttributes<PullRefreshHeaderHandle>
> & { height: number };

const _PullRefreshHeader = React.forwardRef<
  PullRefreshHeaderHandle,
  PullRefreshHeaderProps
>(function PullRefreshHeader(_props, ref) {
  const [state, setState] = useState<PullHeaderState>('idle');

  useImperativeHandle(ref, () => ({
    updateState(newState: PullHeaderState) {
      setState(prev => (prev !== newState ? newState : prev));
    },
  }));

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <Text style={{ fontSize: 18 }}>{state}</Text>
    </View>
  );
});

// 对齐原来的 static 属性，供 ScrollGestureView 读取 height
(_PullRefreshHeader as PullRefreshHeaderComponent).height = 80;

export const PullRefreshHeader = _PullRefreshHeader as PullRefreshHeaderComponent;
