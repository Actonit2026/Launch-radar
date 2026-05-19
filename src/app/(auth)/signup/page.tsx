import { AuthForm } from "@/components/auth-form";

export const metadata = {
  title: "Sign Up | LaunchRadar",
};

export default function SignUpPage() {
  return <AuthForm mode="signup" />;
}
