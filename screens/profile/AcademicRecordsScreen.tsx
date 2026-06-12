import { AppText } from "@/components/AppText";
import EmptyState from "@/components/EmptyState";
import { ErrorComponent } from "@/components/ErrorComponent";
import Screen from "@/components/screen";
import {
  useAcademicRecords,
  useAcademicTerms,
} from "@/features/profile/profile.hooks";
import {
  AcademicRecordTerm,
  AcademicSubject,
  AcademicTermItem,
} from "@/features/profile/profile.types";
import { getApiErrorMessage } from "@/lib/api-error";
import { Card, Select, Separator, Skeleton } from "heroui-native";
import { useEffect, useMemo, useState } from "react";
import { View } from "react-native";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import { RefreshIndicator } from "@/components/RefreshIndicator";

const PASSING_GRADE = 75;
const TERM_ORDER = ["Prelim", "Midterm", "Pre-final", "Final"];

const sortTerms = (
  entries: [string, number][],
): [string, number][] =>
  [...entries].sort(([a], [b]) => {
    const ai = TERM_ORDER.indexOf(a);
    const bi = TERM_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });

const formatGrade = (value: number): string =>
  Number.isInteger(value) ? `${value}` : value.toFixed(2);

// Records use the short term code ("2026-2027 - 1st") while /academic-terms/
// returns the long form ("2026-2027 - 1st Semester"). Match on the short
// derived key so picking a term from the dropdown resolves to its record.
const matchKey = (term: AcademicTermItem) =>
  `${term.schoolYear} - ${term.semester}`;

