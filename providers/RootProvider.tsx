import HeroUIProvider from "./HeroUIProvider";
import KeyboardProvider from "./KeyboardProvider";
import PowerSyncProvider from "./PowerSyncProvider";
import QueryProvider from "./QueryProvider";

const RootProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <PowerSyncProvider>
      <QueryProvider>
        <HeroUIProvider>
          <KeyboardProvider>{children}</KeyboardProvider>
        </HeroUIProvider>
      </QueryProvider>
    </PowerSyncProvider>
  );
};

export default RootProvider;
