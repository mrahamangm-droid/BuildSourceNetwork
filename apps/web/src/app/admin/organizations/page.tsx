import type { Metadata } from "next";
import { requireAdmin } from "@/server/access";
import { listOrganizations } from "@/server/services/admin";
import { setOrgActiveAction } from "@/server/actions";
import { Badge, Button, Card, Input, PageHeader, Select } from "@/components/ui";
import { RevokeForm } from "@/components/dashboard/admin-forms";
import { ORG_TYPE_LABEL, type OrgType } from "@bmn/config";

export const metadata: Metadata = { title: "Companies" };

export default async function Companies({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; type?: string; status?: string; page?: string }>;
}) {
  const a = await requireAdmin();
  const sp = await searchParams;
  const res = await listOrganizations(
    { userId: a.id, isPlatformAdmin: true },
    { q: sp.q, type: sp.type, status: sp.status, page: Number(sp.page) || 1 },
  );
  return (
    <div className="space-y-4">
      <PageHeader title="Companies" description={`${ res.total} matching`} />
      <form className="flex flex-wrap gap-2">
        <Input name="q" defaultValue={sp.q} placeholder="Search name, city or email" className="w-64" />
        <Select name="type" defaultValue={sp.type ?? ""} className="w-40">
          <option value="">All types</option>
          {Object.entries(ORG_TYPE_LABEL).map(([k, v]) => (
            <option key={k} value={k}>{v}</option>
          ))}
        </Select>
        <Select name="status" defaultValue={sp.status ?? ""} className="w-40">
          <option value="">Any status</option>
          {["UNVERIFIED", "PENDING", "VERIFIED", "REJECTED"].map((s) => (
            <option key={s} value={s}>{s.toLowerCase()}</option>
          ))}
        </Select>
        <Button type="submit" variant="outline">Filter</Button>
      </form>
      {res.items.map((o) => (
        <Card key={o.id} className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-semibold">{o.name}</p>
            <p className="text-sm text-muted">
              {ORG_TYPE_LABEL[o.type as OrgType]} · {o.city} · {o._count.members} users · {o._count.products} products
            </p>
            <div className="mt-1 flex gap-1">
              <Badge tone={o.verificationStatus === "VERIFIED" ? "green" : "neutral"}>
                {o.verificationStatus.toLowerCase()}
              </Badge>
              {o.isDemo ? <Badge tone="amber">Demo</Badge> : null}
              {!o.isActive ? <Badge tone="red">Suspended</Badge> : null}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {o.verificationStatus === "VERIFIED" ? <RevokeForm orgId={o.id} /> : null}
            <form action={setOrgActiveAction}>
              <input type="hidden" name="orgId" value={o.id} />
              <input type="hidden" name="active" value={o.isActive ? "0" : "1"} />
              <Button size="sm" variant={o.isActive ? "danger" : "outline"} type="submit">
                {o.isActive ? "Suspend" : "Reactivate"}
              </Button>
            </form>
          </div>
        </Card>
      ))}
    </div>
  );
}
