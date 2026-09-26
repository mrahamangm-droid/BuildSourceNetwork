"use client";
import { useActionState } from "react";
import { Card, Field, Input, Select, Textarea } from "@/components/ui";
import { FormMessage, ImageUpload, SubmitButton, fe } from "@/components/forms/shared";
import { SuggestInput } from "@/components/forms/suggest-input";
import { TaxonomyPicker, type CategoryOption } from "@/components/forms/taxonomy-picker";
import { saveProductAction, type ActionState } from "@/server/actions";

export type ProductFormValues = {
  id?: string;
  name?: string;
  sku?: string | null;
  categoryId?: string;
  subcategoryId?: string | null;
  productTypeId?: string | null;
  brandName?: string;
  manufacturerName?: string;
  material?: string | null;
  grade?: string | null;
  size?: string | null;
  dimensions?: string | null;
  color?: string | null;
  finish?: string | null;
  application?: string | null;
  countryOfOrigin?: string | null;
  unitCode?: string;
  description?: string | null;
  packageSize?: string | null;
  minOrderQty?: string;
  stockStatus?: string;
  price?: string;
  wholesalePrice?: string | null;
  contractorPrice?: string | null;
  vatRatePercent?: string;
  city?: string | null;
  deliveryAvailable?: boolean;
  isActive?: boolean;
  specifications?: string;
  imageUrl?: string | null;
};

/** Type-ahead suggestions, supplied by the server so the client bundle stays small. */
export type ProductFormLists = {
  brands: string[];
  manufacturers: string[];
  materials: string[];
  grades: string[];
  sizes: string[];
  colors: string[];
  finishes: string[];
  applications: string[];
  origins: string[];
};

