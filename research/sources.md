# Source ledger

Each source below was retrieved on 2026-10-01, and every statement listed was located in its text. The dataset records only such statements. Where a paper reports something another study found, the entry says so. Statements not listed here were not verified and are not in the dataset.

## Canadian Conservation Institute, Technical Bulletin 32: Products Used in Preventive Conservation
https://www.canada.ca/en/conservation-institute/services/conservation-preservation-publications/technical-bulletins/products-used-preventive-conservation.html

- The enclosure relationship `C = E A / V N`, with units for each symbol.
- The most dangerous scenario: a vulnerable object in a well-sealed enclosure with a large surface area of an emissive product.
- Pollutant and affected-material pairs: acetic acid and lead; benzoic acid and formic acid with copper and bronze; hydrogen sulfide and carbonyl sulfide with copper, bronze and silver; formic acid from oil-based coatings and paper; hydrogen peroxide from fresh alkyd or oil-based coatings and black and white photographs.
- Flexible PVC: plasticizer from degraded flexible PVC causes stains and embrittlement in direct contact; viscous plasticizer exudate leaches compounds from an object's surface; benzoic acid from degraded plasticizer corrodes copper and bronze.

## CCI, Basic requirements of preventive conservation
https://www.canada.ca/en/conservation-institute/services/preventive-conservation/guidelines-collections/basic-requirements-preventive-conservation.html

- Closed cabinets and display enclosures reduce risks from pollutants and incorrect humidity.

## Review and interlaboratory comparison of the Oddy test methodology (npj Heritage Science, 2024)
https://www.nature.com/articles/s40494-024-01174-9

- The 3-in-1 version, 60 °C and 2 g of material are common practice; other variables are not standardized.
- Oddy's original description runs 28 days at 60 °C.
- Seven institutions testing the same ten materials still produced differing results.
- Table 2: the ten materials and their compositions. Tables 3 to 5: each institution's glassware cleaning, coupon preparation, vessel type and volume, water volume and stopper. Table 7: each institution's rating of each material for the silver, copper and lead coupons and overall (published as an image and transcribed; it reproduces every count in Table 8). Results are anonymized as institutions I to VII, so no row is attributed to a named institution.

## Optimizing museum construction material selection through mass spectrometry analysis (npj Heritage Science, 2025)
https://www.nature.com/articles/s40494-025-01681-3

- Terostat-9220 was applied by a casework manufacturer from 2009 through 2014, and it passed the Oddy test conducted by museum staff because it does not react corrosively with the metal substrates.
- TMP-ol (2,2,6,6-tetramethyl-4-piperidinol) from that adhesive reacted with acidic compounds from other materials and objects in the cases, producing white crystalline efflorescence on objects at several institutions.
- Table 3: the same ten materials rated by CENIM judges for each coupon and overall, with the compound classes detected by HS-SPME and DTD. The text names acetic acid, formic acid, lactic acid and lactide, TCPP, glycols and phthalates for specific materials, and gives normalized acetic acid peak areas. Each statement used is stored with its quote in `research/extracted/ms-2025-emissions.json`.
- Oddy limits: it primarily assesses silver, copper and lead and may not effectively assess paper, paints or plastics; ratings rest on subjective visual inspection. The two published positions on applying Oddy results beyond the coupon metals are stored with their quotes in `research/extracted/oddy-scope-statements.json`.

## Identifying VOCs in exhibition cases and efflorescence on museum objects exhibited at Smithsonian's National Museum of the American Indian-New York (Heritage Science, 2020)
https://heritagesciencejournal.springeropen.com/articles/10.1186/s40494-020-00454-4

