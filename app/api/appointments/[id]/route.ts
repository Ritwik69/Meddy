import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const patchSchema = z.object({
  status: z.enum(["CONFIRMED", "CANCELLED", "COMPLETED", "NO_SHOW"]),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const appt = await prisma.appointment.findUnique({ where: { id } });
  if (!appt) {
    return NextResponse.json({ error: "Appointment not found" }, { status: 404 });
  }

  if (session.user.role === "DOCTOR") {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!doctor || appt.doctorId !== doctor.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  } else if (session.user.role === "PATIENT") {
    const patient = await prisma.patient.findUnique({
      where: { userId: session.user.id },
      select: { id: true },
    });
    if (!patient || appt.patientId !== patient.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    // Patients may only cancel
    if (parsed.data.status !== "CANCELLED") {
      return NextResponse.json(
        { error: "Patients can only cancel appointments" },
        { status: 403 }
      );
    }
  } else {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const updated = await prisma.appointment.update({
    where: { id },
    data: { status: parsed.data.status },
    select: { id: true, status: true },
  });

  return NextResponse.json(updated);
}
