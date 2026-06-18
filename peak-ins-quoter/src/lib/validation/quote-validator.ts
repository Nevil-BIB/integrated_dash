/**
 * Quote Validation Functions
 * Validates home and auto quote data against required fields and format rules
 */

import type {
  HomeQuoteData,
  AutoQuoteData,
  QuoteType,
  ValidationResult,
  FieldValidation,
  Address,
  AdditionalDriver,
  Automobile,
  AccidentOrTicket,
  HomeStyle,
  ConstructionType,
  MaritalStatus,
} from '@/types/quote';

// =============================================================================
// Format Validation Helpers
// =============================================================================

/**
 * Validates date format MM/DD/YYYY
 */
export function isValidDateFormat(value: string): boolean {
  if (!value) return false;
  const dateRegex = /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/\d{4}$/;
  if (!dateRegex.test(value)) return false;

  // Parse and validate the actual date
  const [month, day, year] = value.split('/').map(Number);
  const date = new Date(year, month - 1, day);
  return (
    date.getMonth() === month - 1 &&
    date.getDate() === day &&
    date.getFullYear() === year
  );
}

/**
 * Validates E.164 phone format (+1XXXXXXXXXX)
 */
export function isValidE164Phone(value: string): boolean {
  if (!value) return false;
  const e164Regex = /^\+1\d{10}$/;
  return e164Regex.test(value);
}

/**
 * Validates SSN format XXX-XX-XXXX
 */
export function isValidSSNFormat(value: string): boolean {
  if (!value) return false;
  const ssnRegex = /^\d{3}-\d{2}-\d{4}$/;
  return ssnRegex.test(value);
}

/**
 * Validates email format
 */
export function isValidEmail(value: string): boolean {
  if (!value) return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(value);
}

/**
 * Validates a 4-digit year
 */
export function isValidYear(value: number): boolean {
  return Number.isInteger(value) && value >= 1800 && value <= new Date().getFullYear() + 1;
}

/**
 * Validates an address object has all required fields
 */
export function isValidAddress(address: Partial<Address> | undefined): boolean {
  if (!address) return false;
  return !!(
    address.street?.trim() &&
    address.city?.trim() &&
    address.state?.trim() &&
    address.zip?.trim()
  );
}

/**
 * Validates zip code format (5 digits or 5+4)
 */
export function isValidZipCode(zip: string): boolean {
  if (!zip) return false;
  const zipRegex = /^\d{5}(-\d{4})?$/;
  return zipRegex.test(zip);
}

// =============================================================================
// Home Quote Validation
// =============================================================================

const HOME_STYLES: HomeStyle[] = [
  'Colonial', 'Ranch', 'Split Level', 'Cape Cod', 'Contemporary',
  'Victorian', 'Bi-Level', 'Tri-Level', 'Townhouse', 'Row House', 'Other'
];

const CONSTRUCTION_TYPES: ConstructionType[] = [
  'Frame', 'Masonry', 'Frame/Masonry', 'Fire Resistive', 'Other'
];

/**
 * Validates home quote data
 */
