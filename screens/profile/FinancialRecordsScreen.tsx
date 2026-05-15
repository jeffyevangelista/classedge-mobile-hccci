import { AppText } from "@/components/AppText";
import EmptyState from "@/components/EmptyState";
import { ErrorComponent } from "@/components/ErrorComponent";
import Screen from "@/components/screen";
import { Icon } from "@/components/Icon";
import {
  useAcademicTerms,
  useFinancialInformation,
} from "@/features/profile/profile.hooks";
import {
  AcademicTermItem,
  DiscountSummary,
  FinancialRecord,
  GrantedScholarship,
  MiscellaneousFee,
  OtherFee,
  PaymentReceipt,
  PromissoryNote,
  SubjectFee,
} from "@/features/profile/profile.types";
import { Card, Select, Separator, Skeleton, useThemeColor } from "heroui-native";
import { Pressable, ScrollView, View } from "react-native";
import { RefreshIndicator } from "@/components/RefreshIndicator";
import { useEffect, useMemo, useState } from "react";
import * as WebBrowser from "expo-web-browser";
import { getApiErrorMessage } from "@/lib/api-error";

const formatCurrency = (value: string | number) => {
  const num = typeof value === "string" ? parseFloat(value) : value;
  return `₱${num.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const FinancialRecordsScreen = () => {
  const {
    data,
    isLoading: isLoadingFinancials,
    isRefetching,
    isError: isErrorFinancials,
    error: financialsError,
    refetch,
  } = useFinancialInformation();
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

  const selectedRecord: FinancialRecord | undefined = useMemo(() => {
    const results = data?.results ?? [];
    if (!selectedTermId) return results[0];
    return results.find(
      (r) => String(r.academicTerm.id) === selectedTermId,
    );
  }, [data, selectedTermId]);

  if (isLoadingFinancials || isLoadingTerms) {
    return <FinancialRecordsSkeleton />;
  }

  if (isErrorFinancials || isErrorTerms) {
    return (
      <ErrorComponent
        message={getApiErrorMessage(financialsError ?? termsError)}
        onRetry={() => refetch()}
      />
    );
  }

  if (!terms || terms.length === 0) {
    return (
      <Screen>
        <View className="flex-1 justify-center items-center">
          <EmptyState
            icon="ReceiptIcon"
            title="No academic terms"
            description="No academic terms are available yet."
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
          <RefreshIndicator refreshing={isRefetching} onRefresh={refetch} />
        }
      >
        <TermSelect
          terms={terms}
          selectedTermId={selectedTermId}
          onChange={setSelectedTermId}
        />

        {selectedRecord ? (
          <>
            <TuitionSummaryCard record={selectedRecord} />
            <SubjectFeesCard fees={selectedRecord.subjectFees} />
            <MiscellaneousFeesCard fees={selectedRecord.miscellaneousFees} />
            <OtherFeesCard fees={selectedRecord.otherFees} />
            <ScholarshipsCard
              scholarships={selectedRecord.grantedScholarships}
            />
            <DiscountSummaryCard summary={selectedRecord.discountSummary} />
            <PaymentReceiptsCard receipts={selectedRecord.paymentReceipts} />
            <PromissoryNotesCard notes={selectedRecord.promissoryNotes} />
          </>
        ) : (
          <EmptyState
            icon="ReceiptIcon"
            title="No records for this term"
            description="There are no financial records for the selected term yet."
          />
        )}
      </ScrollView>
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
          value={formatCurrency(tuition.totalAmount)}
        />
        <FeeRow
          label="Amount Paid"
          value={formatCurrency(tuition.amountPaid)}
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

  const total = fees.reduce((sum, f) => sum + parseFloat(f.finalCost), 0);

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
            key={`${fee.subjectName}-${i}`}
            label={fee.subjectName}
            value={formatCurrency(fee.finalCost)}
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

  const total = fees.reduce((sum, f) => sum + parseFloat(f.finalCost), 0);

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
            key={`${fee.feeItemName}-${i}`}
            label={fee.feeItemName}
            value={formatCurrency(fee.finalCost)}
          />
        ))}
        <Separator className="my-1" />
        <FeeRow label="Total" value={formatCurrency(total)} bold />
      </Card.Body>
    </Card>
  );
};

const OtherFeesCard = ({ fees }: { fees: OtherFee[] }) => {
  if (!fees || fees.length === 0) return null;

  const total = fees.reduce((sum, f) => sum + f.finalCost, 0);

  return (
    <Card className="shadow-none rounded-xl">
      <Card.Header className="pb-0">
        <AppText weight="semibold" className="text-base">
          Other Fees
        </AppText>
      </Card.Header>
      <Card.Body className="gap-2">
        {fees.map((fee, i) => (
          <View
            key={`${fee.name}-${i}`}
            className="flex-row justify-between items-center"
          >
            <AppText className="text-sm flex-1">{fee.name}</AppText>
            <View className="items-end">
              {fee.discountAmount > 0 ? (
                <>
                  <AppText className="text-xs text-muted line-through">
                    {formatCurrency(fee.originalCost)}
                  </AppText>
                  <AppText className="text-sm">
                    {formatCurrency(fee.finalCost)}
                  </AppText>
                </>
              ) : (
                <AppText className="text-sm">
                  {formatCurrency(fee.finalCost)}
                </AppText>
              )}
            </View>
          </View>
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
          <View key={`${s.scholarshipName}-${i}`} className="gap-0.5">
            <View className="flex-row justify-between items-center">
              <AppText
                weight="semibold"
                className="text-sm text-green-900 dark:text-green-100 flex-1"
              >
                {s.scholarshipName}
              </AppText>
              <AppText
                weight="semibold"
                className="text-sm text-green-700 dark:text-green-300"
              >
                -{formatCurrency(s.tuitionAmount)}
              </AppText>
            </View>
            <AppText className="text-xs text-green-600 dark:text-green-400">
              Granted: {s.dateGranted}
            </AppText>
          </View>
        ))}
      </Card.Body>
    </Card>
  );
};

const DiscountSummaryCard = ({ summary }: { summary: DiscountSummary }) => {
  if (!summary || summary.totalFeeDiscounts <= 0) return null;

  return (
    <Card className="shadow-none rounded-xl">
      <Card.Header className="pb-0">
        <AppText weight="semibold" className="text-base">
          Discount Summary
        </AppText>
      </Card.Header>
      <Card.Body className="gap-2">
        {summary.subjectDiscountTotal > 0 && (
          <FeeRow
            label="Subject Discounts"
            value={`-${formatCurrency(summary.subjectDiscountTotal)}`}
          />
        )}
        {summary.miscDiscountTotal > 0 && (
          <FeeRow
            label="Miscellaneous Discounts"
            value={`-${formatCurrency(summary.miscDiscountTotal)}`}
          />
        )}
        {summary.otherDiscountTotal > 0 && (
          <FeeRow
            label="Other Discounts"
            value={`-${formatCurrency(summary.otherDiscountTotal)}`}
          />
        )}
        <Separator className="my-1" />
        <FeeRow
          label="Total Discounts"
          value={`-${formatCurrency(summary.totalFeeDiscounts)}`}
          bold
        />
      </Card.Body>
    </Card>
  );
};

const PaymentReceiptsCard = ({ receipts }: { receipts: PaymentReceipt[] }) => {
  if (!receipts || receipts.length === 0) return null;

  const totalPaid = receipts.reduce((sum, r) => sum + r.amount, 0);

  return (
    <Card className="shadow-none rounded-xl">
      <Card.Header className="pb-0">
        <AppText weight="semibold" className="text-base">
          Payment History
        </AppText>
      </Card.Header>
      <Card.Body className="gap-3">
        {receipts.map((r) => (
          <View
            key={r.receiptNumber}
            className="flex-row justify-between items-start"
          >
            <View className="flex-1 pr-2">
              <AppText weight="semibold" className="text-sm">
                Receipt #{r.receiptNumber}
              </AppText>
              <AppText className="text-xs text-muted">
                {r.receiptDate} · {r.paymentMethod}
              </AppText>
              <AppText className="text-xs text-muted">
                Cashier: {r.cashier}
              </AppText>
            </View>
            <AppText weight="semibold" className="text-sm">
              {formatCurrency(r.amount)}
            </AppText>
          </View>
        ))}
        <Separator className="my-1" />
        <FeeRow label="Total Paid" value={formatCurrency(totalPaid)} bold />
      </Card.Body>
    </Card>
  );
};

const PromissoryNotesCard = ({ notes }: { notes: PromissoryNote[] }) => {
  const mutedColor = useThemeColor("muted");
  if (!notes || notes.length === 0) return null;

  return (
    <Card className="shadow-none rounded-xl">
      <Card.Header className="pb-0">
        <AppText weight="semibold" className="text-base">
          Promissory Notes
        </AppText>
      </Card.Header>
      <Card.Body className="gap-2">
        {notes.map((note) => (
          <Pressable
            key={note.id}
            onPress={() => WebBrowser.openBrowserAsync(note.promisoryNoteUrl)}
            accessibilityRole="button"
            accessibilityLabel={`Open promissory note for ${note.academicTermCode}`}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1 })}
            className="flex-row items-start gap-3 rounded-lg bg-default border border-border px-3 py-3"
          >
            <View className="flex-1">
              <AppText weight="semibold" className="text-sm">
                {note.academicTermCode}
              </AppText>
              <AppText className="text-xs text-muted mt-0.5">
                Date: {note.date}
              </AppText>
              {note.notes ? (
                <AppText
                  className="text-xs text-muted mt-0.5"
                  numberOfLines={2}
                >
                  {note.notes}
                </AppText>
              ) : null}
            </View>
            <Icon name="ArrowSquareOutIcon" size={18} color={mutedColor} />
          </Pressable>
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
      className={`text-sm flex-1 ${highlight ? "text-danger" : ""}`}
    >
      {label}
    </AppText>
    <AppText
      weight={bold ? "semibold" : "regular"}
      className={`text-sm ${highlight ? "text-danger" : ""}`}
    >
      {value}
    </AppText>
  </View>
);

const FinancialRecordsSkeleton = () => (
  <View className="p-3 gap-3 mx-auto w-full max-w-3xl">
    <Skeleton className="h-12 w-full rounded-xl" />
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
