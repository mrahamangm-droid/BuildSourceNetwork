import { NextResponse } from "next/server";
import { db } from "@bmn/database";

/** Subcategories (with their product types) of one category, for the dependent dropdowns. Public reference data. */
export async function GET(req: Request) {
  const category = new URL(req.url).searchParams.get("category") ?? "";
  if (!category || category.length > 40)
    return NextResponse.json({ error: "category is required" }, { status: 400 });
  const subcategories = await db.subcategory.findMany({
    where: { categoryId: category },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      types: { orderBy: [{ sortOrder: "asc" }, { name: "asc" }], select: { id: true, name: true } },
    },
  });
  return NextResponse.json(
    { subcategories },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
