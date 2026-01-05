import { Dimensions } from "react-native";

const { width, height } = Dimensions.get("window");

// Base design dimensions (par ex. iPhone X ~ 375x812)
const guidelineBaseWidth = 375;
const guidelineBaseHeight = 812;

export const scale = (size: number) => (width / guidelineBaseWidth) * size;

export const verticalScale = (size: number) =>
  (height / guidelineBaseHeight) * size;

export const moderateScale = (size: number, factor = 0.5) =>
  size + (scale(size) - size) * factor;
