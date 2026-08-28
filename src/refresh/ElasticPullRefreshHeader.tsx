import React, { useImperativeHandle, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { PullRefreshHeaderHandle, PullRefreshHeaderProps, PullHeaderState, PullRefreshHeaderComponent } from './PullRefreshHeader.js';


/**
 * 默认的下拉刷新 Header 组件（弹性指示器）。
 *
 * 使用者可通过实现 PullRefreshHeaderComponent 接口自定义刷新 Header；
 * 本组件作为内置默认实现。
 *
 * @public
 */
const _ElasticPullRefreshHeader = React.forwardRef<
  PullRefreshHeaderHandle,
  PullRefreshHeaderProps
>(function ElasticPullRefreshHeader(_props, ref) {
  const [state, setState] = useState<PullHeaderState>('idle');

  useImperativeHandle(ref, () => ({
    updateState(newState: PullHeaderState) {
      setState(prev => (prev !== newState ? newState : prev));
    },
  }));

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
      <ActivityIndicator animating={state === 'refreshing'} />
    </View>
  );
});

(_ElasticPullRefreshHeader as PullRefreshHeaderComponent).height = 72;

export const ElasticPullRefreshHeader =
  _ElasticPullRefreshHeader as PullRefreshHeaderComponent;
