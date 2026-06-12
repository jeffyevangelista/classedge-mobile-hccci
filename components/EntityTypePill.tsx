import { View } from "react-native";
import { AppText } from "@/components/AppText";
import { Icon, type IconName } from "@/components/Icon";

type EntityType = "event" | "announcement";

type EntityTypePillProps = {
  type: EntityType;
};

type PillStyle = {
  iconName: IconName;
  label: string;
  containerClass: string;
  colorClass: string;
};

const STYLES: Record<EntityType, PillStyle> = {
  event: {
    iconName: "CalendarIcon",
    label: "Event",
    containerClass: "bg-accent/15",
    colorClass: "text-accent",
  },
  announcement: {
    iconName: "MegaphoneIcon",
    label: "Announcement",
    containerClass: "bg-warning/15",
    colorClass: "text-warning",
  },
};

export const EntityTypePill = ({ type }: EntityTypePillProps) => {
  const style = STYLES[type];
  return (
    <View
      className={`self-start flex-row items-center gap-1.5 px-2.5 py-1 rounded-full ${style.containerClass}`}
    >
      <Icon name={style.iconName} size={11} className={style.colorClass} />
      <AppText
        weight="semibold"
        className={`text-[10px] tracking-wider uppercase ${style.colorClass}`}
      >
        {style.label}
      </AppText>
    </View>
  );
};

export default EntityTypePill;
