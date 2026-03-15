import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

/**
 * Central role-based router.
 * Login page redirects to /dashboard; this page forwards to the
 * correct destination based on role + onboarding status.
 */
export default async function DashboardRouter() {
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect("/login");
  }

  if (session.user.role === "PATIENT") {
    redirect("/patient/dashboard");
  }

  if (session.user.role === "DOCTOR") {
    const doctor = await prisma.doctor.findUnique({
      where: { userId: session.user.id },
      select: { registrationNo: true },
    });

    const isOnboarded =
      doctor && !doctor.registrationNo.startsWith("PENDING-");

    redirect(isOnboarded ? "/doctor/dashboard" : "/doctor/onboarding");
  }

  if (session.user.role === "ADMIN" || session.user.role === "CLINIC_ADMIN") {
    redirect("/admin/dashboard");
  }

  redirect("/login");
}
