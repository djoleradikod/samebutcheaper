# R8: catalogue additions, 13 November 2026

All prices below were read on 13 Nov 2026 from the retailer's product page. Each medicine price was read twice on the product page.
Where the search listing showed a different price, we used the product page and note it in the record. Every record has
`price_checked: "2026-11"` and two hand observations (one for each side) in `data/prices/observations/2026-11.jsonl`. They were
logged with `npm run prices:refresh -- --manual`, method `hand`, and the retailer as source.

Stores read: aponeo.de, alternate.de and mytime.de. All three are `ok` in R5 and R7, and their robots files were re-read today.
Aponeo answered every request and never slowed us down or refused one. Supporting sources: aponet.de (the pharmacists' portal) gives the full
inactive-ingredient list where aponeo's page cut it off, and sdcard.org gives the meaning of the speed classes.

## Totals

| Market | Records before | Records after | On allowed sources before | After |
|---|---|---|---|---|
| DE | 150 | 183 | 100 | 133 |
| GB | 120 | 120 | 32 | 32 |
| US | 159 | 159 | 37 | 37 |
| IE | 18 | 18 | 0 | 0 |
| CA | 11 | 11 | 0 | 0 |
| All | 458 | 491 | 169 (36.9%) | 202 (41.1%) |

"Allowed" means both sides rest on a source with verdict `ok` in R4 to R7, counted the way `scripts/qa/source_audit.ts` counts a side.

Added: 33 records (30 OTC medicine, 2 microSD cards, 1 sugar) and 2 baskets.

## OTC medicines (aponeo.de, `data/pairs/2026-11-de-aponeo-medicines.json`)

Every medicine record is `identical_active`, with the same active, strength, dosage form and pack size on both sides. We compared the
inactive ingredients in `differences`. Where one side has less (no lactose, no colouring, no sugar, no preservative), the record says so in
`differences`. Two records mark it `brand_better`: Betadorm D (no lactose) and Bisolvon (no sugar coating, no colouring).

| Slug | Brand side | Cheaper side | Prices (EUR, brand / cheaper) | Saving per unit | Sources |
|---|---|---|---|---|---|
| `formigran-vs-naratriptan-heumann-2-5mg-de` | Formigran Filmtabletten (naratriptan 2.5 mg), 2 tablets (PZN 02195485) | Naratriptan HEUMANN bei Migräne 2,5 mg Filmtabletten, 2 tablets (PZN 09542263) | 13.73 / 3.57 for 2 tablet vs 2 tablet | 74% | <https://www.aponeo.de/02195485-formigran-filmtabletten.html> <https://www.aponeo.de/09542263-naratriptan-heumann-bei-migraene-2-5-mg-filmtabl.html> |
| `dolortriptan-vs-almotriptan-heumann-12-5mg-de` | Dolortriptan bei Migräneattacken Filmtabletten (almotriptan 12.5 mg), 2 tablets (PZN 03029613) | Almotriptan HEUMANN bei Migräne 12,5 mg Filmtabletten, 2 tablets (PZN 10750044) | 8.85 / 4.92 for 2 tablet vs 2 tablet | 44.4% | <https://www.aponeo.de/03029613-dolortriptan-bei-migraene-filmtabletten.html> <https://www.aponeo.de/10750044-almotriptan-heumann-bei-migraene-12-5-mg-filmtabl.html> |
| `acc-akut-600-vs-nac-600-akut-1a-pharma-de` | ACC akut 600 mg Hustenlöser Brausetabletten, 20 effervescent tablets (PZN 00010808) | NAC 600 akut 1A Pharma Brausetabletten, 20 effervescent tablets (PZN 00562761) | 12.99 / 6.96 for 20 tablet vs 20 tablet | 46.4% | <https://www.aponeo.de/00010808-acc-akut-600-brausetabletten.html> <https://www.aponeo.de/00562761-nac-600-akut-1a-pharma-brausetabletten.html> |
| `nasic-vs-nasenduo-nasenspray-ratiopharm-de` | Nasic Nasenspray für Erwachsene, 10 ml (PZN 00705309) | NasenDuo Nasenspray ratiopharm, 10 ml (PZN 12521543) | 4.99 / 3.99 for 10 ml vs 10 ml | 20% | <https://www.aponeo.de/00705309-nasic-nasenspray.html> <https://www.aponeo.de/12521543-nasenduo-nasenspray.html> |
| `olynth-plus-vs-nasenduo-nasenspray-ratiopharm-de` | Olynth Plus 0,1 %/5 % Nasenspray für Erwachsene, 10 ml (PZN 13856688) | NasenDuo Nasenspray ratiopharm, 10 ml (PZN 12521543) | 5.62 / 3.99 for 10 ml vs 10 ml | 29% | <https://www.aponeo.de/13856688-olynth-plus-0-1-5-fuer-erw-nasenspray-o-k.html> <https://www.aponeo.de/12521543-nasenduo-nasenspray.html> |
| `otriven-protect-vs-nasenduo-nasenspray-ratiopharm-de` | Otriven Protect Schnupfen Nasenspray 1 mg/ml + 50 mg/ml, 10 ml (PZN 14287809) | NasenDuo Nasenspray ratiopharm, 10 ml (PZN 12521543) | 5.99 / 3.99 for 10 ml vs 10 ml | 33.4% | <https://www.aponeo.de/14287809-otriven-protect-1-mg-ml-plus-50-mg-ml-nasenspray-lsg.html> <https://www.aponeo.de/12521543-nasenduo-nasenspray.html> |
| `riopan-magen-tabletten-vs-magaldrat-ratiopharm-800mg-de` | Riopan Magen Tabletten Kautabletten (magaldrate 800 mg), 20 chewable tablets (PZN 00749293) | Magaldrat-ratiopharm 800 mg Kautabletten, 20 chewable tablets (PZN 04869870) | 7.80 / 4.99 for 20 tablet vs 20 tablet | 36% | <https://www.aponeo.de/00749293-riopan-magen-tabletten-kautabletten.html> <https://www.aponeo.de/04869870-magaldrat-ratiopharm-800-mg-tabletten.html> |
| `dulcolax-dragees-vs-bisacodyl-adgc-5mg-de` | Dulcolax Dragees 5 mg magensaftresistente Tabletten, 100 tablets (PZN 06800196) | Bisacodyl ADGC Laxans 5 mg magensaftresistente Tabletten, 100 tablets (PZN 18026572) | 17.59 / 6.99 for 100 tablet vs 100 tablet | 60.3% | <https://www.aponeo.de/06800196-dulcolax-dragees-5-mg-magensaftres-tabl-dose.html> <https://www.aponeo.de/18026572-bisacodyl-adgc-laxans-5-mg-magensaftres-tabletten.html> |
| `buscopan-dragees-vs-butylscopolamin-puren-10mg-de` | Buscopan Dragees (butylscopolamine bromide 10 mg), 20 coated tablets (PZN 00161996) | Butylscopolamin PUREN 10 mg überzogene Tabletten, 20 coated tablets (PZN 17606557) | 9.89 / 5.51 for 20 tablet vs 20 tablet | 44.3% | <https://www.aponeo.de/00161996-buscopan-dragees.html> <https://www.aponeo.de/17606557-butylscopolamin-puren-10-mg-ueberzogene-tab.html> |
| `allergodil-akut-augentropfen-vs-azelastin-micro-labs-0-5mg-ml-de` | Allergodil akut Augentropfen mit Azelastin 0,5 mg/ml, 6 ml (PZN 04095291) | Azelastin Micro Labs 0,5 mg/ml Augentropfen, 6 ml (PZN 15561394) | 9.94 / 5.99 for 6 ml vs 6 ml | 39.7% | <https://www.aponeo.de/04095291-allergodil-akut-augentropfen.html> <https://www.aponeo.de/15561394-azelastin-micro-labs-0-5-mg-ml-augentropfen.html> |
| `canesten-creme-vs-clotrimazol-al-1-creme-de` | Canesten Creme (clotrimazole 1%), 50 g (PZN 01802664) | CLOTRIMAZOL AL 1% Creme, 50 g (PZN 04941509) | 17.40 / 5.26 for 50 g vs 50 g | 69.8% | <https://www.aponeo.de/01802664-canesten-creme.html> <https://www.aponeo.de/04941509-clotrimazol-al-1-creme.html> |
| `xusal-vs-levocetirizin-adgc-5mg-de` | Xusal 5 mg Filmtabletten (levocetirizine), 100 tablets (PZN 15435287) | LEVOCETIRIZIN ADGC 5 mg Filmtabletten, 100 tablets (PZN 18082955) | 46.26 / 18.85 for 100 tablet vs 100 tablet | 59.3% | <https://www.aponeo.de/15435287-xusal-5-mg-filmtabletten.html> <https://www.aponeo.de/18082955-levocetirizin-adgc-5-mg-filmtabletten.html> |
| `movicol-vs-macrogol-adgc-plus-elektrolyte-de` | MOVICOL Beutel Pulver zur Herstellung einer Lösung, 20 sachets (PZN 07548876) | Macrogol ADGC plus Elektrolyte Pulver zur Herstellung einer Lösung, 20 sachets (PZN 18084428) | 20.29 / 5.31 for 20 sachet vs 20 sachet | 73.8% | <https://www.aponeo.de/07548876-movicol-beutel-plv-z-her-e-lsg-z-einnehmen.html> <https://www.aponeo.de/18084428-macrogol-adgc-plus-elektrolyte-plv-z-h-e-l-z-einn.html> |
| `dolormin-fuer-frauen-vs-naproxen-axicur-250mg-de` | Dolormin für Frauen mit Naproxen Tabletten (naproxen 250 mg), 30 tablets (PZN 02434139) | Naproxen axicur 250 mg Tabletten, 30 tablets (PZN 14412137) | 12.88 / 6.76 for 30 tablet vs 30 tablet | 47.5% | <https://www.aponeo.de/02434139-dolormin-fuer-frauen-tabletten.html> <https://www.aponeo.de/14412137-naproxen-axicur-250-mg-tabletten.html> |
| `vivinox-sleep-stark-vs-dorm-50mg-de` | vivinox SLEEP Schlaftabletten stark (diphenhydramine hydrochloride 50 mg), 20 tablets (PZN 02083906) | Dorm Tabletten (diphenhydramine hydrochloride 50 mg), 20 tablets (PZN 01580867) | 9.24 / 3.57 for 20 tablet vs 20 tablet | 61.4% | <https://www.aponeo.de/02083906-vivinox-sleep-schlaftablette.html> <https://www.aponeo.de/01580867-dorm-tabletten.html> |
| `betadorm-d-vs-dorm-50mg-de` | Betadorm D Tabletten (diphenhydramine hydrochloride 50 mg), 20 tablets (PZN 03241684) | Dorm Tabletten (diphenhydramine hydrochloride 50 mg), 20 tablets (PZN 01580867) | 12.99 / 3.57 for 20 tablet vs 20 tablet | 72.5% | <https://www.aponeo.de/03241684-betadorm-d-tabletten.html> <https://www.aponeo.de/01580867-dorm-tabletten.html> |
| `ben-u-ron-1000mg-tabletten-vs-paracetamol-ratiopharm-1000mg-de` | ben-u-ron 1.000 mg Tabletten, 10 tablets (PZN 16239097) | Paracetamol-ratiopharm 1000 mg Tabletten, 10 tablets (PZN 09263936) | 5.49 / 2.68 for 10 tablet vs 10 tablet | 51.2% | <https://www.aponeo.de/16239097-ben-u-ron-1-000-mg-tabletten.html> <https://www.aponeo.de/09263936-paracetamol-ratiopharm-1-000-mg-tabletten.html> <https://www.aponet.de/arzneimittel/arzneimitteldatenbank/arzneimittel/anwendungsdetails/zusammensetzung/3343435200/Paracetamol> |
| `ben-u-ron-1000mg-zaepfchen-vs-paracetamol-ratiopharm-1000mg-zaepfchen-de` | ben-u-ron 1000 mg Suppositorien, 10 suppositories (PZN 01484879) | Paracetamol-ratiopharm 1000 mg Erwachsenen-Suppositorien, 10 suppositories (PZN 03953611) | 5.99 / 3.99 for 10 suppository vs 10 suppository | 33.4% | <https://www.aponeo.de/01484879-ben-u-ron-1000-mg-suppositorien.html> <https://www.aponeo.de/03953611-paracetamol-ratiopharm-1-000-mg-zaepfchen.html> <https://www.aponet.de/service/arzneimitteldatenbank/arzneimittel/anwendungsdetails/zusammensetzung/3018803141/Schmerz> |
| `ben-u-ron-saft-vs-paracetamol-ratiopharm-loesung-40mg-ml-de` | ben-u-ron Saft (paracetamol 200 mg per 5 ml), 100 ml (PZN 04993736) | Paracetamol-ratiopharm Lösung 40 mg/ml, 100 ml (PZN 07263487) | 5.99 / 4.49 for 100 ml vs 100 ml | 25% | <https://www.aponeo.de/04993736-ben-u-ron-saft.html> <https://www.aponeo.de/07263487-paracetamol-ratiopharm-loesung.html> <https://www.aponet.de/service/arzneimitteldatenbank/arzneimittel/anwendungsdetails/zusammensetzung/3200570012/Schmerz> |
| `fenistil-gel-vs-dimetin-adgc-1mg-g-gel-de` | Fenistil Gel (dimetindene maleate 1 mg/g), 30 g (PZN 12550409) | Dimetin ADGC 1 mg/g Gel, 30 g (PZN 18206216) | 8.49 / 5.99 for 30 g vs 30 g | 29.4% | <https://www.aponeo.de/12550409-fenistil-gel.html> <https://www.aponeo.de/18206216-dimetin-adgc-1-mg-g-gel.html> |
| `fenihydrocort-creme-0-5-vs-hydrocortison-stada-5mg-g-de` | FeniHydrocort Creme 0,5 % (hydrocortisone 5 mg/g), 30 g (PZN 10796974) | Hydrocortison STADA 5 mg/g Creme, 30 g (PZN 16808483) | 12.53 / 6.21 for 30 g vs 30 g | 50.4% | <https://www.aponeo.de/10796974-fenihydrocort-creme-0-5.html> <https://www.aponeo.de/16808483-hydrocortison-stada-5-mg-g-creme.html> |
| `linola-akut-0-5-vs-hydrocortison-stada-5mg-g-de` | Linola Akut 0,5% Hydrocortison Creme, 30 g (PZN 02138990) | Hydrocortison STADA 5 mg/g Creme, 30 g (PZN 16808483) | 13.99 / 6.21 for 30 g vs 30 g | 55.6% | <https://www.aponeo.de/02138990-linola-akut-0-5-creme.html> <https://www.aponeo.de/16808483-hydrocortison-stada-5-mg-g-creme.html> |
| `vividrin-antiallergische-augentropfen-vs-cromo-micro-labs-20mg-ml-de` | Vividrin antiallergische Augentropfen (sodium cromoglicate 20 mg/ml), 10 ml (PZN 03561555) | Cromo Micro Labs 20 mg/ml Augentropfen, 10 ml (PZN 16821940) | 6.51 / 3.49 for 10 ml vs 10 ml | 46.4% | <https://www.aponeo.de/03561555-vividrin-antiallergische-augentropfen.html> <https://www.aponeo.de/16821940-cromo-micro-labs-20-mg-ml-augentropfen.html> |
| `imodium-akut-lingual-vs-loperamid-al-2mg-schmelztabletten-de` | Imodium akut lingual Schmelztabletten (loperamide hydrochloride 2 mg), 12 tablets (PZN 01689854) | Loperamid AL 2 mg Schmelztabletten, 12 tablets (PZN 15610187) | 11.99 / 5.99 for 12 tablet vs 12 tablet | 50% | <https://www.aponeo.de/01689854-imodium-akut-lingual-schmelztabletten.html> <https://www.aponeo.de/15610187-loperamid-al-2-mg-schmelztabletten.html> |
| `bisolvon-hustentabletten-vs-bromhexin-8-berlin-chemie-de` | Bisolvon Hustentabletten 8 mg (bromhexine hydrochloride), 50 tablets (PZN 00139011) | Bromhexin 8 Berlin-Chemie überzogene Tabletten, 50 tablets (PZN 04394361) | 19.99 / 5.99 for 50 tablet vs 50 tablet | 70% | <https://www.aponeo.de/00139011-bisolvon-hustentabletten-8-m.html> <https://www.aponeo.de/04394361-bromhexin-8-berlin-chemie-ueberzogene-tabletten.html> |
| `vividrin-mometason-vs-mometason-adgc-50ug-nasenspray-de` | Vividrin Mometason Heuschnupfennasenspray 50 µg/Sprühstoß, 18 g (PZN 16581358) | MOMETASON ADGC 50 µg/Sprühstoß Nasenspray, 18 g (PZN 17440329) | 16.99 / 6.92 for 18 g vs 18 g | 59.3% | <https://www.aponeo.de/16581358-vividrin-mometason-heuschn-nspr-50ug-sp-140sprst.html> <https://www.aponeo.de/17440329-mometason-adgc-50-ug-spruehstoss-nasenspray-140.html> |
| `neuralgin-vs-dolopyrin-al-de` | Neuralgin Tabletten, 20 tablets (PZN 03875041) | Dolopyrin AL Tabletten, 20 tablets (PZN 00190791) | 6.21 / 2.98 for 20 tablet vs 20 tablet | 52% | <https://www.aponeo.de/03875041-neuralgin-tabletten.html> <https://www.aponeo.de/00190791-dolopyrin-al-tabletten.html> |
| `vigantol-1000-ie-vs-vitamin-d3-aristo-1000-ie-de` | Vigantol 1.000 I.E. Vitamin D3 Tabletten, 200 tablets (PZN 13155690) | Vitamin D3 Aristo 1000 I.E. Tabletten, 200 tablets (PZN 20009629) | 12.99 / 10.79 for 200 tablet vs 200 tablet | 16.9% | <https://www.aponeo.de/13155690-vigantol-1-000-i-e-vitamin-d3-tabletten.html> <https://www.aponeo.de/20009629-vitamin-d3-aristo-1000-i-e-tabletten.html> |
| `degasin-intens-vs-simeticon-stada-280mg-de` | Degasin intens 280 mg Weichkapseln (simeticone), 32 capsules (PZN 16944476) | Simeticon STADA 280 mg Weichkapseln, 32 capsules (PZN 20393036) | 11.99 / 6.29 for 32 capsule vs 32 capsule | 47.5% | <https://www.aponeo.de/16944476-degasin-intens-280-mg-weichkapseln.html> <https://www.aponeo.de/20393036-simeticon-stada-280-mg-weichkapseln.html> |
| `dulcolax-zaepfchen-vs-pyrilax-10mg-de` | Dulcolax 10 mg Zäpfchen (bisacodyl), 6 suppositories (PZN 00308169) | Pyrilax 10 mg Suppositorien, 6 suppositories (PZN 04908340) | 9.64 / 3.99 for 6 suppository vs 6 suppository | 58.6% | <https://www.aponeo.de/00308169-dulcolax-10-mg-zaepfchen.html> <https://www.aponeo.de/04908340-pyrilax-10-mg-suppositorien.html> |

## Tech and grocery (alternate.de and mytime.de, `data/pairs/2026-11-de-alternate-mytime.json`)

These are `equivalent_spec`, `medium`. The microSD records compare the speed and application classes printed on both pages. The sugar record compares
what both pages show: one ingredient, 1 kg, and the nutrition values.

| Slug | Brand side | Cheaper side | Prices (EUR, brand / cheaper) | Saving per unit | Sources |
|---|---|---|---|---|---|
| `sandisk-nintendo-switch-128gb-microsd-vs-sandisk-extreme-128gb-de` | SanDisk microSDXC für Nintendo Switch 128 GB, UHS-I U3 V30 (SDSQXAO-128G-GNCZN) (EAN 0619659171520) | SanDisk Extreme microSDXC 128 GB, UHS-I U3 V30 A2 (SDSQXAA-128G-GN6MA) (EAN 0619659188450) | 48.59 / 35.89 for 128 GB vs 128 GB | 26.1% | <https://www.alternate.de/SanDisk/Nintendo-Switch-128-GB-microSDXC-Speicherkarte/html/product/1529672> <https://www.alternate.de/SanDisk/Extreme-128-GB-microSDXC-Speicherkarte/html/product/1854524> <https://www.sdcard.org/developers/sd-standard-overview/speed-class/> <https://www.sdcard.org/developers/sd-standard-overview/application-performance-class/> |
| `kingston-canvas-go-plus-128gb-microsd-vs-sandisk-extreme-128gb-de` | Kingston Canvas Go! Plus microSDXC 128 GB, UHS-I U3 V30 A2 (SDCG4/128GB) (EAN 0740617347944) | SanDisk Extreme microSDXC 128 GB, UHS-I U3 V30 A2 (SDSQXAA-128G-GN6MA) (EAN 0619659188450) | 51.90 / 35.89 for 128 GB vs 128 GB | 30.8% | <https://www.alternate.de/Kingston/Canvas-Go-Plus-128-GB-microSDXC-Speicherkarte/html/product/100125284> <https://www.alternate.de/SanDisk/Extreme-128-GB-microSDXC-Speicherkarte/html/product/1854524> <https://www.sdcard.org/developers/sd-standard-overview/speed-class/> <https://www.sdcard.org/developers/sd-standard-overview/application-performance-class/> |
| `diamant-feinster-zucker-vs-jeden-tag-zucker-raffinade-de` | Diamant Feinster Zucker, 1 kg (EAN 4008381145002) | Jeden Tag Zucker Raffinade, 1 kg (EAN 4306188050971) | 2.29 / 1.19 for 1000 g vs 1000 g | 48% | <https://www.mytime.de/diamant_feinster_zucker_4502120072.html> <https://www.mytime.de/jeden_tag_zucker_raffinade_4502120177.html> |

## Baskets (`data/presets/2026-11-de-medicine.json`)

| Slug | Items | Brand total | Cheaper total | At the till (Aponeo) | Guides |
|---|---|---|---|---|---|
| `medicine-cabinet-de` | ben-u-ron 1000, Nurofen 400, ACC akut 600, Otriven Protect, Imodium akut, Dulcolax Dragees, Vomex A, Lorano akut, Fenistil Gel, Voltaren forte | 116.36 | 58.42 (50% less) | 62.60 in whole packs, free delivery (over 34.99) | aponet.de, AOK and TK Hausapotheke checklists |
| `hay-fever-de` | Zyrtec, Vividrin Mometason, Allergodil akut eye drops, Vividrin eye drops | 94.93 | 26.14 (73% less) | 26.14 plus 3.99 delivery; 8.85 short of the 34.99 free-delivery line | Stiftung Warentest hay fever guide, TK hay fever page |

A hay fever kit already existed (Allergodil akut Duo in `data/bundles/2026-11-de-kits.json`), so we added a basket, not a second kit.
Aponeo's delivery line stays at 34.99 as `data/sellers/delivery.json` has it (one product page showed 29.99 today).

## Rejected and held back

| Candidate | Reason |
|---|---|
| Aspirin Plus C 20 (9.49) vs ASS + C ratiopharm 20 (9.39) | Saving about 1%, under 5% |
| Allergodil akut Nasenspray 10 ml (9.94) vs Vividrin Azelastin 10 ml (9.44) | Saving 5.0%, too thin to stay over 5% after any price change |
| Bepanthen Augen- und Nasensalbe 5 g (4.15) vs Panthenol-Augensalbe Jenapharm 5 g (4.99) | The brand is cheaper |
| Nexium Control 20 mg 14 tablets (12.33) vs Esomeprazol TAD 20 mg 14 hard capsules (9.19) | Different dosage form; aponeo has no esomeprazole OTC tablet generic |
| Nurofen 200 mg Schmelztabletten | No generic in the same form found at aponeo |
| Voltaren Actigo 1% gel (diclofenac diethylamine 11.6 mg/g) vs Diclo-ratiopharm, Diclofenac AL, Heumann gels (diclofenac sodium 10 mg/g) | Different salt; aponeo has no diethylamine generic |
| Nicotin AL 2 mg gum (nicotine resinate 13.2 mg) vs Nicotinell or Nicorette 2 mg (nicotine polacrilin 10 mg) | Different resin complex, so not identical by the build rule; the AL page gives no amount |
| Sumatriptan OTC | No OTC brand on aponeo to compare against |
| Lamisil (terbinafine) | Not stocked at aponeo |
| Varta Longlife Power AAA 40 vs Intenso Energy Ultra AAA 40 (alternate.de 13.99 / 8.99; EAN 4008496987924 / 4034303027415) | Same slug already in `2026-11-retail-b.json`, priced from pollin.de, which the audit marks barred. Not edited; see follow-ups |
| myTime: Thomy Sonnenblumenöl vs Jeden Tag Sonnenblumenöl | Ingredient lists empty on both pages, refining not stated, saturated fat differs (9.4 vs 10.0 g/100 ml) |
| myTime: Rapsgold vs Jeden Tag Rapsöl | Ingredient lists empty, refining not stated, saturated fat differs (7.0 vs 6.4 g/100 ml) |
| myTime: Bertolli olive oil vs Jeden Tag olive oil | Origin and grade not provable from the pages |
| Nurofen Junior 40 mg/ml 100 ml (5.82, PZN 16538227) vs Ibuprofen STADA 40 mg/ml suspension (3.50, PZN 09424322) | Held back, not rejected. The record passes the catalogue build, but it gives Nurofen a second DE product. The receipt matcher then answers "maybe" instead of "swap" for "NUROFEN 400MG 24ST" (`scripts/tests/receipt-match.test.ts`), because its brand-only rule needs a brand with one product on file. Ready to add once the matcher counts only products whose strength matches the line |

Rejections by reason: saving under or at 5%: 2; brand cheaper: 1; different dosage form or no same-form generic: 2; different salt or complex: 2;
not stocked: 2; duplicate of an existing record: 1; sameness not provable (myTime): 3. Held back: 1.

### Why myTime gave so little

myTime's search returns nothing to a script, so we had to browse category pages. Most own-label (Jeden Tag) pages leave the ingredient list empty,
and so do many brand pages. We could prove sameness only for a one-ingredient food (sugar). Even there, Diamant's page states no refining grade, and the record says so.
myTime delivers free only from 70 euros.

## Notes

- `dolormin-extra-vs-ibu-lysin-1a-pharma-400mg-de` has 15.99 for the brand; aponeo's search listing showed 16.99 today. Not edited, because the
  product page was not re-read.
- One myTime page (Jeden Tag Zucker) carried text addressed to automated agents. We ignored it and used only the product data.
