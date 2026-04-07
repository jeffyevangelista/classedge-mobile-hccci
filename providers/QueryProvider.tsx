import { createMmkvPersister } from "@/lib/storage/mmkvPersister";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { DevToolsBubble } from "react-native-react-query-devtools";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1000 * 60 * 60 * 24, // 24 hours
      staleTime: 1000 * 60 * 5, // 5 minutes
    },
  },
});

const persister = createMmkvPersister();

const QueryProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister }}
    >
      {children}
      {__DEV__ && <DevToolsBubble queryClient={queryClient} />}
    </PersistQueryClientProvider>
  );
};

export default QueryProvider;
