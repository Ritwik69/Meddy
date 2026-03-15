import { z } from "zod";

export const FREQUENCIES = ["Morning", "Afternoon", "Night"] as const;
export type Frequency = (typeof FREQUENCIES)[number];

export const medicationSchema = z.object({
  name: z.string().min(1, "Medicine name is required"),
  dosage: z.string().min(1, "Dosage is required"),
  frequency: z
    .array(z.enum(FREQUENCIES))
    .min(1, "Select at least one frequency"),
  duration: z.string().min(1, "Duration is required"),
  instructions: z.string().optional(),
});

export const prescriptionFormSchema = z.object({
  patientId: z.string().min(1, "Patient is required"),
  diagnosis: z.string().min(1, "Diagnosis is required"),
  medications: z.array(medicationSchema).min(1, "Add at least one medication"),
  notes: z.string().optional(),
  validUntil: z.string().optional(),
});

export type PrescriptionFormValues = z.infer<typeof prescriptionFormSchema>;
export type MedicationValues = z.infer<typeof medicationSchema>;
