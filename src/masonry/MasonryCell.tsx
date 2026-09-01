import React from "react";
import Reanimated, {
  useDerivedValue,
  useAnimatedStyle,
  useAnimatedReaction,
} from "react-native-reanimated";
import { scheduleOnReactNative } from "../scheduleOnReactNative.js";
import { StyleSheet } from "react-native";
import { TMasonryCellProps } from "../types.js";
import { findNearestThumbIndex } from "./model.js";

export function MasonryCell<T>(props: TMasonryCellProps<T>) {
  const {
    contentOffset: { y },
    thumbs,
    data,
    frameHeight,
  } = props;
  const [current, setCurrent] = React.useState(() => {
    return findNearestThumbIndex(thumbs, y.value, frameHeight);
  });
  const index = useDerivedValue(() => {
    return findNearestThumbIndex(thumbs, y.value, frameHeight);
  }, [thumbs]);
  useAnimatedReaction(
    () => index.value,
    (next, pre) => {
      if (typeof next === "number" && next !== pre) {
        scheduleOnReactNative(setCurrent, next);
      }
    },
    [index],
  );
  const style = useAnimatedStyle(() => {
    const activeThumb = thumbs[index.value];
    return {
      transform: [
        { translateY: activeThumb?.y ?? 0 },
        { translateX: activeThumb?.x ?? 0 },
      ],
    };
  }, [thumbs]);
  const activeThumb = thumbs[current];
  if (!activeThumb) return null;
  const frame = { width: activeThumb.width, height: activeThumb.height };
  const item = data[activeThumb.sectionIndex].items[activeThumb.itemIndex];
  return (
    <Reanimated.View style={[styles.item, frame, style]}>
      {props.renderItem(item, activeThumb.itemIndex, activeThumb.sectionIndex)}
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  item: {
    top: 0,
    left: 0,
    position: "absolute",
  },
});
