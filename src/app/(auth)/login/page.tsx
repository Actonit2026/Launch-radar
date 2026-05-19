import { AuthForm } from "@/components/auth-form";

export const metadata = {
  title: "Sign In | LaunchRadar",
};

type LoginPageProps = {
  searchParams?: Promise<{
    message?: string;
  }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const params = await searchParams;

  return <AuthForm mode="signin" notice={params?.message} />;
}
