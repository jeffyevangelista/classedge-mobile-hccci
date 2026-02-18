import { View, ScrollView } from "react-native";
import { FlashList } from "@shopify/flash-list";
import { Avatar, Card, Separator } from "heroui-native";
import { AppText } from "@/components/AppText";
import { ClockIcon, MapPinIcon } from "phosphor-react-native";
import { Icon } from "@/components/Icon";
import { useAnnouncements } from "../home.hooks";

const AnnouncementList = () => {
  const { data: announcements, isLoading, error, isError } = useAnnouncements();

  const formatEventTime = (start: any, end: any) => {
    const startDate = new Date(start).toLocaleDateString([], {
      month: "short",
      day: "numeric",
    });
    const startTime = new Date(start).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    const endTime = new Date(end).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });

    return `${startDate} • ${startTime} - ${endTime}`;
  };

  if (isLoading) return <AppText>Loading...</AppText>;
  if (isError) return <AppText>{error.message}</AppText>;

  return (
    <FlashList
      ListEmptyComponent={<AppText>No Announcements</AppText>}
      data={announcements}
      renderItem={({ item }) => (
        <Card className="mb-2">
          <Card.Header>
            <View className="flex-row items-center gap-2">
              <Avatar alt="" size="sm">
                <Avatar.Image
                  source={{
                    uri: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1a?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=facearea&facepad=3&w=256&h=256&q=80",
                  }}
                />
                <Avatar.Fallback>JD</Avatar.Fallback>
              </Avatar>

              <View>
                <AppText weight="semibold" className="text-md">
                  John Doe
                </AppText>
                <AppText className="text-xs text-gray-500">1d</AppText>
              </View>
            </View>
          </Card.Header>
          <Separator className="my-2 bg-gray-300" />

          <Card.Body className="gap-2.5">
            <AppText weight="semibold" className="text-lg">
              {item.title}
            </AppText>
            <AppText>{item.description}</AppText>
            {/* {item.events.length > 0 && (
              <AppText weight="semibold" className="text-md">
                Associated Events
              </AppText>
            )} */}

            {/* <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {item.events.map((event) => (
                <Card key={event.id} className="bg-gray-100 mr-2 max-w-sm">
                  <Card.Body className="gap-2.5">
                    <AppText weight="semibold" className="text-md">
                      {event.title}
                    </AppText>
                    <AppText
                      className="text-xs text-gray-500 overflow-hidden"
                      numberOfLines={2}
                    >
                      {event.description}
                    </AppText>
                    <View>
                      <View className="flex-row items-center gap-1">
                        <Icon as={MapPinIcon} size={16} />
                        <AppText>{event.location}</AppText>
                      </View>
                      <View className="flex-row items-center gap-1">
                        <Icon as={ClockIcon} size={16} />
                        <AppText className="text-xs text-gray-500">
                          {formatEventTime(event.startTime, event.endTime)}
                        </AppText>
                      </View>
                    </View>
                  </Card.Body>
                </Card>
              ))}
            </ScrollView> */}
          </Card.Body>
        </Card>
      )}
    />
  );
};

export default AnnouncementList;
