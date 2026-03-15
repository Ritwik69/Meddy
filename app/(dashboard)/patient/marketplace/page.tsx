import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import MarketplacePage from "@/components/dashboard/MarketplacePage";

export default async function PatientMarketplace() {
  const session = await getServerSession(authOptions);
  if (!session || session.user.role !== "PATIENT") redirect("/login");

  return (
    <MarketplacePage
      role="PATIENT"
      userName={session.user.name ?? ""}
      bookHref={() => "#"}
    />
  );
}
