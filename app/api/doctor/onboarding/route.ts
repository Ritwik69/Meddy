import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { onboardingApiSchema } from "@/schemas/doctor";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "DOCTOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = onboardingApiSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const {
    specialization,
    registrationNo,
    experienceYears,
    consultationFee,
    bio,
    clinicName,
    address,
    city,
    state,
    pincode,
    phone,
    clinicType,
    schedule,
  } = parsed.data;

  // Check registration number uniqueness (exclude this doctor's own placeholder)
  const existing = await prisma.doctor.findFirst({
    where: {
      registrationNo,
      NOT: { userId: session.user.id },
    },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "This registration number is already in use" },
      { status: 409 }
    );
  }

  // Convert schedule to DoctorClinic format: { mon: [{start, end}], ... }
  const doctorClinicSchedule: Record<string, { start: string; end: string }[]> = {};
  for (const [day, slot] of Object.entries(schedule)) {
    if (slot.enabled) {
      doctorClinicSchedule[day] = [{ start: slot.start, end: slot.end }];
    }
  }

  await prisma.$transaction(async (tx) => {
    // Update doctor profile
    await tx.doctor.update({
      where: { userId: session.user.id },
      data: {
        registrationNo,
        specialization,
        experienceYears,
        consultationFee,
        bio: bio?.trim() || null,
        city,
        state,
      },
    });

    // Get the doctor's id for the join table
    const doctor = await tx.doctor.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!doctor) throw new Error("Doctor record not found");

    // Create the clinic
    const clinic = await tx.clinic.create({
      data: {
        name: clinicName,
        registrationNo: `AUTO-${doctor.id}-${Date.now()}`,
        type: clinicType,
        address,
        city,
        state,
        pincode,
        phone,
        isActive: true,
        isVerified: false,
      },
    });

    // Link doctor ↔ clinic with schedule
    await tx.doctorClinic.create({
      data: {
        doctorId: doctor.id,
        clinicId: clinic.id,
        schedule: doctorClinicSchedule,
      },
    });
  });

  return NextResponse.json({ success: true });
}
