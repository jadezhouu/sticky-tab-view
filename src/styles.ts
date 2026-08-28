import { StyleSheet } from "react-native";

export const styles = StyleSheet.create({
  wrapperStyle: {
    flexGrow: 1,
    flexShrink: 1,
    overflow: "scroll",
  },
  contentStyle: {
    flexGrow: 1,
  },
  fill: { flex: 1 },
  indicator: {
    borderRadius: 3,
    position: "absolute",
    backgroundColor: "#A8A8A8",
  },

  header: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
  },
  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
  },
  section: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
  },
  leftTop: {
    position: "absolute",
    left: 0,
    top: 0,
  },
  cover: {
    flex: 1,
  },
});
