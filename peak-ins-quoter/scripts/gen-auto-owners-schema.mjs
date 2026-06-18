import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const yesNo = ['Yes', 'No']

const usStateCodes = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC',
]

/** Legacy Auto-Owners portal producer labels (HOME_PERSONAL_FIELDS.agentProducerName) */
const agentProducerNameOptions = [
  'ADAMS, HANNAH',
  'ADAMS, LAUREN H',
  'BOSWELL, MELISSA HOWARD',
  'DAVIS, JULIE ANN',
  'DERAMUS, MELANIE A',
  'ELLIS, BEVERLY L',
  'JONES, TIMOTHY L',
  'MAYNOR, SUZANNE P',
  'MITCHELL, PAMELA A',
  'PEAK, JERE D',
  'PEAK, OWEN',
  'SEWELL, RUTH EMILIE',
  'SWIFT, DONNA Q',
  'TWITCHELL, STACI T',
  'UTSEY III, JAMES C',
  'WEST, BLAKE E',
  'WHITAKER, LYN P',
  'WILLIAMS, AMBER N',
  'NOT LISTED',
]

const field = (key, label, type, required, extra = {}) => ({
  key,
  label,
  type,
  required,
  ...extra,
})

const schema = {
  id: 'auto-owners-home',
  carrierId: 'autoOwners',
  productType: 'home',
  label: 'Auto Owners Home',
  description: 'Auto-Owners homeowners (Dwelling Fire) quoting portal — aoins.com',
  version: '1.1.0',
  automation: {
    route: 'autoOwners',
    submitPath: '/api/generate-quote/playwright',
    statusPath: '/api/generate-quote/playwright/:jobId',
  },
  payload: {
    supportsFlatKeys: true,
    supportsNestedObjects: true,
    supportsFieldsArray: true,
    notes: 'Keys match getPayloadValue() in autoowners.steps.ts',
  },
  formatRules: {
    date: 'MM/DD/YYYY (accepts ISO YYYY-MM-DD input)',
    yesNo,
    checkbox: 'yes/true/1/y → Yes; no/false/0/n → No',
    dropdown: 'Matched by visible portal label text',
    phone: '(XXX) XXX-XXXX',
    ssn: 'XXX-XX-XXXX',
  },
  nonPayload: [
    {
      id: 'credentials',
      source: 'env',
      keys: ['AUTO_OWNERS_USERNAME', 'AUTO_OWNERS_PASSWORD', 'AUTO_OWNERS_TOTP_SECRET'],
    },
    { id: 'lineOfBusiness', source: 'hardcoded', value: 'DW', notes: 'Dwelling Fire' },
    { id: 'insuranceScore', source: 'hardcoded', notes: 'Always No Score' },
    { id: 'priorCarrier', source: 'hardcoded', notes: 'Always None' },
  ],
  sections: [
    {
      id: 'start-proposal',
      title: 'Start Proposal',
      automationStep: 'start-proposal',
      fields: [
        field('insuranceDetails.effectiveDate', 'Effective Date', 'date', true, {
          aliases: ['personal.effectiveDate', 'effectiveDate'],
        }),
        field('personal.state', 'Business State', 'dropdown', true, {
          aliases: ['state'],
          options: usStateCodes,
        }),
        field('personal.firstName', 'First Name', 'text', true, {
          aliases: ['personal.ownerFirstName', 'firstName'],
        }),
        field('personal.lastName', 'Last Name', 'text', true, {
          aliases: ['personal.ownerLastName', 'lastName'],
        }),
      ],
    },
    {
      id: 'basic-policy',
      title: 'Basic Policy — Fire/Dwelling',
      automationStep: 'basic-policy-fire-dwelling',
      fields: [
        field('personal.address', 'Street Address', 'text', true, {
          aliases: ['personal.streetAddress', 'streetAddress', 'address'],
        }),
        field('personal.city', 'City', 'text', true, { aliases: ['city'] }),
        field('personal.zipCode', 'ZIP Code', 'text', true, { aliases: ['zipCode', 'zip'] }),
        field('personal.phone', 'Phone', 'text', true, { aliases: ['phone'] }),
        field('personal.email', 'Email', 'text', false, { aliases: ['email'] }),
        field('termLength', 'Term Length', 'dropdown', true, {
          options: ['Annually', 'Semi-Annually', 'Quarterly', 'Monthly'],
          notes: 'Also accepts codes A/S/Q/M',
        }),
        field('agentProducerName', 'Agent/Producer Name', 'dropdown', true, {
          options: agentProducerNameOptions,
          notes: 'Exact portal producer label; automation falls back to NOT LISTED if no match',
        }),
        field('insuranceDetails.numberOfLosses5Years', 'Any Losses For Past Five Years', 'dropdown', false, {
          aliases: ['numberOfLosses5Years', 'insuranceDetails.numberOfLosses(5 Years)'],
          options: ['None', 'Yes'],
        }),
      ],
    },
    {
      id: 'household-member',
      title: 'Household Member',
      automationStep: 'household-member',
      fields: [
        field('householdMember.firstName', 'First Name', 'text', true, {
          aliases: ['personal.householdMember.firstName'],
        }),
        field('householdMember.lastName', 'Last Name', 'text', true, {
          aliases: ['personal.householdMember.lastName'],
        }),
        field('householdMember.dob', 'Date of Birth', 'date', true, {
          aliases: ['householdMember.dateOfBirth'],
        }),
        field('householdMember.ssn', 'SSN', 'text', false),
        field('householdMember.relationship', 'Relationship to Insured', 'dropdown', true, {
          options: ['Self/Named Insured', 'Spouse', 'Child', 'Resident Relative', 'Other'],
        }),
        field('householdMember.maritalStatus', 'Marital Status', 'dropdown', true, {
          options: ['Married', 'Single', 'Divorced', 'Widowed'],
        }),
        field('householdMember.dlNumber', "Driver's License Number", 'text', false, {
          aliases: ['householdMember.licenseNumber'],
        }),
      ],
    },
    {
      id: 'residence-location',
      title: 'Residence Location — Add Location',
      automationStep: 'add-location',
      fields: [
        field('locationOccupancy', 'Location Occupancy', 'dropdown', true, {
          aliases: ['locationDetail.locationOccupancy'],
          options: ['Principal', 'Secondary', 'Seasonal', 'Short-term rental', 'Tenant Occupied', 'Vacant'],
        }),
        field('ownerOccupied', 'Owner-Occupied', 'dropdown', true, {
          aliases: ['locationDetail.ownerOccupied'],
          options: yesNo,
        }),
        field('vacant', 'Vacant', 'dropdown', true, {
          aliases: ['locationDetail.vacant'],
          options: yesNo,
        }),
        field('liabilityCoverageOnly', 'Liability Coverage Only', 'dropdown', true, {
          aliases: ['locationDetail.liabilityCoverageOnly'],
          options: yesNo,
        }),
      ],
    },
    {
      id: 'location-information',
      title: 'Location Information — Coverages & Construction',
      automationStep: 'location-information',
      fields: [
        field('program', 'Program', 'dropdown', true, { options: ['Basic'] }),
        field('type', 'Type', 'dropdown', true, { options: ['Dwelling'] }),
        field('coverageA', 'Coverage A', 'text', true, { aliases: ['coverageAAmount'] }),
        field('coverageF', 'Coverage F', 'dropdown', true, {
          options: ['100,000', '200,000', '300,000', '500,000', '1,000,000'],
        }),
        field('personalInjury', 'Personal Injury', 'dropdown', true, { options: yesNo }),
        field('coverageG', 'Coverage G', 'dropdown', true, { options: ['1,000', '5,000'] }),
        field('allOtherPerilsDeductible', 'All Other Perils Deductible', 'dropdown', true, {
          options: ['250', '500', '750', '1,000', '1,500', '2,500', '5,000', '10,000', '15,000', '20,000'],
        }),
        field('windHailDeductible', 'Wind/Hail Deductible', 'dropdown', true, {
          options: ['1500', '2000', '2500', '5000', '10000'],
        }),
        field('hurricaneDeductible', 'Hurricane Deductible', 'dropdown', true, { options: ['5%'] }),
        field('constructionYear', 'Construction Year', 'number', true),
        field('construction', 'Construction', 'dropdown', true, {
          options: ['Frame', 'Masonry', 'Masonry Veneer', 'Log', 'Fire Resistive', 'Cement Fiber'],
        }),
        field('foundation', 'Foundation', 'dropdown', true, { options: ['Open', 'Continuous'] }),
        field('finishedLivingArea', 'Finished Living Area', 'number', false),
        field('numberOfFamiliesUnits', 'Number Of Families/Units', 'number', true),
        field('replacementCost100', '100% Replacement Cost', 'text', false),
        field('roofLossSettlementWindstormHail', 'Roof Loss Settlement (Wind/Hail)', 'dropdown', false, {
          options: ['Actual Cash Value', 'Replacement Cost'],
        }),
        field('marketValue', 'Market Value', 'text', false),
        field('isStudentRental', 'Is this a student rental?', 'dropdown', true, { options: yesNo }),
        field('boardingOrLodgingOrStudentRentals', 'Boarding/Lodging/Student Rentals', 'dropdown', false, {
          options: yesNo,
          notes: 'Fallback when isStudentRental absent',
        }),
        field('visibleFromOtherDwellings', 'Visible From Other Dwellings', 'dropdown', true, {
          options: yesNo,
        }),
        field('locatedOnIsland', 'Located On Island', 'dropdown', true, { options: yesNo }),
        field('conditionOfDwelling', 'Condition Of Dwelling', 'dropdown', false, {
          options: ['Excellent', 'Good', 'Average', 'Poor'],
        }),
        field('roofUpdateYear', 'Roof Update Year', 'text', true, { format: 'yyyy' }),
        field('hasMortgageeContractHolderOrSecuredLineOfCredit', 'Mortgagee/Contract Holder/Secured LOC', 'dropdown', true, {
          options: yesNo,
        }),
        field('dogsOwnedOrKept', 'Any dogs owned/kept', 'dropdown', true, { options: yesNo }),
        field('specificBreed', 'Specify Breed', 'dropdown', false, {
          conditionalOn: { key: 'dogsOwnedOrKept', value: 'Yes' },
        }),
        field('biteHistoryAggressiveBehavior', 'Bite history/aggressive behavior', 'dropdown', false, {
          options: yesNo,
          conditionalOn: { key: 'dogsOwnedOrKept', value: 'Yes' },
        }),
        field('within1000FeetOfHydrant', 'Within 1000 Feet Of Hydrant', 'dropdown', true, {
          options: yesNo,
        }),
        field('bridgeAccess', 'Is there bridge access', 'dropdown', true, { options: yesNo }),
        field('dwellingConstructedWithAsbestos', 'Dwelling constructed with asbestos?', 'dropdown', true, {
          options: yesNo,
        }),
      ],
    },
    {
      id: 'location-information-continued',
      title: 'Location Information Continued',
      automationStep: 'location-information-continued',
      fields: [
        field('fireplace', 'Fireplace', 'dropdown', false, { options: yesNo }),
        field('swimmingPool', 'Swimming Pool', 'dropdown', false, { options: yesNo }),
        field('fortifiedHome', 'FORTIFIED Home™', 'dropdown', true, {
          options: ['No', 'Safer Living', 'IRC', 'Bronze', 'Silver', 'Gold', 'Fortified Roof'],
        }),
        field('woodCoalHeating', 'Wood/Coal Heating', 'dropdown', true, { options: yesNo }),
        field('woodCoalHeatingQuantity', 'Wood/Coal Heating Quantity', 'number', false, {
          conditionalOn: { key: 'woodCoalHeating', value: 'Yes' },
        }),
        field('gatedAccessToDwelling', 'Gated access to dwelling', 'dropdown', true, { options: yesNo }),
        field('applicantWillingToCompleteDiySurvey', 'DIY survey opt-in', 'dropdown', true, {
          options: yesNo,
        }),
        field('screenedEnclosure', 'Screened Enclosure', 'dropdown', true, { options: yesNo }),
        field('roofYear', 'Roof Year', 'text', false, { aliases: ['roofUpdateYear'] }),
        field('roofMaterial', 'Roof Material', 'dropdown', true, { optionsSource: 'portal' }),
        field('roofShape', 'Roof Shape', 'dropdown', false, { optionsSource: 'portal' }),
        field('heatingType', 'Heating Type', 'dropdown', false, { optionsSource: 'portal' }),
        field('plumbingType', 'Plumbing Type', 'dropdown', false, { optionsSource: 'portal' }),
        field('electricalType', 'Electrical Type', 'dropdown', false, { optionsSource: 'portal' }),
        field('numberOfStories', 'Number of Stories', 'dropdown', false, { optionsSource: 'portal' }),
        field('garageType', 'Garage Type', 'dropdown', false, { optionsSource: 'portal' }),
        field('trampoline', 'Trampoline', 'dropdown', false, { options: yesNo }),
        field('burglarAlarm', 'Burglar Alarm', 'dropdown', false, { options: yesNo }),
        field('fireAlarm', 'Fire Alarm', 'dropdown', false, { options: yesNo }),
        field('sprinklerSystem', 'Sprinkler System', 'dropdown', false, { options: yesNo }),
        field('gatedCommunity', 'Gated Community', 'dropdown', false, { options: yesNo }),
      ],
    },
    {
      id: 'underwriting-policy-questions',
      title: 'Underwriting — Policy Questions',
      automationStep: 'underwriting-policy-questions',
      fields: [
        field('pleaseExplain', 'Please Explain', 'text', true),
        field('hasAnyCompanyCanceledRefusedOrDeclinedRenewal', 'Canceled/Refused/Declined Renewal', 'dropdown', true, {
          options: yesNo,
        }),
        field('options', 'Options', 'dropdown', false, {
          options: ['Non-Pay', 'Previous insurer is leaving the market', 'Other'],
          conditionalOn: { key: 'hasAnyCompanyCanceledRefusedOrDeclinedRenewal', value: 'Yes' },
        }),
        field('hasAutoOwnersInsurancePast5Years', 'Auto-Owners Insurance Past 5 Years', 'dropdown', true, {
          options: yesNo,
        }),
        field('previousPolicyNumber', 'Previous Policy Number', 'text', false, {
          conditionalOn: { key: 'hasAutoOwnersInsurancePast5Years', value: 'Yes' },
        }),
      ],
    },
    {
      id: 'underwriting-location-specific',
      title: 'Underwriting — Location Specific Questions',
      automationStep: 'underwriting-location-specific',
      fields: [
        field('dwellingForSale', 'Dwelling For Sale', 'dropdown', true, { options: yesNo }),
        field('isNewVentureNoPreviousLandlordOrRentalPropertyExperience', 'New Venture', 'dropdown', true, {
          options: yesNo,
        }),
        field('dwellingNewPurchase', 'Dwelling New Purchase', 'dropdown', true, { options: yesNo }),
        field('purchasePrice', 'Purchase Price', 'text', false, {
          conditionalOn: { key: 'dwellingNewPurchase', value: 'Yes' },
        }),
        field('dwellingOccupied', 'Dwelling Occupied', 'dropdown', true, { options: yesNo }),
        field('locationSpecificPleaseExplain', 'Please Explain', 'text', false, {
          aliases: ['locationSpecificQuestions.pleaseExplain'],
        }),
        field('expectedOccupancyDate', 'Expected Occupancy Date', 'date', false),
        field('dayCareOnPremises', 'Day Care On Premises', 'dropdown', true, { options: yesNo }),
        field('childrenCaredForCount', 'Children Cared For Count', 'number', false, {
          conditionalOn: { key: 'dayCareOnPremises', value: 'Yes' },
        }),
        field('farmingOnPremises', 'Farming On Premises', 'dropdown', true, { options: yesNo }),
        field('acresFarmedByOthers', 'Acres Farmed By Others', 'number', false, {
          conditionalOn: { key: 'farmingOnPremises', value: 'Yes' },
        }),
        field('numberOfAnimalsLarge', 'Number of Animals (Large)', 'number', false),
        field('numberOfAnimalsMedium', 'Number of Animals (Medium)', 'number', false),
        field('numberOfAnimalsSmall', 'Number of Animals (Small)', 'number', false),
        field('otherBusinessOnPremises', 'Other Business On Premises', 'dropdown', true, { options: yesNo }),
        field('describeBusiness', 'Describe Business', 'text', false, {
          conditionalOn: { key: 'otherBusinessOnPremises', value: 'Yes' },
        }),
        field('buildingUnderRenovationOrReconstruction', 'Under Renovation/Reconstruction', 'dropdown', true, {
          options: yesNo,
        }),
        field('householdMembersLivingDuringRenovation', 'Living During Renovation', 'dropdown', false, {
          conditionalOn: { key: 'buildingUnderRenovationOrReconstruction', value: 'Yes' },
        }),
        field('renovationExplanation', 'Renovation Explanation', 'text', false, {
          conditionalOn: { key: 'buildingUnderRenovationOrReconstruction', value: 'Yes' },
        }),
        field('responsesVerifiedWithApplicant', 'Responses Verified With Applicant', 'dropdown', true, {
          options: yesNo,
        }),
      ],
    },
    {
      id: 'final-sale-policy-questions',
      title: 'Final Sale — Policy Questions',
      automationStep: 'final-sale-policy-questions',
      fields: [
        field('hasFiledPersonalBankruptcyOrJudgementsPast5Years', 'Bankruptcy/Judgements Past 5 Years', 'dropdown', true, {
          options: yesNo,
        }),
        field('bankruptcyPleaseExplain', 'Bankruptcy Please Explain', 'text', false, {
          conditionalOn: { key: 'hasFiledPersonalBankruptcyOrJudgementsPast5Years', value: 'Yes' },
        }),
        field('hasAnyApplicantBeenConvictedOfArson', 'Convicted Of Arson', 'dropdown', true, {
          options: yesNo,
        }),
      ],
    },
    {
      id: 'final-sale-location-specific',
      title: 'Final Sale — Location Specific Questions',
      automationStep: 'final-sale-location-specific',
      fields: [
        field('areThereAnyOutbuildingsOnPremises', 'Outbuildings On Premises', 'dropdown', true, {
          options: yesNo,
        }),
        field('anyFloodingBrushLandslideOrUnusualHazards', 'Flooding/Brush/Landslide Hazards', 'dropdown', true, {
          options: yesNo,
        }),
        field('areDogsAllowed', 'Dogs Allowed', 'dropdown', true, { options: yesNo }),
        field('anyAnimalsOtherThanLivestockNotTypicallyHouseholdPets', 'Non-Household Animals', 'dropdown', true, {
          options: yesNo,
        }),
        field('anyUncorrectedFireCodeViolations', 'Uncorrected Fire Code Violations', 'dropdown', true, {
          options: yesNo,
        }),
        field('difficultAccessByFireAndPoliceDepartments', 'Difficult Fire/Police Access', 'dropdown', true, {
          options: yesNo,
        }),
      ],
    },
  ],
}

const schemaPath = path.join(__dirname, '../src/lib/carriers/schemas/auto-owners-home.json')
fs.writeFileSync(schemaPath, `${JSON.stringify(schema, null, 2)}\n`)
console.log(`Wrote ${schemaPath}`)
