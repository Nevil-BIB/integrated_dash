/**
 * Test script for Auto API to UI transformation
 * Run with: npx tsx scripts/test-auto-transform.ts
 */

import { autoApiToUiExtraction, detectExtractionType, getAutoExtractionData } from '../src/lib/extraction/transform'
import type { AutoApiExtractionResult } from '../src/types/extraction'
import type { AutoExtractionResult } from '../src/types/auto-extraction'

// Sample API extraction result
const sampleApiData: AutoApiExtractionResult = {
  personal: {
    // Policy effective date
    effectiveDate: { value: '2024-07-01', confidence: 'high', flagged: false },
    // Owner info
    ownerFirstName: { value: 'John', confidence: 'high', flagged: false },
    ownerLastName: { value: 'Smith', confidence: 'high', flagged: false },
    ownerDOB: { value: '1985-03-15', confidence: 'medium', flagged: false },
    maritalStatus: { value: 'Married', confidence: 'high', flagged: false },
    // Spouse fields (conditional: only if maritalStatus is Married or Domestic Partner)
    spouseFirstName: { value: 'Jane', confidence: 'high', flagged: false },
    spouseLastName: { value: 'Smith', confidence: 'high', flagged: false },
    spouseDOB: { value: '1987-07-22', confidence: 'medium', flagged: false },
    // Mailing address
    streetAddress: { value: '123 Main St', confidence: 'high', flagged: false },
    city: { value: 'Springfield', confidence: 'high', flagged: false },
    state: { value: 'IL', confidence: 'high', flagged: false },
    zipCode: { value: '62701', confidence: 'high', flagged: false },
    // Garaging address (conditional: only if garagingAddressSameAsMailing is No)
    garagingAddressSameAsMailing: { value: true, confidence: 'high', flagged: false },
    garagingStreetAddress: { value: null, confidence: 'low', flagged: false },
    garagingCity: { value: null, confidence: 'low', flagged: false },
    garagingState: { value: null, confidence: 'low', flagged: false },
    garagingZipCode: { value: null, confidence: 'low', flagged: false },
    // Prior address (conditional: required if yearsAtCurrentAddress < 5)
    priorStreetAddress: { value: null, confidence: 'low', flagged: true },
    priorCity: { value: null, confidence: 'low', flagged: true },
    priorState: { value: null, confidence: 'low', flagged: true },
    priorZipCode: { value: null, confidence: 'low', flagged: true },
    yearsAtCurrentAddress: { value: '10', confidence: 'high', flagged: false },
    // Contact
    phone: { value: '(555) 123-4567', confidence: 'high', flagged: false },
    email: { value: 'john.smith@email.com', confidence: 'high', flagged: false },
    // Auto-specific
    ownerDriversLicense: { value: 'S123-4567-8901', confidence: 'high', flagged: false },
    ownerLicenseState: { value: 'IL', confidence: 'high', flagged: false },
    spouseDriversLicense: { value: 'S234-5678-9012', confidence: 'high', flagged: false },
    spouseLicenseState: { value: 'IL', confidence: 'high', flagged: false },
    ownerOccupation: { value: 'Software Engineer', confidence: 'medium', flagged: false },
    spouseOccupation: { value: 'Teacher', confidence: 'medium', flagged: false },
    ownerEducation: { value: "Bachelor's Degree", confidence: 'medium', flagged: false },
    spouseEducation: { value: "Master's Degree", confidence: 'medium', flagged: false },
    rideShare: { value: false, confidence: 'high', flagged: false },
    delivery: { value: false, confidence: 'high', flagged: false },
  },
  additionalDrivers: [
    {
      firstName: { value: 'Tommy', confidence: 'high', flagged: false },
      lastName: { value: 'Smith', confidence: 'high', flagged: false },
      dateOfBirth: { value: '2005-09-10', confidence: 'high', flagged: false },
      licenseNumber: { value: 'S345-6789-0123', confidence: 'high', flagged: false },
      licenseState: { value: 'IL', confidence: 'high', flagged: false },
      relationship: { value: 'Child', confidence: 'high', flagged: false },
      goodStudentDiscount: { value: true, confidence: 'high', flagged: false },
      vehicleAssigned: { value: 'Vehicle 2', confidence: 'medium', flagged: false },
    },
  ],
  vehicles: [
    {
      // Vehicle info
      year: { value: '2022', confidence: 'high', flagged: false },
      make: { value: 'Toyota', confidence: 'high', flagged: false },
      model: { value: 'Camry', confidence: 'high', flagged: false },
      vin: { value: '1HGBH41JXMN109186', confidence: 'high', flagged: false },
      estimatedMileage: { value: '12000', confidence: 'medium', flagged: false },
      vehicleUsage: { value: 'Commute', confidence: 'high', flagged: false },
      ownership: { value: 'Financed', confidence: 'high', flagged: false },
      // Deductibles (per-vehicle)
      comprehensiveDeductible: { value: '500', confidence: 'high', flagged: false },
      collisionDeductible: { value: '500', confidence: 'high', flagged: false },
      roadTroubleService: { value: '$50', confidence: 'high', flagged: false },
      limitedTNCCoverage: { value: false, confidence: 'high', flagged: false },
      additionalExpenseCoverage: { value: '$25/day', confidence: 'high', flagged: false },
    },
    {
      // Vehicle info
      year: { value: '2020', confidence: 'high', flagged: false },
      make: { value: 'Honda', confidence: 'high', flagged: false },
      model: { value: 'Civic', confidence: 'high', flagged: false },
      vin: { value: '2HGFC2F69MH530234', confidence: 'high', flagged: false },
      estimatedMileage: { value: '8000', confidence: 'medium', flagged: false },
      vehicleUsage: { value: 'Pleasure', confidence: 'high', flagged: false },
      ownership: { value: 'Owned', confidence: 'high', flagged: false },
      // Deductibles (per-vehicle)
      comprehensiveDeductible: { value: '1000', confidence: 'high', flagged: false },
      collisionDeductible: { value: '1000', confidence: 'high', flagged: false },
      roadTroubleService: { value: 'None', confidence: 'high', flagged: false },
      limitedTNCCoverage: { value: false, confidence: 'high', flagged: false },
      additionalExpenseCoverage: { value: 'None', confidence: 'high', flagged: false },
    },
  ],
  coverage: {
    bodilyInjury: { value: '250/500', confidence: 'high', flagged: false },
    propertyDamage: { value: '100', confidence: 'high', flagged: false },
    uninsuredMotorist: { value: '250/500', confidence: 'high', flagged: false },
    underinsuredMotorist: { value: '250/500', confidence: 'high', flagged: false },
    medicalPayments: { value: '5000', confidence: 'high', flagged: false },
    towing: { value: true, confidence: 'high', flagged: false },
    rental: { value: true, confidence: 'high', flagged: false },
    offRoadVehicleLiability: { value: false, confidence: 'high', flagged: false },
  },
  // Note: deductibles are now part of vehicles, not a separate array
  lienholders: [
    {
      vehicleReference: { value: '2022 Toyota Camry', confidence: 'high', flagged: false },
      lienholderName: { value: 'Toyota Financial Services', confidence: 'high', flagged: false },
      lienholderAddress: { value: 'PO Box 105386', confidence: 'medium', flagged: false },
      lienholderCity: { value: 'Atlanta', confidence: 'medium', flagged: false },
      lienholderState: { value: 'GA', confidence: 'medium', flagged: false },
      lienholderZip: { value: '30348', confidence: 'medium', flagged: false },
    },
  ],
  priorInsurance: {
    insuranceCompany: { value: 'State Farm', confidence: 'high', flagged: false },
    premium: { value: '$1,850', confidence: 'high', flagged: false },
    policyNumber: { value: 'SF-12345678', confidence: 'high', flagged: false },
    expirationDate: { value: '2024-06-15', confidence: 'high', flagged: false },
  },
  accidentsOrTickets: [
    {
      driverName: { value: 'John Smith', confidence: 'high', flagged: false },
      date: { value: '2022-03-15', confidence: 'high', flagged: false },
      type: { value: 'Speeding Ticket', confidence: 'high', flagged: false },
      description: { value: '15 mph over limit', confidence: 'medium', flagged: false },
      amount: { value: null, confidence: 'low', flagged: true },
      atFault: { value: 'N/A', confidence: 'high', flagged: false },
    },
  ],
}

