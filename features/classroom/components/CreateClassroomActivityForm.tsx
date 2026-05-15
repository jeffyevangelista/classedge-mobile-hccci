import { View, Text, Pressable, Platform, Alert } from "react-native";
import React, { useState } from "react";
import {
  Button,
  Input,
  Label,
  Select,
  Separator,
  Skeleton,
  Surface,
  TextArea,
  TextField,
} from "heroui-native";
import { Icon } from "@/components/Icon";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { AppText } from "@/components/AppText";
import {
  useClassroomGradingPeriods,
  useActivityTypes,
} from "../classroom.hooks";
import { createActivity } from "../ classroom.service";
import { useLocalSearchParams, useRouter } from "expo-router";

type SelectOption = {
  value: string;
  label: string;
};

const scoringTypes: SelectOption[] = [
  { value: "percentage", label: "Percentage" },
  { value: "number", label: "Number" },
];

const CreateClassroomActivityForm = () => {
  const router = useRouter();
  const { classroomId } = useLocalSearchParams();
  const [title, setTitle] = useState("");
  const [term, setTerm] = useState<SelectOption | undefined>();
  const [instructions, setInstructions] = useState("");
  const [passingScore, setPassingScore] = useState("");
  const [type, setType] = useState<SelectOption | undefined>();
  const [activityType, setActivityType] = useState<SelectOption | undefined>();
  const [maxScore, setMaxScore] = useState("");

  const [startDate, setStartDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);

  const [endDate, setEndDate] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const onStartDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    setShowStartDatePicker(Platform.OS === "ios");
    if (selectedDate) setStartDate(selectedDate);
  };

  const onStartTimeChange = (
    event: DateTimePickerEvent,
    selectedTime?: Date,
  ) => {
    setShowStartTimePicker(Platform.OS === "ios");
    if (selectedTime) setStartTime(selectedTime);
  };

  const onEndDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowEndDatePicker(Platform.OS === "ios");
    if (selectedDate) setEndDate(selectedDate);
  };

  const onEndTimeChange = (event: DateTimePickerEvent, selectedTime?: Date) => {
    setShowEndTimePicker(Platform.OS === "ios");
    if (selectedTime) setEndTime(selectedTime);
  };

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  const formatTime = (date: Date) =>
    date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const combineDateTime = (date: Date, time: Date) => {
    const combined = new Date(date);
    combined.setHours(time.getHours(), time.getMinutes(), 0, 0);
    return combined;
  };

  const handleSubmit = async () => {
    const maxScoreNum = parseInt(maxScore, 10);
    const passingScoreNum = parseInt(passingScore, 10);
    const termIdNum = term?.value ? parseInt(term.value, 10) : NaN;
    const activityTypeIdNum = activityType?.value
      ? parseInt(activityType.value, 10)
      : NaN;

    const missing: string[] = [];
    if (!title.trim()) missing.push("Title");
    if (!term?.value) missing.push("Term");
    if (!activityType?.value) missing.push("Activity Type");
    if (!type?.value) missing.push("Scoring Type");
    if (Number.isNaN(maxScoreNum)) missing.push("Max Score");
    if (Number.isNaN(passingScoreNum)) missing.push("Passing Score");
    if (missing.length > 0) {
      Alert.alert(
        "Missing required fields",
        `Please provide: ${missing.join(", ")}`,
      );
      return;
    }

    const startDateTime = combineDateTime(startDate, startTime);
    const endDateTime = combineDateTime(endDate, endTime);

    const data = {
      activityName: title,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      showScore: false,
      maxRetake: 1,
      timeDuration: 0,
      maxScore: maxScoreNum,
      passingScore: passingScoreNum,
      passingScoreType: type?.value ?? "percentage",
      retakeMethod: "highest",
      activityInstruction: instructions,
      activityFileInstruction: "",
      classroomMode: true,
      isGraded: true,
      shuffleQuestions: false,
      subjectId: parseInt(classroomId as string, 10),
      activityTypeId: Number.isNaN(activityTypeIdNum) ? 2 : activityTypeIdNum,
      termId: termIdNum,
    };
    try {
      const { localId } = await createActivity(data);

      router.replace(`/classroom/${classroomId}/input-grades/${localId}`);
    } catch (error) {
      console.error("Error creating activity:", error);
      Alert.alert(
        "Could not create activity",
        error instanceof Error ? error.message : "Unknown error",
      );
    }
  };

  return (
    <View className="w-full max-w-xl mx-auto px-2.5 gap-2.5">
      <TextField isRequired>
        <Label>Title</Label>
        <Input value={title} onChangeText={setTitle} />
      </TextField>

      <TextField>
        <Label>Term</Label>
        <GradingPeriodSelector value={term} onValueChange={setTerm} />
      </TextField>
      <TextField>
        <Label>Activity Type</Label>
        <ActivityTypeSelector
          value={activityType}
          onValueChange={setActivityType}
        />
      </TextField>

      <TextField>
        <Label>Instructions</Label>
        <TextArea
          placeholder="Enter your message here..."
          value={instructions}
          onChangeText={setInstructions}
        />
      </TextField>

      <TextField>
        <Label>Scoring Type</Label>

        <Select value={type} onValueChange={setType}>
          <Select.Trigger>
            <Select.Value placeholder="Select one" />
            <Select.TriggerIndicator />
          </Select.Trigger>
          <Select.Portal>
            <Select.Overlay />
            <Select.Content presentation="popover" width="trigger">
              <Select.ListLabel className="mb-2">
                Choose a type
              </Select.ListLabel>
              {scoringTypes.map((state, index) => (
                <React.Fragment key={state.value}>
                  <Select.Item value={state.value} label={state.label} />
                  {index < scoringTypes.length - 1 && <Separator />}
                </React.Fragment>
              ))}
            </Select.Content>
          </Select.Portal>
        </Select>
      </TextField>

      <TextField isRequired>
        <Label>Max Score</Label>
        <Input
          value={maxScore}
          onChangeText={setMaxScore}
          keyboardType="numeric"
        />
      </TextField>

      <TextField isRequired>
        <Label>Passing Score</Label>
        <Input
          value={passingScore}
          onChangeText={setPassingScore}
          keyboardType="numeric"
        />
      </TextField>

      <TextField isRequired>
        <Label>From</Label>
        <Surface className="gap-1 py-2 rounded-xl p-0 shadow-none">
          <Pressable
            onPress={() => setShowStartDatePicker(!showStartDatePicker)}
            className="flex-row items-center justify-center py-4"
          >
            <Icon name="CalendarIcon" size={16} className="text-muted mr-2" />
            <Text className="text-foreground">{formatDate(startDate)}</Text>
          </Pressable>
          {showStartDatePicker && (
            <View className="items-center">
              <DateTimePicker
                value={startDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onStartDateChange}
                minimumDate={new Date()}
              />
            </View>
          )}
        </Surface>
        <Surface className="gap-1 rounded-xl p-0 shadow-none">
          <Pressable
            onPress={() => setShowStartTimePicker(!showStartTimePicker)}
            className="flex-row items-center justify-center py-4"
          >
            <Icon name="ClockIcon" size={16} className="text-muted mr-2" />
            <Text className="text-foreground">{formatTime(startTime)}</Text>
          </Pressable>
          {showStartTimePicker && (
            <View className="items-center">
              <DateTimePicker
                value={startTime}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onStartTimeChange}
              />
            </View>
          )}
        </Surface>
      </TextField>

      <TextField isRequired>
        <Label>To</Label>
        <Surface className="gap-1 py-2 rounded-xl p-0 shadow-none">
          <Pressable
            onPress={() => setShowEndDatePicker(!showEndDatePicker)}
            className="flex-row items-center justify-center py-4"
          >
            <Icon name="CalendarIcon" size={16} className="text-muted mr-2" />
            <Text className="text-foreground">{formatDate(endDate)}</Text>
          </Pressable>
          {showEndDatePicker && (
            <View className="items-center">
              <DateTimePicker
                value={endDate}
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onEndDateChange}
                minimumDate={startDate}
              />
            </View>
          )}
        </Surface>
        <Surface className="gap-1 py-2 rounded-xl p-0 shadow-none">
          <Pressable
            onPress={() => setShowEndTimePicker(!showEndTimePicker)}
            className="flex-row items-center justify-center py-4"
          >
            <Icon name="ClockIcon" size={16} className="text-muted mr-2" />
            <Text className="text-foreground">{formatTime(endTime)}</Text>
          </Pressable>
          {showEndTimePicker && (
            <View className="items-center">
              <DateTimePicker
                value={endTime}
                mode="time"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                onChange={onEndTimeChange}
              />
            </View>
          )}
        </Surface>
      </TextField>

      <Button onPress={handleSubmit}>
        <Button.Label>Create Activity</Button.Label>
      </Button>
    </View>
  );
};

