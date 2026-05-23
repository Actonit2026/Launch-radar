"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { refreshHomepageDemoExamples } from "@/lib/demo-examples";
import { isMasterAdminEmail } from "@/lib/master-admin";

export async function refreshDemoExamplesAction() {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!isMasterAdminEmail(user.email)) {
    redirect("/dashboard");
  }

  await refreshHomepageDemoExamples();

  revalidatePath("/");
  revalidatePath("/admin/analyzer");
}