// Run tests
console.log('='.repeat(80))
console.log('Auto API to UI Transformation Test')
console.log('='.repeat(80))

// Test 1: Detection
console.log('\n1. Testing detectExtractionType...')
const detectedType = detectExtractionType(sampleApiData)
console.log(`   Detected type: ${detectedType}`)
console.log(`   Expected: auto`)
console.log(`   Result: ${detectedType === 'auto' ? 'PASS' : 'FAIL'}`)

// Test 2: Direct transformation
console.log('\n2. Testing autoApiToUiExtraction...')
const uiResult = autoApiToUiExtraction(sampleApiData)

// Check structure (note: deductibles are now part of vehicles, not a separate array)
const structureChecks = [
  { name: 'personal exists', check: () => !!uiResult.personal },
  { name: 'additionalDrivers is array', check: () => Array.isArray(uiResult.additionalDrivers) },
  { name: 'vehicles is array', check: () => Array.isArray(uiResult.vehicles) },
  { name: 'coverage exists', check: () => !!uiResult.coverage },
  { name: 'lienholders is array', check: () => Array.isArray(uiResult.lienholders) },
  { name: 'priorInsurance exists', check: () => !!uiResult.priorInsurance },
  { name: 'accidentsOrTickets is array', check: () => Array.isArray(uiResult.accidentsOrTickets) },
  { name: 'vehicles[0] has deductible fields', check: () => uiResult.vehicles[0] && 'comprehensiveDeductible' in uiResult.vehicles[0] },
]

structureChecks.forEach(({ name, check }) => {
  console.log(`   ${name}: ${check() ? 'PASS' : 'FAIL'}`)
})

