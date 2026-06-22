import MailSent from "@/assets/illustrations/forgot-password/mail-sent.svg";
import { AppText } from "@/components/AppText";
import AuthIllustrationLayout from "@/components/AuthIllustrationLayout";
import OTPVerificationForm from "@/features/auth/components/OTPVerificationForm";
import useStore from "@/lib/store";

const OTPVerificationScreen = () => {
  const email = useStore((s) => s.email);

  return (
    <AuthIllustrationLayout
      Illustration={MailSent}
      title="Please check your email"
      description={
        <>
          We&apos;ve sent a 6-digit verification code to{" "}
          <AppText weight="semibold" className="text-foreground">
            {email}
          </AppText>
        </>
      }
      step={{ current: 2, total: 3 }}
    >
      <OTPVerificationForm />
    </AuthIllustrationLayout>
  );
};

export default OTPVerificationScreen;
