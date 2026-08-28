import React from "react";
import { makeMutable } from "react-native-reanimated";
import type { TScrollHandlers, TStickyTabContext } from "../types.js";

export const ElasticScrollContext = React.createContext<TScrollHandlers>({
  hasGestureFocus: () => {
    return false;
  },
  claimGestureFocus: () => {
    "worklet";
    return false;
  },
  onStart: () => {
    "worklet";
    return false;
  },
  onActive: () => {
    "worklet";
    return false;
  },
  onEnd: () => {
    "worklet";
    return false;
  },
  onCancel: () => {
    "worklet";
  },
  onFail: () => {
    "worklet";
  },
});

// 默认 handlersMutable 是一个空 SharedValue，无 Provider 时写入无副作用，读取返回 {}
export const StickyTabContext = React.createContext<TStickyTabContext>({
  onTabChange: () => () => {},
  handlersMutable: makeMutable({}),
});
