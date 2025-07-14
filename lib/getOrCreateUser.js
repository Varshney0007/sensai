import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";

export async function getOrCreateUser() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  // Try to find user by clerkUserId
  let user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (user) return user;

  // Fetch Clerk user data from Clerk API
  const response = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
    headers: {
      Authorization: `Bearer ${process.env.CLERK_SECRET_KEY}`,
    },
  });

  if (!response.ok) {
    console.error("Failed to fetch user from Clerk");
    throw new Error("User not found");
  }

  const clerkUser = await response.json();
  const email = clerkUser.email_addresses[0].email_address;
  const name = `${clerkUser.first_name ?? ""} ${clerkUser.last_name ?? ""}`.trim();

  // Try to find user by email
  const existingByEmail = await db.user.findUnique({ where: { email } });

  if (existingByEmail) {
    // Update with clerkUserId and return
    return await db.user.update({
      where: { email },
      data: { clerkUserId: userId },
    });
  }

  // Otherwise, create a new user
  return await db.user.create({
    data: {
      clerkUserId: userId,
      email,
      name,
    },
  });
}
