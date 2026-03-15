import { z } from "zod";

// ─── Constants (shared with the page) ─────────────────────

export const SPECIALTIES = [
  "Cardiology",
  "Dermatology",
  "Endocrinology",
  "ENT",
  "Gastroenterology",
  "General Medicine",
  "General Surgery",
  "Gynecology",
  "Nephrology",
  "Neurology",
  "Oncology",
  "Ophthalmology",
  "Orthopedics",
  "Pediatrics",
  "Psychiatry",
  "Pulmonology",
  "Radiology",
  "Rheumatology",
  "Urology",
] as const;

export const CLINIC_TYPES = [
  { value: "hospital",          label: "Hospital" },
  { value: "clinic",            label: "Private Clinic" },
  { value: "polyclinic",        label: "Polyclinic" },
  { value: "diagnostic_center", label: "Diagnostic Center" },
  { value: "pharmacy",          label: "Pharmacy" },
] as const;

export type ClinicTypeValue = (typeof CLINIC_TYPES)[number]["value"];

// ─── Step 1 – Basic info ───────────────────────────────────

export const step1Schema = z.object({
  specialization: z.string().min(1, "Please select a specialty"),
  registrationNo: z
    .string()
    .min(3, "Enter your medical registration number")
    .max(50, "Registration number too long"),
  experienceYears: z.coerce
    .number({ error: "Enter years of experience" })
    .int()
    .min(0, "Cannot be negative")
    .max(70, "Please enter a valid value"),
  consultationFee: z.coerce
    .number({ error: "Enter consultation fee" })
    .positive("Fee must be greater than 0")
    .max(100_000, "Fee seems too high"),
  bio: z
    .string()
    .max(500, "Bio must be under 500 characters")
    .optional(),
});

export type Step1Data = z.infer<typeof step1Schema>;

// ─── Step 2 – Clinic form fields (schedule managed separately) ─

export const step2FormSchema = z.object({
  clinicName: z.string().min(2, "Enter clinic name"),
  address: z.string().min(5, "Enter full address"),
  city: z.string().min(2, "Enter city"),
  state: z.string().min(2, "Enter state"),
  pincode: z
    .string()
    .regex(/^\d{6}$/, "Enter a valid 6-digit pincode"),
  phone: z
    .string()
    .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit phone number"),
  clinicType: z.enum(
    ["hospital", "clinic", "polyclinic", "diagnostic_center", "pharmacy"] as const
  ),
});

export type Step2FormData = z.infer<typeof step2FormSchema>;

// ─── Day schedule sub-schema ───────────────────────────────

export const dayScheduleSchema = z.object({
  enabled: z.boolean(),
  start:   z.string().regex(/^\d{2}:\d{2}$/),
  end:     z.string().regex(/^\d{2}:\d{2}$/),
});

export type DaySchedule = z.infer<typeof dayScheduleSchema>;

export type WeekSchedule = {
  mon: DaySchedule;
  tue: DaySchedule;
  wed: DaySchedule;
  thu: DaySchedule;
  fri: DaySchedule;
  sat: DaySchedule;
  sun: DaySchedule;
};

// ─── Full API schema (Step 1 + Step 2 + schedule) ─────────

const weekScheduleSchema = z.object({
  mon: dayScheduleSchema,
  tue: dayScheduleSchema,
  wed: dayScheduleSchema,
  thu: dayScheduleSchema,
  fri: dayScheduleSchema,
  sat: dayScheduleSchema,
  sun: dayScheduleSchema,
});

export const onboardingApiSchema = z.object({
  // Step 1
  specialization:   z.string().min(1),
  registrationNo:   z.string().min(3).max(50),
  experienceYears:  z.coerce.number().int().min(0).max(70),
  consultationFee:  z.coerce.number().positive().max(100_000),
  bio:              z.string().max(500).optional(),
  // Step 2 – clinic
  clinicName:  z.string().min(2),
  address:     z.string().min(5),
  city:        z.string().min(2),
  state:       z.string().min(2),
  pincode:     z.string().regex(/^\d{6}$/),
  phone:       z.string().regex(/^[6-9]\d{9}$/),
  clinicType:  z.enum(
    ["hospital", "clinic", "polyclinic", "diagnostic_center", "pharmacy"] as const
  ),
  schedule: weekScheduleSchema,
});

export type OnboardingApiData = z.infer<typeof onboardingApiSchema>;
