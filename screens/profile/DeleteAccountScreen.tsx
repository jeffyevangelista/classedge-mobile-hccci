import { Alert, Button, Card, Dialog, Separator } from "heroui-native";
import { useState } from "react";
import { View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import AppInput from "@/components/AppInput";
import { AppText } from "@/components/AppText";
import { ScreenScrollView } from "@/components/ScreenScrollView";
import Screen from "@/components/screen";
import {
  useRequestDeletionOTP,
  useSubmitAccountDeletionRequest,
} from "@/features/account-deletion/account-deletion.hooks";
import type { AccountDeletionResponse } from "@/features/account-deletion/account-deletion.types";

const DPO_EMAIL = "inquiries@classify.com.ph";

type Step = "intro" | "otp";

const DeleteAccountScreen = () => {
  const [step, setStep] = useState<Step>("intro");
  const [reason, setReason] = useState("");
  const [otp, setOtp] = useState("");
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const otpMutation = useRequestDeletionOTP();
  const submitMutation = useSubmitAccountDeletionRequest();

  const sendCode = () => {
    setIsConfirmOpen(false);
    setOtp("");
    submitMutation.reset();
    otpMutation.mutate(undefined, {
      onSuccess: () => setStep("otp"),
    });
  };

  const handleConfirmOpenChange = (next: boolean) => {
    if (otpMutation.isPending) return;
    setIsConfirmOpen(next);
  };

  const handleSubmitOtp = () => {
    submitMutation.mutate({ otp: otp.trim(), reason: reason.trim() || undefined });
  };

  if (submitMutation.data?.httpStatus === 201) {
    return <SuccessState response={submitMutation.data.response} />;
  }
  if (submitMutation.data?.httpStatus === 200) {
    return <AlreadyPendingState response={submitMutation.data.response} />;
  }

  if (step === "otp") {
    return (
      <Screen>
        <KeyboardAwareScrollView
          style={{ flex: 1 }}
          bottomOffset={24}
          contentContainerStyle={{ paddingVertical: 12 }}
        >
          <View className="p-3 gap-4 mx-auto w-full max-w-3xl">
            <Card className="shadow-none rounded-xl">
              <Card.Body className="gap-3">
                <AppText weight="bold" className="text-lg">
                  Confirm Deletion
                </AppText>
                <AppText className="text-sm text-muted">
                  We sent a 6-digit code to your email. Enter it below to
                  confirm your deletion request. The code expires in 10 minutes.
                </AppText>
              </Card.Body>
            </Card>

            <Card className="shadow-none rounded-xl">
              <Card.Body className="gap-2">
                <AppText weight="semibold" className="text-sm">
                  Verification code
                </AppText>
                <AppInput
                  value={otp}
                  onChangeText={(value) =>
                    setOtp(value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="6-digit code"
                  keyboardType="number-pad"
                  maxLength={6}
                  autoFocus
                />
              </Card.Body>
            </Card>

            {submitMutation.isError ? (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Couldn't confirm your code</Alert.Title>
                  <Alert.Description>
                    Double-check the code or request a new one. Codes expire
                    after 10 minutes.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}

            {otpMutation.isError ? (
              <Alert status="danger">
                <Alert.Indicator />
                <Alert.Content>
                  <Alert.Title>Couldn't send a new code</Alert.Title>
                  <Alert.Description>
                    Wait a moment before retrying, or email {DPO_EMAIL}.
                  </Alert.Description>
                </Alert.Content>
              </Alert>
            ) : null}

            <Button
              variant="danger"
              isDisabled={otp.length !== 6 || submitMutation.isPending}
              onPress={handleSubmitOtp}
            >
              <Button.Label>
                {submitMutation.isPending ? "Confirming…" : "Confirm Deletion"}
              </Button.Label>
            </Button>

            <Button
              variant="ghost"
              isDisabled={otpMutation.isPending}
              onPress={sendCode}
            >
              <Button.Label className="text-muted">
                {otpMutation.isPending ? "Sending…" : "Resend code"}
              </Button.Label>
            </Button>

            <Button
              variant="ghost"
              onPress={() => {
                setStep("intro");
                setOtp("");
                submitMutation.reset();
                otpMutation.reset();
              }}
              isDisabled={submitMutation.isPending || otpMutation.isPending}
            >
              <Button.Label className="text-muted">Back</Button.Label>
            </Button>
          </View>
        </KeyboardAwareScrollView>
      </Screen>
    );
  }

  // step === "intro"
  return (
    <Screen>
      <KeyboardAwareScrollView
        style={{ flex: 1 }}
        bottomOffset={24}
        contentContainerStyle={{ paddingVertical: 12 }}
      >
        <View className="p-3 gap-4 mx-auto w-full max-w-3xl">
          <Card className="shadow-none rounded-xl">
            <Card.Body className="gap-3">
              <AppText className="text-sm text-muted">
                Submitting this request asks our Data Protection Officer to
                delete your Classedge account.
              </AppText>

              <Separator className="my-1" />

              <View className="gap-1">
                <AppText weight="semibold" className="text-sm">
                  What will be deleted
                </AppText>
                <AppText className="text-sm text-muted">
                  Your profile, credentials, gamification records, your chat
                  messages, notification preferences, and recent login history.
                </AppText>
              </View>

              <View className="gap-1">
                <AppText weight="semibold" className="text-sm">
                  What we may retain
                </AppText>
                <AppText className="text-sm text-muted">
                  Academic transcripts and grade history (controlled by your
                  school), legal-consent records, and operational audit logs.
                  See our Privacy Policy for full details.
                </AppText>
              </View>

              <View className="gap-1">
                <AppText weight="semibold" className="text-sm">
                  Timing
                </AppText>
                <AppText className="text-sm text-muted">
                  We acknowledge requests within 5 business days and aim to
                  complete deletion within 30 days. You'll continue using
                  Classedge normally until the request is processed.
                </AppText>
              </View>
            </Card.Body>
          </Card>

          <Card className="shadow-none rounded-xl">
            <Card.Body className="gap-2">
              <AppText weight="semibold" className="text-sm">
                Reason (optional)
              </AppText>
              <AppInput
                value={reason}
                onChangeText={setReason}
                placeholder="Help our DPO understand the context"
                multiline
                numberOfLines={4}
                maxLength={500}
                textAlignVertical="top"
              />
            </Card.Body>
          </Card>

          {otpMutation.isError ? (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>Couldn't send a confirmation code</Alert.Title>
                <Alert.Description>
                  Check your connection and try again, or email {DPO_EMAIL}.
                </Alert.Description>
              </Alert.Content>
            </Alert>
          ) : null}

          <Button
            variant="danger"
            isDisabled={otpMutation.isPending}
            onPress={() => setIsConfirmOpen(true)}
          >
            <Button.Label>
              {otpMutation.isPending ? "Sending…" : "Request Account Deletion"}
            </Button.Label>
          </Button>
        </View>
      </KeyboardAwareScrollView>

      <Dialog isOpen={isConfirmOpen} onOpenChange={handleConfirmOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay />
          <Dialog.Content className="w-full max-w-lg mx-auto">
            <View className="mb-5 gap-3">
              <Dialog.Title>Send confirmation code?</Dialog.Title>
              <Dialog.Description>
                We'll email a 6-digit code to your account address. Enter it on
                the next screen to confirm the deletion request. To cancel
                later, contact {DPO_EMAIL}.
              </Dialog.Description>
            </View>
            <View className="gap-2">
              <Button
                variant="danger"
                onPress={sendCode}
                isDisabled={otpMutation.isPending}
              >
                <Button.Label>Send Code</Button.Label>
              </Button>
              <Button
                variant="ghost"
                onPress={() => setIsConfirmOpen(false)}
                isDisabled={otpMutation.isPending}
              >
                <Button.Label>Cancel</Button.Label>
              </Button>
            </View>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog>
    </Screen>
  );
};

const SuccessState = ({ response }: { response: AccountDeletionResponse }) => {
  const submittedDate = new Date(response.submittedAt).toLocaleDateString();
  return (
    <Screen>
      <ScreenScrollView
        className="flex-1"
        contentContainerClassName="p-3 gap-4 mx-auto w-full max-w-3xl"
      >
        <Card className="shadow-none rounded-xl">
          <Card.Body className="gap-3">
            <AppText weight="bold" className="text-lg">
              Request Received
            </AppText>
            <AppText className="text-sm text-muted">
              We received your account deletion request. We aim to complete
              deletion within 30 days. We'll email you when it's done.
            </AppText>
            <AppText className="text-sm text-muted">
              To cancel before then, email{" "}
              <AppText weight="semibold" className="text-sm">
                {DPO_EMAIL}
              </AppText>
              .
            </AppText>
            <Separator className="my-1" />
            <View className="gap-1">
              <AppText className="text-xs text-muted">
                Request ID: {response.id}
              </AppText>
              <AppText className="text-xs text-muted">
                Submitted: {submittedDate}
              </AppText>
            </View>
          </Card.Body>
        </Card>
      </ScreenScrollView>
    </Screen>
  );
};

const AlreadyPendingState = ({
  response,
}: {
  response: AccountDeletionResponse;
}) => {
  const submittedDate = new Date(response.submittedAt).toLocaleDateString();
  return (
    <Screen>
      <ScreenScrollView
        className="flex-1"
        contentContainerClassName="p-3 gap-4 mx-auto w-full max-w-3xl"
      >
        <Card className="shadow-none rounded-xl">
          <Card.Body className="gap-3">
            <AppText weight="bold" className="text-lg">
              Request Already Submitted
            </AppText>
            <AppText className="text-sm text-muted">
              You submitted an account deletion request on {submittedDate}.
              We'll complete it within 30 days of that date.
            </AppText>
            <AppText className="text-sm text-muted">
              To cancel, email{" "}
              <AppText weight="semibold" className="text-sm">
                {DPO_EMAIL}
              </AppText>
              .
            </AppText>
            <Separator className="my-1" />
            <AppText className="text-xs text-muted">
              Request ID: {response.id}
            </AppText>
          </Card.Body>
        </Card>
      </ScreenScrollView>
    </Screen>
  );
};

export default DeleteAccountScreen;
