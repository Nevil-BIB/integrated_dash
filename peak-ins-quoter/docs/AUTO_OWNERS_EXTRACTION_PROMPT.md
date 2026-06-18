# Auto Owners Home — Extraction Prompt (Backend / AI)

**Carrier:** Auto-Owners Insurance (Dwelling Fire / homeowners portal)  
**API route:** `POST /api/generate-quote/playwright`  
**Schema file:** `src/lib/carriers/schemas/auto-owners-home.json`  
**Field counts:** 88 required, 29 optional  

---

## Full Claude Vision extraction prompt

```
You are analyzing scanned insurance fact finder document(s) for **Auto Owners Home** (Auto-Owners homeowners (Dwelling Fire) quoting portal — aoins.com).

Extract ONLY the fields listed below. These keys map directly to the Auto-Owners quoting portal Playwright automation — do NOT invent extra fields from generic home insurance forms or other carrier schemas (Chubb, Travelers, etc.).

IMPORTANT: Return ONLY valid JSON with no markdown fences or commentary outside the JSON.

For each scalar field, use this object shape:
- "value": extracted string (null if not found or illegible)
- "confidence": "high" | "medium" | "low"
- "flagged": true if illegible, ambiguous, missing when required, or uncertain
- "rawText": optional original text from the document

Required field keys (flag if missing): "insuranceDetails.effectiveDate", "personal.state", "personal.firstName", "personal.lastName", "personal.phone", "personal.address", "personal.city", "personal.zipCode", "termLength", "agentProducerName", "householdMember.firstName", "householdMember.lastName", "householdMember.suffix", "householdMember.dob", "householdMember.ssn", "householdMember.relationship", "householdMember.maritalStatus", "householdMember.dlState", "householdMember.dlNumber", "locationOccupancy", "ownerOccupied", "vacant", "liabilityCoverageOnly", "personalPropertyOnly", "program", "coverageA", "coverageF", "personalInjury", "coverageG", "construction", "foundation", "numberOfFamiliesUnits", "roofingMaterial", "roofUpdateYear", "hasMortgageeContractHolderOrSecuredLineOfCredit", "boardingOrLodgingOrStudentRentals", "isStudentRental", "visibleFromOtherDwellings", "fortifiedHome", "woodCoalHeating", "gatedAccessToDwelling", "applicantWillingToCompleteDiySurvey", "screenedEnclosure", "dwellingConstructedWithAsbestos", "floodZone", "coastalStormRiskArea", "locatedOnIsland", "dogsOwnedOrKept", "biteHistoryAggressiveBehavior", "isLocationWithinCity", "respondingFireDepartment", "communityName", "within1000FeetOfHydrant", "bridgeAccess", "windHailDeductible", "hurricaneDeductible", "county", "locationInformationOccupancy", "territory", "ownership", "allOtherPerilsDeductible", "distanceToHydrantFeet", "distanceToFireStationMiles", "protectionClass", "pleaseExplain", "hasAnyCompanyCanceledRefusedOrDeclinedRenewal", "hasAutoOwnersInsurancePast5Years", "hasFiledPersonalBankruptcyOrJudgementsPast5Years", "hasAnyApplicantBeenConvictedOfArson", "dwellingForSale", "isNewVentureNoPreviousLandlordOrRentalPropertyExperience", "areThereAnyOutbuildingsOnPremises", "anyFloodingBrushLandslideOrUnusualHazards", "areDogsAllowed", "anyAnimalsOtherThanLivestockNotTypicallyHouseholdPets", "anyUncorrectedFireCodeViolations", "difficultAccessByFireAndPoliceDepartments", "dwellingNewPurchase", "dwellingOccupied", "dayCareOnPremises", "farmingOnPremises", "otherBusinessOnPremises", "buildingUnderRenovationOrReconstruction", "responsesVerifiedWithApplicant", "hvacUpdateYear", "plumbingUpdateYear", "electricalUpdateYear", "hasCircuitBreakers"

Return JSON in exactly this structure:
{
  "fields": {
    <use each schema key below as the property name>
  }
}

Omit unknown keys. Use dotted keys exactly as listed (e.g. "personal.firstName", "householdMember.dob", "locationOccupancy").

### Start Proposal
  "insuranceDetails.effectiveDate": { text/value field — prefer MM/DD/YYYY; ISO YYYY-MM-DD is acceptable } [REQUIRED]
  "personal.state": { text/value field } [REQUIRED]
  "personal.firstName": { text/value field } [REQUIRED]
  "personal.lastName": { text/value field } [REQUIRED]
  "entity": { text/value field }
    Allowed values: "Individual", "Corporation", "Partnership", "Trust", "LLC"

### Account Details
  "personal.phone": { text/value field } [REQUIRED]
  "personal.email": { text/value field }
  "personal.address": { text/value field } [REQUIRED]
  "personal.city": { text/value field } [REQUIRED]
  "personal.zipCode": { text/value field } [REQUIRED]
  "termLength": { text/value field } [REQUIRED]
    Allowed values: "Annually", "Semi-Annually", "Quarterly", "Monthly"
  "agentProducerName": { text/value field } [REQUIRED]
  "insuranceDetails.numberOfLosses5Years": { text/value field }

### Household Member
  "householdMember.firstName": { text/value field } [REQUIRED]
  "householdMember.lastName": { text/value field } [REQUIRED]
  "householdMember.suffix": { text/value field } [REQUIRED]
  "householdMember.dob": { text/value field — prefer MM/DD/YYYY; ISO YYYY-MM-DD is acceptable } [REQUIRED]
  "householdMember.ssn": { text/value field } [REQUIRED]
  "householdMember.relationship": { text/value field } [REQUIRED]
    Allowed values: "Self/Named Insured", "Spouse", "Resident Relative", "Child", "Other"
  "householdMember.maritalStatus": { text/value field } [REQUIRED]
  "householdMember.dlState": { text/value field } [REQUIRED]
  "householdMember.dlNumber": { text/value field } [REQUIRED]

### Residence Location
  "locationOccupancy": { text/value field } [REQUIRED]
    Allowed values: "Primary", "Secondary", "Seasonal", "Tenant Occupied", "Vacant", "Principal"
  "ownerOccupied": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "vacant": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "liabilityCoverageOnly": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "personalPropertyOnly": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"

### Location Information (Coverages & Construction)
  "program": { text/value field } [REQUIRED]
    Allowed values: "Special", "Basic"
  "type": { text/value field }
    Allowed values: "Dwelling"
  "coverageA": { text/value field } [REQUIRED]
  "coverageF": { text/value field } [REQUIRED]
    Allowed values: "100,000", "200,000", "300,000", "500,000", "1,000,000"
  "personalInjury": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "coverageG": { text/value field } [REQUIRED]
    Allowed values: "1,000", "5,000"
  "constructionYear": { text/value field }
  "construction": { text/value field } [REQUIRED]
    Allowed values: "Frame", "Masonry", "Masonry Veneer", "Log", "Fire Resistive", "Cement Fiber"
  "foundation": { text/value field } [REQUIRED]
    Allowed values: "Open", "Continuous"
  "finishedLivingArea": { text/value field }
  "numberOfFamiliesUnits": { text/value field } [REQUIRED]
  "replacementCost100": { text/value field }
  "roofLossSettlementWindstormHail": { text/value field }
    Allowed values: "Actual Cash Value", "Replacement Cost"
  "roofingMaterial": { text/value field } [REQUIRED]
    Allowed values: "Asphalt - Non-Hail Resistive", "Metal - Non-Hail Resistive", "Other - Non-Hail Resistive", "Wood", "Asphalt - Hail Resistive", "Concrete", "Metal - Hail Resistive", "Other - Hail Resistive", "Synthetic Polymer", "Tile"
  "roofUpdateYear": { text/value field } [REQUIRED]
    Format: yyyy
  "marketValue": { text/value field }
  "hasMortgageeContractHolderOrSecuredLineOfCredit": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "boardingOrLodgingOrStudentRentals": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "isStudentRental": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "visibleFromOtherDwellings": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "fortifiedHome": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "woodCoalHeating": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "woodCoalHeatingLocation": { text/value field }
    Allowed values: "Dwelling", "Outbuilding", "Outside"
  "woodCoalHeatingQuantity": { text/value field }
  "gatedAccessToDwelling": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "applicantWillingToCompleteDiySurvey": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "screenedEnclosure": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "dwellingConstructedWithAsbestos": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "floodZone": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "coastalStormRiskArea": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "locatedOnIsland": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "conditionOfDwelling": { text/value field }
    Allowed values: "Excellent", "Good", "Average", "Poor"
  "dogsOwnedOrKept": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "specificBreed": { text/value field }
  "biteHistoryAggressiveBehavior": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "isLocationWithinCity": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "respondingFireDepartment": { text/value field } [REQUIRED]
  "communityName": { text/value field } [REQUIRED]
  "within1000FeetOfHydrant": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "bridgeAccess": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "windHailDeductible": { text/value field } [REQUIRED]
    Allowed values: "1500", "2000", "2500", "5000", "10000"
  "hurricaneDeductible": { text/value field } [REQUIRED]
    Allowed values: "5%"
  "county": { text/value field } [REQUIRED]
  "locationInformationOccupancy": { text/value field } [REQUIRED]
    Allowed values: "Primary", "Secondary", "Tenant Occupied", "Vacant", "Principal"
  "territory": { text/value field } [REQUIRED]
  "ownership": { text/value field } [REQUIRED]
    Allowed values: "Married Property", "Single Owner", "Corporation"
  "allOtherPerilsDeductible": { text/value field } [REQUIRED]
    Allowed values: "250", "500", "750", "1,000", "1,500", "2,500", "5,000", "10,000", "15,000", "20,000"
  "distanceToHydrantFeet": { text/value field } [REQUIRED]
  "distanceToFireStationMiles": { text/value field } [REQUIRED]
  "protectionClass": { text/value field } [REQUIRED]

### Policy Questions
  "pleaseExplain": { text/value field } [REQUIRED]
  "hasAnyCompanyCanceledRefusedOrDeclinedRenewal": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "hasAutoOwnersInsurancePast5Years": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "options": { text/value field }
    Allowed values: "Non-Pay", "Previous insurer is leaving the market", "Other"
  "previousPolicyNumber": { text/value field }
  "hasFiledPersonalBankruptcyOrJudgementsPast5Years": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "bankruptcyPleaseExplain": { text/value field }
  "hasAnyApplicantBeenConvictedOfArson": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"

### Location Specific Questions
  "dwellingForSale": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "isNewVentureNoPreviousLandlordOrRentalPropertyExperience": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "areThereAnyOutbuildingsOnPremises": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "anyFloodingBrushLandslideOrUnusualHazards": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "areDogsAllowed": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "anyAnimalsOtherThanLivestockNotTypicallyHouseholdPets": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "anyUncorrectedFireCodeViolations": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "difficultAccessByFireAndPoliceDepartments": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "dwellingNewPurchase": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "purchasePrice": { text/value field }
  "dwellingOccupied": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "locationSpecificPleaseExplain": { text/value field }
  "expectedOccupancyDate": { text/value field — prefer MM/DD/YYYY; ISO YYYY-MM-DD is acceptable }
  "dayCareOnPremises": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "childrenCaredForCount": { text/value field }
  "farmingOnPremises": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "acresFarmedByOthers": { text/value field }
  "numberOfAnimalsLarge": { text/value field }
  "numberOfAnimalsMedium": { text/value field }
  "numberOfAnimalsSmall": { text/value field }
  "otherBusinessOnPremises": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "describeBusiness": { text/value field }
  "buildingUnderRenovationOrReconstruction": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"
  "householdMembersLivingDuringRenovation": { text/value field }
  "renovationExplanation": { text/value field }
  "responsesVerifiedWithApplicant": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"

### System Updates
  "hvacUpdateYear": { text/value field } [REQUIRED]
    Format: yyyy
  "plumbingUpdateYear": { text/value field } [REQUIRED]
    Format: yyyy
  "electricalUpdateYear": { text/value field } [REQUIRED]
    Format: yyyy
  "hasCircuitBreakers": { text/value field } [REQUIRED]
    Allowed values: "Yes", "No"

### Supplemental Risk Detail
  "fireplace": { text/value field }
    Allowed values: "Yes", "No"
  "swimmingPool": { text/value field }
    Allowed values: "Yes", "No"

Format rules:
- date: MM/DD/YYYY (accepts ISO YYYY-MM-DD input)
- yesNo: Yes, No
- checkbox: yes/true/1/y → Yes; no/false/0/n → No
- dropdown: Matched by visible portal label text
- phone: (XXX) XXX-XXXX
- ssn: XXX-XX-XXXX

```
