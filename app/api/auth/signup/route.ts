import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signupSchema } from "@/schemas/auth";
import type { PrismaClient } from "@/app/generated/prisma/client";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = signupSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Invalid input";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { name, email, phone, password, role } = parsed.data;

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { phone }] },
      select: { id: true, email: true, phone: true },
    });

    if (existing) {
      const field = existing.email === email ? "email" : "phone number";
      return NextResponse.json(
        { error: `This ${field} is already registered` },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    type TxClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;
    const user = await prisma.$transaction(async (tx: TxClient) => {
      const newUser = await tx.user.create({
        data: { name, email, phone, password: hashedPassword, role },
      });

      if (role === "PATIENT") {
        await tx.patient.create({ data: { userId: newUser.id } });
      } else if (role === "DOCTOR") {
        await tx.doctor.create({
          data: {
            userId: newUser.id,
            registrationNo: `PENDING-${newUser.id}`,
            specialization: "General",
            consultationFee: 500,
            experienceYears: 0,
            qualifications: [],
            languages: ["English", "Hindi"],
          },
        });
      }

      return newUser;
    });

    return NextResponse.json({ id: user.id }, { status: 201 });
  } catch (error) {
    console.error("[SIGNUP]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