- SPME–GC–MS and DART-MS identified TMP-ol as the organic component of the efflorescence, emitted by the structural adhesive Terostat MS 937.
- TMP-ol is a component of hindered amine light stabilizers; Tinuvin 770 is reported as an additive of the Terostat adhesive.
- The case manufacturer used two formulations, Terostat MS 937 and Terostat 9220, and only Terostat 937 has been found in the NMAI cases.
- Museum staff did not expect problems because the adhesive had been vetted by Oddy testing.
- It summarizes Rijksmuseum findings of crystalline deposits from TMP-ol reacting with carboxylic acids emitted by peroxide-cured silicone gaskets, MDF panels, UV adhesive and beeswax products.

## Are cellulose ethers safe for the conservation of artwork? (Heritage Science, 2022)
https://www.nature.com/articles/s40494-022-00688-4

- Table 1: 60 commercial cellulose ether products and batches with supplier, purchase date, batch, and Oddy ratings for each coupon and overall (28 days at 60 °C, 100% relative humidity, in duplicate), with the corrosion products identified by Raman spectroscopy. The counts match the abstract: 33 P, 20 T, 7 F.
- The paper rates with F for fail where the other papers use U. Records use U and note the F.
- A BEMMA microchamber test of 1 g of Klucel G from Deffner found about 4000 µg/m³ of acetic acid and a small amount of formaldehyde, and the sample did not fulfil the BEMMA scheme.
- Klucel G purchased in 2017 passed with no corrosion, while samples purchased in 2021 from two suppliers rated T on lead.
- It cites British Museum experience that the results for the three metals can be generalized to all materials.

## Automated corrosion detection in Oddy test coupons using convolutional neural networks (npj Heritage Science, 2022)
https://www.nature.com/articles/s40494-022-00778-3

- The Oddy test does not identify the corrosive compounds off-gassed by a test material.
- Some adhesives that had passed the Oddy test produced TMP-ol, which reacted with acids in the case to form crystalline deposits at the Museum of Fine Arts Boston, the Smithsonian's NMAI and the Rijksmuseum. This paper does not name Terostat, so it is cited only for these general statements.

## Sanity documentation
- https://www.sanity.io/docs/ai/sanity-context
- https://www.sanity.io/docs/ai/sanity-context-mcp
- https://www.sanity.io/docs/ai/sanity-context-mcp-tools
- https://www.sanity.io/docs/ai/sanity-context-security

## Inconsistencies inside the sources

Statements that depend on resolving these are not in the dataset.

- The 2025 paper's Table 1 lists material 7 as MDF and material 8 as plywood, while one passage calls 7 birchwood and 8 MDF. Statements about "the two wood-based materials" are recorded for both.
- The 2025 paper says materials 1, 2, 3 and 9 "did tarnish the silver coupons", while its Table 3 rates all four silver P. The dataset records only that sulphur compounds were detected in them.
- The 2025 paper groups material 10 with materials whose lead coupons were P or T, while its Table 3 and other passages rate material 10 lead U. The dataset uses the table.
- The cellulose ether paper says all historical samples failed with T or F, while its Table 1 rates several historical samples P. The dataset uses the table.
- The primary NMAI study names Terostat MS 937 as the source of TMP-ol; the 2025 review names Terostat-9220.

## What the sources do not say

These are absent from the dataset on purpose.

- The date, institution, protocol and per-coupon results of the Terostat Oddy test. The papers say only that museum staff tested it and it passed.
- Which Terostat formulation was Oddy tested.
- A numeric safety threshold for any pollutant. CCI Technical Bulletin 32 gives none, and ArtifactGuard defines none.
- Any statement on glass deterioration or humidity in the CCI bulletin or the CCI guidelines page, so no glass artifact is modelled.
- Whether a given flexible PVC is degraded. CCI's contact and benzoic acid entries are for degraded flexible PVC.
- Which acids were present in the NMAI cases beyond those summarized from the Rijksmuseum study.

## Synthetic records

Products, revisions and Oddy tests labelled `synthetic-rule` exist only to exercise the rules (a failing test, an old test, a no-conflict case). They carry no real-world claim and are labelled as synthetic wherever they appear.
