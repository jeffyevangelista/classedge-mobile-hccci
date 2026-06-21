import { useThemeColor } from "heroui-native";
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Rect,
  Stop,
} from "react-native-svg";

const DECOR_WIDTH = 220;
const DECOR_HEIGHT = 160;

const DOT_SPACING = 18;
const DOT_RADIUS = 1.75;
const DOT_MAX_OPACITY = 0.55;
const DOT_FALLOFF = 160;
// SVG sits at top: -10 of the container, so the container's top edge is at
// SVG y = 10. Vertical fade reaches zero at the container top and is fully
// opaque by TOP_FADE_DISTANCE below it.
const CARD_TOP_Y = 10;
const TOP_FADE_DISTANCE = 28;

type Dot = { cx: number; cy: number; opacity: number };

// Pre-compute a grid of dots that fade both horizontally (brightest at the
// right edge, invisible at the left) and vertically (invisible at the top
// of the container, fully opaque a bit below). Dropped if invisible.
// Used only when the consumer opts in via the `dots` prop, so the field is
// contained to a single surface and there is no cross-surface seam to
// align.
const DOTS: Dot[] = (() => {
  const result: Dot[] = [];
  for (let cy = DOT_SPACING / 2; cy < DECOR_HEIGHT; cy += DOT_SPACING) {
    for (let cx = DOT_SPACING / 2; cx < DECOR_WIDTH; cx += DOT_SPACING) {
      const distFromRight = DECOR_WIDTH - cx;
      const horizontalOpacity =
        DOT_MAX_OPACITY - (distFromRight / DOT_FALLOFF) * DOT_MAX_OPACITY;
      const verticalFactor = Math.max(
        0,
        Math.min(1, (cy - CARD_TOP_Y) / TOP_FADE_DISTANCE),
      );
      const opacity = horizontalOpacity * verticalFactor;
      if (opacity > 0.05) {
        result.push({ cx, cy, opacity });
      }
    }
  }
  return result;
})();

type Props = {
  /** Set true to overlay the accent dot field on top of the gradient wash. */
  dots?: boolean;
};

const HeaderDecor = ({ dots = false }: Props = {}) => {
  const accentColor = useThemeColor("accent");
  return (
    <Svg
      width={DECOR_WIDTH}
      height={DECOR_HEIGHT}
      style={{ position: "absolute", top: -10, right: -10 }}
      pointerEvents="none"
    >
      <Defs>
        <LinearGradient
          id="header-decor-fade"
          x1="100%"
          y1="50%"
          x2="0%"
          y2="50%"
        >
          <Stop offset="0%" stopColor={accentColor} stopOpacity={0.22} />
          <Stop offset="100%" stopColor={accentColor} stopOpacity={0} />
        </LinearGradient>
      </Defs>
      <Rect
        width={DECOR_WIDTH}
        height={DECOR_HEIGHT}
        fill="url(#header-decor-fade)"
      />
      {dots &&
        DOTS.map((dot, i) => (
          <Circle
            key={i}
            cx={dot.cx}
            cy={dot.cy}
            r={DOT_RADIUS}
            fill={accentColor}
            fillOpacity={dot.opacity}
          />
        ))}
    </Svg>
  );
};

export default HeaderDecor;
