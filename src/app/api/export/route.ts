import { NextResponse } from "next/server";
import { requireOwner } from "@/lib/auth/session";
import { listItems, getLedger, getSales, getSettings } from "@/lib/reseller/db";

export async function GET() {
  await requireOwner();
  const [settings, items, sales, ledger] = await Promise.all([
    getSettings(),
    listItems("all"),
    getSales(),
    getLedger(5000)
  ]);

  return NextResponse.json(
    {
      exportedAt: new Date().toISOString(),
      settings,
      inventory: items,
      sales,
      ledger
    },
    {
      headers: {
        "Content-Disposition": `attachment; filename="private-reselling-os-export-${new Date().toISOString().slice(0, 10)}.json"`
      }
    }
  );
}
