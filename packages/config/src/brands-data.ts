/**
 * Seed list of well-known building-product manufacturers and the brands they market.
 * Format: `M Name | ISO country` starts a manufacturer; the `B` lines under it list its brands
 * separated by semicolons. Suppliers can always add brands and manufacturers not listed here;
 * this list only makes the common ones pickable and correctly grouped from day one.
 */
export const MANUFACTURER_TEXT = `
M Holcim | CH
B Holcim; Aggregate Industries
M Heidelberg Materials | DE
B Heidelberg Materials; Hanson; Italcementi; Lehigh Hanson
M CEMEX | MX
B CEMEX
M UltraTech Cement | IN
B UltraTech; Birla White
M Gulf Cement | AE
B Gulf Cement
M Union Cement | AE
B Union Cement
M Saint-Gobain | FR
B Saint-Gobain; Gyproc; Isover; Weber; PAM; Ecophon; CertainTeed; Norton; Sekurit; Placo
M Sika | CH
B Sika; SikaTop; Sikaflex; SikaBond; Sikalastic; SikaGrout; Sikament
M Fosroc | GB
B Fosroc; Nitoflor; Conbextra; Nitoproof; Renderoc
M Mapei | IT
B Mapei; Planitop; Ultracolor; Keraflex; Mapelastic
M Knauf | DE
B Knauf; Knauf Insulation; Knauf AMF; Knauf Gips
M USG | US
B USG; Sheetrock; Durock; Ceilings Plus
M Etex | BE
B Etex; Promat; Eternit; Cedral; Equitone; Siniat
M Rockwool | DK
B Rockwool; Rockpanel; Rockfon
M Kingspan | IE
B Kingspan; Kooltherm; Quadcore; Nu-Air
M Owens Corning | US
B Owens Corning; Foamular; Pink Fiberglas; Duration Shingles
M Tata Steel | IN
B Tata Steel; Tata Tiscon; Tata Shaktee
M Emirates Steel Arkan | AE
B Emirates Steel; Arkan
M ArcelorMittal | LU
B ArcelorMittal
M Hilti | LI
B Hilti
M Fischer | DE
B fischer; fischer Duopower
M Simpson Strong-Tie | US
B Simpson Strong-Tie
M Bosch | DE
B Bosch Professional; Bosch Home; Bosch Thermotechnology
M Makita | JP
B Makita
M DeWalt / Stanley Black & Decker | US
B DeWalt; Stanley; Black+Decker; Irwin; Lenox; Craftsman; Bostitch
M Festool | DE
B Festool
M 3M | US
B 3M; Scotch; Command
M Caterpillar | US
B Cat; Caterpillar
M JCB | GB
B JCB
M Komatsu | JP
B Komatsu
M Volvo Construction Equipment | SE
B Volvo CE
M Hyundai Construction Equipment | KR
B Hyundai CE
M Liebherr | CH
B Liebherr
M Atlas Copco | SE
B Atlas Copco; Chicago Pneumatic; Edwards
M Wacker Neuson | DE
B Wacker Neuson
M Putzmeister | DE
B Putzmeister; Schwing
M Ingersoll Rand | US
B Ingersoll Rand
M Husqvarna | SE
B Husqvarna; Gardena
M Geberit | CH
B Geberit
M LIXIL | JP
B American Standard; Grohe; INAX; GROHE
M Kohler | US
B Kohler; Sterling; Robern
M Roca | ES
B Roca; Laufen
M Duravit | DE
B Duravit
M Villeroy & Boch | DE
B Villeroy & Boch
M Hansgrohe | DE
B Hansgrohe; AXOR; Pharo
M TOTO | JP
B TOTO
M Jaquar | IN
B Jaquar
M RAK Ceramics | AE
B RAK Ceramics; RAKstone
M Kajaria | IN
B Kajaria; Kajaria Eternity
M Porcelanosa | ES
B Porcelanosa; Venis; Gamadecor; Urbatek
M Marazzi | IT
B Marazzi; Ragno
M Mohawk | US
B Mohawk; Daltile; Quick-Step; Pergo; Unilin; American Olean
M Tarkett | FR
B Tarkett; Desso; Johnsonite
M Interface | US
B Interface
M Forbo | CH
B Forbo; Marmoleum; Allura
M Kronospan | AT
B Kronospan; Kronodesign
M Egger | AT
B Egger
M Wienerberger | AT
B Wienerberger; Porotherm; Terca; Semmelrock; Pipelife
M Aliaxis | BE
B Aliaxis; Marley; Nicoll
M Uponor | FI
B Uponor
M Georg Fischer | CH
B GF Piping Systems; Georg Fischer
M Wavin | NL
B Wavin
M Polypipe | GB
B Polypipe; Terrain; Nu-Heat
M Astral | IN
B Astral; Astral Pipes; Seal-IT
M Finolex | IN
B Finolex
M Supreme Industries | IN
B Supreme
M Gulf Extrusions | AE
B Gulf Extrusions
M Danfoss | DK
B Danfoss
M Grundfos | DK
B Grundfos
M Xylem | US
B Xylem; Lowara; Flygt; Bell & Gossett
M Pentair | US
B Pentair; Sta-Rite
M Wilo | DE
B Wilo
M Daikin | JP
B Daikin; Goodman; Amana
M Carrier | US
B Carrier; Toshiba Carrier; Bryant
M Trane | US
B Trane; American Standard Heating & Air
M Mitsubishi Electric | JP
B Mitsubishi Electric
M LG Electronics | KR
B LG
M Samsung | KR
B Samsung
M Panasonic | JP
B Panasonic
M Midea | CN
B Midea; Toshiba Home Appliances
M Gree | CN
B Gree
M York (JCI) | US
B York; Johnson Controls
M Schneider Electric | FR
B Schneider Electric; Merlin Gerin; Square D; Clipsal; APC
M ABB | CH
B ABB; Busch-Jaeger
M Siemens | DE
B Siemens
M Legrand | FR
B Legrand; Bticino; Vantage
M Eaton | IE
B Eaton; Cooper Bussmann; MEM
M Hager | DE
B Hager
M Havells | IN
B Havells; Crabtree; Lloyd
M Polycab | IN
B Polycab
M Ducab | AE
B Ducab
M Nexans | FR
B Nexans
M Prysmian | IT
B Prysmian; Draka
M Philips Lighting (Signify) | NL
B Philips Lighting; Signify; Philips Hue; WiZ
M Osram | DE
B Osram; Ledvance; Sylvania
M Cree Lighting | US
B Cree
M Assa Abloy | SE
B Assa Abloy; Yale; Chubb; Abloy; Mul-T-Lock; HID; Ceco
M dormakaba | CH
B dormakaba; Dorma; Kaba
M Allegion | IE
B Schlage; Allegion; LCN
M Hikvision | CN
B Hikvision
M Dahua | CN
B Dahua
M Kone | FI
B Kone
M Otis | US
B Otis
M Schindler | CH
B Schindler
M thyssenkrupp Elevator | DE
B TK Elevator
M Sherwin-Williams | US
B Sherwin-Williams; Dutch Boy; Krylon; Valspar; Minwax
M PPG | US
B PPG; Glidden; Olympic
M AkzoNobel | NL
B Dulux; International; Sikkens; Interpon; Hammerite
M Jotun | NO
B Jotun; Jotashield; Fenomastic; Majestic
M Nippon Paint | JP
B Nippon Paint
M Asian Paints | IN
B Asian Paints; Apcolite; Royale; Ultima
M Berger Paints | IN
B Berger; Luxol
M National Paints | AE
B National Paints
M Caparol | DE
B Caparol; DAW
M Benjamin Moore | US
B Benjamin Moore
M RPM International | US
B Rust-Oleum; DAP; Zinsser; Tremco; Carboline; Dryvit
M Pilkington (NSG Group) | JP
B Pilkington
M AGC | JP
B AGC; Glaverbel; Lacobel; Planibel
M Guardian Glass | US
B Guardian
M Emirates Glass | AE
B Emirates Glass
M Schüco | DE
B Schüco
M Reynaers | BE
B Reynaers
M Hydro | NO
B Hydro; Sapa; Wicona; Technal
M Alucobond | DE
B Alucobond; 3A Composites
M Andersen Windows | US
B Andersen; Renewal by Andersen
M Pella | US
B Pella
M VELUX | DK
B Velux
M Jeld-Wen | US
B JELD-WEN; Swedoor; Dekko
M Masonite | US
B Masonite
M GAF | US
B GAF; Timberline
M IKO | CA
B IKO; Cambridge; Marathon
M Carlisle | US
B Carlisle SynTec; Carlisle Coatings; Hunter Panels
M Firestone Building Products | US
B Firestone; UltraPly; RubberGard
M Bauder | DE
B Bauder
M Monier / Braas | DE
B Braas; Monier; Lafarge Roofing
M BlueScope | AU
B BlueScope; Colorbond; Zincalume; Lysaght
M Trex | US
B Trex
M Azek | US
B Azek; TimberTech
M Weyerhaeuser | US
B Weyerhaeuser; Trus Joist
M West Fraser | CA
B West Fraser
M IKEA | SE
B IKEA
M Ashley Furniture | US
B Ashley
M Herman Miller | US
B Herman Miller; Knoll; Geiger
M Steelcase | US
B Steelcase; Coalesse; Turnstone
M Whirlpool | US
B Whirlpool; Maytag; KitchenAid; Jenn-Air; Indesit
M BSH Home Appliances | DE
B Bosch; Neff; Gaggenau; Thermador
M Electrolux | SE
B Electrolux; AEG; Frigidaire; Zanussi
M Haier | CN
B Haier; GE Appliances; Candy; Hoover
M Miele | DE
B Miele
M Franke | CH
B Franke
M Blanco | DE
B Blanco
M Kärcher | DE
B Karcher
M Scotts Miracle-Gro | US
B Scotts; Miracle-Gro; Ortho
M Toro | US
B Toro; Lawn-Boy; Exmark
M Deere & Company | US
B John Deere
M STIHL | DE
B STIHL; Viking
M Rain Bird | US
B Rain Bird
M Hunter Industries | US
B Hunter
M Netafim | IL
B Netafim
M Werner Co. | US
B Werner
M Louisville Ladder | US
B Louisville Ladder
M Krause | DE
B Krause
M Leica Geosystems | CH
B Leica Geosystems
M Trimble | US
B Trimble
M Topcon | JP
B Topcon
M Fluke | US
B Fluke
M Lincoln Electric | US
B Lincoln Electric; Harris; Kester
M ESAB | SE
B ESAB
M Miller Electric | US
B Miller
M Kemppi | FI
B Kemppi
M Soudal | BE
B Soudal; Soudafoam; Soudaseal
M Henkel | DE
B Henkel; Loctite; Pattex; Ceresit; Pritt; Technomelt
M Bostik | FR
B Bostik
M Zamil Steel | SA
B Zamil Steel
M Kirby Building Systems | KW
B Kirby
M Master Builders Solutions | CH
B MasterBrix; MasterEmaco; MasterGlenium; MasterSeal; MasterFlow
M Pidilite | IN
B Dr. Fixit; Fevicol; Fevikwik; M-Seal
M Koki Holdings | JP
B HiKOKI; Metabo HPT
M Metabo | DE
B Metabo
M Techtronic Industries | HK
B Milwaukee
M Armstrong World Industries | US
B Armstrong Ceilings
`;
