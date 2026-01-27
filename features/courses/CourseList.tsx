import { AppText } from "@/components/AppText";
import { Icon } from "@/components/Icon";
import Image from "@/components/Image";
import { type Subject, subjects } from "@/powersync/schema";
import { db } from "@/powersync/system";
import { toCompilableQuery } from "@powersync/drizzle-driver";
import { useQuery } from "@powersync/react-native";
import { FlashList } from "@shopify/flash-list";
import { eq } from "drizzle-orm";
import { Link } from "expo-router";
import { Card, TextField } from "heroui-native";
import { MagnifyingGlassIcon } from "phosphor-react-native";
import { Alert, Pressable, useWindowDimensions, View } from "react-native";

const CourseList = () => {
  const { width } = useWindowDimensions();
  const MIN_CARD_WIDTH = 280; // The "Sweet Spot" for readability

  // Calculate how many columns fit based on available width
  // Math.max(1, ...) ensures we never have 0 columns
  const numColumns = Math.max(1, Math.floor(width / MIN_CARD_WIDTH));

  const { data, isLoading } = useQuery(
    toCompilableQuery(db.select().from(subjects)),
  );

  return (
    <View className="w-full max-w-6xl mx-auto flex-1  ">
      <FlashList
        ListHeaderComponent={
          <TextField className=" p-1 md:max-w-xl md:mx-auto w-full">
            <View className="w-full flex-row items-center">
              <TextField.Input
                className="flex-1 pr-10 shadow-none "
                placeholder="Find a course"
              />
              <Pressable className="absolute right-4">
                <Icon as={MagnifyingGlassIcon} />
              </Pressable>
            </View>
          </TextField>
        }
        key={numColumns}
        numColumns={numColumns}
        data={data}
        className="p-2.5"
        contentContainerStyle={{ paddingBottom: 15 }}
        renderItem={({ item }) => <Course item={item} />}
      />
    </View>
  );
};

const Course = ({ item }: { item: Subject }) => {
  const { width } = useWindowDimensions();
  const MIN_CARD_WIDTH = 280; // The "Sweet Spot" for readability

  const numColumns = Math.max(1, Math.floor(width / MIN_CARD_WIDTH));

  return (
    <Link
      href={`/course/${item.id}`}
      style={{ flex: 1 / numColumns, padding: 10 / 2 }}
      asChild
    >
      <Pressable>
        <Card className="p-0">
          <Card.Body className="gap-2.5">
            <Image
              source={require("@/assets/placeholder/bg-placeholder.png")}
              className="rounded-t-3xl w-full aspect-video border"
              contentFit="cover"
            />
            <View className="px-4 pb-4">
              {/* Added a fixed height container here */}
              <View className="md:h-14">
                <AppText
                  numberOfLines={2}
                  className="font-semibold text-lg md:text-md leading-6"
                >
                  {item.name}
                </AppText>
              </View>

              {/* This will now stay aligned across all cards */}
              <AppText numberOfLines={1} className="text-sm text-gray-500">
                Room {item.roomNumber} · {item.teacherName}
              </AppText>
            </View>
          </Card.Body>
        </Card>
      </Pressable>
    </Link>
  );
};

export default CourseList;
