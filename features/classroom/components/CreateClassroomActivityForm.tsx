import { ActivityIndicator, View, Pressable, Platform, Alert } from "react-native";
import React, { useState } from "react";
import {
  Button,
  FieldError,
  Input,
  Label,
  Select,
  Separator,
  Skeleton,
  Surface,
  TextField,
  useThemeColor,
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
  const mutedColor = useThemeColor("muted");
  const [title, setTitle] = useState("");
  const [term, setTerm] = useState<SelectOption | undefined>();
  const [instructions, setInstructions] = useState("");
  const [passingScore, setPassingScore] = useState("");
  const [type, setType] = useState<SelectOption | undefined>();
  const [activityType, setActivityType] = useState<SelectOption | undefined>();
  const [maxScore, setMaxScore] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const [startDate, setStartDate] = useState(new Date());
  const [startTime, setStartTime] = useState(new Date());
  const [showStartDatePicker, setShowStartDatePicker] = useState(false);
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);

  const [endDate, setEndDate] = useState(new Date());
  const [endTime, setEndTime] = useState(new Date());
  const [showEndDatePicker, setShowEndDatePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const clearError = (key: string) =>
    setErrors((prev) => (prev[key] ? { ...prev, [key]: undefined } : prev));

  const onStartDateChange = (
    event: DateTimePickerEvent,
    selectedDate?: Date,
  ) => {
    setShowStartDatePicker(Platform.OS === "ios");
    if (!selectedDate) return;
    setStartDate(selectedDate);
    // Bump end date forward if the new start passes it.
    if (selectedDate > endDate) setEndDate(selectedDate);
    clearError("schedule");
  };

  const onStartTimeChange = (
    event: DateTimePickerEvent,
    selectedTime?: Date,
  ) => {
    setShowStartTimePicker(Platform.OS === "ios");
    if (selectedTime) setStartTime(selectedTime);
    clearError("schedule");
  };

  const onEndDateChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowEndDatePicker(Platform.OS === "ios");
    if (selectedDate) setEndDate(selectedDate);
    clearError("schedule");
  };

  const onEndTimeChange = (event: DateTimePickerEvent, selectedTime?: Date) => {
    setShowEndTimePicker(Platform.OS === "ios");
    if (selectedTime) setEndTime(selectedTime);
    clearError("schedule");
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

    const nextErrors: Record<string, string | undefined> = {};
    if (!title.trim()) nextErrors.title = "Title is required";
    if (!term?.value) nextErrors.term = "Term is required";
    if (!activityType?.value)
      nextErrors.activityType = "Activity type is required";
    if (!type?.value) nextErrors.type = "Scoring type is required";
    if (Number.isNaN(maxScoreNum)) nextErrors.maxScore = "Max score is required";
    if (Number.isNaN(passingScoreNum))
      nextErrors.passingScore = "Passing score is required";

    const startDateTime = combineDateTime(startDate, startTime);
    const endDateTime = combineDateTime(endDate, endTime);
    if (endDateTime <= startDateTime) {
      nextErrors.schedule = "End must be after start";
    }

    if (Object.values(nextErrors).some(Boolean)) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

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
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View className="w-full max-w-xl mx-auto px-2.5 gap-3">
      <SectionHeader>Basic info</SectionHeader>

      <TextField isRequired isInvalid={!!errors.title}>
        <Label>Title</Label>
        <Input
          value={title}
          onChangeText={(text) => {
            setTitle(text);
            clearError("title");
          }}
        />
        {!!errors.title && <FieldError>{errors.title}</FieldError>}
      </TextField>

      <TextField isRequired isInvalid={!!errors.term}>
        <Label>Term</Label>
        <GradingPeriodSelector
          value={term}
          onValueChange={(v) => {
            setTerm(v);
            clearError("term");
          }}
        />
        {!!errors.term && <FieldError>{errors.term}</FieldError>}
      </TextField>

      <TextField isRequired isInvalid={!!errors.activityType}>
        <Label>Activity type</Label>
        <ActivityTypeSelector
          value={activityType}
          onValueChange={(v) => {
            setActivityType(v);
            clearError("activityType");
          }}
        />
        {!!errors.activityType && (
          <FieldError>{errors.activityType}</FieldError>
        )}
      </TextField>

      <TextField>
        <Label>Instructions</Label>
        <Input
          placeholder="Enter your message here..."
          value={instructions}
          onChangeText={setInstructions}
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          className="h-32"
        />
      </TextField>

      <SectionHeader>Scoring</SectionHeader>

      <TextField isRequired isInvalid={!!errors.type}>
        <Label>Scoring type</Label>
        <Select
          value={type}
          onValueChange={(v) => {
            setType(v);
            clearError("type");
          }}
        >
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
        {!!errors.type && <FieldError>{errors.type}</FieldError>}
      </TextField>

      <View className="flex-row gap-2">
        <TextField
          isRequired
          isInvalid={!!errors.maxScore}
          className="flex-1"
        >
          <Label>Max score</Label>
          <Input
            value={maxScore}
            onChangeText={(text) => {
              setMaxScore(text);
              clearError("maxScore");
            }}
            keyboardType="numeric"
          />
          {!!errors.maxScore && <FieldError>{errors.maxScore}</FieldError>}
        </TextField>

        <TextField
          isRequired
          isInvalid={!!errors.passingScore}
          className="flex-1"
        >
          <Label>Passing score</Label>
          <Input
            value={passingScore}
            onChangeText={(text) => {
              setPassingScore(text);
              clearError("passingScore");
            }}
            keyboardType="numeric"
          />
          {!!errors.passingScore && (
            <FieldError>{errors.passingScore}</FieldError>
          )}
        </TextField>
      </View>

      <SectionHeader>Schedule</SectionHeader>

      <TextField isRequired isInvalid={!!errors.schedule}>
        <Label>Starts at</Label>
        <View className="flex-row gap-2">
          <Surface className="flex-1 rounded-xl shadow-none">
            <Pressable
              onPress={() => setShowStartDatePicker(!showStartDatePicker)}
              className="flex-row items-center justify-center py-4"
            >
              <Icon name="CalendarIcon" size={16} color={mutedColor} />
              <AppText className="text-foreground ml-2">
                {formatDate(startDate)}
              </AppText>
            </Pressable>
          </Surface>
          <Surface className="flex-1 rounded-xl shadow-none">
            <Pressable
              onPress={() => setShowStartTimePicker(!showStartTimePicker)}
              className="flex-row items-center justify-center py-4"
            >
              <Icon name="ClockIcon" size={16} color={mutedColor} />
              <AppText className="text-foreground ml-2">
                {formatTime(startTime)}
              </AppText>
            </Pressable>
          </Surface>
        </View>
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
      </TextField>

      <TextField isRequired isInvalid={!!errors.schedule}>
        <Label>Ends at</Label>
        <View className="flex-row gap-2">
          <Surface className="flex-1 rounded-xl shadow-none">
            <Pressable
              onPress={() => setShowEndDatePicker(!showEndDatePicker)}
              className="flex-row items-center justify-center py-4"
            >
              <Icon name="CalendarIcon" size={16} color={mutedColor} />
              <AppText className="text-foreground ml-2">
                {formatDate(endDate)}
              </AppText>
            </Pressable>
          </Surface>
          <Surface className="flex-1 rounded-xl shadow-none">
            <Pressable
              onPress={() => setShowEndTimePicker(!showEndTimePicker)}
              className="flex-row items-center justify-center py-4"
            >
              <Icon name="ClockIcon" size={16} color={mutedColor} />
              <AppText className="text-foreground ml-2">
                {formatTime(endTime)}
              </AppText>
            </Pressable>
          </Surface>
        </View>
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
        {!!errors.schedule && <FieldError>{errors.schedule}</FieldError>}
      </TextField>

      <Button
        onPress={handleSubmit}
        isDisabled={isSubmitting}
        className="mt-2"
      >
        {isSubmitting ? (
          <ActivityIndicator size="small" />
        ) : (
          <Button.Label>Create Activity</Button.Label>
        )}
      </Button>
    </View>
  );
};

const SectionHeader = ({ children }: { children: React.ReactNode }) => (
  <AppText
    weight="semibold"
    className="text-xs uppercase tracking-wide text-foreground/70 mt-2"
  >
    {children}
  </AppText>
);

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