const GradingPeriodSelector = ({
  value,
  onValueChange,
}: {
  value: SelectOption | undefined;
  onValueChange: (value: SelectOption | undefined) => void;
}) => {
  const { data, isLoading } = useClassroomGradingPeriods();
  if (isLoading) return <Skeleton className="h-10 w-full rounded-lg" />;

  return (
    <Select value={value} onValueChange={onValueChange}>
      <Select.Trigger>
        <Select.Value placeholder="Select grading period" />
        <Select.TriggerIndicator />
      </Select.Trigger>
      <Select.Portal>
        <Select.Overlay />
        <Select.Content presentation="popover" width="trigger">
          <Select.ListLabel className="mb-2">
            Choose a grading period
          </Select.ListLabel>
          {data?.map((gradingPeriod, index) => (
            <React.Fragment key={gradingPeriod.id}>
              <Select.Item
                value={String(gradingPeriod.id)}
                label={gradingPeriod.termName}
              />
              {index < data.length - 1 && <Separator />}
            </React.Fragment>
          ))}
        </Select.Content>
      </Select.Portal>
    </Select>
  );
};

const ActivityTypeSelector = ({
  value,
  onValueChange,
}: {
  value: SelectOption | undefined;
  onValueChange: (value: SelectOption | undefined) => void;
}) => {
  const { data, isLoading } = useActivityTypes();
  if (isLoading) return <Skeleton className="h-10 w-full rounded-lg" />;

  return (
    <Select value={value} onValueChange={onValueChange}>
      <Select.Trigger>
        <Select.Value placeholder="Select activity type" />
        <Select.TriggerIndicator />
      </Select.Trigger>
      <Select.Portal>
        <Select.Overlay />
        <Select.Content presentation="popover" width="trigger">
          <Select.ListLabel className="mb-2">
            Choose an activity type
          </Select.ListLabel>
          {data?.map((activityType, index) => (
            <React.Fragment key={activityType.id}>
              <Select.Item
                value={String(activityType.id)}
                label={activityType.name}
              />
              {index < data.length - 1 && <Separator />}
            </React.Fragment>
          ))}
        </Select.Content>
      </Select.Portal>
    </Select>
  );
};

export default CreateClassroomActivityForm;
