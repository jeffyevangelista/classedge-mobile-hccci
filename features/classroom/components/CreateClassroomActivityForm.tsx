import { View, Text, Pressable, Platform } from "react-native";
import React, { useState } from "react";
import {
  Button,
  Input,
  Label,
  Select,
  Separator,
  Surface,
  TextArea,
  TextField,
} from "heroui-native";
import { Icon } from "@/components/Icon";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { AppText } from "@/components/AppText";
import { useClassroomGradingPeriods } from "../classroom.hooks";
import { createActivity } from "../ classroom.service";
import { createId } from "@paralleldrive/cuid2";
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
    const startDateTime = combineDateTime(startDate, startTime);
    const endDateTime = combineDateTime(endDate, endTime);

    console.log({
      activityName: title,
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      show_score: false,
      remedial: false,
      maxRetake: 1,
      timeDuration: 0,
      maxScore,
      status: true,
      passingScoreType: passingScore,
      retakeMethod: "highest",
      activityInstruction: instructions,
      classroomMode: true,
      isGraded: true,
      shuffleQuestions: false,
      subjectId: classroomId,
      termId: term?.value,
      activityTypeId: type?.value,
    });

    try {
      await createActivity({
        id: createId(),
        activityName: title,
        startTime: startDateTime.toISOString(),
        endTime: endDateTime.toISOString(),
        showScore: 0,
        maxRetake: 1,
        timeDuration: 0,
        maxScore: parseInt(maxScore),
        passingScore: parseInt(passingScore),
        passingScoreType: type?.value,
        retakeMethod: "highest",
        activityInstruction: instructions,
        classroomMode: 1,
        isGraded: 1,
        shuffleQuestions: 0,
        subjectId: parseInt(classroomId as string),
        activityTypeId: 2,
      });

      router.replace(`/classroom/${classroomId}/input-grades`);
    } catch (error) {
      console.error("Error creating activity:", error);
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
        <Surface className="gap-1 py-2 rounded-2xl p-0">
          <Pressable
            onPress={() => setShowStartDatePicker(!showStartDatePicker)}
            className="flex-row items-center justify-center py-4 "
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
        <Surface className="gap-1 rounded-2xl p-0">
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
        <Surface className="gap-1 py-2 rounded-2xl p-0">
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
        <Surface className="gap-1 py-2 rounded-2xl p-0">
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
  if (isLoading) return <AppText>loading...</AppText>;

  console.log(data);

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

export default CreateClassroomActivityForm;
