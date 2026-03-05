import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { getRestaurantsByOwner, initDB } from "@/lib/db";

export default async function Home() {
  const session = await auth();

  if (!session?.user?.email) {
    redirect("/login");
  }

  await initDB();
  const restaurants = await getRestaurantsByOwner(session.user.email);

  if (restaurants.length > 0) {
    redirect(`/r/${restaurants[0].slug}`);
  }

  redirect("/onboarding");
}
