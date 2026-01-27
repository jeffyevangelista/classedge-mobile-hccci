import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import { FlashList } from "@shopify/flash-list";
import { Link } from "expo-router";
import { Avatar, Card } from "heroui-native";
import {
  BookOpenIcon,
  IdentificationBadgeIcon,
  PersonIcon,
} from "phosphor-react-native";
import { Pressable, useWindowDimensions, View } from "react-native";

type Notification = {
  id: number;
  entity_type: "material" | "assessment";
  entity_id: number;
  user_id: number;
  message: string;
  is_read: boolean;
  created_at: string;
  created_by: number;
  created_by_photo: string;
};

const notifications: Notification[] = [
  {
    id: 201,
    entity_id: 450,
    entity_type: "material",
    user_id: 42,
    message:
      "Prof. Thompson uploaded a new lecture slide: 'Advanced Thermodynamics'.",
    is_read: false,
    created_at: "2026-01-27T10:15:00Z",
    created_by: 5,
    created_by_photo:
      "https://api.dicebear.com/7.x/avataaars/svg?seed=Thompson",
  },
  {
    id: 202,
    entity_id: 992,
    entity_type: "assessment",
    user_id: 42,
    message: "Your 'Midterm Quiz - Unit 3' is now open for submissions.",
    is_read: false,
    created_at: "2026-01-27T09:00:00Z",
    created_by: 1,
    created_by_photo:
      "https://api.dicebear.com/7.x/identicon/svg?seed=SchoolAdmin",
  },
  {
    id: 203,
    entity_id: 451,
    entity_type: "material",
    user_id: 42,
    message:
      "New reading material: 'Case Study - Renewable Energy' has been added.",
    is_read: true,
    created_at: "2026-01-26T16:45:10Z",
    created_by: 5,
    created_by_photo:
      "https://api.dicebear.com/7.x/avataaars/svg?seed=Thompson",
  },
  {
    id: 204,
    entity_id: 880,
    entity_type: "assessment",
    user_id: 42,
    message: "Grade released: Your 'Final Project Proposal' has been reviewed.",
    is_read: true,
    created_at: "2026-01-25T14:20:00Z",
    created_by: 14,
    created_by_photo: "https://api.dicebear.com/7.x/avataaars/svg?seed=Grader",
  },
];

const NotificationItem = ({
  entity_type,
  entity_id,
  message,
  created_at,
  is_read,
  created_by_photo,
}: Notification) => {
  const { width } = useWindowDimensions();

  return (
    <Link
      className={`rounded ${is_read ? "border-b border-gray-200" : "mb-1"}`}
      href={
        entity_type === "material"
          ? `/material/${entity_id}`
          : `/assessment/${entity_id}`
      }
      asChild
    >
      <Pressable
        className={`
        flex-row items-start p-4 rounded
        ${is_read ? "bg-white" : "bg-[#EBF5FF] "}
      `}
      >
        {/* Icon Section */}
        <View
          className={`p-2.5 rounded-xl ${is_read ? "bg-slate-100" : "bg-white"}`}
        >
          <Icon
            as={
              entity_type === "assessment"
                ? IdentificationBadgeIcon
                : BookOpenIcon
            }
            size={22}
            className={is_read ? "text-slate-400" : "text-blue-600"}
          />
        </View>

        {/* Content Section */}
        <View className="flex-1 ml-3">
          <AppText
            weight={is_read ? "regular" : "bold"}
            className={`text-sm ${is_read ? "text-slate-500" : "text-slate-900"}`}
            numberOfLines={2}
          >
            {message}
          </AppText>
          <AppText className="text-[11px] text-slate-400 mt-1 uppercase font-medium">
            {entity_type} • 2 hours ago
          </AppText>
        </View>

        {/* Dot Indicator */}
        {!is_read && (
          <View className="w-2.5 h-2.5 rounded-full bg-blue-600 self-center ml-2" />
        )}
      </Pressable>
    </Link>
  );
};

const NotificationList = () => {
  return (
    <FlashList
      className="bg-none"
      data={notifications}
      // contentContainerStyle={{ paddingVertical: 16 }}
      renderItem={({ item }) => <NotificationItem {...item} />}
    />
  );
};
export default NotificationList;
