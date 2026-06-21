import api from "@/lib/axios";
import {
  AcademicRecordsResponse,
  AcademicTermItem,
  FinancialRecord,
} from "./profile.types";

export const getFinancialInformation = async (
  academicTermId?: number,
): Promise<FinancialRecord> => {
  const res = await api.get<FinancialRecord>("/finances/", {
    params:
      academicTermId !== undefined
        ? { academic_term_id: academicTermId }
        : undefined,
  });
  return res.data;
};

export const getAcademicRecords =
  async (): Promise<AcademicRecordsResponse> => {
    return (await api.get<AcademicRecordsResponse>("/academic-records/")).data;
  };

export const getAcademicTerms = async (): Promise<AcademicTermItem[]> => {
  return (await api.get<AcademicTermItem[]>("/academic-terms/")).data;
};
