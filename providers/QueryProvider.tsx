import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

const qc = new QueryClient();

const QueryProvider = ({ children }: { children: React.ReactNode }) => {
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

export default QueryProvider;
