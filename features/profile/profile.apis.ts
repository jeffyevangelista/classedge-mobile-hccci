import api from "@/lib/axios";
import { FinancialRecordResponse } from "./profile.types";

export const getFinancialInformation =
  async (): Promise<FinancialRecordResponse> => {
    return (await api.get<FinancialRecordResponse>("/finances/")).data;
  };
