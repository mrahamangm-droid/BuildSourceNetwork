"use client";
import { useActionState } from "react";
import { Card, Field, Input, Select, Textarea } from "@/components/ui";
import { SUPPLIER_KINDS, SUPPLIER_KIND_LABEL } from "@bmn/config";
import { FormMessage, ImageUpload, SubmitButton, fe } from "@/components/forms/shared";
import { saveOrgProfileAction, type ActionState } from "@/server/actions";

type Org = {
  name: string;
  description: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  addressLine: string | null;
  city: string | null;
  businessHours: string | null;
  deliveryAreas: string[];
  logoUrl: string | null;
  coverUrl: string | null;
  categories: { id: string }[];
  type?: string;
  supplierKind?: string | null;
  leadTimeDays?: number | null;
  minOrderNote?: string | null;
  capacityNote?: string | null;
  certifications?: string[];
};

export function ProfileForm({
  org,
  categories,
  canEdit,
  publicHref,
}: {
  org: Org;
  categories: { id: string; name: string }[];
  canEdit: boolean;
  publicHref: string | null;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveOrgProfileAction, {});
  const selected = new Set(org.categories.map((c) => c.id));
  return (
    <form action={action} className="space-y-6">
      <fieldset disabled={!canEdit} className="space-y-6">
        <Card className="space-y-4">
          <h2 className="font-semibold">Branding</h2>
          <div className="grid gap-6 sm:grid-cols-2">
            <ImageUpload name="logoUrl" label="Logo" initial={org.logoUrl} />
            <ImageUpload name="coverUrl" label="Cover image" initial={org.coverUrl} />
          </div>
        </Card>
        <Card className="space-y-4">
          <h2 className="font-semibold">Business information</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Company name" error={fe(state, "name")}>
              <Input name="name" defaultValue={org.name} required />
            </Field>
            <Field label="City" error={fe(state, "city")}>
              <Input name="city" defaultValue={org.city ?? ""} required />
            </Field>
            <Field label="Public phone" error={fe(state, "phone")}>
              <Input name="phone" defaultValue={org.phone ?? ""} />
            </Field>
            <Field
              label="Public email"
              hint="Shown on your public profile"
              error={fe(state, "email")}
            >
              <Input name="email" type="email" defaultValue={org.email ?? ""} />
            </Field>
            <Field label="Website" error={fe(state, "website")}>
              <Input name="website" defaultValue={org.website ?? ""} placeholder="https://" />
            </Field>
            <Field label="Business hours">
              <Input
                name="businessHours"
                defaultValue={org.businessHours ?? ""}
                placeholder="Sat–Thu 8:00–18:00"
              />
            </Field>
          </div>
          <Field label="Address">
            <Input name="addressLine" defaultValue={org.addressLine ?? ""} />
          </Field>
          <Field label="Description" error={fe(state, "description")}>
            <Textarea name="description" defaultValue={org.description ?? ""} rows={4} />
          </Field>
          <Field label="Delivery areas" hint="Comma-separated cities, e.g. Sharjah, Dubai, Ajman">
            <Input name="deliveryAreas" defaultValue={org.deliveryAreas.join(", ")} />
          </Field>
        </Card>
        {org.type === "SUPPLIER" ? (
          <Card className="space-y-4">
            <div>
              <h2 className="font-semibold">Supplier &amp; factory details</h2>
              <p className="text-sm text-muted">
                Manufacturers appear in the manufacturer directory. Only state what you can back up
                with documents; certifications are self-declared until verified by our team.
              </p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="We are a">
                <Select name="supplierKind" defaultValue={org.supplierKind ?? ""}>
                  <option value="">Not specified</option>
                  {SUPPLIER_KINDS.map((k) => (
                    <option key={k} value={k}>
                      {SUPPLIER_KIND_LABEL[k]}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field
                label="Typical lead time (days)"
                hint="0 = ex-stock"
                error={fe(state, "leadTimeDays")}
              >
                <Input
                  name="leadTimeDays"
                  inputMode="numeric"
                  defaultValue={org.leadTimeDays ?? ""}
                />
              </Field>
            </div>
            <Field label="Minimum order" hint="e.g. 1 truckload (25 t) or AED 5,000">
              <Input name="minOrderNote" defaultValue={org.minOrderNote ?? ""} />
            </Field>
            <Field label="Production capacity" hint="e.g. 2,000 t / month">
              <Input name="capacityNote" defaultValue={org.capacityNote ?? ""} />
            </Field>
            <Field label="Certifications" hint="Comma-separated, e.g. ISO 9001, ESMA, BS 4449">
              <Input name="certifications" defaultValue={(org.certifications ?? []).join(", ")} />
            </Field>
          </Card>
        ) : null}
        <Card className="space-y-3">
          <h2 className="font-semibold">Product categories</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => (
              <label key={c.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="categoryIds"
                  value={c.id}
                  defaultChecked={selected.has(c.id)}
                />
                {c.name}
              </label>
            ))}
          </div>
        </Card>
      </fieldset>
      <FormMessage state={state} />
      <div className="flex flex-wrap items-center gap-3">
        {canEdit ? (
          <SubmitButton>Save profile</SubmitButton>
        ) : (
          <p className="text-sm text-muted">Only owners and admins can edit the company profile.</p>
        )}
        {publicHref ? (
          <a className="text-sm text-brand-700 hover:underline" href={publicHref}>
            View public page
          </a>
        ) : null}
      </div>
    </form>
  );
}
