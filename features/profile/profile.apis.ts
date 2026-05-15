import api from "@/lib/axios";
import {
  AcademicRecordsResponse,
  AcademicTermItem,
  FinancialRecordResponse,
} from "./profile.types";

export const getFinancialInformation =
  async (): Promise<FinancialRecordResponse> => {
    return (await api.get<FinancialRecordResponse>("/finances/")).data;
  };

export const getAcademicRecords = async (): Promise<AcademicRecordsResponse> => {
  return (await api.get<AcademicRecordsResponse>("/academic-records/")).data;
};

export const getAcademicTerms = async (): Promise<AcademicTermItem[]> => {
  return (await api.get<AcademicTermItem[]>("/academic-terms/")).data;
};
