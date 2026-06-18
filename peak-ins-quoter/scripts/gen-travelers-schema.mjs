import fs from 'fs'

const yesNo = ['Yes', 'No']
const field = (key, label, type, required, extra = {}) => ({
  key,
  label,
  type,
  required,
  ...extra,
})

const schema = {
  id: 'travelers-home',
  carrierId: 'travelers',
  productType: 'home',
  label: 'Travelers Home',
  description: 'Travelers homeowners quoting portal',
  version: '1.0.0',
  automation: {
    route: 'travelers',
    submitPath: '/api/generate-quote/playwright/travelers',
    statusPath: '/api/generate-quote/playwright/travelers/:jobId',
  },
  payload: {
    supportsFlatKeys: true,
    supportsNestedObjects: true,
    supportsFieldsArray: true,
    notes:
      'Keys also resolve as homeownersInformations.* and occupancy.* aliases in backend runner.',
  },
  formatRules: {
    date: 'MM/DD/YYYY (accepts ISO YYYY-MM-DD input)',
    yesNo,
    checkbox: 'yes/true/1/y → Yes; no/false/0/n → No',
    dropdown: 'Matched by visible portal label text',
  },
  nonPayload: [
    { id: 'credentials', source: 'env', keys: ['TRAVELERS_USERNAME', 'TRAVELERS_PASSWORD'] },
    { id: 'mfaOtp', source: 'webhook' },
    {
      id: 'replacementCostMethod',
      source: 'hardcoded',
      notes: 'Quote W/Out Estimate — not from payload',
    },
  ],
  sections: [
    {
      id: 'customer-search',
      title: 'Customer Search',
      automationStep: 'customer-search',
      fields: [
        field('personal.lastName', 'Last Name', 'text', true, {
          aliases: ['lastName', 'personal.ownerLastName'],
        }),
        field('personal.firstName', 'First Name', 'text', false, {
          aliases: ['firstName', 'personal.ownerFirstName'],
        }),
        field('personal.state', 'State', 'dropdown', false, {
          aliases: ['state', 'stateCode'],
          notes: 'Optional on search; required on Account Details',
        }),
        field('personal.city', 'City', 'text', false, { aliases: ['city'] }),
        field('personal.zipCode', 'ZIP', 'text', false, { aliases: ['zip', 'zipCode'] }),
        field('accountSearchCriteria', 'Search Criteria (legacy)', 'dropdown', false, {
          options: ['01 Name', '02 Policy', '04 CCF', '05 ABS'],
          notes: 'Default 01 Name',
        }),
        field('policyNumber', 'Policy #', 'text', false, {
          aliases: ['insuranceDetails.policyNumber'],
          conditionalOn: { key: 'accountSearchCriteria', value: '02 Policy' },
        }),
        field('ccfNumber', 'CCF #', 'text', false, {
          conditionalOn: { key: 'accountSearchCriteria', value: '04 CCF' },
        }),
        field('absNumber', 'ABS #', 'text', false, {
          conditionalOn: { key: 'accountSearchCriteria', value: '05 ABS' },
        }),
        field('personal.address', 'Street (Add Customer)', 'text', true, {
          aliases: ['streetAddress', 'street', 'address', 'personal.streetAddress'],
        }),
      ],
    },
    {
      id: 'initiate-quote',
      title: 'Initiate Quote',
      automationStep: 'initiate-quote',
      fields: [
        field('insuranceDetails.effectiveDate', 'Effective Date', 'date', true, {
          aliases: ['personal.effectiveDate', 'effectiveDate'],
        }),
      ],
    },
    {
      id: 'account-details',
      title: 'Account Details',
      automationStep: 'account-details',
      fields: [
        field('personal.phone', 'Home Phone', 'text', true, {
          aliases: ['phone', 'personal.homePhone'],
        }),
        field('personal.applicantDOB', 'Date of Birth', 'date', true, {
          aliases: ['personal.dateOfBirth', 'dateOfBirth'],
        }),
        field('personal.address', 'Address', 'text', true, {
          aliases: ['streetAddress', 'address'],
        }),
        field('personal.city', 'City', 'text', true, { aliases: ['city'] }),
        field('personal.state', 'State', 'dropdown', true, { aliases: ['state'] }),
        field('personal.zipCode', 'ZIP Code', 'text', true, {
          aliases: ['zipCode', 'zip'],
        }),
      ],
    },
    {
      id: 'report-information',
      title: 'Report Information',
      automationStep: 'report-information',
      fields: [
        field(
          'personal.livedAtDifferentAddressPast6Months',
          'Have you lived at a different address in the past 6 months?',
          'dropdown',
          true,
          { aliases: ['livedAtDifferentAddressPast6Months'], options: yesNo },
        ),
      ],
    },
    {
      id: 'home-underwriting',
      title: 'Home Underwriting',
      automationStep: 'home-underwriting',
      fields: [
        field(
          'homeownersInsuranceCancelledDeclinedNonrenewedLast3Years',
          'Has your homeowners insurance been cancelled/declined/nonrenewed in the last 3 years?',
          'dropdown',
          true,
          { options: yesNo },
        ),
        field('homeVacantOrUnoccupied', 'Is the home vacant or unoccupied?', 'dropdown', true, {
          options: yesNo,
        }),
        field('occupiedInNext30Days', 'Will it be occupied in the next 30 days?', 'dropdown', true, {
          options: yesNo,
          conditionalOn: { key: 'homeVacantOrUnoccupied', value: 'Yes' },
        }),
        field(
          'businessConductedOnPremises',
          'Do you conduct any type of business on the premises?',
          'dropdown',
          true,
          { options: yesNo },
        ),
        field(
          'businessProvidesProfessionalAdviceOrOpinions',
          'Does the Business provide professional advice and/or opinions?',
          'dropdown',
          true,
          { options: yesNo, conditionalOn: { key: 'businessConductedOnPremises', value: 'Yes' } },
        ),
        field(
          'businessHasEmployeesOtherThanResidenceRelatives',
          'Are there any employees other than residence relatives?',
          'dropdown',
          true,
          { options: yesNo, conditionalOn: { key: 'businessConductedOnPremises', value: 'Yes' } },
        ),
        field(
          'businessMoreThanFourClientVisitsPerWeek',
          'More than four client visits per week?',
          'dropdown',
          true,
          { options: yesNo, conditionalOn: { key: 'businessConductedOnPremises', value: 'Yes' } },
        ),
        field(
          'homeAvailableForRentIncludingShortTermOrHomeSharing',
          'Home available for rent / short-term / home sharing?',
          'dropdown',
          true,
          { options: yesNo },
        ),
        field(
          'portionOfHomeAvailableForRent',
          'What portion of your home is available for rent?',
          'dropdown',
          true,
          {
            optionsSource: 'portal',
            conditionalOn: {
              key: 'homeAvailableForRentIncludingShortTermOrHomeSharing',
              value: 'Yes',
            },
          },
        ),
        field(
          'basisHomeAvailableForRent',
          'On what basis is your home available for rent?',
          'dropdown',
          true,
          {
            optionsSource: 'portal',
            conditionalOn: {
              key: 'homeAvailableForRentIncludingShortTermOrHomeSharing',
              value: 'Yes',
            },
          },
        ),
        field(
          'homeInDesignatedHighRiskFloodZone',
          'Is the home in a designated high risk flood zone?',
          'dropdown',
          true,
          { options: yesNo },
        ),
        field('hasFloodPolicy', 'Do you have a flood policy?', 'dropdown', true, {
          options: yesNo,
          conditionalOn: { key: 'homeInDesignatedHighRiskFloodZone', value: 'Yes' },
        }),
        field(
          'petsOrAnimalsBittenOrInjuredAnyone',
          'Pets/animals that have bitten or injured anyone?',
          'dropdown',
          true,
          { options: yesNo },
        ),
        field('ownsRestrictedDogBreedsOrMix', 'Own restricted dog breeds or mix?', 'dropdown', true, {
          options: yesNo,
        }),
        field('insuranceStatus', 'Insurance Status', 'dropdown', true, {
          aliases: ['insuranceDetails.insuranceStatus'],
          options: ['Currently Insured', 'No Current Insurance'],
        }),
        field('burglarAlarm', 'Burglar Alarm', 'dropdown', true, {
          options: ['Local', 'Smart', 'Central', 'None'],
        }),
      ],
    },
    {
      id: 'residence-location',
      title: 'Residence — Additional Location',
      automationStep: 'residence',
      fields: [
        field('feetFromHydrant', 'Feet from Hydrant', 'number', true, {
          aliases: ['property.feetFromHydrant', 'residence.feetFromHydrant'],
        }),
      ],
    },
    {
      id: 'home-characteristics',
      title: 'Home Characteristics',
      automationStep: 'home-characteristics',
      fields: [
        field('yearBuilt', 'Year Built', 'number', true),
        field('residenceType', 'Residence Type', 'dropdown', true, {
          options: ['Primary', 'Secondary'],
        }),
        field('seasonalDwelling', 'Seasonal Dwelling', 'dropdown', true, { options: yesNo }),
        field('swimmingPool', 'Swimming Pool', 'dropdown', true, { options: yesNo }),
        field('swimmingPoolType', 'Swimming Pool Type', 'dropdown', true, {
          options: ['Above Ground', 'Inground'],
          conditionalOn: { key: 'swimmingPool', value: 'Yes' },
        }),
        field('swimmingPoolSafetyFeature', 'Swimming Pool Safety Feature', 'dropdown', true, {
          options: ['None', 'Fence or Locked Gate', 'Retractable Ladder', 'Other'],
          conditionalOn: { key: 'swimmingPool', value: 'Yes' },
        }),
        field('purchaseMonthYear', 'Purchase Month/Year', 'text', true),
        field('woodCoalPelletStove', 'Wood/Coal/Pellet Stove', 'dropdown', true, {
          options: yesNo,
        }),
        field(
          'stoveProfessionallyInstalledOrInspected',
          'Stove Professionally Installed/Inspected',
          'dropdown',
          true,
          { options: yesNo, conditionalOn: { key: 'woodCoalPelletStove', value: 'Yes' } },
        ),
        field('chimneyCleanedAnnually', 'Chimney Cleaned Annually', 'dropdown', true, {
          options: yesNo,
          conditionalOn: { key: 'woodCoalPelletStove', value: 'Yes' },
        }),
        field('ulListed', 'UL Listed', 'dropdown', true, {
          options: yesNo,
          conditionalOn: { key: 'woodCoalPelletStove', value: 'Yes' },
        }),
        field('numberOfFamilies', 'Number of Families', 'dropdown', true, {
          options: ['1 Family', '2 Family', '3 Family', '4 Family', '5+ Family'],
        }),
        field('primarySourceOfHeat', 'Primary Source of Heat', 'dropdown', true, {
          options: ['Central - Gas', 'Central - Electric', 'Central - Oil', 'None', 'Other'],
        }),
      ],
    },
    {
      id: 'structure',
      title: 'Structure',
      automationStep: 'structure',
      fields: [
        field('squareFootage', 'Square Footage', 'number', true, {
          aliases: ['property.squareFootage'],
        }),
        field('buildingConstructionType', 'Building Construction Type', 'dropdown', true, {
          options: [
            'Frame',
            'Masonry',
            'Concrete',
            'Steel',
            'Modular',
            'Log Home',
            'Mobile or Manufactured',
          ],
          optionsSource: 'portal',
        }),
        field('sidingType', 'Siding Type', 'dropdown', true, {
          options: [
            'Vinyl',
            'Aluminum/Steel',
            'Wood',
            'Brick/Masonry Veneer',
            'Stone Veneer',
            'Stucco',
            'Cement Fiber',
            'All Other',
          ],
          optionsSource: 'portal',
        }),
        field('primaryFoundationType', 'Primary Foundation Type', 'dropdown', true, {
          options: ['Basement', 'Crawl Space', 'Slab', 'Open/Raised'],
          optionsSource: 'portal',
        }),
        field('basementFinished', 'Basement Finished %', 'text', true, {
          notes: 'Yes→100%, No→0%, or numeric %',
          conditionalOn: { key: 'primaryFoundationType', value: 'Basement' },
        }),
        field('numberOfBathrooms', 'Number of Bathrooms', 'number', true),
        field('garageType', 'Garage Type', 'dropdown', true, {
          options: ['None', 'Attached', 'Detached', 'Carport', 'Basement'],
          optionsSource: 'portal',
        }),
        field('garageSizeNumberOfCars', 'Garage Size (Number of Cars)', 'dropdown', true, {
          options: ['1', '2', '3', '4', '5+'],
          conditionalOn: { key: 'garageType', notValue: 'None' },
        }),
        field('numberOfStories', 'Number of Stories', 'dropdown', true, {
          options: ['1', '1.5', '2', '2.5', '3', '4+'],
          optionsSource: 'portal',
        }),
      ],
    },
    {
      id: 'roof',
      title: 'Roof',
      automationStep: 'roof',
      fields: [
        field('roofShape', 'Roof Shape', 'dropdown', true, {
          options: ['Gable', 'Hip', 'Gambrel', 'Flat', 'Shed', 'Complex', 'Other'],
          optionsSource: 'portal',
        }),
        field('roofType', 'Roof Type', 'dropdown', true, {
          options: [
            'Architectural Shingle',
            'Asphalt-Fiberglass',
            'Clay or Concrete Tile',
            'Slate',
            'Metal',
            'Comp Over Wood',
            'Wood',
            'Modified Polymer',
            'Foam Composite',
            'Rolled Material',
            'Rubber/Membrane',
            'Tar & Gravel',
            'T-Lock',
            'Asbestos',
            'Other',
          ],
          optionsSource: 'portal',
        }),
        field('yearRoofingReplaced', 'Year Roofing Replaced', 'number', true),
        field('numberOfSolarPanelsOnRoof', 'Number of Solar Panels on Roof', 'number', true),
      ],
    },
    {
      id: 'losses',
      title: 'Losses',
      automationStep: 'losses',
      fields: [
        field('currentAutoPolicyBodilyInjuryLimit', 'Current Auto Policy Bodily Injury Limit', 'dropdown', true, {
          options: [
            'Less than or Equal to 25/50 (CSL 75) (A)',
            'Greater than 25/50 (CSL 75) (B)',
            'No Car (N)',
            'Car in Storage (G)',
            'Military (M)',
            'Car Without Insurance (NP)',
          ],
        }),
      ],
    },
    {
      id: 'home-coverage',
      title: 'Home Coverage',
      automationStep: 'coverage',
      fields: [
        field('baseCoverageLevel', 'Base Coverage Level', 'dropdown', true, {
          options: [
            'Travelers Protect®',
            'Travelers Protect Plus®',
            'Travelers Protect Premier®',
          ],
        }),
        field('replacementCost', 'Replacement Cost', 'number', true),
        field('aDwellingLimit', 'A - Dwelling Limit', 'number', true),
        field('ePersonalLiability', 'E - Personal Liability', 'dropdown', true, {
          optionsSource: 'portal',
        }),
        field('fMedicalPayments', 'F - Medical Payments', 'dropdown', true, {
          optionsSource: 'portal',
        }),
        field('deductible', 'Deductible', 'dropdown', true, {
          options: [
            '1,000',
            '1,500',
            '2,000',
            '2,500',
            '5,000',
            '7,500',
            '10,000',
            '25,000',
            '50,000',
            '1%',
            '2%',
          ],
        }),
      ],
    },
    {
      id: 'digital-quote',
      title: 'Digital Quote',
      automationStep: 'digital-quote',
      fields: [
        field('personal.email', 'Customer Email Address', 'text', true, {
          aliases: ['email', 'shared.email', 'digitalQuoteEmail'],
        }),
      ],
    },
  ],
}

fs.writeFileSync(
  'src/lib/carriers/schemas/travelers-home.json',
  `${JSON.stringify(schema, null, 2)}\n`,
)
console.log('travelers-home.json written')
