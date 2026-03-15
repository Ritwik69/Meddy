import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import MarketplacePage from "@/components/dashboard/MarketplacePage";

export default async function DoctorMarketplace() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "DOCTOR") redirect("/login");

  return (
    <MarketplacePage
      role="DOCTOR"
      userName={session.user.name ?? ""}
      bookHref={(roomId) => `/doctor/rooms/book/${roomId}`}
    />
  );
}
