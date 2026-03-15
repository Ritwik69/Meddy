import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const prescription = await prisma.prescription.findUnique({
    where: { id },
    select: {
      id: true,
      diagnosis: true,
      medications: true,
      notes: true,
      issuedAt: true,
      validUntil: true,
      patient: {
        select: { user: { select: { name: true, phone: true } } },
      },
      doctor: {
        select: {
          specialization: true,
          user: { select: { name: true } },
        },
      },
    },
  });

  if (!prescription) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Verify access: only the linked doctor or patient can view
  if (session.user.role === "DOCTOR") {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    const full = await prisma.prescription.findUnique({
      where: { id },
      select: { doctorId: true },
    });
    if (!doctor || full?.doctorId !== doctor.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (session.user.role === "PATIENT") {
    const patient = await prisma.patient.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    const full = await prisma.prescription.findUnique({
      where: { id },
      select: { patientId: true },
    });
    if (!patient || full?.patientId !== patient.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json(prescription);
}
