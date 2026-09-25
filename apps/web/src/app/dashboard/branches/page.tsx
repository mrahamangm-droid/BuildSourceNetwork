import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireCtx } from "@/server/access";
import { deleteBranchAction, deleteWarehouseAction } from "@/server/actions";
import { listBranches, listWarehouseOptions } from "@/server/services/branches";
import { listStock } from "@/server/services/inventory";
import { Alert, Badge, Button, Card, EmptyState, PageHeader } from "@/components/ui";
import { BranchForm, TransferForm, WarehouseAddForm } from "@/components/dashboard/branch-forms";
import { MAX_BRANCHES, warehouseDeleteBlocker } from "@/lib/branches";
import { roleHas } from "@bmn/config";

export const metadata: Metadata = { title: "Branches & warehouses" };

export default async function BranchesPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const ctx = await requireCtx();
  if (!["SUPPLIER", "STORE"].includes(ctx.orgType) || !roleHas(ctx.role, "inventory.manage"))
    redirect("/dashboard");
  const sp = await searchParams;
  const canEdit = roleHas(ctx.role, "org.manage");
  const [branches, options, stock] = await Promise.all([
    listBranches(ctx),
    listWarehouseOptions(ctx),
    listStock(ctx),
  ]);

  return (
    <div className="max-w-4xl space-y-6">
      <PageHeader
        title="Branches & warehouses"
        description="Keep stock per location. Orders and stock movements can be recorded against a specific warehouse."
      />
      {sp.error ? <Alert tone="error">{sp.error}</Alert> : null}

      {branches.length ? (
        branches.map((b) => (
          <Card key={b.id} className="space-y-4">
            <BranchForm branch={b} canEdit={canEdit} />
            <div>
              <h3 className="text-sm font-semibold">Warehouses</h3>
              <ul className="mt-2 divide-y divide-line rounded-lg border border-line text-sm">
                {b.warehouses.map((w) => {
                  const why = warehouseDeleteBlocker({
                    movements: w.movements,
                    onHandMilli: w.stockedProducts > 0 ? 1 : 0,
                    reservedMilli: 0,
                    orderLines: w.orderLines,
                  });
                  return (
                    <li key={w.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2">
                      <span className="font-medium">{w.name}</span>
                      <span className="flex items-center gap-2">
                        <Badge tone={w.stockedProducts ? "blue" : "neutral"}>
                          {w.stockedProducts} product{w.stockedProducts === 1 ? "" : "s"} in stock
                        </Badge>
                        {canEdit && !why ? (
                          <form action={deleteWarehouseAction}>
                            <input type="hidden" name="id" value={w.id} />
                            <Button type="submit" variant="ghost" size="sm">
                              Delete
                            </Button>
                          </form>
                        ) : null}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
            {canEdit ? (
              <div className="flex flex-wrap items-end justify-between gap-3">
                <WarehouseAddForm branchId={b.id} />
                <form action={deleteBranchAction}>
                  <input type="hidden" name="id" value={b.id} />
                  <Button type="submit" variant="ghost" size="sm">
                    Delete branch
                  </Button>
                </form>
              </div>
            ) : null}
          </Card>
        ))
      ) : (
        <EmptyState
          title="No branches yet"
          body="A default location is created automatically when you first record stock. Add branches here to split stock by site."
        />
      )}

      {canEdit && branches.length < MAX_BRANCHES ? (
        <Card>
          <h2 className="mb-3 font-semibold">Add a branch</h2>
          <BranchForm canEdit />
        </Card>
      ) : null}

      <TransferForm
        products={stock.map((r) => ({ id: r.productId, name: r.name, unit: r.unit }))}
        warehouses={options}
      />
    </div>
  );
}
