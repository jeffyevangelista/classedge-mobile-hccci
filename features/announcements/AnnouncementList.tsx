import { View, Text, ScrollView } from "react-native";
import React, { useState } from "react";

import { FlashList } from "@shopify/flash-list";
import { Avatar, Card, Divider, ScrollShadow } from "heroui-native";
import { AppText } from "@/components/AppText";
import { useQuery } from "@powersync/react-native";
import { db, powersync } from "@/powersync/system";
import { toCompilableQuery } from "@powersync/drizzle-driver";
import { announcements } from "@/powersync/schema";
import { CalendarIcon, ClockIcon, MapPinIcon } from "phosphor-react-native";
import { Icon } from "@/components/Icon";

import { LinearGradient } from "expo-linear-gradient";

const AnnouncementList = () => {
  // const { data, isLoading } = useQuery(
  //   toCompilableQuery(db.select().from(announcements)),
  // );

  // if (isLoading) return <Text>Loading...</Text>;

  const data = [
    {
      id: "ann-101",
      authorId: "user_98765",
      createdAt: "2026-01-20T10:00:00Z",
      title: "Welcome to the 2026 Tech Summit",
      content:
        "We are thrilled to announce that registration is now open for our annual summit. Check the attached event for details!",
      events: [
        {
          id: "event_001",
          title: "Annual Tech Summit 2026",
          description:
            "A three-day conference focusing on the future of AI, renewable energy, and decentralized web technologies.",
          location: "Moscone Center, San Francisco, CA",
          startTime: "2026-03-15T09:00:00Z",
          endTime: "2026-03-17T17:00:00Z",
          createdAt: "2026-01-15T12:00:00Z",
          updatedAt: "2026-01-19T14:20:00Z",
        },
      ],
    },
    {
      id: "ann-102",
      authorId: "user_43210",
      createdAt: "2026-01-21T08:30:00Z",
      title: "Maintenance Update",
      content:
        "The community portal will be down for scheduled maintenance this Sunday from 2 AM to 4 AM UTC.",
      events: [],
    },
    {
      id: "ann-103",
      authorId: "user_55555",
      createdAt: "2026-01-22T14:00:00Z",
      title: "Upcoming Workshops",
      content:
        "Join us for two exciting workshops on web development and machine learning this month!",
      events: [
        {
          id: "event_002",
          title: "Web Development Workshop",
          description:
            "Learn the latest trends in React, Next.js, and modern web development practices.",
          location: "Tech Hub, Building A, Room 201",
          startTime: "2026-02-05T10:00:00Z",
          endTime: "2026-02-05T16:00:00Z",
          createdAt: "2026-01-20T10:00:00Z",
          updatedAt: "2026-01-22T09:00:00Z",
        },
        {
          id: "event_003",
          title: "Machine Learning Fundamentals",
          description:
            "An introductory workshop covering ML basics, neural networks, and practical applications.",
          location: "Innovation Center, Lab 3",
          startTime: "2026-02-12T13:00:00Z",
          endTime: "2026-02-12T18:00:00Z",
          createdAt: "2026-01-20T10:30:00Z",
          updatedAt: "2026-01-22T09:15:00Z",
        },
      ],
    },
    {
      id: "ann-101",
      authorId: "user_98765",
      createdAt: "2026-01-20T10:00:00Z",
      title: "Welcome to the 2026 Tech Summit",
      content:
        "We are thrilled to announce that registration is now open for our annual summit. Check the attached event for details!",
      events: [
        {
          id: "event_001",
          title: "Annual Tech Summit 2026",
          description:
            "A three-day conference focusing on the future of AI, renewable energy, and decentralized web technologies.",
          location: "Moscone Center, San Francisco, CA",
          startTime: "2026-03-15T09:00:00Z",
          endTime: "2026-03-17T17:00:00Z",
          createdAt: "2026-01-15T12:00:00Z",
          updatedAt: "2026-01-19T14:20:00Z",
        },
      ],
    },
    {
      id: "ann-102",
      authorId: "user_43210",
      createdAt: "2026-01-21T08:30:00Z",
      title: "Maintenance Update",
      content:
        "The community portal will be down for scheduled maintenance this Sunday from 2 AM to 4 AM UTC.",
      events: [],
    },
  ];

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

  return (
    <FlashList
      data={data}
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
          <Divider className="my-2 bg-gray-300" />

          <Card.Body className="gap-2.5">
            <AppText weight="semibold" className="text-lg">
              {item.title}
            </AppText>
            <AppText>{item.content}</AppText>
            {item.events.length > 0 && (
              <AppText weight="semibold" className="text-md">
                Associated Events
              </AppText>
            )}

            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
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
            </ScrollView>
          </Card.Body>
        </Card>
      )}
    />
  );
};

export default AnnouncementList;
