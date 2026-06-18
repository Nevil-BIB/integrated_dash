import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { HomeExtractionResult } from '@/types/home-extraction'
import { createEmptyHomeExtraction } from '@/types/home-extraction'
import type { AutoExtractionResult } from '@/types/auto-extraction'
import type { ExtractionField, ExtractionBooleanField } from '@/types/extraction'

// Helper to create a high-confidence field
function field(value: string): ExtractionField {
  return {
    value,
    confidence: 'high',
    flagged: false,
  }
}

// Helper to create a high-confidence boolean field
function boolField(value: boolean): ExtractionBooleanField {
  return {
    value,
    confidence: 'high',
    flagged: false,
  }
}

// Generate fake Home extraction data with all required fields
function createFakeHomeExtraction(): HomeExtractionResult {
  const base = createEmptyHomeExtraction()
  return {
    ...base,
    personal: {
      ...base.personal,
      firstName: field('John'),
      lastName: field('Smith'),
      maritalStatus: field('Married'),
      coApplicantPresent: field('Yes'),
      spouseFirstName: field('Sarah'),
      spouseLastName: field('Smith'),
      spouseDOB: field('1987-03-22'),
      spouseSSN: field('987-65-4321'),
      occupation: field('Software Engineer'),
      address: field('1234 Oak Street'),
      city: field('Austin'),
      state: field('TX'),
      zipCode: field('78701'),
      yearsAtCurrentAddress: field('7'),
      livedAtDifferentAddressPast6Months: field('No'),
      priorAddress: field(''),
      priorCity: field(''),
      priorState: field(''),
      priorZipCode: field(''),
      phone: field('(512) 555-1234'),
      email: field('john.smith@email.com'),
      mailingAddress: field('1234 Oak Street'),
      termLength: field('Annually'),
      agentProducerName: field('PEAK, OWEN'),
      country: field('United States'),
      entity: field('Individual'),
      applicantDOB: field('1985-06-15'),
      applicantSSN: field('123-45-6789'),
    },
    property: {
      ...base.property,
      purchaseDate: field('2018-03-01'),
      yearBuilt: field('2005'),
      squareFootage: field('2450'),
      numberOfStories: field('2'),
      bedroomCount: field('4'),
      kitchenCount: field('1'),
      kitchenStyle: field('Custom'),
      bathroomCount: field('2.5'),
      bathroomStyle: field('Standard'),
      flooringPercentage: field('60% hardwood, 40% carpet'),
      heatType: field('Gas'),
      dwellingType: field('Single Family'),
      constructionStyle: field('Colonial'),
      constructionQuality: field('Standard'),
      homeUnderConstruction: field('No'),
      exteriorConstruction: field('Frame/Masonry'),
      exteriorFeatures: field('Brick veneer with vinyl siding accents'),
      fireplaceCount: field('1'),
      fireplaceType: field('Gas'),
      roofAge: field('5'),
      roofConstruction: field('Asphalt Shingle'),
      roofShape: field('Gable'),
      foundation: field('Slab'),
      finishedBasement: field('N/A'),
      garageType: field('2 Car'),
      garageLocation: field('Attached'),
      deckPatioDetails: field('Covered patio 400 sq ft, wood deck 200 sq ft'),
      condoOrTownhouse: field('No'),
      specialFeatures: field('Smart home system, sprinkler system'),
      distanceToFireDepartment: field('Under 5 miles'),
      waterSupplyType: field('Public'),
    },
    occupancy: {
      ...base.occupancy,
      dwellingOccupancy: field('Owner Occupied'),
      businessOnPremises: field('No'),
      shortTermRental: field('No'),
      daysRentedToOthers: field('None'),
      horsesOrLivestock: field('No'),
      numberOfFamilies: field('1'),
    },
    safetyRisk: {
      ...base.safetyRisk,
      alarmSystem: field('Yes'),
      monitoredAlarm: field('Yes'),
      pool: field('No'),
      trampoline: field('No'),
      enclosedYard: field('Yes'),
      dog: field('Yes'),
      dogBreed: field('Golden Retriever'),
      windMitigation: field('None'),
      stormShutters: field('No'),
      impactGlass: field('No'),
    },
    coverage: {
      ...base.coverage,
      dwellingCoverage: field('$450,000'),
      liabilityCoverage: field('$300,000'),
      medicalPayments: field('$5,000'),
      deductible: field('$1,000'),
    },
    scheduledItems: {
      ...base.scheduledItems,
      jewelry: [
        {
          description: field('Diamond engagement ring'),
          value: field('$8,500'),
        },
        {
          description: field('Rolex watch'),
          value: field('$12,000'),
        },
      ],
      otherValuables: [
        {
          description: field('Art collection - 3 original paintings'),
          value: field('$15,000'),
        },
      ],
    },
    claimsHistory: {
      ...base.claimsHistory,
      claims: [],
    },
    insuranceDetails: {
      ...base.insuranceDetails,
      propertySameAsMailing: field('Yes'),
      reasonForPolicy: field('Existing Home'),
      currentlyInsured: field('Yes - Different Carrier'),
      lienholderName: field('Chase Home Mortgage'),
      lienholderAddress: field('PO Box 78889'),
      lienholderCity: field('Phoenix'),
      lienholderState: field('AZ'),
      lienholderZip: field('85062'),
      currentInsuranceCompany: field('State Farm'),
      policyNumber: field('HO-123456789'),
      effectiveDate: field('2025-02-15'),
      currentPremium: field('$2,400/year'),
      escrowed: field('Yes'),
      insuranceCancelledDeclined: field('No'),
      maintenanceCondition: field('Excellent'),
      numberOfLosses5Years: field('0'),
      referredBy: field('Online Search'),
    },
    updates: {
      ...base.updates,
      hvacUpdate: field('Yes'),
      hvacYear: field('2020'),
      plumbingUpdate: field('No'),
      plumbingYear: field(''),
      roofUpdate: field('Yes'),
      roofYear: field('2020'),
      electricalUpdate: field('Yes'),
      electricalYear: field('2019'),
      circuitBreakers: field('Yes'),
      wiringUpdate: field('Yes'),
      wiringYear: field('2019'),
    },
  }
}

