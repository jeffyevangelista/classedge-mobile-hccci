import { AppText } from "@/components/AppText";
import EmptyState from "@/components/EmptyState";
import { ErrorComponent } from "@/components/ErrorComponent";
import Screen from "@/components/screen";
import { useFinancialInformation } from "@/features/profile/profile.hooks";
import {
  FinancialRecord,
  GrantedScholarship,
  MiscellaneousFee,
  SubjectFee,
} from "@/features/profile/profile.types";
import { Card, Separator, Skeleton } from "heroui-native";
import { RefreshControl, ScrollView, View } from "react-native";

const formatCurrency = (value: string | number) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return `₱${num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const FinancialRecordsScreen = () => {
  const { data, isLoading, isRefetching, isError, error, refetch } =
    useFinancialInformation();

  if (isLoading) return <FinancialRecordsSkeleton />;
  if (isError)
    return <ErrorComponent message={error.message} onRetry={() => refetch()} />;

  const record = data?.results?.[0];

  if (!record) {
    return (
      <Screen>
        <View className="flex-1 justify-center items-center">
          <EmptyState
            icon="ReceiptIcon"
            title="No financial records"
            description="Your financial records will appear here once available."
          />
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        className="flex-1"
        contentContainerClassName="p-3 pb-8 gap-3 mx-auto w-full max-w-3xl"
        refreshControl={
          <RefreshControl refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        <AcademicTermBanner record={record} />
        <TuitionSummaryCard record={record} />
        <SubjectFeesCard fees={record.subject_fees} />
        <MiscellaneousFeesCard fees={record.miscellaneous_fees} />
        <ScholarshipsCard scholarships={record.granted_scholarships} />
      </ScrollView>
    </Screen>
  );
};

const AcademicTermBanner = ({ record }: { record: FinancialRecord }) => (
  <Card className="shadow-none rounded-xl bg-primary-50 dark:bg-primary-950 border border-primary-200 dark:border-primary-800">
    <Card.Body className="py-3 px-4">
      <AppText
        weight="semibold"
        className="text-primary-700 dark:text-primary-300 text-sm"
      >
        {record.academic_term.academic_term_code}
      </AppText>
    </Card.Body>
  </Card>
);

const TuitionSummaryCard = ({ record }: { record: FinancialRecord }) => {
  const { tuition } = record;
  return (
    <Card className="shadow-none rounded-xl">
      <Card.Header className="pb-0">
        <AppText weight="semibold" className="text-base">
          Tuition Summary
        </AppText>
      </Card.Header>
      <Card.Body className="gap-2">
        <FeeRow
          label="Total Amount"
          value={formatCurrency(tuition.total_amount)}
        />
        <FeeRow
          label="Amount Paid"
          value={formatCurrency(tuition.amount_paid)}
        />
        <Separator className="my-1" />
        <FeeRow
          label="Balance"
          value={formatCurrency(tuition.balance)}
          bold
          highlight={parseFloat(tuition.balance) > 0}
        />
      </Card.Body>
    </Card>
  );
};

const SubjectFeesCard = ({ fees }: { fees: SubjectFee[] }) => {
  if (!fees || fees.length === 0) return null;

  const total = fees.reduce((sum, f) => sum + parseFloat(f.final_cost), 0);

  return (
    <Card className="shadow-none rounded-xl">
      <Card.Header className="pb-0">
        <AppText weight="semibold" className="text-base">
          Subject Fees
        </AppText>
      </Card.Header>
      <Card.Body className="gap-2">
        {fees.map((fee, i) => (
          <FeeRow
            key={`${fee.subject_name}-${i}`}
            label={fee.subject_name}
            value={formatCurrency(fee.final_cost)}
          />
        ))}
        <Separator className="my-1" />
        <FeeRow label="Total" value={formatCurrency(total)} bold />
      </Card.Body>
    </Card>
  );
};

const MiscellaneousFeesCard = ({ fees }: { fees: MiscellaneousFee[] }) => {
  if (!fees || fees.length === 0) return null;

  const total = fees.reduce((sum, f) => sum + parseFloat(f.final_cost), 0);

  return (
    <Card className="shadow-none rounded-xl">
      <Card.Header className="pb-0">
        <AppText weight="semibold" className="text-base">
          Miscellaneous Fees
        </AppText>
      </Card.Header>
      <Card.Body className="gap-2">
        {fees.map((fee, i) => (
          <FeeRow
            key={`${fee.fee_item_name}-${i}`}
            label={fee.fee_item_name}
            value={formatCurrency(fee.final_cost)}
          />
        ))}
        <Separator className="my-1" />
        <FeeRow label="Total" value={formatCurrency(total)} bold />
      </Card.Body>
    </Card>
  );
};

const ScholarshipsCard = ({
  scholarships,
}: {
  scholarships: GrantedScholarship[];
}) => {
  if (!scholarships || scholarships.length === 0) return null;

  return (
    <Card className="shadow-none rounded-xl bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800">
      <Card.Header className="pb-0">
        <AppText
          weight="semibold"
          className="text-base text-green-800 dark:text-green-200"
        >
          Granted Scholarships
        </AppText>
      </Card.Header>
      <Card.Body className="gap-2">
        {scholarships.map((s, i) => (
          <View key={`${s.scholarship_name}-${i}`} className="gap-0.5">
            <View className="flex-row justify-between items-center">
              <AppText
                weight="semibold"
                className="text-sm text-green-900 dark:text-green-100 flex-1"
              >
                {s.scholarship_name}
              </AppText>
              <AppText
                weight="semibold"
                className="text-sm text-green-700 dark:text-green-300"
              >
                -{formatCurrency(s.tuition_amount)}
              </AppText>
            </View>
            <AppText className="text-xs text-green-600 dark:text-green-400">
              Granted: {s.date_granted}
            </AppText>
          </View>
        ))}
      </Card.Body>
    </Card>
  );
};

const FeeRow = ({
  label,
  value,
  bold = false,
  highlight = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
  highlight?: boolean;
}) => (
  <View className="flex-row justify-between items-center">
    <AppText
      weight={bold ? "semibold" : "regular"}
      className={`text-sm flex-1 ${highlight ? "text-red-600 dark:text-red-400" : ""}`}
    >
      {label}
    </AppText>
    <AppText
      weight={bold ? "semibold" : "regular"}
      className={`text-sm ${highlight ? "text-red-600 dark:text-red-400" : ""}`}
    >
      {value}
    </AppText>
  </View>
);

const FinancialRecordsSkeleton = () => (
  <View className="p-3 gap-3 mx-auto w-full max-w-3xl">
    <Card className="shadow-none rounded-xl">
      <Card.Body>
        <Skeleton className="h-4 w-2/3 rounded" />
      </Card.Body>
    </Card>
    {Array(3)
      .fill(0)
      .map((_, index) => (
        <Card key={index} className="shadow-none rounded-xl">
          <Card.Header className="pb-0">
            <Skeleton className="h-5 w-1/3 rounded" />
          </Card.Header>
          <Card.Body className="gap-3">
            <View className="flex-row justify-between">
              <Skeleton className="h-4 w-1/3 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
            </View>
            <View className="flex-row justify-between">
              <Skeleton className="h-4 w-2/5 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
            </View>
            <View className="flex-row justify-between">
              <Skeleton className="h-4 w-1/4 rounded" />
              <Skeleton className="h-4 w-16 rounded" />
            </View>
          </Card.Body>
        </Card>
      ))}
  </View>
);

export default FinancialRecordsScreen;
