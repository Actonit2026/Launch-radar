"use server";

import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth";
import { ensureUserProfile } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";
import {
  isSupabaseConfigured,
  supabaseConfigMessage,
} from "@/lib/supabase/config";
import { canRunProductScan, recordUsageEvent } from "@/lib/usage";
import { analyzeUserProduct } from "@/lib/user-products";
import { parseCompetitorUrl } from "@/lib/urls";

export type UserProductFormState = {
  error?: string;
  message?: string;
};

type ParsedProductForm =
  | {
      name: string;
      baseUrl: string;
      submittedPageUrl?: string;
      error?: never;
    }
  | {
      error: string;
      name?: never;
      baseUrl?: never;
      submittedPageUrl?: never;
    };

function readProductForm(formData: FormData): ParsedProductForm {
  const rawName = String(formData.get("name") ?? "").trim();
  const rawUrl = String(formData.get("baseUrl") ?? "").trim();

  if (!rawUrl) {
    return { error: "Product URL is required." };
  }

  try {
    const parsedUrl = parseCompetitorUrl(rawUrl);
    const hostname = new URL(parsedUrl.baseUrl).hostname.replace(/^www\./, "");

    return {
      name: rawName || hostname,
      baseUrl: parsedUrl.baseUrl,
      submittedPageUrl: parsedUrl.submittedPageUrl,
    };
  } catch {
    return { error: "Enter a valid product website URL." };
  }
}

async function getOwnedProduct(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  productId: string,
) {
  const { data: product, error } = await supabase
    .from("user_products")
    .select("id, name, base_url")
    .eq("id", productId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    return { product: null, error: error.message };
  }

  if (!product) {
    return { product: null, error: "Product not found." };
  }

  return { product, error: null };
}

export async function saveUserProductAction(
  _previousState: UserProductFormState,
  formData: FormData,
): Promise<UserProductFormState> {
  if (!isSupabaseConfigured()) {
    return { error: supabaseConfigMessage };
  }

  const user = await getCurrentUser();

  if (!user) {
    return { error: "Sign in before analyzing your product." };
  }

  const parsed = readProductForm(formData);

  if ("error" in parsed) {
    return { error: parsed.error };
  }

  const supabase = await createClient();
  const profileError = await ensureUserProfile(supabase, user);

  if (profileError) {
    return { error: profileError };
  }

  const { data: existingProduct, error: existingError } = await supabase
    .from("user_products")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  if (existingError) {
    return { error: existingError.message };
  }

  if (existingProduct) {
    const guard = await canRunProductScan({
      supabase,
      userId: user.id,
    });

    if (!guard.allowed) {
      return { error: guard.reason ?? "Product analysis limit reached." };
    }
  }

  const mutation = existingProduct
    ? supabase
        .from("user_products")
        .update({
          name: parsed.name,
          base_url: parsed.baseUrl,
          scan_status: "pending" as const,
          error_message: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", existingProduct.id)
        .eq("user_id", user.id)
        .select("id")
        .single()
    : supabase
        .from("user_products")
        .insert({
          user_id: user.id,
          name: parsed.name,
          base_url: parsed.baseUrl,
        })
        .select("id")
        .single();

  const { data: product, error: productError } = await mutation;

  if (productError) {
    return { error: productError.message };
  }

  const analysis = await analyzeUserProduct({
    supabase,
    userId: user.id,
    productId: product.id,
    productName: parsed.name,
    baseUrl: parsed.baseUrl,
    submittedPageUrl: parsed.submittedPageUrl,
  });

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/your-product");

  if (analysis.error) {
    return { error: analysis.error };
  }

  if (!existingProduct) {
    await recordUsageEvent({
      supabase,
      userId: user.id,
      eventType: "first_product_added",
      metadata: {
        product_id: product.id,
      },
    });
  }

  return {
    message: `Analyzed ${parsed.name}. ${
      analysis.data?.pagesAnalyzed ?? 0
    } pages reviewed, ${
      analysis.data?.recommendationsCreated ?? 0
    } strong recommendations created.`,
  };
}

export async function rerunUserProductAction(
  _previousState: UserProductFormState,
  formData: FormData,
): Promise<UserProductFormState> {
  if (!isSupabaseConfigured()) {
    return { error: supabaseConfigMessage };
  }

  const user = await getCurrentUser();

  if (!user) {
    return { error: "Sign in before re-running product analysis." };
  }

  const productId = String(formData.get("productId") ?? "");

  if (!productId) {
    return { error: "Product is required." };
  }

  const supabase = await createClient();
  const { product, error } = await getOwnedProduct(supabase, user.id, productId);

  if (error || !product) {
    return { error: error ?? "Product not found." };
  }

  const guard = await canRunProductScan({
    supabase,
    userId: user.id,
  });

  if (!guard.allowed) {
    return { error: guard.reason ?? "Product analysis limit reached." };
  }

  const analysis = await analyzeUserProduct({
    supabase,
    userId: user.id,
    productId: product.id,
    productName: product.name,
    baseUrl: product.base_url,
  });

  revalidatePath("/dashboard/your-product");

  if (analysis.error) {
    return { error: analysis.error };
  }

  return {
    message: `Re-ran analysis. ${
      analysis.data?.pagesAnalyzed ?? 0
    } pages reviewed, ${
      analysis.data?.recommendationsCreated ?? 0
    } strong recommendations created.`,
  };
}

export async function saveRecommendationFeedbackAction(formData: FormData) {
  if (!isSupabaseConfigured()) {
    return;
  }

  const user = await getCurrentUser();

  if (!user) {
    return;
  }

  const recommendationId = String(formData.get("recommendationId") ?? "");
  const feedback = String(formData.get("feedback") ?? "");
  const allowedFeedback = new Set([
    "useful",
    "not_useful",
    "already_knew",
    "implemented",
    "saved",
    "rejected",
    "hidden",
    "resolved",
  ]);

  if (!recommendationId || !allowedFeedback.has(feedback)) {
    return;
  }

  const supabase = await createClient();

  const { error } = await supabase.from("recommendation_feedback").upsert(
    {
      recommendation_id: recommendationId,
      user_id: user.id,
      feedback: feedback as
        | "useful"
        | "not_useful"
        | "already_knew"
        | "implemented"
        | "saved"
        | "rejected"
        | "hidden"
        | "resolved",
    },
    { onConflict: "recommendation_id,user_id" },
  );

  if (!error) {
    await recordUsageEvent({
      supabase,
      userId: user.id,
      eventType: "recommendation_feedback",
      metadata: {
        recommendation_id: recommendationId,
        feedback,
      },
    });
  }

  revalidatePath("/dashboard/your-product");
}
