"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";

export interface DoctorResult {
  id: string;
  specialization: string;
  qualifications: string[];
  experienceYears: number;
  consultationFee: string; // Decimal serialized as string
  bio: string | null;
  city: string | null;
  state: string | null;
  isVerified: boolean;
  isAvailable: boolean;
  user: { name: string | null; image: string | null };
  clinics: Array<{
    schedule: Record<string, Array<{ start: string; end: string }>> | null;
    clinic: { name: string; city: string };
  }>;
}

export interface DoctorFilters {
  search: string;
  specialization: string;
  city: string;
}

export function useDoctors(filters: DoctorFilters) {
  return useQuery({
    queryKey: ["doctors", filters],
    queryFn: async () => {
      const sp = new URLSearchParams();
      if (filters.search) sp.set("search", filters.search);
      if (filters.specialization) sp.set("specialization", filters.specialization);
      if (filters.city) sp.set("city", filters.city);

      const { data } = await axios.get<{ doctors: DoctorResult[] }>(
        `/api/doctors?${sp.toString()}`
      );
      return data.doctors;
    },
  });
}
