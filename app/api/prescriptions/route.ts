import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { prescriptionFormSchema } from "@/schemas/prescription";

// ── GET /api/prescriptions ────────────────────────────────────────────────────
// DOCTOR → their issued prescriptions
// PATIENT → their received prescriptions
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (session.user.role === "DOCTOR") {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!doctor) {
      return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
    }

    const prescriptions = await prisma.prescription.findMany({
      where: { doctorId: doctor.id },
      select: {
        id: true,
        diagnosis: true,
        medications: true,
        issuedAt: true,
        validUntil: true,
        patient: {
          select: { user: { select: { name: true, phone: true } } },
        },
      },
      orderBy: { issuedAt: "desc" },
    });
    return NextResponse.json(prescriptions);
  }

  if (session.user.role === "PATIENT") {
    const patient = await prisma.patient.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!patient) {
      return NextResponse.json({ error: "Patient not found" }, { status: 404 });
    }

    const prescriptions = await prisma.prescription.findMany({
      where: { patientId: patient.id },
      select: {
        id: true,
        diagnosis: true,
        medications: true,
        notes: true,
        issuedAt: true,
        validUntil: true,
        doctor: {
          select: {
            specialization: true,
            user: { select: { name: true } },
          },
        },
      },
      orderBy: { issuedAt: "desc" },
    });
    return NextResponse.json(prescriptions);
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

// ── POST /api/prescriptions ───────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "DOCTOR") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: session.user.id },
    select: { id: true },
  });
  if (!doctor) {
    return NextResponse.json({ error: "Doctor not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = prescriptionFormSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { patientId, diagnosis, medications, notes, validUntil } = parsed.data;

  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: { id: true },
  });
  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const prescription = await prisma.prescription.create({
    data: {
      patientId,
      doctorId: doctor.id,
      diagnosis,
      medications,
      notes: notes || null,
      validUntil: validUntil ? new Date(validUntil) : null,
    },
  });

  return NextResponse.json(prescription, { status: 201 });
}