export function validateHomeQuote(data: Partial<HomeQuoteData>): ValidationResult {
  const fields: Record<string, FieldValidation> = {};
  const missingRequiredFields: string[] = [];
  let validFields = 0;
  let totalFields = 0;

  // Helper to add field validation
  const addField = (
    path: string,
    value: unknown,
    isRequired: boolean,
    isValid: boolean,
    error?: string
  ) => {
    totalFields++;
    const fieldValidation: FieldValidation = {
      isValid,
      isRequired,
      value,
      error,
    };
    fields[path] = fieldValidation;

    if (isValid) {
      validFields++;
    }

    if (isRequired && !isValid) {
      missingRequiredFields.push(path);
    }
  };

  // Personal Section Validation
  const personal = data.personal;

  // Required: name
  const nameValue = personal?.name?.trim();
  addField(
    'personal.name',
    nameValue,
    true,
    !!nameValue && nameValue.length > 0,
    !nameValue ? 'Name is required' : undefined
  );

  // Optional: spouseName
  if (personal?.spouseName !== undefined) {
    addField('personal.spouseName', personal.spouseName, false, true);
  }

  // Required: address
  const addressValid = isValidAddress(personal?.address);
  addField(
    'personal.address',
    personal?.address,
    true,
    addressValid,
    !addressValid ? 'Complete address (street, city, state, zip) is required' : undefined
  );

  // Validate individual address fields if address exists
  if (personal?.address) {
    if (personal.address.zip && !isValidZipCode(personal.address.zip)) {
      addField(
        'personal.address.zip',
        personal.address.zip,
        true,
        false,
        'Invalid zip code format'
      );
    }
  }

  // Conditional: priorAddress (required if < 5 years at current)
  const yearsAtCurrent = personal?.yearsAtCurrentAddress;
  const priorAddressRequired = yearsAtCurrent !== undefined && yearsAtCurrent < 5;
  if (priorAddressRequired || personal?.priorAddress) {
    const priorAddressValid = isValidAddress(personal?.priorAddress);
    addField(
      'personal.priorAddress',
      personal?.priorAddress,
      priorAddressRequired,
      priorAddressRequired ? priorAddressValid : true,
      priorAddressRequired && !priorAddressValid
        ? 'Prior address is required when less than 5 years at current address'
        : undefined
    );
  }

  // Optional: phoneNumber (validate format if provided)
  if (personal?.phoneNumber) {
    const phoneValid = isValidE164Phone(personal.phoneNumber);
    addField(
      'personal.phoneNumber',
      personal.phoneNumber,
      false,
      phoneValid,
      !phoneValid ? 'Phone must be in E.164 format (+1XXXXXXXXXX)' : undefined
    );
  }

  // Optional: email (validate format if provided)
  if (personal?.email) {
    const emailValid = isValidEmail(personal.email);
    addField(
      'personal.email',
      personal.email,
      false,
      emailValid,
      !emailValid ? 'Invalid email format' : undefined
    );
  }

  // Optional: effectiveDate (validate format if provided)
  if (personal?.effectiveDate) {
    const dateValid = isValidDateFormat(personal.effectiveDate);
    addField(
      'personal.effectiveDate',
      personal.effectiveDate,
      false,
      dateValid,
      !dateValid ? 'Date must be in MM/DD/YYYY format' : undefined
    );
  }

  // Required: applicantDOB
  const dobValid = personal?.applicantDOB ? isValidDateFormat(personal.applicantDOB) : false;
  addField(
    'personal.applicantDOB',
    personal?.applicantDOB,
    true,
    dobValid,
    !personal?.applicantDOB
      ? 'Applicant date of birth is required'
      : !dobValid
      ? 'Date must be in MM/DD/YYYY format'
      : undefined
  );

  // Optional: spouseDOB (validate format if provided)
  if (personal?.spouseDOB) {
    const spouseDobValid = isValidDateFormat(personal.spouseDOB);
    addField(
      'personal.spouseDOB',
      personal.spouseDOB,
      false,
      spouseDobValid,
      !spouseDobValid ? 'Date must be in MM/DD/YYYY format' : undefined
    );
  }

  // Optional: applicantSSN (validate format if provided)
  if (personal?.applicantSSN) {
    const ssnValid = isValidSSNFormat(personal.applicantSSN);
    addField(
      'personal.applicantSSN',
      personal.applicantSSN,
      false,
      ssnValid,
      !ssnValid ? 'SSN must be in XXX-XX-XXXX format' : undefined
    );
  }

  // Optional: spouseSSN (validate format if provided)
  if (personal?.spouseSSN) {
    const spouseSsnValid = isValidSSNFormat(personal.spouseSSN);
    addField(
      'personal.spouseSSN',
      personal.spouseSSN,
      false,
      spouseSsnValid,
      !spouseSsnValid ? 'SSN must be in XXX-XX-XXXX format' : undefined
    );
  }

  // Home Section Validation
  const home = data.home;

  // Optional: homeStyle (validate enum if provided)
  if (home?.homeStyle) {
    const styleValid = HOME_STYLES.includes(home.homeStyle);
    addField(
      'home.homeStyle',
      home.homeStyle,
      false,
      styleValid,
      !styleValid ? `Home style must be one of: ${HOME_STYLES.join(', ')}` : undefined
    );
  }

  // Required: yearBuilt
  const yearBuiltValid = home?.yearBuilt ? isValidYear(home.yearBuilt) : false;
  addField(
    'home.yearBuilt',
    home?.yearBuilt,
    true,
    yearBuiltValid,
    !home?.yearBuilt
      ? 'Year built is required'
      : !yearBuiltValid
      ? 'Year must be a valid 4-digit year'
      : undefined
  );

  // Required: constructionType
  const constructionTypeValid = home?.constructionType
    ? CONSTRUCTION_TYPES.includes(home.constructionType)
    : false;
  addField(
    'home.constructionType',
    home?.constructionType,
    true,
    constructionTypeValid,
    !home?.constructionType
      ? 'Construction type is required'
      : !constructionTypeValid
      ? `Construction type must be one of: ${CONSTRUCTION_TYPES.join(', ')}`
      : undefined
  );

  // Optional fields - just track them if provided
  const optionalHomeFields = [
    'stories', 'finishedLivingArea', 'foundationType', 'foundationMaterial',
    'kitchen', 'bathroomType', 'bathroomStyle', 'hvacSystems', 'flooring',
    'roofStyleSlope', 'roofCover', 'finishedBasement', 'garage',
    'deckPatioDetails', 'condoOrTownhouse', 'specialFeatures'
  ] as const;

  for (const field of optionalHomeFields) {
    if (home && home[field] !== undefined) {
      addField(`home.${field}`, home[field], false, true);
    }
  }

  const isValid = missingRequiredFields.length === 0 &&
    Object.values(fields).every(f => f.isValid);

  return {
    isValid,
    quoteType: 'home',
    totalFields,
    validFields,
    invalidFields: totalFields - validFields,
    missingRequiredFields,
    fields,
    home: {
      isValid,
      fields,
    },
  };
}

