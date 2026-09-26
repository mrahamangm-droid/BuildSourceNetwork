/**
 * Suggestion lists for structured product attributes. They power the type-ahead lists on the
 * product form, the marketplace filters and (later) the bulk-upload validation. Values are
 * suggestions, not a closed set: a supplier can type anything, because a real catalogue always
 * contains something the list did not foresee.
 */
const list = (s: string) =>
  s
    .split("|")
    .map((x) => x.trim())
    .filter(Boolean);

export const MATERIALS = list(
  "Portland cement|Ready-mix concrete|Reinforced concrete|Precast concrete|Aerated concrete (AAC)|Clay brick|Concrete block|Natural stone|Granite|Marble|Limestone|Sandstone|Travertine|Quartz|Porcelain|Ceramic|Glass|Tempered glass|Laminated glass|Steel|Stainless steel 304|Stainless steel 316|Galvanised steel|Mild steel|Aluminium|Copper|Brass|Cast iron|Ductile iron|PVC|uPVC|CPVC|HDPE|PPR|PEX|Polycarbonate|Acrylic|Fibreglass (GRP)|Solid wood|Engineered wood|Plywood|MDF|HDF|Particle board|OSB|Bamboo|Cork|Vinyl|Laminate|Rubber|Bitumen|EPDM|TPO|Gypsum|Cement board|Fibre cement|Mineral wool|Glass wool|EPS|XPS|PIR|PUR|Polyurethane|Epoxy|Silicone|Acrylic latex|Textile / fabric|Leather|Rattan|Wrought iron|Terrazzo|Composite|Recycled plastic",
);

export const GRADES = list(
  "Grade 30|Grade 40|Grade 50|C20/25|C25/30|C30/37|C40/50|CEM I 42.5N|CEM I 52.5N|CEM II/B-M 42.5N|Fe 415|Fe 500|Fe 500D|Fe 550|B500B|B500C|Grade 60|Grade 75|Class A|Class B|Class C|AA grade|A grade|B grade|Commercial grade|Industrial grade|Marine grade|Food grade|Fire rated (A1)|Fire rated (B-s1,d0)|Water resistant (MR)|Moisture resistant|Exterior grade|Interior grade|E0|E1|BS EN|ASTM|ISO 9001|PN10|PN16|SDR 11|SDR 17|Schedule 40|Schedule 80|IP44|IP54|IP65|IP66|IP67|IK08|IK10|Load class D400|Load class C250",
);

export const COLORS = list(
  "White|Off-white|Ivory|Cream|Beige|Sand|Grey|Light grey|Dark grey|Charcoal|Black|Silver|Chrome|Brushed steel|Gold|Brass|Bronze|Copper|Brown|Walnut|Oak|Teak|Wenge|Natural|Red|Terracotta|Orange|Yellow|Green|Olive|Blue|Navy|Teal|Pink|Purple|Multicolour|Transparent|Frosted|RAL 9010|RAL 9016|RAL 7016|RAL 9005|Custom colour",
);

export const FINISHES = list(
  "Matt|Satin|Semi-gloss|Gloss|High gloss|Polished|Honed|Brushed|Textured|Rough|Sandblasted|Bush-hammered|Flamed|Anti-slip|Lappato|Natural|Raw|Primed|Painted|Powder coated|Anodised|Galvanised|Hot-dip galvanised|Electroplated|PVDF coated|Chrome plated|Nickel plated|Black oxide|Lacquered|Oiled|Waxed|Stained|Veneer|Foil wrapped|Embossed|Sanded|Unfinished|Pre-finished|Self-finished",
);

export const APPLICATIONS = list(
  "Foundation|Slab|Column and beam|Blockwork|Plastering|Screed|Waterproofing|Roofing|Facade / cladding|Flooring|Wall tiling|Ceiling|Partition|Insulation (thermal)|Insulation (acoustic)|Fire protection|Interior painting|Exterior painting|Plumbing (potable water)|Drainage and sewage|Irrigation|HVAC ducting|Electrical wiring|Lighting|Data and telecom|Security and access|Windows and doors|Kitchen|Bathroom|Landscaping|Paving|Fencing|Swimming pool|Structural steel|Formwork and scaffolding|Fixing and fastening|Sealing and bonding|Repair and restoration|Demolition|Site safety|Maintenance|Furniture|Decor|Outdoor living",
);

export const ORIGINS = list(
  "United Arab Emirates|Saudi Arabia|Oman|Qatar|Bahrain|Kuwait|Egypt|Jordan|India|Pakistan|Bangladesh|China|Turkey|Italy|Spain|Germany|France|United Kingdom|Netherlands|Belgium|Sweden|Finland|Poland|Portugal|Greece|Malaysia|Indonesia|Vietnam|Thailand|Japan|South Korea|United States|Canada|Brazil|South Africa|Australia",
);

export const SIZES = list(
  "10 mm|12 mm|16 mm|20 mm|25 mm|32 mm|40 mm|50 mm|63 mm|75 mm|90 mm|110 mm|160 mm|200 mm|1/2 in|3/4 in|1 in|2 in|4 in|300 x 300 mm|300 x 600 mm|600 x 600 mm|600 x 1200 mm|800 x 800 mm|1200 x 2400 mm|1220 x 2440 mm (4 x 8 ft)|100 x 200 x 400 mm|200 x 200 x 400 mm|Small|Medium|Large|Extra large",
);