// Generate fake Auto extraction data with all required fields
function createFakeAutoExtraction(): AutoExtractionResult {
  return {
    personal: {
      effectiveDate: field('2025-02-15'),
      ownerFirstName: field('John'),
      ownerLastName: field('Smith'),
      ownerDOB: field('1985-06-15'),
      maritalStatus: field('Married'),
      spouseFirstName: field('Sarah'),
      spouseLastName: field('Smith'),
      spouseDOB: field('1987-03-22'),
      streetAddress: field('1234 Oak Street'),
      city: field('Austin'),
      state: field('TX'),
      zipCode: field('78701'),
      garagingAddressSameAsMailing: boolField(true),
      garagingStreetAddress: field(''),
      garagingCity: field(''),
      garagingState: field(''),
      garagingZipCode: field(''),
      yearsAtCurrentAddress: field('7'),
      priorStreetAddress: field(''),
      priorCity: field(''),
      priorState: field(''),
      priorZipCode: field(''),
      phone: field('(512) 555-1234'),
      email: field('john.smith@email.com'),
      ownerDriversLicense: field('12345678'),
      ownerLicenseState: field('TX'),
      spouseDriversLicense: field('87654321'),
      spouseLicenseState: field('TX'),
      ownerOccupation: field('Software Engineer'),
      spouseOccupation: field('Marketing Manager'),
      ownerEducation: field("Bachelor's Degree"),
      spouseEducation: field("Master's Degree"),
      rideShare: boolField(false),
      delivery: boolField(false),
    },
    additionalDrivers: [
      {
        firstName: field('Emma'),
        lastName: field('Smith'),
        dateOfBirth: field('2006-09-10'),
        licenseNumber: field('TXD9876543'),
        licenseState: field('TX'),
        relationship: field('Child'),
        goodStudentDiscount: boolField(true),
        vehicleAssigned: field('Vehicle 2'),
      },
    ],
    vehicles: [
      {
        year: field('2022'),
        make: field('Toyota'),
        model: field('Camry XSE'),
        vin: field('4T1BZ1HK1NU123456'),
        estimatedMileage: field('12000'),
        vehicleUsage: field('Commute'),
        ownership: field('Financed'),
        comprehensiveDeductible: field('500'),
        collisionDeductible: field('500'),
        roadTroubleService: field('$50'),
        limitedTNCCoverage: boolField(false),
        additionalExpenseCoverage: field('$30/day'),
      },
      {
        year: field('2021'),
        make: field('Honda'),
        model: field('CR-V EX-L'),
        vin: field('7FARW2H87ME123456'),
        estimatedMileage: field('15000'),
        vehicleUsage: field('Pleasure'),
        ownership: field('Owned'),
        comprehensiveDeductible: field('500'),
        collisionDeductible: field('500'),
        roadTroubleService: field('$50'),
        limitedTNCCoverage: boolField(false),
        additionalExpenseCoverage: field('$30/day'),
      },
    ],
    coverage: {
      bodilyInjury: field('250/500'),
      propertyDamage: field('100'),
      uninsuredMotorist: field('250/500'),
      underinsuredMotorist: field('250/500'),
      medicalPayments: field('5000'),
      offRoadVehicleLiability: boolField(false),
      towing: boolField(true),
      rental: boolField(true),
    },
    lienholders: [
      {
        vehicleReference: field('Vehicle 1 - 2022 Toyota Camry'),
        lienholderName: field('Toyota Financial Services'),
        lienholderAddress: field('PO Box 105386'),
        lienholderCity: field('Atlanta'),
        lienholderState: field('GA'),
        lienholderZip: field('30348'),
      },
    ],
    priorInsurance: {
      insuranceCompany: field('Progressive'),
      premium: field('$1,800/6 months'),
      policyNumber: field('AUTO-98765432'),
      expirationDate: field('2025-02-14'),
    },
    accidentsOrTickets: [],
  }
}

export async function POST() {
  try {
    const supabase = await createClient()

    // Verify authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Create combined extraction data
    const homeData = createFakeHomeExtraction()
    const autoData = createFakeAutoExtraction()

    const combinedData = {
      quoteType: 'both' as const,
      home: homeData,
      auto: autoData,
    }

    // Create extraction record with fake data
    const { data: extraction, error: dbError } = await supabase
      .from('extractions')
      .insert({
        user_id: user.id,
        filename: 'DEMO_Smith_Family_FactFinder.pdf',
        storage_path: `${user.id}/demo-fact-finder.pdf`,
        insurance_type: 'both',
        extracted_data: combinedData,
        status: 'completed',
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database insert error:', dbError)
      return NextResponse.json({ error: 'Failed to create extraction record', details: dbError }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      extraction,
      message: 'Demo extraction created successfully with all required fields populated'
    })
  } catch (error) {
    console.error('Seed error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET endpoint to check if the seed endpoint is available
export async function GET() {
  return NextResponse.json({
    message: 'Seed endpoint ready. POST to this endpoint to create a demo extraction with all required fields.',
    description: 'Creates a fake "Smith Family" extraction record with Home + Auto data, all required fields populated with realistic values.'
  })
}