// =============================================================================
// Auto Quote Validation
// =============================================================================

const MARITAL_STATUSES: MaritalStatus[] = [
  'Single', 'Married', 'Divorced', 'Widowed', 'Separated', 'Domestic Partner'
];

/**
 * Validates auto quote data
 */
export function validateAutoQuote(data: Partial<AutoQuoteData>): ValidationResult {
  const fields: Record<string, FieldValidation> = {};
  const missingRequiredFields: string[] = [];
  let validFields = 0;
  let totalFields = 0;

  const addField = (
    path: string,
    value: unknown,
    isRequired: boolean,
    isValid: boolean,
    error?: string
  ) => {
    totalFields++;
    fields[path] = { isValid, isRequired, value, error };
    if (isValid) validFields++;
    if (isRequired && !isValid) missingRequiredFields.push(path);
  };

  // Personal Section
  const personal = data.personal;

  // Required: name
  const nameValue = personal?.name?.trim();
  addField(
    'personal.name',
    nameValue,
    true,
    !!nameValue,
    !nameValue ? 'Name is required' : undefined
  );

  // Optional: spouseName
  if (personal?.spouseName !== undefined) {
    addField('personal.spouseName', personal.spouseName, false, true);
  }

  // Required: currentAddress
  const addressValid = isValidAddress(personal?.currentAddress);
  addField(
    'personal.currentAddress',
    personal?.currentAddress,
    true,
    addressValid,
    !addressValid ? 'Complete current address is required' : undefined
  );

  // Optional: priorAddress
  if (personal?.priorAddress) {
    const priorValid = isValidAddress(personal.priorAddress);
    addField(
      'personal.priorAddress',
      personal.priorAddress,
      false,
      priorValid,
      !priorValid ? 'Prior address must be complete if provided' : undefined
    );
  }

  // Required: phoneNumber
  const phoneValid = personal?.phoneNumber ? isValidE164Phone(personal.phoneNumber) : false;
  addField(
    'personal.phoneNumber',
    personal?.phoneNumber,
    true,
    phoneValid,
    !personal?.phoneNumber
      ? 'Phone number is required'
      : !phoneValid
      ? 'Phone must be in E.164 format (+1XXXXXXXXXX)'
      : undefined
  );

  // Required: email
  const emailValid = personal?.email ? isValidEmail(personal.email) : false;
  addField(
    'personal.email',
    personal?.email,
    true,
    emailValid,
    !personal?.email
      ? 'Email is required'
      : !emailValid
      ? 'Invalid email format'
      : undefined
  );

  // Required: maritalStatus
  const maritalValid = personal?.maritalStatus
    ? MARITAL_STATUSES.includes(personal.maritalStatus)
    : false;
  addField(
    'personal.maritalStatus',
    personal?.maritalStatus,
    true,
    maritalValid,
    !personal?.maritalStatus
      ? 'Marital status is required'
      : !maritalValid
      ? `Marital status must be one of: ${MARITAL_STATUSES.join(', ')}`
      : undefined
  );

  // Required: effectiveDate
  const effectiveDateValid = personal?.effectiveDate
    ? isValidDateFormat(personal.effectiveDate)
    : false;
  addField(
    'personal.effectiveDate',
    personal?.effectiveDate,
    true,
    effectiveDateValid,
    !personal?.effectiveDate
      ? 'Effective date is required'
      : !effectiveDateValid
      ? 'Date must be in MM/DD/YYYY format'
      : undefined
  );

  // Optional date fields
  if (personal?.applicantDOB) {
    const valid = isValidDateFormat(personal.applicantDOB);
    addField('personal.applicantDOB', personal.applicantDOB, false, valid,
      !valid ? 'Date must be in MM/DD/YYYY format' : undefined);
  }
  if (personal?.spouseDOB) {
    const valid = isValidDateFormat(personal.spouseDOB);
    addField('personal.spouseDOB', personal.spouseDOB, false, valid,
      !valid ? 'Date must be in MM/DD/YYYY format' : undefined);
  }

  // Optional string fields
  const optionalPersonalFields = [
    'applicantDL', 'spouseDL', 'applicantOccupation', 'spouseOccupation'
  ] as const;
  for (const field of optionalPersonalFields) {
    if (personal && personal[field] !== undefined) {
      addField(`personal.${field}`, personal[field], false, true);
    }
  }

  // Vehicle Usage Section
  const vehicleUsage = data.vehicleUsage;
  if (vehicleUsage) {
    const usageFields: (keyof typeof vehicleUsage)[] = [
      'garagingAddressSameAsMailing', 'vehicleUse', 'rideShare', 'delivery'
    ];
    for (const field of usageFields) {
      if (vehicleUsage[field] !== undefined) {
        addField(`vehicleUsage.${field}`, vehicleUsage[field], false, true);
      }
    }
  }

  // Additional Drivers
  const additionalDrivers = data.additionalDrivers || [];
  additionalDrivers.forEach((driver: AdditionalDriver, index: number) => {
    const nameValid = !!driver.name?.trim();
    addField(
      `additionalDrivers[${index}].name`,
      driver.name,
      true,
      nameValid,
      !nameValid ? 'Driver name is required' : undefined
    );

    const dobValid = isValidDateFormat(driver.dob);
    addField(
      `additionalDrivers[${index}].dob`,
      driver.dob,
      true,
      dobValid,
      !dobValid ? 'Driver DOB must be in MM/DD/YYYY format' : undefined
    );

    if (driver.licenseNumber !== undefined) {
      addField(`additionalDrivers[${index}].licenseNumber`, driver.licenseNumber, false, true);
    }
    if (driver.relationship !== undefined) {
      addField(`additionalDrivers[${index}].relationship`, driver.relationship, false, true);
    }
  });

  // Automobiles
  const automobiles = data.automobiles || [];
  automobiles.forEach((auto: Automobile, index: number) => {
    const yearValid = isValidYear(auto.year);
    addField(
      `automobiles[${index}].year`,
      auto.year,
      true,
      yearValid,
      !yearValid ? 'Vehicle year must be a valid 4-digit year' : undefined
    );

    const makeValid = !!auto.make?.trim();
    addField(
      `automobiles[${index}].make`,
      auto.make,
      true,
      makeValid,
      !makeValid ? 'Vehicle make is required' : undefined
    );

    const modelValid = !!auto.model?.trim();
    addField(
      `automobiles[${index}].model`,
      auto.model,
      true,
      modelValid,
      !modelValid ? 'Vehicle model is required' : undefined
    );

    if (auto.vin !== undefined) {
      // VIN should be 17 characters if provided
      const vinValid = !auto.vin || auto.vin.length === 17;
      addField(
        `automobiles[${index}].vin`,
        auto.vin,
        false,
        vinValid,
        !vinValid ? 'VIN must be 17 characters' : undefined
      );
    }

    if (auto.ownership !== undefined) {
      addField(`automobiles[${index}].ownership`, auto.ownership, false, true);
    }
  });

  // Coverages - all optional
  const coverages = data.coverages;
  if (coverages) {
    const coverageFields: (keyof typeof coverages)[] = [
      'bodilyInjury', 'propertyDamage', 'uninsuredMotorist',
      'offRoadVehicleLiability', 'medicalPayments', 'towing', 'rental'
    ];
    for (const field of coverageFields) {
      if (coverages[field] !== undefined) {
        addField(`coverages.${field}`, coverages[field], false, true);
      }
    }
  }

  // Deductibles
  const deductibles = data.deductibles || [];
  deductibles.forEach((ded, index) => {
    addField(`deductibles[${index}].vehicleRef`, ded.vehicleRef, true, !!ded.vehicleRef,
      !ded.vehicleRef ? 'Vehicle reference is required' : undefined);
    if (ded.comprehensiveDeductible !== undefined) {
      addField(`deductibles[${index}].comprehensiveDeductible`, ded.comprehensiveDeductible, false, true);
    }
    if (ded.collisionDeductible !== undefined) {
      addField(`deductibles[${index}].collisionDeductible`, ded.collisionDeductible, false, true);
    }
  });

  // Prior Insurance - all optional
  const priorInsurance = data.priorInsurance;
  if (priorInsurance) {
    if (priorInsurance.company !== undefined) {
      addField('priorInsurance.company', priorInsurance.company, false, true);
    }
    if (priorInsurance.premium !== undefined) {
      const premiumValid = typeof priorInsurance.premium === 'number' && priorInsurance.premium >= 0;
      addField('priorInsurance.premium', priorInsurance.premium, false, premiumValid,
        !premiumValid ? 'Premium must be a positive number' : undefined);
    }
    if (priorInsurance.policyNumber !== undefined) {
      addField('priorInsurance.policyNumber', priorInsurance.policyNumber, false, true);
    }
    if (priorInsurance.expirationDate) {
      const valid = isValidDateFormat(priorInsurance.expirationDate);
      addField('priorInsurance.expirationDate', priorInsurance.expirationDate, false, valid,
        !valid ? 'Date must be in MM/DD/YYYY format' : undefined);
    }
  }

  // Accidents or Tickets
  const incidents = data.accidentsOrTickets || [];
  incidents.forEach((incident: AccidentOrTicket, index: number) => {
    const dateValid = isValidDateFormat(incident.date);
    addField(
      `accidentsOrTickets[${index}].date`,
      incident.date,
      true,
      dateValid,
      !dateValid ? 'Incident date must be in MM/DD/YYYY format' : undefined
    );

    const typeValid = incident.type === 'Accident' || incident.type === 'Ticket';
    addField(
      `accidentsOrTickets[${index}].type`,
      incident.type,
      true,
      typeValid,
      !typeValid ? 'Type must be Accident or Ticket' : undefined
    );

    if (incident.description !== undefined) {
      addField(`accidentsOrTickets[${index}].description`, incident.description, false, true);
    }
    if (incident.driver !== undefined) {
      addField(`accidentsOrTickets[${index}].driver`, incident.driver, false, true);
    }
  });

  const isValid = missingRequiredFields.length === 0 &&
    Object.values(fields).every(f => f.isValid);

  return {
    isValid,
    quoteType: 'auto',
    totalFields,
    validFields,
    invalidFields: totalFields - validFields,
    missingRequiredFields,
    fields,
    auto: {
      isValid,
      fields,
    },
  };
}

