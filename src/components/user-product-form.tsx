"use client";

import { useActionState, useEffect, useRef } from "react";
import {
  rerunUserProductAction,
  saveUserProductAction,
  type UserProductFormState,
} from "@/app/dashboard/your-product/actions";

type UserProductFormProps = {
  product?: {
    id: string;
    name: string;
    baseUrl: string;
    scanStatus: string;
  } | null;
};

export function UserProductForm({ product }: UserProductFormProps) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, isPending] = useActionState<
    UserProductFormState,
    FormData
  >(saveUserProductAction, {});
  const [rerunState, rerunAction, isRerunning] = useActionState<
    UserProductFormState,
    FormData
  >(rerunUserProductAction, {});

  useEffect(() => {
    if (state.message && !product) {
      formRef.current?.reset();
    }
  }, [product, state.message]);

  return (
    <div className="rounded-lg border border-ink/10 bg-white p-6 shadow-soft">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h2 className="text-xl font-semibold text-ink">Your Product</h2>
          <p className="mt-2 text-sm leading-6 text-ink/60">
            Analyze your own public website with the same evidence-backed
            pipeline used for competitors.
          </p>
        </div>
        {product ? (
          <span className="rounded-full bg-paper px-3 py-1 text-xs font-semibold text-ink/60">
            {product.scanStatus}
          </span>
        ) : null}
      </div>

      <form ref={formRef} action={formAction} className="mt-6 grid gap-4">
        <label>
          <span className="text-sm font-medium text-ink/75">Product name</span>
          <input
            name="name"
            type="text"
            defaultValue={product?.name ?? ""}
            placeholder="LaunchRadar"
            className="mt-2 h-11 w-full rounded-md border border-ink/15 px-3 text-sm outline-none transition focus:border-moss"
          />
        </label>
        <label>
          <span className="text-sm font-medium text-ink/75">Website URL</span>
          <input
            name="baseUrl"
            type="text"
            defaultValue={product?.baseUrl ?? ""}
            placeholder="example.com"
            required
            className="mt-2 h-11 w-full rounded-md border border-ink/15 px-3 text-sm outline-none transition focus:border-moss"
          />
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={isPending}
            className="inline-flex h-11 items-center justify-center rounded-md bg-moss px-5 text-sm font-semibold text-white transition hover:bg-moss/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending
              ? "Analyzing..."
              : product
                ? "Update and analyze"
                : "Analyze product"}
          </button>
        </div>
      </form>

      {product ? (
        <form action={rerunAction} className="mt-3">
          <input type="hidden" name="productId" value={product.id} />
          <button
            type="submit"
            disabled={isRerunning}
            className="inline-flex h-10 items-center justify-center rounded-md border border-ink/15 bg-white px-4 text-sm font-semibold text-ink transition hover:border-ink/35 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isRerunning ? "Re-running..." : "Re-run analysis"}
          </button>
        </form>
      ) : null}

      {[state.error, rerunState.error].filter(Boolean).map((error) => (
        <p key={error} className="mt-4 text-sm leading-6 text-red-600">
          {error}
        </p>
      ))}
      {[state.message, rerunState.message].filter(Boolean).map((message) => (
        <p key={message} className="mt-4 text-sm leading-6 text-moss">
          {message}
        </p>
      ))}
    </div>
  );
}
