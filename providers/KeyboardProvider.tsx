import {
  KeyboardProvider,
  KeyboardToolbar,
} from "react-native-keyboard-controller";

export default ({ children }: { children: React.ReactNode }) => (
  <KeyboardProvider>
    {children}
    <KeyboardToolbar />
  </KeyboardProvider>
);