// Test 3: Value preservation (note: deductibles are now in vehicles)
console.log('\n3. Testing value preservation...')
const valueChecks = [
  { name: 'personal.ownerFirstName.value', expected: 'John', actual: uiResult.personal.ownerFirstName.value },
  { name: 'personal.ownerLastName.value', expected: 'Smith', actual: uiResult.personal.ownerLastName.value },
  { name: 'personal.rideShare.value', expected: false, actual: uiResult.personal.rideShare.value },
  { name: 'additionalDrivers[0].firstName.value', expected: 'Tommy', actual: uiResult.additionalDrivers[0]?.firstName.value },
  { name: 'vehicles[0].make.value', expected: 'Toyota', actual: uiResult.vehicles[0]?.make.value },
  { name: 'vehicles.length', expected: 2, actual: uiResult.vehicles.length },
  { name: 'coverage.bodilyInjury.value', expected: '250/500', actual: uiResult.coverage.bodilyInjury.value },
  { name: 'vehicles[0].comprehensiveDeductible.value', expected: '500', actual: uiResult.vehicles[0]?.comprehensiveDeductible.value },
  { name: 'vehicles[1].collisionDeductible.value', expected: '1000', actual: uiResult.vehicles[1]?.collisionDeductible.value },
  { name: 'lienholders[0].lienholderName.value', expected: 'Toyota Financial Services', actual: uiResult.lienholders[0]?.lienholderName.value },
  { name: 'priorInsurance.insuranceCompany.value', expected: 'State Farm', actual: uiResult.priorInsurance.insuranceCompany.value },
  { name: 'accidentsOrTickets[0].type.value', expected: 'Speeding Ticket', actual: uiResult.accidentsOrTickets[0]?.type.value },
]

valueChecks.forEach(({ name, expected, actual }) => {
  const pass = expected === actual
  console.log(`   ${name}: ${pass ? 'PASS' : 'FAIL'} (expected: ${expected}, actual: ${actual})`)
})

// Test 4: Confidence preservation
console.log('\n4. Testing confidence preservation...')
const confidenceChecks = [
  { name: 'personal.ownerFirstName.confidence', expected: 'high', actual: uiResult.personal.ownerFirstName.confidence },
  { name: 'personal.ownerDOB.confidence', expected: 'medium', actual: uiResult.personal.ownerDOB.confidence },
  { name: 'additionalDrivers[0].goodStudentDiscount.confidence', expected: 'high', actual: uiResult.additionalDrivers[0]?.goodStudentDiscount.confidence },
]

confidenceChecks.forEach(({ name, expected, actual }) => {
  const pass = expected === actual
  console.log(`   ${name}: ${pass ? 'PASS' : 'FAIL'} (expected: ${expected}, actual: ${actual})`)
})

// Test 5: Flagged preservation
console.log('\n5. Testing flagged preservation...')
const flaggedChecks = [
  { name: 'personal.priorStreetAddress.flagged', expected: true, actual: uiResult.personal.priorStreetAddress.flagged },
  { name: 'personal.ownerFirstName.flagged', expected: false, actual: uiResult.personal.ownerFirstName.flagged },
  { name: 'accidentsOrTickets[0].amount.flagged', expected: true, actual: uiResult.accidentsOrTickets[0]?.amount.flagged },
]

flaggedChecks.forEach(({ name, expected, actual }) => {
  const pass = expected === actual
  console.log(`   ${name}: ${pass ? 'PASS' : 'FAIL'} (expected: ${expected}, actual: ${actual})`)
})

// Test 6: getAutoExtractionData wrapper
console.log('\n6. Testing getAutoExtractionData...')
const wrapperResult = getAutoExtractionData(sampleApiData)
console.log(`   Returns non-null: ${wrapperResult !== null ? 'PASS' : 'FAIL'}`)
console.log(`   Same structure as direct: ${JSON.stringify(wrapperResult?.personal.ownerFirstName) === JSON.stringify(uiResult.personal.ownerFirstName) ? 'PASS' : 'FAIL'}`)

// Test 7: Empty/missing data handling (note: deductibles are now part of vehicles)
console.log('\n7. Testing empty data handling...')
const emptyApiData: AutoApiExtractionResult = {
  personal: {} as any,
  additionalDrivers: [],
  vehicles: [],
  coverage: {} as any,
  lienholders: [],
  priorInsurance: {} as any,
  accidentsOrTickets: [],
}

const emptyResult = autoApiToUiExtraction(emptyApiData)
console.log(`   Empty personal handled: ${emptyResult.personal.ownerFirstName.value === null ? 'PASS' : 'FAIL'}`)
console.log(`   Empty arrays preserved: ${emptyResult.vehicles.length === 0 ? 'PASS' : 'FAIL'}`)
console.log(`   Empty coverage handled: ${emptyResult.coverage.bodilyInjury.value === null ? 'PASS' : 'FAIL'}`)

console.log('\n' + '='.repeat(80))
console.log('Test Complete')
console.log('='.repeat(80))
