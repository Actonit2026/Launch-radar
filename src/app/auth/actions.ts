"use server";

import { headers } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getAppUrl } from "@/lib/app-url";
import { createClient } from "@/lib/supabase/server";
import {
  isSupabaseConfigured,
  supabaseConfigMessage,
} from "@/lib/supabase/config";

export type AuthState = {
  error?: string;
  message?: string;
};

function friendlyAuthError(message: string) {
  if (/invalid login credentials/i.test(message)) {
    return "That email and password combination was not recognized.";
  }

  if (/email not confirmed/i.test(message)) {
    return "Check your email and confirm your account before signing in.";
  }

  if (/password/i.test(message) && /weak|short/i.test(message)) {
    return "Use a stronger password before continuing.";
  }

  return message;
}

function readEmail(formData: FormData) {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email) {
    return { email, error: "Email is required." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { email, error: "Enter a valid email address." };
  }

  return { email };
}

function readCredentials(formData: FormData) {
  const emailResult = readEmail(formData);
  const password = String(formData.get("password") ?? "");

  if (emailResult.error) {
    return { email: emailResult.email, password, error: emailResult.error };
  }

  if (!password) {
    return { email: emailResult.email, password, error: "Password is required." };
  }

  if (password.length < 6) {
    return {
      email: emailResult.email,
      password,
      error: "Password must be at least 6 characters.",
    };
  }

  return { email: emailResult.email, password };
}

function readNewPassword(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!password || !confirmPassword) {
    return { error: "Enter and confirm your new password." };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  return { password };
}

export async function signInAction(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured()) {
    return { error: supabaseConfigMessage };
  }

  const credentials = readCredentials(formData);

  if (credentials.error) {
    return { error: credentials.error };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signUpAction(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured()) {
    return { error: supabaseConfigMessage };
  }

  const credentials = readCredentials(formData);

  if (credentials.error) {
    return { error: credentials.error };
  }

  const requestHeaders = await headers();
  const appUrl = getAppUrl(requestHeaders);

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: credentials.email,
    password: credentials.password,
    options: {
      emailRedirectTo: `${appUrl}/auth/confirm?next=/dashboard/onboarding`,
    },
  });

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  if (data.session) {
    revalidatePath("/", "layout");
    redirect("/dashboard/onboarding");
  }

  return {
    message: "Check your email to confirm your account.",
  };
}

export async function requestPasswordResetAction(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured()) {
    return { error: supabaseConfigMessage };
  }

  const emailResult = readEmail(formData);

  if (emailResult.error) {
    return { error: emailResult.error };
  }

  const requestHeaders = await headers();
  const appUrl = getAppUrl(requestHeaders);
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    emailResult.email,
    {
      redirectTo: `${appUrl}/auth/confirm?next=/reset-password`,
    },
  );

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  return {
    message: "Check your email for a secure password reset link.",
  };
}

export async function resetPasswordAction(
  _previousState: AuthState,
  formData: FormData,
): Promise<AuthState> {
  if (!isSupabaseConfigured()) {
    return { error: supabaseConfigMessage };
  }

  const passwordResult = readNewPassword(formData);

  if (passwordResult.error) {
    return { error: passwordResult.error };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return {
      error:
        "Your reset link is invalid or expired. Request a new password reset email.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: passwordResult.password,
  });

  if (error) {
    return { error: friendlyAuthError(error.message) };
  }

  revalidatePath("/", "layout");
  redirect("/dashboard");
}

export async function signOutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }

  revalidatePath("/", "layout");
  redirect("/login");
}
