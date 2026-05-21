import { redirect } from "next/navigation";
import { ForgotPasswordForm } from "@/components/password-reset-forms";
import { getCurrentUser } from "@/lib/auth";

export const metadata = {
  title: "Forgot Password | LaunchRadar",
};

export default async function ForgotPasswordPage() {
  const user = await getCurrentUser();

  if (user) {
    redirect("/dashboard");
  }

  return <ForgotPasswordForm />;
}