export function ProductForm({
  values,
  categories,
  units,
  lists,
}: {
  values: ProductFormValues;
  categories: CategoryOption[];
  units: { code: string; name: string }[];
  lists: ProductFormLists;
}) {
  const [state, action] = useActionState<ActionState, FormData>(saveProductAction, {});
  return (
    <form action={action} className="space-y-6">
      {values.id ? <input type="hidden" name="id" value={values.id} /> : null}
      <Card className="space-y-4">
        <h2 className="font-semibold">Product</h2>
        <Field label="Product name" error={fe(state, "name")}>
          <Input
            name="name"
            defaultValue={values.name}
            required
            placeholder="e.g. Ordinary Portland Cement 50kg"
          />
        </Field>
        <TaxonomyPicker
          categories={categories}
          initial={{
            categoryId: values.categoryId,
            subcategoryId: values.subcategoryId,
            productTypeId: values.productTypeId,
          }}
          errors={{
            categoryId: fe(state, "categoryId"),
            subcategoryId: fe(state, "subcategoryId"),
            productTypeId: fe(state, "productTypeId"),
          }}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Brand" hint="Pick a known brand or type your own">
            <SuggestInput
              name="brandName"
              options={lists.brands}
              defaultValue={values.brandName}
              maxLength={80}
            />
          </Field>
          <Field label="Manufacturer" hint="Filled in automatically for known brands">
            <SuggestInput
              name="manufacturerName"
              options={lists.manufacturers}
              defaultValue={values.manufacturerName}
              maxLength={80}
            />
          </Field>
          <Field label="SKU" error={fe(state, "sku")}>
            <Input name="sku" defaultValue={values.sku ?? ""} />
          </Field>
        </div>
        <Field label="Description" error={fe(state, "description")}>
          <Textarea name="description" defaultValue={values.description ?? ""} rows={3} />
        </Field>
        <ImageUpload name="imageUrl" label="Product image" initial={values.imageUrl} />
      </Card>
      <Card className="space-y-4">
        <h2 className="font-semibold">Attributes</h2>
        <p className="text-sm text-muted">
          These make the product easy to filter and compare. Fill in what applies and leave the rest
          blank.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Material">
            <SuggestInput
              name="material"
              options={lists.materials}
              defaultValue={values.material}
            />
          </Field>
          <Field label="Grade / class">
            <SuggestInput name="grade" options={lists.grades} defaultValue={values.grade} />
          </Field>
          <Field label="Size">
            <SuggestInput name="size" options={lists.sizes} defaultValue={values.size} />
          </Field>
          <Field label="Dimensions" hint="e.g. 600 x 600 x 10 mm">
            <Input name="dimensions" defaultValue={values.dimensions ?? ""} maxLength={120} />
          </Field>
          <Field label="Colour">
            <SuggestInput name="color" options={lists.colors} defaultValue={values.color} />
          </Field>
          <Field label="Finish">
            <SuggestInput name="finish" options={lists.finishes} defaultValue={values.finish} />
          </Field>
          <Field label="Application">
            <SuggestInput
              name="application"
              options={lists.applications}
              defaultValue={values.application}
            />
          </Field>
          <Field label="Country of origin">
            <SuggestInput
              name="countryOfOrigin"
              options={lists.origins}
              defaultValue={values.countryOfOrigin}
            />
          </Field>
        </div>
        <Field
          label="Other specifications"
          hint="One per line, as “Name: value” (e.g. Strength: 42.5N)"
        >
          <Textarea name="specifications" defaultValue={values.specifications} rows={3} />
        </Field>
      </Card>
      <Card className="space-y-4">
        <h2 className="font-semibold">Pricing & units</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label="Unit" error={fe(state, "unitCode")}>
            <Select name="unitCode" defaultValue={values.unitCode ?? ""} required>
              <option value="" disabled>
                Choose…
              </option>
              {units.map((u) => (
                <option key={u.code} value={u.code}>
                  {u.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Package size">
            <Input
              name="packageSize"
              defaultValue={values.packageSize ?? ""}
              placeholder="e.g. 50 kg bag"
            />
          </Field>
          <Field label="Minimum order" error={fe(state, "minOrderQty")}>
            <Input
              name="minOrderQty"
              type="number"
              step="any"
              min="0"
              defaultValue={values.minOrderQty ?? "1"}
              required
            />
          </Field>
          <Field label="Price (AED)" error={fe(state, "price")}>
            <Input
              name="price"
              type="number"
              step="0.01"
              min="0"
              defaultValue={values.price}
              required
            />
          </Field>
          <Field label="Wholesale price" error={fe(state, "wholesalePrice")}>
            <Input
              name="wholesalePrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={values.wholesalePrice ?? ""}
            />
          </Field>
          <Field label="Contractor price" error={fe(state, "contractorPrice")}>
            <Input
              name="contractorPrice"
              type="number"
              step="0.01"
              min="0"
              defaultValue={values.contractorPrice ?? ""}
            />
          </Field>
          <Field label="VAT %">
            <Input
              name="vatRatePercent"
              type="number"
              step="0.01"
              min="0"
              max="100"
              defaultValue={values.vatRatePercent ?? "5"}
            />
          </Field>
        </div>
      </Card>
      <Card className="space-y-4">
        <h2 className="font-semibold">Availability</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Stock status">
            <Select name="stockStatus" defaultValue={values.stockStatus ?? "IN_STOCK"}>
              <option value="IN_STOCK">In stock</option>
              <option value="LOW_STOCK">Low stock</option>
              <option value="OUT_OF_STOCK">Out of stock</option>
              <option value="ON_REQUEST">On request</option>
            </Select>
          </Field>
          <Field label="Location (city)">
            <Input name="city" defaultValue={values.city ?? ""} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="deliveryAvailable"
            defaultChecked={values.deliveryAvailable ?? true}
          />{" "}
          Delivery available
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isActive" defaultChecked={values.isActive ?? true} /> Listed
          in the marketplace
        </label>
      </Card>
      <FormMessage state={state} />
      <SubmitButton>{values.id ? "Save changes" : "Add product"}</SubmitButton>
    </form>
  );
}
