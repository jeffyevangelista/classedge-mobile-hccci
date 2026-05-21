import { Pressable, TextInput, View } from "react-native";
import { useThemeColor } from "heroui-native";
import { Icon } from "@/components/Icon";

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export const StudentSearchBar = ({ value, onChange }: Props) => {
  const hasQuery = value.length > 0;
  const mutedColor = useThemeColor("muted");

  return (
    <View className="flex-row items-center gap-2 px-3 mb-2 rounded-xl bg-default-200 border border-border max-w-3xl w-full mx-auto">
      <Icon name="MagnifyingGlass" size={18} color={mutedColor} />
      <TextInput
        placeholder="Search student..."
        placeholderTextColor={mutedColor}
        value={value}
        onChangeText={onChange}
        autoCorrect={false}
        autoCapitalize="none"
        textAlignVertical="center"
        className="flex-1 text-base text-foreground"
        style={{ minHeight: 48, includeFontPadding: false }}
      />
      {hasQuery && (
        <Pressable onPress={() => onChange("")} hitSlop={8}>
          <Icon name="XIcon" size={14} color={mutedColor} />
        </Pressable>
      )}
    </View>
  );
};

export default StudentSearchBar;
