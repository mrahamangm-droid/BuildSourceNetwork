/**
 * The columns a product import understands. One table drives everything: automatic column
 * mapping (aliases), the downloadable template (labels, examples, required marks) and validation.
 */
export type FieldKey =
  | "sku"
  | "name"
  | "category"
  | "subcategory"
  | "productType"
  | "brand"
  | "manufacturer"
  | "unit"
  | "price"
  | "wholesalePrice"
  | "contractorPrice"
  | "minOrderQty"
  | "stockStatus"
  | "stockQty"
  | "packageSize"
  | "vatRatePercent"
  | "city"
  | "description"
  | "material"
  | "grade"
  | "size"
  | "dimensions"
  | "color"
  | "finish"
  | "application"
  | "countryOfOrigin"
  | "specifications"
  | "imageUrl"
  | "delivery"
  | "active";

export type FieldDef = {
  key: FieldKey;
  label: string;
  /** Required when a NEW product is created. Updates only need the columns being changed. */
  required?: boolean;
  /** Normalised header names (lower case, letters and digits only) that map to this field. */
  aliases: string[];
  example: string;
  width: number;
  /** Stored as text in the template so leading zeros in SKUs survive. */
  text?: boolean;
  help: string;
};

export const FIELDS: FieldDef[] = [
  {
    key: "sku",
    label: "SKU",
    aliases: [
      "sku",
      "itemcode",
      "productcode",
      "code",
      "partno",
      "partnumber",
      "mpn",
      "articleno",
      "itemno",
      "barcode",
      "ean",
      "upc",
    ],
    example: "CEM-OPC-50",
    width: 16,
    text: true,
    help: "Your own product code. Used to update existing products instead of duplicating them.",
  },
  {
    key: "name",
    label: "Product Name",
    required: true,
    aliases: [
      "productname",
      "name",
      "product",
      "item",
      "itemname",
      "itemdescription",
      "title",
      "productdescription",
    ],
    example: "OPC Cement 50 kg bag",
    width: 34,
    help: "2 to 160 characters.",
  },
  {
    key: "category",
    label: "Category",
    required: true,
    aliases: ["category", "maincategory", "productcategory", "group", "productgroup"],
    example: "Cement",
    width: 22,
    help: "Pick from the drop-down. Must match a BSN category.",
  },
  {
    key: "subcategory",
    label: "Subcategory",
    aliases: ["subcategory", "subcat", "subgroup", "sub"],
    example: "Portland cement",
    width: 24,
    help: "Pick from the drop-down (depends on Category).",
  },
  {
    key: "productType",
    label: "Product Type",
    aliases: ["producttype", "typeofproduct", "itemtype", "variety"],
    example: "OPC",
    width: 22,
    help: "Pick from the drop-down (depends on Subcategory).",
  },
  {
    key: "brand",
    label: "Brand",
    aliases: ["brand", "brandname", "make", "marque"],
    example: "Sika",
    width: 18,
    help: "New brands are created automatically.",
  },
  {
    key: "manufacturer",
    label: "Manufacturer",
    aliases: ["manufacturer", "manufacturername", "producer", "mfr", "mfg", "maker"],
    example: "",
    width: 20,
    help: "Leave blank to use the brand's manufacturer.",
  },
  {
    key: "unit",
    label: "Unit",
    required: true,
    aliases: ["unit", "uom", "unitofmeasure", "unitofmeasurement", "soldper", "per", "sellingunit"],
    example: "BAG",
    width: 10,
    help: "Pick from the drop-down (BAG, TON, M2, PCS ...). Common spellings such as bags or sqm are understood.",
  },
  {
    key: "price",
    label: "Price",
    required: true,
    aliases: [
      "price",
      "unitprice",
      "retailprice",
      "rate",
      "sellingprice",
      "listprice",
      "mrp",
      "cost",
      "amount",
    ],
    example: "18.50",
    width: 12,
    help: "Price per unit, excluding VAT. Formats like 1,250.50 or AED 12 are understood.",
  },
  {
    key: "wholesalePrice",
    label: "Wholesale Price",
    aliases: ["wholesaleprice", "wholesale", "bulkprice", "bulkrate", "tradeprice"],
    example: "17.00",
    width: 14,
    help: "Optional price for larger buyers.",
  },
  {
    key: "contractorPrice",
    label: "Contractor Price",
    aliases: ["contractorprice", "contractor", "contractorrate", "projectprice"],
    example: "16.50",
    width: 15,
    help: "Optional price for verified contractors.",
  },
  {
    key: "minOrderQty",
    label: "Min Order Qty",
    aliases: [
      "minorderqty",
      "moq",
      "minimumorderquantity",
      "minimumorder",
      "minqty",
      "minimumqty",
      "minorder",
      "minimumquantity",
    ],
    example: "100",
    width: 14,
    help: "Minimum order quantity. Large numbers such as 1,000,000 or 1.5k are understood.",
  },
  {
    key: "stockStatus",
    label: "Availability",
    aliases: ["availability", "stockstatus", "stock", "status", "instock", "available"],
    example: "In stock",
    width: 14,
    help: "In stock, Low stock, Out of stock or On request.",
  },
  {
    key: "stockQty",
    label: "Stock Quantity",
    aliases: [
      "stockqty",
      "stockquantity",
      "quantity",
      "qty",
      "onhand",
      "inventory",
      "balance",
      "stocklevel",
    ],
    example: "12500",
    width: 14,
    help: "If Availability is blank: above 0 means In stock, 0 means Out of stock.",
  },
  {
    key: "packageSize",
    label: "Package Size",
    aliases: ["packagesize", "package", "packing", "pack", "packsize", "packaging"],
    example: "50 kg",
    width: 14,
    help: "For example 50 kg bag, 25 L pail.",
  },
  {
    key: "vatRatePercent",
    label: "VAT %",
    aliases: ["vat", "vatpercent", "vatrate", "tax", "taxrate", "taxpercent", "gst"],
    example: "5",
    width: 8,
    help: "0 to 100. Defaults to 5.",
  },
  {
    key: "city",
    label: "City",
    aliases: ["city", "location", "emirate", "warehouselocation", "town"],
    example: "Dubai",
    width: 14,
    help: "Defaults to your company city.",
  },
  {
    key: "description",
    label: "Description",
    aliases: ["description", "details", "notes", "about", "longdescription", "productdetails"],
    example: "",
    width: 40,
    help: "Up to 4,000 characters.",
  },
  {
    key: "material",
    label: "Material",
    aliases: ["material", "materialtype", "composition"],
    example: "",
    width: 14,
    help: "Attribute filter value.",
  },
  {
    key: "grade",
    label: "Grade / Class",
    aliases: ["grade", "class", "gradeclass", "strength", "standard"],
    example: "42.5N",
    width: 12,
    help: "Attribute filter value.",
  },
  {
    key: "size",
    label: "Size",
    aliases: ["size", "diameter", "thickness", "length", "width"],
    example: "",
    width: 12,
    help: "Attribute filter value.",
  },
  {
    key: "dimensions",
    label: "Dimensions",
    aliases: ["dimensions", "dimension", "lxwxh"],
    example: "",
    width: 16,
    help: "For example 600 x 600 x 10 mm.",
  },
  {
    key: "color",
    label: "Colour",
    aliases: ["colour", "color", "shade"],
    example: "",
    width: 12,
    help: "Attribute filter value.",
  },
  {
    key: "finish",
    label: "Finish",
    aliases: ["finish", "surface", "surfacefinish", "texture"],
    example: "",
    width: 12,
    help: "Attribute filter value.",
  },
  {
    key: "application",
    label: "Application",
    aliases: ["application", "usage", "use", "recommendeduse", "applicationarea"],
    example: "",
    width: 16,
    help: "Attribute filter value.",
  },
  {
    key: "countryOfOrigin",
    label: "Country of Origin",
    aliases: ["countryoforigin", "origin", "country", "madein", "coo"],
    example: "",
    width: 16,
    help: "Attribute filter value.",
  },
  {
    key: "specifications",
    label: "Specifications",
    aliases: [
      "specifications",
      "specification",
      "specs",
      "spec",
      "technicaldata",
      "technicalspecs",
    ],
    example: "Setting time: 45 min; Strength: 42.5 MPa",
    width: 40,
    help: "Pairs like Key: value separated by semicolons or new lines.",
  },
  {
    key: "imageUrl",
    label: "Image URL",
    aliases: [
      "imageurl",
      "image",
      "imagelink",
      "picture",
      "photo",
      "photourl",
      "imageurl1",
      "mainimage",
    ],
    example: "",
    width: 30,
    help: "Public https:// link, or use the bulk image upload step after importing.",
  },
  {
    key: "delivery",
    label: "Delivery Available",
    aliases: ["delivery", "deliveryavailable", "canbedelivered", "shipping"],
    example: "Yes",
    width: 12,
    help: "Yes or No. Defaults to Yes.",
  },
  {
    key: "active",
    label: "Active",
    aliases: ["active", "isactive", "visible", "published", "enabled", "listed"],
    example: "Yes",
    width: 10,
    help: "Yes or No. Inactive products are hidden from the marketplace.",
  },
];

export const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((f) => [f.key, f])) as Record<
  FieldKey,
  FieldDef
>;
export const REQUIRED_FIELDS = FIELDS.filter((f) => f.required).map((f) => f.key);

/** Hard ceiling per import job; bigger catalogues are split into several files. */
export const BULK_MAX_ROWS = 100_000;
