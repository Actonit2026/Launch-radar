import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isMasterAdminEmail } from "@/lib/master-admin";
import { getValidationRun } from "@/lib/validation/suite";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();

  if (!user || !isMasterAdminEmail(user.email)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { id } = await params;
  const run = await getValidationRun(id);

  if (!run) {
    return NextResponse.json({ error: "Validation run not found" }, { status: 404 });
  }

  return NextResponse.json(run.report_json, {
    headers: {
      "content-disposition": `attachment; filename="launchradar-validation-${id}.json"`,
    },
  });
}
