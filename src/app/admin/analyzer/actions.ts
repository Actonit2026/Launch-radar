"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import {
  refreshHomepageDemoExampleByName,
  refreshHomepageDemoExamples,
} from "@/lib/demo-examples";
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
  revalidatePath("/admin/demo-examples");
}

export async function refreshOneDemoExampleAction(formData: FormData) {
  const user = await getCurrentUser();

  if (!user) {
    redirect("/login");
  }

  if (!isMasterAdminEmail(user.email)) {
    redirect("/dashboard");
  }

  const name = String(formData.get("name") ?? "").trim();

  if (!name) {
    return;
  }

  await refreshHomepageDemoExampleByName(name);

  revalidatePath("/");
  revalidatePath("/admin/analyzer");
  revalidatePath("/admin/demo-examples");
}
