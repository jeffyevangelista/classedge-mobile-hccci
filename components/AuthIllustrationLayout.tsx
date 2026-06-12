import { StyleSheet, useWindowDimensions, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { SvgProps } from "react-native-svg";
import { MotiView } from "moti";
import { AppText } from "@/components/AppText";

type Step = { current: number; total: number };

type Props = {
  Illustration: React.FC<SvgProps>;
  title: string;
  description?: React.ReactNode;
  children: React.ReactNode;
  step?: Step;
  animateIllustration?: boolean;
};

const ILLUSTRATION_MAX_HEIGHT = 170;
const ILLUSTRATION_WIDTH_RATIO = 0.55;
const ILLUSTRATION_HEIGHT_RATIO = 0.18;

export default function AuthIllustrationLayout({
  Illustration,
  title,
  description,
  children,
  step,
  animateIllustration,
}: Props) {
  const { height, width } = useWindowDimensions();
  const verticalPadding = height > 800 ? 64 : 32;
  const illustrationHeight = Math.min(
    height * ILLUSTRATION_HEIGHT_RATIO,
    ILLUSTRATION_MAX_HEIGHT,
  );
  const illustrationWidth = width * ILLUSTRATION_WIDTH_RATIO;

  const illustration = (
    <Illustration
      width={illustrationWidth}
      height={illustrationHeight}
      style={styles.image}
    />
  );

  return (
    <KeyboardAwareScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{
        flexGrow: 1,
        alignItems: "center",
        justifyContent: "flex-start",
        paddingHorizontal: 24,
        paddingTop: verticalPadding,
        paddingBottom: verticalPadding / 2,
      }}
      className="bg-background"
      keyboardShouldPersistTaps="handled"
    >
      {step && <StepIndicator current={step.current} total={step.total} />}
      {animateIllustration ? (
        <MotiView
          from={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", damping: 14 }}
        >
          {illustration}
        </MotiView>
      ) : (
        illustration
      )}
      <AppText
        className="text-center text-2xl text-foreground mb-2"
        weight="semibold"
      >
        {title}
      </AppText>
      {description !== undefined && (
        <AppText className="text-center text-muted mb-8">
          {description}
        </AppText>
      )}
      {children}
    </KeyboardAwareScrollView>
  );
}

const StepIndicator = ({ current, total }: Step) => (
  <View className="flex-row justify-center items-center gap-1.5 mb-6">
    {Array.from({ length: total }).map((_, i) => {
      const stepNum = i + 1;
      const isActive = stepNum === current;
      const isPast = stepNum < current;
      return (
        <View
          key={i}
          className={
            isActive
              ? "w-6 h-1.5 rounded-full bg-accent"
              : isPast
                ? "w-1.5 h-1.5 rounded-full bg-accent"
                : "w-1.5 h-1.5 rounded-full bg-muted/40"
          }
        />
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  image: { marginBottom: 32 },
});