// =============================================================================
// Combined Quote Validation
// =============================================================================

/**
 * Validates quote data based on quote type
 */
export function validateQuote(
  type: QuoteType,
  homeData?: Partial<HomeQuoteData>,
  autoData?: Partial<AutoQuoteData>
): ValidationResult {
  if (type === 'home') {
    if (!homeData) {
      return {
        isValid: false,
        quoteType: 'home',
        totalFields: 0,
        validFields: 0,
        invalidFields: 0,
        missingRequiredFields: ['homeData'],
        fields: {},
        home: { isValid: false, fields: {} },
      };
    }
    return validateHomeQuote(homeData);
  }

  if (type === 'auto') {
    if (!autoData) {
      return {
        isValid: false,
        quoteType: 'auto',
        totalFields: 0,
        validFields: 0,
        invalidFields: 0,
        missingRequiredFields: ['autoData'],
        fields: {},
        auto: { isValid: false, fields: {} },
      };
    }
    return validateAutoQuote(autoData);
  }

  // type === 'both'
  const homeResult = homeData ? validateHomeQuote(homeData) : {
    isValid: false,
    totalFields: 0,
    validFields: 0,
    invalidFields: 0,
    missingRequiredFields: ['homeData'],
    fields: {},
  };

  const autoResult = autoData ? validateAutoQuote(autoData) : {
    isValid: false,
    totalFields: 0,
    validFields: 0,
    invalidFields: 0,
    missingRequiredFields: ['autoData'],
    fields: {},
  };

  // Combine results
  const combinedFields: Record<string, FieldValidation> = {};

  // Prefix home fields
  for (const [key, value] of Object.entries(homeResult.fields)) {
    combinedFields[`home.${key}`] = value;
  }

  // Prefix auto fields
  for (const [key, value] of Object.entries(autoResult.fields)) {
    combinedFields[`auto.${key}`] = value;
  }

  const combinedMissingRequired = [
    ...homeResult.missingRequiredFields.map(f => `home.${f}`),
    ...autoResult.missingRequiredFields.map(f => `auto.${f}`),
  ];

  return {
    isValid: homeResult.isValid && autoResult.isValid,
    quoteType: 'both',
    totalFields: homeResult.totalFields + autoResult.totalFields,
    validFields: homeResult.validFields + autoResult.validFields,
    invalidFields: homeResult.invalidFields + autoResult.invalidFields,
    missingRequiredFields: combinedMissingRequired,
    fields: combinedFields,
    home: {
      isValid: homeResult.isValid,
      fields: homeResult.fields,
    },
    auto: {
      isValid: autoResult.isValid,
      fields: autoResult.fields,
    },
  };
}
