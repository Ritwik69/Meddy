import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search")?.trim() ?? "";
  const specialization = searchParams.get("specialization")?.trim() ?? "";
  const city = searchParams.get("city")?.trim() ?? "";

  const doctors = await prisma.doctor.findMany({
    where: {
      isAvailable: true,
      ...(specialization
        ? {
            specialization: {
              equals: specialization,
              mode: "insensitive",
            },
          }
        : {}),
      ...(city
        ? { city: { contains: city, mode: "insensitive" } }
        : {}),
      ...(search
        ? {
            OR: [
              {
                specialization: {
                  contains: search,
                  mode: "insensitive",
                },
              },
              {
                user: {
                  name: { contains: search, mode: "insensitive" },
                },
              },
            ],
          }
        : {}),
    },
    include: {
      user: { select: { name: true, image: true } },
      clinics: {
        include: {
          clinic: { select: { name: true, city: true } },
        },
        take: 1,
      },
    },
    orderBy: [{ isVerified: "desc" }, { experienceYears: "desc" }],
    take: 30,
  });

  // Serialize Decimal fields to string so JSON.stringify doesn't throw
  const serialized = doctors.map((d) => ({
    ...d,
    consultationFee: d.consultationFee.toString(),
  }));

  return NextResponse.json({ doctors: serialized });
}
