/**
 * Global construction & home marketplace taxonomy: Department → Category → Subcategory → Product type.
 * One line per node, kept in a compact text form so it is easy to review and extend:
 *   D <department>
 *   C <category>                       (the 20 original category names are kept exactly)
 *   S <subcategory> | type; type; ...
 * Names must not contain ";" or "|". Slugs are derived from names; renaming a node creates a new one.
 */
export const TAXONOMY_TEXT = `
D Site Preparation & Earthworks
C Site Clearing & Demolition
S Demolition Tools & Breakers | Demolition hammers; Jackhammers; Concrete breakers; Wrecking bars; Sledgehammers
S Demolition Consumables | Diamond core bits; Cutting discs; Chisel bits; Dust suppression sprays
S Hoarding & Site Fencing | Temporary fence panels; Site hoarding sheets; Barrier bases; Fence clamps; Warning tape
S Debris Handling | Debris chutes; Skip bins; Rubble sacks; Waste containers; Wheelbarrows
C Excavation & Earthworks
S Fill & Backfill Materials | Selected fill; Crusher run; Road base; Type 1 sub-base; Marine sand fill; Topsoil
S Geotextiles & Ground Stabilisation | Geotextile fabric; Geogrids; Geocells; Erosion control mats; Soil stabiliser
S Shoring & Trench Support | Trench boxes; Hydraulic shores; Sheet piles; Trench sheets; Acrow props
S Dewatering | Submersible pumps; Well points; Discharge hoses; Sump pumps; Silt bags
C Surveying & Site Setup
S Survey Equipment | Total stations; Laser levels; Rotating lasers; Staff and tripods; Measuring wheels
S Marking & Layout | Marking paint; Pegs and stakes; String lines; Chalk lines; Survey nails
S Temporary Site Facilities | Site cabins; Portable toilets; Water tanks; Temporary power boards; Generators
S Site Signage | Safety signs; Project boards; Road signs; Reflective cones; Barrier tape

D Concrete, Cement & Masonry
C Cement
S Portland Cement | Ordinary Portland cement; Sulphate resistant cement; Rapid hardening cement; White cement; Low heat cement
S Blended Cement | Portland pozzolana cement; Slag cement; Fly ash cement; Composite cement
S Specialty Cement | Oil well cement; Masonry cement; Calcium aluminate cement; Tile grout cement
C Sand
S Building Sand | Washed sharp sand; Plastering sand; Red sand; Dune sand; Fine sand
S Silica & Industrial Sand | Silica sand; Filter sand; Blasting sand; Play sand; Golf bunker sand
C Gravel
S Aggregates | Crushed stone 10mm; Crushed stone 20mm; Crushed stone 40mm; Pea gravel; Coarse aggregate
S Decorative & Drainage Stone | River pebbles; Drainage gravel; Decorative gravel; Rip rap; Gabion stone
S Recycled Aggregates | Recycled concrete aggregate; Recycled base; Crushed brick
C Blocks
S Concrete Blocks | Hollow blocks; Solid blocks; Interlocking blocks; Load bearing blocks; Kerb blocks
S Lightweight Blocks | AAC blocks; Foam concrete blocks; Lightweight aggregate blocks; Pumice blocks
S Bricks | Clay bricks; Fly ash bricks; Facing bricks; Engineering bricks; Fire bricks
S Paving Blocks & Kerbs | Interlock pavers; Kerb stones; Cobble pavers; Grass pavers; Edge restraints
C Ready-Mix & Concrete Products
S Ready-Mix Concrete | Normal grade concrete; High strength concrete; Self compacting concrete; Screed mix; Pumpable concrete
S Precast Elements | Precast slabs; Precast columns; Precast beams; Manhole rings; Precast walls; Lintels
S Mortar & Screed | Ready mix mortar; Cement mortar; Self levelling screed; Bedding mortar; Plaster mix
C Concrete Admixtures & Chemicals
S Admixtures | Plasticisers; Superplasticisers; Retarders; Accelerators; Air entrainers; Waterproofing admixtures
S Curing & Release | Curing compounds; Form release agents; Bonding agents; Surface hardeners
S Repair Mortars & Grouts | Non-shrink grout; Epoxy grout; Structural repair mortar; Crack injection resin; Anchor grout
C Formwork & Falsework
S Formwork Systems | Plywood formwork; Steel formwork; Aluminium formwork; Plastic formwork; Column forms
S Formwork Accessories | Tie rods; Wing nuts; Spacers; Shutter clamps; Bar chairs; Cover blocks
S Scaffolding & Props | Cuplock scaffolding; Frame scaffolding; Adjustable props; Scaffold boards; Scaffold tubes; Base jacks
C Stone & Masonry Materials
S Natural Building Stone | Rubble stone; Dressed stone; Coral stone; Ashlar blocks; Stone lintels
S Masonry Accessories | Wall ties; Expansion joint fillers; Masonry reinforcement mesh; Damp proof courses; Lintel bars
S Masonry Tools | Brick trowels; Pointing tools; Jointers; Block splitters; Mortar boards

D Structural Steel & Metals
C Steel
S Reinforcing Steel | Rebar; Deformed bars; Steel mesh; Wire rod; Coiled rebar; Stainless rebar
S Structural Sections | I beams; H beams; Channels; Angles; Flat bars; Hollow sections
S Plates & Sheets | Mild steel plates; Checkered plates; Galvanised sheets; Stainless steel sheets; Perforated sheets
S Steel Pipes & Tubes | Black steel pipes; Galvanised pipes; Seamless pipes; Square tubes; Rectangular tubes
S Wire & Fasteners for Steel | Binding wire; Welding wire; Anchor bolts; Structural bolts; Washers and nuts
C Metals & Fabrication
S Aluminium Profiles | Extrusions; Angles; Channels; Flat sections; Window profiles
S Stainless Steel Products | Stainless pipes; Stainless fittings; Handrail tubes; Stainless sheets; Fasteners
S Structural Fabrication | Steel trusses; Portal frames; Mezzanine floors; Staircases; Steel gates
S Metal Decking & Profiles | Metal deck; Corrugated sheets; Sandwich panels; Purlins; Z sections
S Welding Supplies | Welding electrodes; MIG wire; Welding rods; Gas cylinders; Welding helmets
C Concrete Reinforcement Accessories
S Post-tensioning & Anchors | PT strands; Anchorage; Ducts; Chemical anchors; Expansion anchors
S Couplers & Splices | Rebar couplers; Threaded couplers; Lap splices; Dowel bars
C Piling & Foundation Works
S Piling Materials | Bored pile cages; Steel sheet piles; Precast piles; Pile caps; Casing tubes
S Foundation Accessories | Blinding sheets; Foundation waterproofing; Starter bars; Anchor cages; Void formers
S Ground Improvement | Vibro stone columns; Grouting materials; Bentonite; Soil nails; Ground anchors

D Plumbing, Sanitary & Water
C Plumbing
S Pipes | PPR pipes; uPVC pipes; CPVC pipes; HDPE pipes; Copper pipes; PEX pipes; Multilayer pipes
S Fittings | Elbows; Tees; Couplings; Reducers; Unions; Adapters; End caps
S Valves | Ball valves; Gate valves; Check valves; Butterfly valves; Pressure reducing valves; Float valves
S Drainage & Sewer | Drain pipes; Floor drains; Manhole covers; Gully traps; Inspection chambers; Soil pipes
S Pumps & Water Boosting | Booster pumps; Submersible pumps; Circulation pumps; Pressure vessels; Jockey pumps
S Water Tanks & Treatment | Water storage tanks; Septic tanks; Filtration units; Softeners; Chlorinators; Grease traps
S Water Heating | Electric water heaters; Solar water heaters; Heat pump heaters; Instant heaters; Boilers
S Plumbing Consumables | PTFE tape; Pipe sealant; Solvent cement; Pipe clips; Insulation sleeves
C Sanitaryware
S Toilets & Bidets | Wall hung WC; Floor standing WC; Close coupled WC; Bidets; Cisterns; Toilet seats
S Basins | Wall hung basins; Pedestal basins; Countertop basins; Undercounter basins; Vanity basins
S Bathroom Taps & Mixers | Basin mixers; Shower mixers; Bath fillers; Wall mixers; Bidet taps; Angle valves
S Showers | Rain showers; Hand showers; Shower columns; Concealed showers; Shower trays; Shower enclosures
S Bathtubs & Spas | Freestanding baths; Built-in baths; Corner baths; Whirlpool baths; Jacuzzis
S Bathroom Accessories | Towel rails; Soap dispensers; Toilet roll holders; Mirrors; Grab bars; Shelves
S Commercial Washroom | Urinals; Hand dryers; Partition cubicles; Sensor taps; Baby changing stations
C Water Supply & Irrigation Infrastructure
S Water Mains | Ductile iron pipes; GRP pipes; HDPE mains; Hydrants; Water meters; Air valves
S Boreholes & Wells | Borehole pumps; Casing pipes; Well screens; Pump controllers
S Rainwater Harvesting | Rainwater tanks; Gutter filters; First flush diverters; Harvesting pumps
C Gas & Fuel Systems
S Gas Piping | LPG pipes; Gas fittings; Regulators; Gas meters; Flexible gas hoses
S Gas Storage & Appliances | LPG cylinders; Gas tanks; Gas heaters; Gas stoves; Gas leak detectors
S Fuel Storage & Dispensing | Diesel tanks; Fuel dispensers; Fuel hoses; Nozzles; Oil separators

D Electrical, Lighting & Smart Home
C Electrical
S Cables & Wires | House wiring cables; Armoured cables; Flexible cables; Coaxial cables; Data cables; Earth cables; Solar cables
S Conduits & Trunking | PVC conduit; Flexible conduit; Cable trays; Cable ladders; Trunking; Cable glands
S Switchgear & Distribution | Distribution boards; MCBs; RCCBs; Isolators; Contactors; Busbars; Metering panels
S Switches & Sockets | Wall switches; Power sockets; USB sockets; Dimmers; Data outlets; Weatherproof sockets
S Transformers & Power | Distribution transformers; Generators; UPS systems; Voltage stabilisers; Inverters
S Earthing & Lightning Protection | Earth rods; Earth pits; Lightning conductors; Bonding clamps; Surge protectors
S Solar & Renewable Energy | Solar panels; Solar inverters; Mounting structures; Batteries; Charge controllers; EV chargers
C Lighting
S Indoor Lighting | LED downlights; Panel lights; Track lights; Pendant lights; Wall lights; Strip lights; Chandeliers
S Outdoor Lighting | Flood lights; Garden lights; Street lights; Bollard lights; Wall packs; Solar lights
S Industrial Lighting | High bay lights; Linear highbay; Explosion proof lights; Emergency lights; Tube lights
S Lamps & Drivers | LED bulbs; LED drivers; Tubes; Ballasts; Halogen lamps
C Smart Home & Security
S Home Automation | Smart switches; Smart hubs; Smart thermostats; Motion sensors; Smart curtains
S CCTV & Surveillance | IP cameras; NVRs; Dome cameras; Video doorbells; Camera brackets
S Access Control & Intercom | Door locks; Fingerprint readers; Video intercoms; Gate motors; Barrier gates
S Alarms & Detection | Burglar alarms; Smoke detectors; Gas detectors; Glass break sensors; Sirens
S Networking & Communications | Structured cabling; Routers; Access points; Patch panels; Fibre optic cables
C Power Cables & Utility
S Medium & High Voltage | MV cables; Cable joints; Ring main units; Cable terminations; Switchgear panels
S Substation Equipment | Substation transformers; Insulators; Lightning arresters; Disconnectors; Metering units
S Cable Accessories | Cable lugs; Heat shrink sleeves; Cable markers; Cable drums; Cable pulling tools
C Telecom & Data Centres
S Racks & Enclosures | Server racks; Wall cabinets; Patch panels; PDUs; Cable managers
S Data Centre Cooling & Power | Precision cooling; Rack UPS; Busway; Raised floor tiles; Fire suppression gas

D HVAC, Fire & Safety
C HVAC & Ventilation
S Air Conditioning | Split ACs; Ducted ACs; VRF systems; Chillers; Cassette units; Window ACs; Fan coil units
S Ventilation | Exhaust fans; Ventilation ducts; Air handling units; Fresh air units; Extractor fans; Louvres
S Ducting & Accessories | Galvanised ducts; Flexible ducts; Duct insulation; Dampers; Grilles and diffusers
S Refrigeration & Cold Rooms | Cold room panels; Compressors; Refrigerant gases; Condensing units; Copper line sets
S Heating | Radiators; Underfloor heating; Space heaters; Heat exchangers
C Fire Protection
S Fire Fighting Systems | Sprinklers; Fire pumps; Hose reels; Fire hydrants; Fire extinguishers; Fire hoses
S Fire Detection & Alarm | Fire alarm panels; Smoke detectors; Heat detectors; Manual call points; Fire sirens
S Passive Fire Protection | Fire rated doors; Fire stopping; Intumescent paint; Fire boards; Fire blankets
C Safety materials
S Personal Protective Equipment | Safety helmets; Safety shoes; Gloves; Safety glasses; Ear protection; Respirators; High visibility vests
S Fall Protection | Safety harnesses; Lanyards; Life lines; Safety nets; Anchor points; Guard rails
S Site Safety Equipment | First aid kits; Safety barriers; Fire blankets; Spill kits; Eye wash stations; Warning lights
S Traffic & Road Safety | Traffic cones; Road studs; Speed bumps; Barriers; Reflective tapes
C Elevators & Vertical Transport
S Lifts | Passenger lifts; Goods lifts; Home lifts; Hospital lifts; Dumbwaiters; Car lifts
S Escalators & Moving Walks | Escalators; Moving walkways; Handrails; Steps and combs; Escalator parts
S Lift Components | Lift doors; Lift ropes; Control panels; Guide rails; Car interiors
C Building Automation & Controls
S Building Management Systems | BMS controllers; Sensors; Actuators; Gateways; Energy meters
S Controls & Sensors | Thermostats; Occupancy sensors; CO2 sensors; Flow meters; Pressure transmitters

D Roofing, Insulation & Waterproofing
C Roofing
S Roof Sheets & Tiles | Concrete roof tiles; Clay roof tiles; Metal roof sheets; Corrugated sheets; Polycarbonate sheets; Roof slates
S Roof Structure | Roof trusses; Purlins; Rafters; Battens; Roof brackets
S Roof Drainage | Gutters; Downpipes; Roof drains; Gutter guards; Rainwater outlets
S Roof Accessories | Ridge caps; Flashings; Skylights; Roof vents; Roof hatches; Sealants
S Membranes & Underlays | Roof underlay; Breathable membranes; Bitumen felt; TPO membranes; PVC membranes
C Insulation
S Thermal Insulation | Rockwool; Glass wool; XPS boards; EPS boards; PIR boards; Spray foam; Reflective foil
S Acoustic Insulation | Acoustic panels; Acoustic mats; Sound barriers; Acoustic sealants; Resilient channels
S Pipe & Duct Insulation | Nitrile rubber insulation; Pipe lagging; Duct wraps; Foam sleeves
S Cladding Insulation | ETICS systems; Insulated render; Cavity wall insulation; Insulation fixings
C Waterproofing
S Liquid Membranes | Polyurethane membranes; Acrylic membranes; Cementitious coatings; Bitumen emulsion; Epoxy sealers
S Sheet Membranes | APP membranes; SBS membranes; PVC sheets; HDPE sheets; Self adhesive membranes
S Sealants & Waterstops | Polyurethane sealants; Silicone sealants; Hydrophilic waterstops; PVC waterstops; Joint fillers
S Damp Proofing | Damp proof courses; Injection creams; Tanking slurries; Basement systems
C Green Building Materials
S Green Roofs & Walls | Green roof substrates; Drainage boards; Root barriers; Vertical garden systems; Sedum mats
S Low-impact Materials | Recycled steel; Low VOC paints; Bamboo products; Recycled plastic lumber; Hempcrete
S Energy & Water Saving | Solar reflective coatings; Low flow fittings; Greywater systems; Cool roof paint; Daylight tubes

D Walls, Ceilings & Partitions
C Gypsum
S Gypsum Boards | Standard plasterboard; Moisture resistant boards; Fire rated boards; Acoustic boards; Impact resistant boards
S Board Framing | Metal studs; Tracks; Furring channels; Suspension systems; Corner beads
S Board Finishing | Jointing compound; Joint tape; Screws; Plaster; Skim coat
S Ceiling Systems | Suspended ceiling tiles; Grid systems; Ceiling access panels; Bulkhead kits; Stretch ceilings
C Partitions & Wall Panels
S Partition Systems | Glass partitions; Movable partitions; Demountable partitions; Toilet partitions; Cabin walls
S Wall Panels | 3D wall panels; Acoustic wall panels; WPC panels; Stone veneer; Fluted panels; PVC panels
S Cladding | Aluminium composite panels; Fibre cement boards; HPL cladding; Timber cladding; Terracotta cladding
C Plaster, Render & Screed
S Plasters | Gypsum plaster; Cement plaster; Lime plaster; Decorative plaster; Skim coats
S External Render | Acrylic render; Textured render; Mineral render; Render mesh; Render beads
S Screeds & Toppings | Sand cement screed; Flowing screed; Floor hardeners; Levelling compound
C Facade & Cladding Systems
S Ventilated Facades | Facade sub-frames; ACP cladding; Stone cladding fixings; Terracotta panels; Ceramic facade panels
S Glass Facades | Unitised curtain wall; Spider glazing; Glass fins; Facade sealants; Structural silicone
S Facade Maintenance | Cradles; Building maintenance units; Facade cleaning supplies; Anchor points; Lifelines

D Doors, Windows & Glazing
C Doors
S Interior Doors | Flush doors; Panel doors; Glass doors; Sliding doors; Barn doors; Pocket doors; Folding doors
S Exterior & Security Doors | Steel security doors; Entrance doors; Wooden entrance doors; Aluminium doors; Composite doors
S Fire & Industrial Doors | Fire rated doors; Roller shutters; Sectional doors; High speed doors; Loading dock doors
S Garage & Gate Doors | Sectional garage doors; Up and over doors; Sliding gates; Swing gates; Automatic openers
S Door Hardware | Door locks; Hinges; Handles; Door closers; Door stoppers; Digital locks; Door viewers
S Door Frames | Timber frames; Steel frames; Aluminium frames; Architraves
C Windows
S Window Systems | Aluminium windows; uPVC windows; Timber windows; Sliding windows; Casement windows; Tilt and turn windows
S Glazing | Tempered glass; Laminated glass; Double glazing units; Low-E glass; Tinted glass; Mirrors; Glass blocks
S Curtain Wall & Storefront | Curtain wall systems; Structural glazing; Storefront frames; Glass railings; Skylights
S Window Hardware & Screens | Window handles; Hinges; Fly screens; Roller blinds; Security grilles; Shutters
S Louvres & Shading | Aluminium louvres; External blinds; Pergola louvres; Sun screens; Awnings
C Architectural Hardware & Security
S Locks & Security | Mortice locks; Padlocks; Safes; Deadbolts; Cylinder locks; Master key systems
S Automatic Entrances | Sliding door operators; Revolving doors; Swing door operators; Push plates; Sensors
S Architectural Metalwork | Steel doors and screens; Balustrade posts; Louvre doors; Grilles; Ornamental gates

D Flooring, Tiles & Wall Finishes
C Tiles
S Floor Tiles | Porcelain tiles; Ceramic tiles; Vitrified tiles; Marble look tiles; Outdoor tiles; Anti-slip tiles
S Wall Tiles | Ceramic wall tiles; Mosaic tiles; Subway tiles; Glass tiles; Decorative tiles
S Natural Stone | Marble; Granite; Limestone; Travertine; Slate; Sandstone; Quartz slabs
S Tile Installation Materials | Tile adhesive; Tile grout; Tile trims; Spacers; Levelling clips; Tile cutters
S Large Format & Slabs | Sintered stone slabs; Porcelain slabs; Quartz countertops; Marble slabs
C Flooring
S Wood & Laminate Flooring | Solid wood; Engineered wood; Laminate; Parquet; Bamboo flooring; Skirting boards
S Vinyl & Resilient Flooring | Vinyl planks; Vinyl sheets; LVT tiles; Rubber flooring; Linoleum
S Carpets & Rugs | Carpet tiles; Broadloom carpet; Rugs; Carpet underlay; Entrance mats
S Industrial & Epoxy Flooring | Epoxy floor coatings; Polished concrete; Anti-static flooring; Floor paint; Hardener toppings
S Raised & Access Floors | Raised floor panels; Pedestals; Access floor tiles; Cable floor systems
C Wallcoverings & Decorative Finishes
S Wallpapers & Coverings | Wallpaper; Vinyl wall coverings; Fabric wall coverings; Murals; Cork panels
S Decorative Stone & Brick | Stone cladding; Brick slips; Faux stone; Feature walls; Pebble finishes
S Mouldings & Trims | Cornices; Skirting; Architraves; Dado rails; Ceiling roses; Column wraps
C Decking & Outdoor Paving
S Decking | Composite decking; Timber decking; Deck tiles; Deck fixings; Deck joists
S Outdoor Paving | Porcelain pavers; Natural stone pavers; Paver pedestals; Grass grids; Permeable pavers
S Pool & Wet Area Surfaces | Anti-slip coating; Pool surrounds; Shower floors; Textured tiles; Drain grates

D Paints, Coatings & Adhesives
C Paint
S Interior Paints | Emulsion paint; Matt paint; Silk paint; Kitchen and bath paint; Ceiling paint; Primer sealer
S Exterior Paints | Weatherproof paint; Textured coatings; Elastomeric paint; Masonry paint; Anti-fungal paint
S Wood & Metal Coatings | Wood stain; Varnish; Wood oil; Enamel paint; Metal primer; Anti-rust paint; Hammerite
S Specialty Paints | Fire retardant paint; Anti-corrosion paint; Chalkboard paint; Heat resistant paint; Road marking paint
S Painting Tools & Supplies | Rollers; Brushes; Spray guns; Masking tape; Paint trays; Drop sheets; Scrapers
C Adhesives & Sealants
S Construction Adhesives | Contact adhesive; PU adhesive; Epoxy adhesive; Wood glue; Construction glue; Mounting adhesive
S Sealants & Fillers | Silicone; Acrylic sealant; Polyurethane sealant; Wall filler; Wood filler; Expanding foam
S Tapes & Films | Duct tape; Double sided tape; Masking tape; Protective film; Damp course tape
C Protective & Industrial Coatings
S Epoxy & Polyurethane Coatings | Epoxy coatings; PU coatings; Zinc rich primer; Coal tar epoxy; Tank linings
S Anti-corrosion & Marine | Marine coatings; Galvanising paint; Corrosion inhibitors; Pipe wrap tape
C Wood Care & Preservation
S Timber Treatment | Wood preservatives; Termite treatments; Fungicides; Fire retardant treatments; End grain sealers
S Wood Finishes | Decking oil; Lacquer; Polyurethane varnish; Wax; Stain blockers; Sanding sealers

D Kitchens, Bathrooms & Fitted Interiors
C Kitchens
S Kitchen Cabinets | Base cabinets; Wall cabinets; Tall units; Corner units; Pantry units; Kitchen islands
S Worktops & Splashbacks | Granite worktops; Quartz worktops; Laminate worktops; Solid surface; Glass splashbacks; Stainless worktops
S Kitchen Sinks & Taps | Single bowl sinks; Double bowl sinks; Undermount sinks; Kitchen mixers; Pull out taps; Waste disposers
S Kitchen Fittings | Drawer runners; Hinges; Handles; Pull out baskets; Bin systems; Lift up systems
S Built-in Appliances | Built-in ovens; Hobs; Cooker hoods; Built-in microwaves; Built-in dishwashers; Built-in fridges
C Bathrooms & Wet Rooms
S Bathroom Furniture | Vanity units; Mirror cabinets; Storage towers; Bathroom shelves; Laundry cabinets
S Wet Room Systems | Linear drains; Shower waterproofing; Wet room trays; Wetroom panels
S Bathroom Heating & Ventilation | Heated towel rails; Bathroom fans; Underfloor mats; Heat lamps
C Wardrobes & Joinery
S Wardrobes & Closets | Sliding wardrobes; Walk-in wardrobes; Wardrobe interiors; Dressing units; Shoe cabinets
S Custom Joinery Materials | MDF; Plywood; Blockboard; Particle board; HPL laminates; Edge banding; Veneers
S Joinery Hardware | Hinges; Drawer slides; Handles; Locks; Shelf supports; Cam locks
C Staircases & Railings
S Staircases | Timber stairs; Steel stairs; Glass stairs; Spiral stairs; Stair treads; Stair nosings
S Railings & Balustrades | Glass balustrades; Stainless railings; Wrought iron railings; Handrails; Baluster posts
C Laundry & Utility Rooms
S Laundry Fittings | Utility sinks; Laundry cabinets; Drying racks; Ironing boards; Washing machine stands
S Utility Storage | Broom cupboards; Wall storage; Shelving; Mudroom benches; Pegboards

D Furniture, Appliances & Decor
C Furniture
S Living Room | Sofas; Armchairs; Coffee tables; TV units; Bookcases; Side tables; Recliners
S Bedroom | Beds; Mattresses; Bedside tables; Wardrobes; Dressers; Bed frames; Headboards
S Dining & Kitchen Furniture | Dining tables; Dining chairs; Bar stools; Buffets; Kitchen carts; Sideboards
S Home Office | Office desks; Office chairs; Filing cabinets; Bookshelves; Standing desks; Meeting tables
S Outdoor Furniture | Garden sets; Loungers; Outdoor sofas; Parasols; Swings; Hammocks; Benches
S Commercial & Contract Furniture | Reception desks; Hotel furniture; Restaurant seating; School furniture; Lockers; Waiting area seating
C Home Appliances
S Cooking Appliances | Cookers; Ovens; Microwaves; Air fryers; Induction hobs; Cooker hoods
S Refrigeration Appliances | Refrigerators; Freezers; Wine coolers; Ice makers; Mini bars
S Laundry Appliances | Washing machines; Tumble dryers; Washer dryers; Irons; Steamers
S Cleaning & Air Care | Vacuum cleaners; Robot vacuums; Air purifiers; Dehumidifiers; Humidifiers
S Small Home Appliances | Kettles; Toasters; Blenders; Coffee machines; Water dispensers; Fans
C Home Decor & Furnishings
S Curtains & Blinds | Curtains; Roller blinds; Venetian blinds; Roman blinds; Curtain rails; Motorised blinds
S Wall Decor | Wall art; Mirrors; Wall clocks; Wall shelves; Frames; Wall stickers
S Rugs & Soft Furnishings | Rugs; Cushions; Throws; Bedding; Towels; Table linen
S Lighting Decor | Table lamps; Floor lamps; Lanterns; Decorative pendants; Candles
S Storage & Organisation | Shelving units; Storage boxes; Shoe racks; Closet organisers; Garage storage
C Home Entertainment & Technology
S Audio Visual | Televisions; Projectors; Soundbars; Home cinema speakers; TV mounts
S Networking & Devices | Wi-Fi routers; Mesh systems; Smart speakers; Media players; Cable management
C Kids & Baby Rooms
S Kids Furniture | Cribs; Bunk beds; Study desks; Toy storage; Kids wardrobes
S Safety & Play | Safety gates; Corner guards; Play mats; Night lights; Window guards

D Landscaping, Outdoor & Pools
C Landscaping Materials
S Soil & Growing Media | Topsoil; Compost; Potting mix; Mulch; Peat moss; Soil conditioner; Fertilisers
S Plants & Turf | Natural grass; Artificial grass; Palm trees; Shrubs; Flowering plants; Ground cover; Seeds
S Hardscape | Paving stones; Retaining wall blocks; Edging; Steps; Gabion baskets; Decorative rocks
S Garden Structures | Pergolas; Gazebos; Trellis; Fences; Garden sheds; Planters; Arbours
C Irrigation
S Irrigation Systems | Drip irrigation; Sprinklers; Irrigation controllers; Rain sensors; Valve boxes
S Irrigation Pipes & Fittings | Poly pipes; Drip tubes; Fittings; Filters; Hose reels; Tap timers
C Swimming Pools & Water Features
S Pool Construction | Pool shells; Pool liners; Pool tiles; Pool coping; Skimmers; Pool lights
S Pool Equipment | Pool pumps; Filters; Heaters; Chlorinators; Robotic cleaners; Covers
S Pool Chemicals & Care | Chlorine; pH adjusters; Algaecides; Test kits; Pool brushes; Pool nets
S Water Features | Fountains; Waterfalls; Ponds; Pond liners; Fountain pumps; Statues
C Outdoor Living
S Outdoor Kitchens & BBQ | BBQ grills; Outdoor kitchens; Pizza ovens; Fire pits; Smokers
S Shade & Outdoor Structures | Shade sails; Car parking shades; Awnings; Canopies; Pergola roofs
S Playgrounds & Sports Surfaces | Playground equipment; Rubber tiles; Sports flooring; Synthetic turf; Goal posts; Padel courts
S Fencing & Gates | Chain link fence; Timber fence; Metal fence; Palisade fence; Garden gates; Fence posts
C Garden Tools & Equipment
S Lawn & Garden Machinery | Lawn mowers; Hedge trimmers; Leaf blowers; Chainsaws; Brush cutters; Garden tractors
S Hand Garden Tools | Spades; Rakes; Pruners; Shears; Trowels; Wheelbarrows
S Watering & Spraying | Garden hoses; Sprayers; Hose reels; Watering cans; Sprinkler heads

D Hardware, Tools & Equipment
C Hardware
S Fasteners | Screws; Nails; Bolts; Nuts; Washers; Rivets; Anchors; Threaded rods
S Fixings & Brackets | Angle brackets; Shelf brackets; Wall plugs; Hangers; Cable clips; Joist hangers
S Builders Hardware | Hinges; Latches; Bolts; Chains; Padlocks; Castors; Handles
S Ropes, Chains & Rigging | Wire ropes; Chain slings; Shackles; Hooks; Turnbuckles; Tie down straps
S Abrasives & Cutting | Sandpaper; Grinding discs; Cutting discs; Drill bits; Saw blades; Wire brushes
C Tools
S Power Tools | Drills; Angle grinders; Circular saws; Rotary hammers; Jigsaws; Sanders; Routers; Impact drivers
S Hand Tools | Hammers; Screwdrivers; Pliers; Spanners; Saws; Chisels; Tape measures; Spirit levels; Trowels
S Cordless Tools | Cordless drills; Battery packs; Chargers; Cordless grinders; Cordless saws
S Tool Storage | Tool boxes; Tool bags; Workbenches; Trolleys; Tool belts
S Air & Pneumatic Tools | Air compressors; Nail guns; Air hoses; Spray guns; Impact wrenches
C Construction Equipment
S Concrete Equipment | Concrete mixers; Vibrators; Power trowels; Concrete pumps; Screeds; Cutters
S Lifting & Access | Cranes; Hoists; Forklifts; Scissor lifts; Boom lifts; Pallet trucks; Chain blocks
S Earthmoving Machinery | Excavators; Loaders; Backhoes; Bulldozers; Rollers; Compactors; Dump trucks
S Compaction & Cutting Machines | Plate compactors; Rammers; Floor saws; Core drilling machines; Wall chasers
S Power Generation | Diesel generators; Portable generators; Light towers; Welders; Power distribution
S Equipment Rental & Spares | Machine spare parts; Hydraulic hoses; Filters; Tyres; Attachments; Buckets
C Measuring & Testing Instruments
S Site Measuring | Laser distance meters; Measuring tapes; Levels; Plumb bobs; Clinometers
S Materials Testing | Concrete cube moulds; Slump cones; Rebound hammers; Sieves; Moisture meters; Thermal cameras
S Electrical Testing | Multimeters; Insulation testers; Earth testers; Clamp meters; Cable locators
C Welding & Metalworking
S Welding Machines | MIG welders; TIG welders; Arc welders; Plasma cutters; Spot welders
S Metalworking Tools | Bench grinders; Pipe benders; Bench vices; Metal saws; Drill presses
C Ladders & Access Equipment
S Ladders | Step ladders; Extension ladders; Telescopic ladders; Platform ladders; Loft ladders
S Access Platforms | Mobile towers; Trestles; Work platforms; Scaffold stairs; Podium steps

D Maintenance, Repair & Renovation
C Building Maintenance
S Cleaning Supplies | Cleaning chemicals; Mops; Buckets; Brooms; Pressure washers; Floor scrubbers; Microfibre cloths
S Repair Compounds | Wall fillers; Crack repair; Concrete patch; Wood repair; Epoxy putty; Leak sealers
S Electrical Maintenance | Bulb replacements; Spare switches; Circuit testers; Breaker replacements; Fuses
S Plumbing Repairs | Tap washers; Cistern parts; Pipe repair clamps; Drain cleaners; Leak sealants; Flush kits
S Pest Control & Protection | Termite treatment; Insecticides; Rodent control; Anti-termite barriers; Bird deterrents
C Renovation & Remodeling
S Demolition & Strip-out Materials | Protection sheeting; Dust barriers; Floor protection; Skips; Strip-out tools
S Refurbishment Finishes | Overlay tiles; Wall paints; Floor refinishing; Cabinet refacing; Spray coatings
S Facade Renovation | Facade paints; Cladding replacement; Render repair; Window refit kits; Pressure cleaning
S Energy Efficiency Upgrades | Window films; Insulation upgrades; LED retrofit; Smart thermostats; Solar retrofit
S Accessibility Upgrades | Ramps; Grab rails; Stair lifts; Wider doors; Tactile paving
C Other construction materials
S Miscellaneous Building Materials | Bitumen; Lime; Plastic sheeting; Polythene; Timber; Wooden pallets; Cable ties
S Timber & Boards | Softwood timber; Hardwood; Plywood; OSB; Marine plywood; Treated timber; Pallets
S Packaging & Site Consumables | Tarpaulins; Sandbags; Cable drums; Cartons; Stretch film; Rope
S Specialty Construction Chemicals | Rust removers; Descalers; Release oils; Solvent cleaners; Dust binders
C Waste, Recycling & Environmental
S Waste Handling | Waste bins; Compactors; Recycling stations; Medical waste bins; Skip liners
S Environmental Protection | Silt fences; Spill kits; Oil separators; Dust control; Noise barriers
C Facilities Management Supplies
S Housekeeping & Hygiene | Sanitisers; Tissue dispensers; Trash liners; Air fresheners; Floor mats
S Grounds & Building Care | De-icing; Sealcoats; Line marking; Drain cleaning; Pest traps

D Commercial, Industrial & Infrastructure
C Roads & Civil Infrastructure
S Road Materials | Asphalt; Bitumen emulsion; Road base; Kerb stones; Road paint; Tack coat
S Drainage & Utilities | Concrete pipes; Manholes; Culverts; Catch basins; Trench drains; Duct banks
S Bridges & Marine Works | Bearings; Expansion joints; Piles; Fenders; Marine concrete; Rip rap
S Utility Ducts & Cables Infrastructure | HDPE ducts; Cable markers; Cable covers; Warning tapes; Draw pits
C Industrial Building Systems
S Pre-Engineered Buildings | Steel warehouse kits; Portal frame sheds; Sandwich panel buildings; Modular cabins
S Industrial Flooring & Racking | Warehouse racking; Industrial floors; Dock levellers; Mezzanines; Pallet racks
S Process Piping & Valves | Carbon steel piping; Flanges; Gaskets; Industrial valves; Pipe supports; Steam traps
S Tanks & Silos | Steel tanks; GRP tanks; Silos; Bunded tanks; Fuel tanks
C Commercial Fit-out
S Retail Fit-out | Shopfronts; Display shelving; Counters; Mannequins; Retail lighting; Signage
S Office Fit-out | Partitions; Raised floors; Ceiling systems; Workstations; Acoustic pods; Cable management
S Hospitality Fit-out | Kitchen equipment; Restaurant furniture; Bar counters; Hotel fixtures; Laundry equipment
S Healthcare & Education Fit-out | Medical gas systems; Lab furniture; Antibacterial flooring; School fixtures; Sports flooring
C Modular & Prefabricated Construction
S Prefab Units | Container homes; Portable cabins; Modular bathrooms; Prefab villas; Guard houses
S Structural Insulated Panels | SIP panels; Light gauge steel frames; CLT panels; Cross laminated timber; Glulam beams
C Energy & Utilities Infrastructure
S Solar Farms & Storage | Utility inverters; Solar trackers; Battery energy storage; Combiner boxes; Mounting piles
S Power Plants & Substations | Generator sets; Switchyards; Cooling systems; Fuel handling; Control rooms
S EV Charging Infrastructure | AC chargers; DC fast chargers; Charger pedestals; Load management; Charging cables
C Agriculture & Farm Buildings
S Greenhouses | Polycarbonate greenhouses; Shade nets; Grow lights; Hydroponic systems; Greenhouse fans
S Farm Structures | Livestock housing; Grain silos; Feed storage; Farm fencing; Barn kits
S Farm Water & Irrigation | Centre pivots; Drip lines; Pumps; Water troughs; Filtration
`;
