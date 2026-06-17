import { View } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import { useThemeColor } from "heroui-native";

const DrawerDecoration = () => {
  const muted = useThemeColor("muted");
  return (
    <View
      style={{ height: 180, width: "100%", marginTop: "auto" }}
      pointerEvents="none"
    >
      <Svg
        viewBox="0 0 240 180"
        width="100%"
        height="100%"
        fill="none"
        stroke={muted}
        strokeWidth={1.3}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <G opacity={0.55}>
          <Path d="M20 180 Q35 130 60 90 Q80 60 90 40" />
          <Path d="M30 155 Q55 145 75 120" />
          <Path d="M40 130 Q60 122 75 100" />
          <Path d="M52 105 Q68 100 80 80" />
        </G>
        <G opacity={0.45}>
          <Path d="M120 180 Q120 150 125 120 Q130 90 145 70" />
          <Path d="M122 155 Q140 145 152 125" />
          <Path d="M123 130 Q140 122 152 105" />
          <Path d="M125 105 Q140 100 150 88" />
        </G>
        <G opacity={0.55}>
          <Path d="M220 180 Q205 130 180 90 Q160 60 150 40" />
          <Path d="M210 155 Q185 145 165 120" />
          <Path d="M200 130 Q180 122 165 100" />
          <Path d="M188 105 Q172 100 160 80" />
        </G>
      </Svg>
    </View>
  );
};

export default DrawerDecoration;
