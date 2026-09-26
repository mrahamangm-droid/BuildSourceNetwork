import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@bmn/database";
import { Breadcrumbs } from "@/components/market/parts";
import { LinkButton } from "@/components/ui";

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "All building and home categories",
  description:
    "Browse every department, category and product type on BuildSource Network: from site preparation, concrete and steel to MEP, finishes, kitchens, furniture, landscaping and maintenance.",
  alternates: { canonical: "/categories" },
};

export default async function CategoriesPage() {
  const departments = await db.department.findMany({
    orderBy: { sortOrder: "asc" },
    select: {
      slug: true,
      name: true,
      categories: {
        orderBy: { sortOrder: "asc" },
        select: {
          slug: true,
          name: true,
          subcategories: {
            orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
            select: { slug: true, name: true },
          },
        },
      },
    },
  });
  const href = (category: string, sub?: string) =>
    `/marketplace?category=${category}${sub ? `&sub=${sub}` : ""}`;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <Breadcrumbs items={[{ name: "Home", href: "/" }, { name: "Categories" }]} />
      <h1 className="text-3xl font-bold tracking-tight">
        Everything to build, renovate and maintain
      </h1>
      <p className="mt-2 max-w-3xl text-muted">
        Browse by department, category and subcategory, or{" "}
        <Link className="text-brand-700 hover:underline" href="/marketplace">
          search the marketplace
        </Link>
        . Can’t find it? Describe what you need and let suppliers quote.
      </p>
      <div className="mt-4">
        <LinkButton href="/request-quotes">Request quotes</LinkButton>
      </div>
      <nav aria-label="Departments" className="mt-6 flex flex-wrap gap-2 text-sm">
        {departments.map((d) => (
          <a
            key={d.slug}
            href={`#${d.slug}`}
            className="rounded-full border border-line px-3 py-1 hover:bg-surface"
          >
            {d.name}
          </a>
        ))}
      </nav>
      <div className="mt-8 space-y-10">
        {departments.map((d) => (
          <section key={d.slug} id={d.slug} aria-labelledby={`${d.slug}-h`}>
            <h2 id={`${d.slug}-h`} className="text-xl font-semibold">
              {d.name}
            </h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {d.categories.map((c) => (
                <div key={c.slug} className="rounded-xl border border-line p-4">
                  <h3 className="font-medium">
                    <Link className="hover:text-brand-700" href={href(c.slug)}>
                      {c.name}
                    </Link>
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm text-muted">
                    {c.subcategories.map((s) => (
                      <li key={s.slug}>
                        <Link
                          className="hover:text-brand-700 hover:underline"
                          href={href(c.slug, s.slug)}
                        >
                          {s.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