const AcademicRecordsScreen = () => {
  const {
    data: records,
    isLoading: isLoadingRecords,
    isRefetching,
    isError: isErrorRecords,
    error: recordsError,
    refetch,
  } = useAcademicRecords();
  const {
    data: terms,
    isLoading: isLoadingTerms,
    isError: isErrorTerms,
    error: termsError,
  } = useAcademicTerms();

  const [selectedTermId, setSelectedTermId] = useState<string | undefined>(
    undefined,
  );

  // Default the selection to the current semester (if flagged) or the first term.
  useEffect(() => {
    if (terms && terms.length > 0 && !selectedTermId) {
      const current = terms.find((t) => t.currentSemester);
      setSelectedTermId(String((current ?? terms[0]).id));
    }
  }, [terms, selectedTermId]);

  const selectedTerm = useMemo(
    () => terms?.find((t) => String(t.id) === selectedTermId),
    [terms, selectedTermId],
  );

  const selectedRecord: AcademicRecordTerm | undefined = useMemo(() => {
    if (!records || !selectedTerm) return undefined;
    const key = matchKey(selectedTerm);
    return records.find((r) => r.academicTermCode === key);
  }, [records, selectedTerm]);

  // Skeleton during the initial fetch AND during a retry from the
  // error state. `isLoading` only flips on first mount; subsequent
  // retries surface as `isFetching` (more reliable than `isRefetching`
  // when `keepPreviousData` is in play), so the second arm prevents a
  // blank flash between tapping "Try again" and the error reappearing.
  const isRecordsFetching = isLoadingRecords || isRefetching;
  if (
    isLoadingTerms ||
    (isRecordsFetching && !records)
  )
    return <AcademicRecordsSkeleton />;
  if (isErrorRecords || isErrorTerms) {
    return (
      <Screen>
        <ErrorComponent
          message={getApiErrorMessage(recordsError ?? termsError)}
          onRetry={() => refetch()}
        />
      </Screen>
    );
  }

  if (!terms || terms.length === 0) {
    return (
      <Screen>
        <View className="flex-1 justify-center items-center">
          <EmptyState
            icon="GraduationCapIcon"
            title="No academic terms"
            description="No academic terms are available yet."
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScreenScrollView
        className="flex-1"
        contentContainerClassName="p-3 pb-8 gap-4 mx-auto w-full max-w-3xl"
        refreshControl={
          <RefreshIndicator refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        <TermSelect
          terms={terms}
          selectedTermId={selectedTermId}
          onChange={setSelectedTermId}
        />

        {selectedRecord ? (
          <TermSection term={selectedRecord} />
        ) : (
          <EmptyState
            icon="GraduationCapIcon"
            title="No records for this term"
            description="There are no grades recorded for the selected term yet."
          />
        )}
      </ScreenScrollView>
    </Screen>
  );
};

const TermSelect = ({
  terms,
  selectedTermId,
  onChange,
}: {
  terms: AcademicTermItem[];
  selectedTermId: string | undefined;
  onChange: (id: string) => void;
}) => {
  const selectedTerm = terms.find((t) => String(t.id) === selectedTermId);
  const value = selectedTerm
    ? {
        value: String(selectedTerm.id),
        label: selectedTerm.academicTermCode,
      }
    : undefined;

  return (
    <Select
      value={value}
      onValueChange={(v) => {
        if (!Array.isArray(v) && v) {
          onChange(v.value);
        }
      }}
    >
      <Select.Trigger>
        <Select.Value placeholder="Select term" />
        <Select.TriggerIndicator />
      </Select.Trigger>
      <Select.Portal>
        <Select.Overlay />
        <Select.Content presentation="popover" width="trigger">
          {terms.map((t) => (
            <Select.Item
              key={t.id}
              value={String(t.id)}
              label={
                t.currentSemester
                  ? `${t.academicTermCode} · Current`
                  : t.academicTermCode
              }
            />
          ))}
        </Select.Content>
      </Select.Portal>
    </Select>
  );
};

const TermSection = ({ term }: { term: AcademicRecordTerm }) => {
  const subjects = term.subjects ?? [];

  return (
    <View className="gap-3">
      <Card className="shadow-none rounded-xl">
        <Card.Body className="gap-3">
          {subjects.length === 0 ? (
            <AppText className="text-sm text-muted">
              No subjects recorded for this term.
            </AppText>
          ) : (
            subjects.map((subject, i) => (
              <View key={`${subject.subjectName}-${i}`} className="gap-2">
                <SubjectRow subject={subject} />
                {i < subjects.length - 1 ? (
                  <Separator className="my-1" />
                ) : null}
              </View>
            ))
          )}
        </Card.Body>
      </Card>
    </View>
  );
};

const SubjectRow = ({ subject }: { subject: AcademicSubject }) => {
  const final = subject.breakdown?.final ?? 0;
  const isFailing = final < PASSING_GRADE;
  const termEntries = sortTerms(
    Object.entries(subject.breakdown?.terms ?? {}),
  );

  return (
    <View className="gap-1.5">
      <View className="flex-row justify-between items-start">
        <AppText weight="semibold" className="text-sm flex-1 pr-3">
          {subject.subjectName}
        </AppText>
        <AppText
          weight="bold"
          className={`text-lg ${isFailing ? "text-danger" : ""}`}
        >
          {formatGrade(final)}
        </AppText>
      </View>
      {termEntries.length > 0 ? (
        <View className="flex-row flex-wrap gap-1.5">
          {termEntries.map(([term, grade]) => (
            <View
              key={term}
              className="px-2 py-0.5 rounded-md bg-default border border-border"
            >
              <AppText className="text-xs text-muted">
                {term}: {formatGrade(grade)}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
      {subject.transmutedGrade !== null &&
      subject.transmutedGrade !== undefined ? (
        <AppText className="text-xs text-muted">
          Transmuted: {formatGrade(subject.transmutedGrade)}
        </AppText>
      ) : null}
    </View>
  );
};

const AcademicRecordsSkeleton = () => (
  <View className="p-3 gap-3 mx-auto w-full max-w-3xl">
    <Skeleton className="h-12 w-full rounded-xl" />
    <Card className="shadow-none rounded-xl">
      <Card.Header className="pb-0">
        <Skeleton className="h-5 w-1/3 rounded" />
      </Card.Header>
      <Card.Body className="gap-4">
        {Array(5)
          .fill(0)
          .map((_, index) => (
            <View key={index} className="gap-1.5">
              <View className="flex-row justify-between">
                <Skeleton className="h-4 w-2/3 rounded" />
                <Skeleton className="h-5 w-10 rounded" />
              </View>
              <View className="flex-row gap-1.5">
                <Skeleton className="h-4 w-20 rounded-md" />
                <Skeleton className="h-4 w-20 rounded-md" />
              </View>
            </View>
          ))}
      </Card.Body>
    </Card>
  </View>
);

export default AcademicRecordsScreen;
