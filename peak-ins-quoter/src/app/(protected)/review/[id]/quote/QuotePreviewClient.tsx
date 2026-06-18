"use client";

import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { ValidationSummary, RequiredFieldsAlert } from "@/components/quote";
import {
  AUTOMATION_START_PREVIEW_MS,
  CarrierAutomationErrorModal,
  CarrierAutomationStartingModal,
  CarrierAutomationSuccessModal,
  type CarrierAutomationSuccessVariant,
} from "@/components/quote/CarrierAutomationStatusModals";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Loader2,
  Send,
  Car,
  Users,
  AlertTriangle,
  CheckCircle2,
  ArrowLeft,
  User,
  Home,
  FileText,
  Shield,
  Edit2,
  ChevronDown,
  Calculator,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  transformExtractionToValidation,
  updateFieldInValidation,
  detectExtractionType,
  extractVehicles,
  extractDrivers,
  type ExtractedDataType,
} from "@/lib/quote/validation";
import { getHomeExtractionData } from "@/lib/extraction/transform";
import {
  readWorkflowMeta,
  supportsCarrierSchemaExtraction,
  getCarrierSchema,
  transformCarrierToValidation,
  buildCarrierSubmitFields,
  updateFieldBySchemaKey,
  validateCarrierExtraction,
  buildPlaywrightSubmitUrl,
  buildPlaywrightStatusUrl,
  getAutomationCarrierLabel,
  getCarrierFieldsMap,
  getCarrierOption,
  getFieldBySchemaKey,
  type CarrierOptionId,
} from "@/lib/carriers";
import {
  CarrierExtractionForm,
  type CarrierFormData,
} from "@/components/extraction/CarrierExtractionForm";
import { CarrierWorkflowTabs } from "@/components/extraction/CarrierWorkflowTabs";
import type { ExtractionField } from "@/types/extraction";
import {
  createEmptyHomeExtraction,
  type HomeExtractionResult,
  mergeChubbHomeCoverageEstimator,
  mergeChubbWithLegacyHomeownersFields,
  type HomeExtractionChubbHomeCoverageEstimator,
  CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS,
  CHUBB_ATTACHED_STRUCTURE_FIELDS,
  CHUBB_CONSTRUCTION_TYPE_FIELDS,
  type HomeFieldInputType,
  HOME_SIDING_TYPE_OPTIONS,
} from "@/types/home-extraction";
import { ChubbHomeCoverageEstimatorEditor } from "@/components/extraction/ChubbHomeCoverageEstimatorEditor";
import { createClient } from "@/lib/supabase/client";
import type { AutoExtractionResult } from "@/types/auto-extraction";
import type {
  ExtractionResult,
  CombinedExtractionData,
} from "@/types/extraction";
import type { CombinedUiExtractionData } from "@/types/database";
import type {
  QuoteType,
  UIValidationResult,
  UIFieldValidation,
} from "@/types/quote";

// Union type for all possible extraction data formats
type ExtractedData =
  | HomeExtractionResult
  | AutoExtractionResult
  | ExtractionResult
  | CombinedExtractionData
  | CombinedUiExtractionData;

interface QuotePreviewClientProps {
  extractionId: string;
  extractedData: ExtractedData;
  quoteType: QuoteType;
  storagePath: string;
  supabaseUrl: string;
}

const additionalFieldDefinitions: UIFieldValidation[] = [
  {
    key: "mailingAddress",
    label: "Mailing Address",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Personal Information",
    inputType: "text",
  },
  {
    key: "termLength",
    label: "Term length",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Personal Information",
    inputType: "select",
    options: ["Annually", "Semi-Annually", "Quarterly", "Monthly"],
  },
  {
    key: "agentProducerName",
    label: "Agent / Producer Name",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Personal Information",
    inputType: "select",
    options: [
      "ADAMS, HANNAH",
      "ADAMS, LAUREN H",
      "BOSWELL, MELISSA HOWARD",
      "DAVIS, JULIE ANN",
      "DERAMUS, MELANIE A",
      "ELLIS, BEVERLY L",
      "JONES, TIMOTHY L",
      "MAYNOR, SUZANNE P",
      "MITCHELL, PAMELA A",
      "PEAK, JERE D",
      "PEAK, OWEN",
      "SEWELL, RUTH EMILIE",
      "SWIFT, DONNA Q",
      "TWITCHELL, STACI T",
      "UTSEY III, JAMES C",
      "WEST, BLAKE E",
      "WHITAKER, LYN P",
      "WILLIAMS, AMBER N",
    ],
  },
  {
    key: "country",
    label: "Country",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Personal Information",
    inputType: "text",
  },
  {
    key: "entity",
    label: "Entity",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Personal Information",
    inputType: "select",
    options: [
      "Corporation",
      "Estate",
      "Individual",
      "Limited Liability Company",
      "Other",
      "Partnership",
      "Trust",
    ],
  },
  {
    key: "homeownersInsuranceCancelledDeclinedNonrenewedLast3Years",
    label:
      "Has your homeowners insurance been cancelled/declined/nonrenewed in the last 3 years?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "homeVacantOrUnoccupied",
    label: "Is the home vacant or unoccupied?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "occupiedInNext30Days",
    label: "Will it be occupied in the next 30 days?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "businessConductedOnPremises",
    label: "Do you conduct any type of business on the premises?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "businessProvidesProfessionalAdviceOrOpinions",
    label:
      "Does the Business provide professional advice and/or opinions (e.g. financial, legal) or include academic tutor, music lessons, or graphic design?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "businessHasEmployeesOtherThanResidenceRelatives",
    label: "Are there any employees other than residence relatives?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "businessMoreThanFourClientVisitsPerWeek",
    label:
      "Do you have more than four client visits per week at your residence premises?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "homeAvailableForRentIncludingShortTermOrHomeSharing",
    label:
      "Is your entire home or any part of it available for rent, including short-term vacation rental or home sharing/swapping?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "portionOfHomeAvailableForRent",
    label: "What portion of your home is available for rent?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: [
      "Entire home",
      "Part of home / separate unit",
      "Room(s) only",
      "Other",
    ],
  },
  {
    key: "basisHomeAvailableForRent",
    label: "On what basis is your home available for rent?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: [
      "Short-term vacation rental (Airbnb, VRBO, etc.)",
      "Home sharing / home swapping",
      "Long-term rental",
      "Other",
    ],
  },
  {
    key: "homeInDesignatedHighRiskFloodZone",
    label: "Is the home located in a designated high risk flood zone?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "hasFloodPolicy",
    label: "Do you have a flood policy?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "petsOrAnimalsBittenOrInjuredAnyone",
    label:
      "Do you or any household member have any pets or animals that have bitten or injured anyone?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "ownsRestrictedDogBreedsOrMix",
    label:
      "Do you or any household member own one or more of the following breeds or a mix of one of these breeds of dogs?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "insuranceStatus",
    label: "Insurance Status",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["Currently Insured", "No Current Insurance"],
  },
  {
    key: "burglarAlarm",
    label: "Burglar Alarm",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["Local", "Smart", "Central", "None"],
  },
  {
    key: "feetFromHydrant",
    label: "Feet From Hydrant",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "number",
  },
  {
    key: "yearBuilt",
    label: "Year Built",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "number",
  },
  {
    key: "purchaseMonthYear",
    label: "Purchase Month/Year",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "text",
  },
  {
    key: "numberOfFamilies",
    label: "Number of Families",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["1 Family", "2 Family", "3 Family", "4 Family", "5+ Family"],
  },
  {
    key: "primarySourceOfHeat",
    label: "Primary Source of Heat",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: [
      "Central - Oil",
      "Central - Gas",
      "Central - Electric",
      "Other",
      "None",
    ],
  },
  {
    key: "residenceType",
    label: "Residence Type",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["Primary", "Secondary"],
  },
  {
    key: "seasonalDwelling",
    label: "Seasonal Dwelling",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "swimmingPool",
    label: "Swimming Pool",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "swimmingPoolType",
    label: "Swimming Pool Type",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["Above Ground", "Inground"],
  },
  {
    key: "swimmingPoolSafetyFeature",
    label: "Swimming Pool Safety Feature",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: [
      "None",
      "Fence or Locked Gate",
      "Retractable Ladder",
      "Other",
    ],
  },
  {
    key: "woodCoalPelletStove",
    label: "Wood/Coal/Pellet Stove",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "stoveProfessionallyInstalledOrInspected",
    label: "Stove Professionally Installed/Inspected",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "chimneyCleanedAnnually",
    label: "Chimney Cleaned Annually",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "ulListed",
    label: "UL Listed",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "numberOfResidenceEmployees",
    label: "Number of Residence Employees",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: false,
    category: "Homeowners Informations",
    inputType: "number",
  },
  {
    key: "squareFootage",
    label: "Square Footage",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "number",
  },
  {
    key: "buildingConstructionType",
    label: "Building Construction Type",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: [
      "Frame",
      "Masonry",
      "Concrete",
      "Steel",
      "Modular",
      "Mobile or Manufactured",
    ],
  },
  {
    key: "sidingType",
    label: "Siding Type",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: [...HOME_SIDING_TYPE_OPTIONS],
  },
  {
    key: "primaryFoundationType",
    label: "Primary Foundation Type",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: [
      "Basement/Crawlspace",
      "Slab",
      "Piers/Pilings",
    ],
  },
  {
    key: "basementFinished",
    label: "Basement Finished",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "numberOfBathrooms",
    label: "Number of Bathrooms",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "number",
  },
  {
    key: "garageType",
    label: "Garage Type",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["Attached", "Detached", "Built-in", "Basement", "Carport", "Multiple", "None"],
  },
  {
    key: "garageSizeNumberOfCars",
    label: "Garage Size (Number of Cars)",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["1", "2", "3", "4", "5+"],
  },
  {
    key: "numberOfStories",
    label: "Number of Stories",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["1", "2", "3", "4+"],
  },
  {
    key: "roofShape",
    label: "Roof Shape",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["Gable", "Hip", "Gambrel", "Flat", "Shed", "Complex", "Other"],
  },
  {
    key: "roofType",
    label: "Roof Type",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: [
      "Architectural Shingle",
      "Asphalt-Fiberglass",
      "Clay or Concrete Tile",
      "Slate",
      "Metal",
      "Wood",
      "Comp Over Wood",
      "Modified Polymer",
      "Foam Composite",
      "Rolled Material",
      "Rubber/Membrane",
      "Tar & Gravel",
      "T-Lock",
      "Asbestos",
    ],
  },
  {
    key: "yearRoofingReplaced",
    label: "Year Roofing Replaced",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "number",
  },
  {
    key: "numberOfSolarPanelsOnRoof",
    label: "Number of Solar Panels on Roof",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "number",
  },
  {
    key: "currentAutoPolicyBodilyInjuryLimit",
    label: "Current Auto Policy Bodily Injury Limit",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: [
      "Less than or Equal to 25/50 (CSL 75)",
      "Greater than 25/50 (CSL 75)",
      "No Car",
      "Car in Storage",
      "Military",
      "Car Without Insurance",
    ],
  },
  {
    key: "baseCoverageLevel",
    label: "Base Coverage Level",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: [
      "Travelers Protect®",
      "Travelers Protect Plus®",
      "Travelers Protect Premier®",
    ],
  },
  {
    key: "replacementCost",
    label: "Replacement Cost",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "number",
  },
  {
    key: "aDwellingLimit",
    label: "A - Dwelling Limit",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "number",
  },
  {
    key: "ePersonalLiability",
    label: "E - Personal Liability",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["100,000", "300,000", "500,000"],
  },
  {
    key: "fMedicalPayments",
    label: "F - Medical Payments",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: ["1,000", "2,000", "5,000", "10,000"],
  },
  {
    key: "deductible",
    label: "Deductible",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Homeowners Informations",
    inputType: "select",
    options: [
      "1,000",
      "1,500",
      "2,000",
      "2,500",
      "5,000",
      "7,500",
      "10,000",
      "25,000",
      "50,000",
      "1%",
      "2%",
    ],
  },
  {
    key: "locationOccupancy",
    label: "Occupancy",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Detail",
    inputType: "select",
    options: ["Primary", "Secondary", "Seasonal", "Tenant Occupied", "Vacant", "Principal"],
  },
  {
    key: "ownerOccupied",
    label: "Is the location Owner-Occupied",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Detail",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "vacant",
    label: "Is the location Vacant",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Detail",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "liabilityCoverageOnly",
    label: "Liability Coverage only",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Detail",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "personalPropertyOnly",
    label: "Personal Property Only",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Detail",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "program",
    label: "Program",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: ["Special", "Basic"],
  },
  {
    key: "type",
    label: "Type",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: false,
    category: "Location Information",
    inputType: "select",
    options: ["Dwelling"],
  },
  {
    key: "coverageA",
    label: "Coverage A",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "text",
  },
  {
    key: "coverageF",
    label: "Coverage F",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: ["100,000", "200,000", "300,000", "500,000", "1,000,000"],
  },
  {
    key: "personalInjury",
    label: "Personal Injury",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "coverageG",
    label: "Coverage G",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: ["1,000", "5,000"],
  },
  {
    key: "constructionYear",
    label: "Construction Year",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: false,
    category: "Location Information",
    inputType: "number",
  },
  {
    key: "construction",
    label: "Construction",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: [
      "Frame",
      "Masonry",
      "Masonry Veneer",
      "Log",
      "Fire Resistive",
      "Cement Fiber",
    ],
  },
  {
    key: "foundation",
    label: "Foundation",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: ["Open", "Continuous"],
  },
  {
    key: "finishedLivingArea",
    label: "Finished Living Area",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: false,
    category: "Location Information",
    inputType: "number",
  },
  {
    key: "numberOfFamiliesUnits",
    label: "Number Of Families/Units",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "number",
  },
  {
    key: "replacementCost100",
    label: "100% Replacement Cost",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: false,
    category: "Location Information",
    inputType: "text",
  },
  {
    key: "roofLossSettlementWindstormHail",
    label: "Roof Loss Settlement for Windstorm or Hail Losses",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: false,
    category: "Location Information",
    inputType: "select",
    options: ["Actual Cash Value", "Replacement Cost"],
  },
  {
    key: "roofingMaterial",
    label: "Roofing Material",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: [
      "Asphalt - Non-Hail Resistive",
      "Metal - Non-Hail Resistive",
      "Other - Non-Hail Resistive",
      "Wood",
      "Asphalt - Hail Resistive",
      "Concrete",
      "Metal - Hail Resistive",
      "Other - Hail Resistive",
      "Synthetic Polymer",
      "Tile",
    ],
  },
  {
    key: "roofUpdateYear",
    label: "Roof Update Year",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "text",
  },
  {
    key: "marketValue",
    label: "Market Value",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: false,
    category: "Location Information",
    inputType: "text",
  },
  {
    key: "hasMortgageeContractHolderOrSecuredLineOfCredit",
    label:
      "Is there a Mortgagee, Contract Holder or secured line of credit for this Location?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "boardingOrLodgingOrStudentRentals",
    label:
      "Is the property used as a boarding or lodging house or for student rentals?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "isStudentRental",
    label: "Is this a student rental?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "visibleFromOtherDwellings",
    label: "Visible from other dwellings",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "fortifiedHome",
    label: "FORTIFIED Home™?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "woodCoalHeating",
    label: "Wood/Coal Heating",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "woodCoalHeatingLocation",
    label: "Where is this located",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: ["Dwelling", "Outbuilding", "Outside"],
  },
  {
    key: "woodCoalHeatingQuantity",
    label: "Quantity",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "number",
  },
  {
    key: "gatedAccessToDwelling",
    label: "Gated access to dwelling?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "applicantWillingToCompleteDiySurvey",
    label: "Is applicant willing to complete a DIY survey for this location?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "screenedEnclosure",
    label: "Screened Enclosure?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "dwellingConstructedWithAsbestos",
    label: "Is the dwelling constructed with material containing asbestos?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "floodZone",
    label: "Flood Zone",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "coastalStormRiskArea",
    label: "Coastal Storm Risk Area",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "locatedOnIsland",
    label: "Is the property located on an island",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "conditionOfDwelling",
    label: "Condition of dwelling",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: false,
    category: "Location Information",
    inputType: "select",
    options: ["Excellent", "Good", "Average", "Poor"],
  },
  {
    key: "dogsOwnedOrKept",
    label:
      "Any dogs owned by the insured around/ kept at the insured location(s)?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "specificBreed",
    label: "Specific Breed",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: [
      "Akita (Include hybrid/mixes)",
      "American Staffordshire Terrier (Include hybrid/mixes)",
      "Bullmastiff (Include hybrid/mixes)",
      "Chow Chow (Include hybrid/mixes)",
      "Doberman Pinscher (Include hybrid/mixes)",
      "German Shepherd (Include hybrid/mixes)",
      "Pit Bull (Include hybrid/mixes)",
      "Presa Canario (Include hybrid/mixes)",
      "Rottweiler (Include hybrid/mixes)",
      "Wolf Hybrid (Include hybrid/mixes)",
      "Other Breed",
    ],
  },
  {
    key: "biteHistoryAggressiveBehavior",
    label: "Any bite history or history of aggressive behavior?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "isLocationWithinCity",
    label: "Is Location Within A City?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "respondingFireDepartment",
    label: "Responding Fire Department",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "text",
  },
  {
    key: "communityName",
    label: "Community Name",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "text",
  },
  {
    key: "within1000FeetOfHydrant",
    label: "Within 1000 Feet Of Hydrant",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "bridgeAccess",
    label: "Is there bridge access",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "windHailDeductible",
    label: "Wind/Hail Deductible",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: ["1500", "2000", "2500", "5000", "10000"],
  },
  {
    key: "hurricaneDeductible",
    label: "Hurricane Deductible",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: ["5%"],
  },
  {
    key: "pleaseExplain",
    label: "Please explain",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Policy Questions",
    inputType: "text",
  },
  {
    key: "hasAnyCompanyCanceledRefusedOrDeclinedRenewal",
    label:
      "Has any company canceled, refused to write or declined renewal for this applicant",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Policy Questions",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "hasAutoOwnersInsurancePast5Years",
    label:
      "Has the applicant had insurance with any Auto-Owners Group Company within the past 5 years",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Policy Questions",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "options",
    label: "Options",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Policy Questions",
    inputType: "select",
    options: ["Non-Pay", "Previous insurer is leaving the market", "Other"],
  },
  {
    key: "previousPolicyNumber",
    label: "Previous policy number",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Policy Questions",
    inputType: "text",
  },
  {
    key: "hasFiledPersonalBankruptcyOrJudgementsPast5Years",
    label:
      "Has this applicant filed personal bankruptcy, had repossessions, court judgements or substantially past due mortgage, utility or property tax payments within the past 5 years",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Policy Questions",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "bankruptcyPleaseExplain",
    label: "Please Explain",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Policy Questions",
    inputType: "text",
  },
  {
    key: "hasAnyApplicantBeenConvictedOfArson",
    label: "Has any applicant been convicted of arson",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Policy Questions",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "dwellingForSale",
    label: "Is the dwelling for sale",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Specific Questions",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "isNewVentureNoPreviousLandlordOrRentalPropertyExperience",
    label:
      "Is this a new venture (no previous landlord or rental property experience)?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Specific Questions",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "areThereAnyOutbuildingsOnPremises",
    label: "Are there any outbuildings on the premises:",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Specific Questions",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "anyFloodingBrushLandslideOrUnusualHazards",
    label: "Any flooding/brush/landslide or unusual hazards:",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Specific Questions",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "areDogsAllowed",
    label: "Are dogs allowed?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Specific Questions",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "anyAnimalsOtherThanLivestockNotTypicallyHouseholdPets",
    label:
      "Any animals, other than livestock, not typically regarded as household pets kept on premises?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Specific Questions",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "anyUncorrectedFireCodeViolations",
    label: "Any uncorrected fire code violations:",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Specific Questions",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "difficultAccessByFireAndPoliceDepartments",
    label: "Difficult access by fire and police departments:",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Specific Questions",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "dwellingNewPurchase",
    label: "Is the dwelling a new purchase",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Specific Questions",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "purchasePrice",
    label: "Purchase price",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Specific Questions",
    inputType: "text",
  },
  {
    key: "dwellingOccupied",
    label: "Is the dwelling occupied",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Specific Questions",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "locationSpecificPleaseExplain",
    label: "Please explain",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Specific Questions",
    inputType: "text",
  },
  {
    key: "expectedOccupancyDate",
    label: "Expected occupancy date",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Specific Questions",
    inputType: "date",
  },
  {
    key: "dayCareOnPremises",
    label: "Is there day care on the premises",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Specific Questions",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "childrenCaredForCount",
    label: "How many children are cared for (including household members)",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Specific Questions",
    inputType: "number",
  },
  {
    key: "farmingOnPremises",
    label: "Is there farming on the premises",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Specific Questions",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "acresFarmedByOthers",
    label: "How many acres are farmed by someone other than insured",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Specific Questions",
    inputType: "number",
  },
  {
    key: "numberOfAnimalsLarge",
    label: "Number of Animals (Large)",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Specific Questions",
    inputType: "number",
  },
  {
    key: "numberOfAnimalsMedium",
    label: "Number of Animals (Medium)",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Specific Questions",
    inputType: "number",
  },
  {
    key: "numberOfAnimalsSmall",
    label: "Number of Animals (Small)",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Specific Questions",
    inputType: "number",
  },
  {
    key: "otherBusinessOnPremises",
    label: "Is there any other business on the premises",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Specific Questions",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "describeBusiness",
    label: "Describe Business",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Specific Questions",
    inputType: "text",
  },
  {
    key: "buildingUnderRenovationOrReconstruction",
    label: "Is the building undergoing renovation or reconstruction",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Specific Questions",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "householdMembersLivingDuringRenovation",
    label:
      "Are any household members living at the home during renovation/reconstruction",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Specific Questions",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "renovationExplanation",
    label: "Please explain extent of the renovation or reconstruction",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Specific Questions",
    inputType: "text",
  },
  {
    key: "responsesVerifiedWithApplicant",
    label: "Have all responses been verified with the applicant?",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Specific Questions",
    inputType: "select",
    options: ["Yes", "No"],
  },
  {
    key: "county",
    label: "County",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "text",
  },
  {
    key: "locationInformationOccupancy",
    label: "Occupancy",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: ["Primary", "Secondary", "Tenant Occupied", "Vacant", "Principal"],
  },
  {
    key: "territory",
    label: "Territory",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "text",
  },
  {
    key: "ownership",
    label: "Ownership",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: ["Married Property", "Single Owner", "Corporation"],
  },
  {
    key: "allOtherPerilsDeductible",
    label: "All Other Perils Deductible",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "select",
    options: [
      "250",
      "500",
      "750",
      "1,000",
      "1,500",
      "2,500",
      "5,000",
      "10,000",
      "15,000",
      "20,000",
    ],
  },
  {
    key: "distanceToHydrantFeet",
    label: "Distance to Hydrant (feet)",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "number",
  },
  {
    key: "distanceToFireStationMiles",
    label: "Distance to Fire Station (miles)",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "number",
  },
  {
    key: "protectionClass",
    label: "Protection Class",
    value: null,
    status: "missing",
    confidence: "high",
    flagged: false,
    required: true,
    category: "Location Information",
    inputType: "text",
  },
];

const HOMEOWNERS_INFORMATIONS_FIELD_KEYS = new Set(
  additionalFieldDefinitions
    .filter((field) => field.category === "Homeowners Informations")
    .map((field) => field.key),
);

function applyHomeownersFieldToExtractedData(
  extractedData: ExtractedData,
  quoteType: QuoteType,
  fieldKey: string,
  value: string,
): ExtractedData {
  const updatedField = {
    value,
    confidence: "high" as const,
    flagged: false,
  };
  const emptySection = createEmptyHomeExtraction().homeownersInformations;

  const mergeSection = (
    section: HomeExtractionResult["homeownersInformations"] | undefined,
  ): HomeExtractionResult["homeownersInformations"] => ({
    ...emptySection,
    ...section,
    [fieldKey]: updatedField,
  });

  if (
    typeof extractedData === "object" &&
    extractedData &&
    "quoteType" in extractedData &&
    (extractedData as { quoteType?: string }).quoteType === "both"
  ) {
    const combined = extractedData as CombinedUiExtractionData;
    if (quoteType === "auto") {
      return extractedData;
    }
    const home = combined.home ?? createEmptyHomeExtraction();
    return {
      ...combined,
      home: {
        ...home,
        homeownersInformations: mergeSection(home.homeownersInformations),
      },
    };
  }

  const home = extractedData as HomeExtractionResult;
  return {
    ...home,
    homeownersInformations: mergeSection(home.homeownersInformations),
  };
}

function getChubbFromExtractedData(
  extractedData: ExtractedData,
  quoteType: QuoteType,
): HomeExtractionChubbHomeCoverageEstimator {
  if (
    typeof extractedData === "object" &&
    extractedData &&
    "quoteType" in extractedData &&
    (extractedData as { quoteType?: string }).quoteType === "both"
  ) {
    const combined = extractedData as CombinedUiExtractionData;
    if (quoteType === "auto") {
      return mergeChubbHomeCoverageEstimator();
    }
    return mergeChubbWithLegacyHomeownersFields(
      mergeChubbHomeCoverageEstimator(combined.home?.chubbHomeCoverageEstimator),
      combined.home?.homeownersInformations,
    );
  }

  const home = extractedData as HomeExtractionResult;
  return mergeChubbWithLegacyHomeownersFields(
    mergeChubbHomeCoverageEstimator(home.chubbHomeCoverageEstimator),
    home.homeownersInformations,
  );
}

function readChubbFieldValue(field: { value?: unknown } | undefined): string | null {
  const value = field?.value;
  return typeof value === "string" && value.trim() !== "" ? value : null;
}

function toUiFieldInputType(
  inputType: HomeFieldInputType,
): NonNullable<UIFieldValidation["inputType"]> {
  if (inputType === "textarea" || inputType === "checkbox") {
    return "text";
  }
  return inputType;
}

function fieldAlreadyInValidation(
  key: string,
  requiredFields: UIFieldValidation[],
  optionalFields: UIFieldValidation[],
): boolean {
  return (
    requiredFields.some((field) => field.key === key) ||
    optionalFields.some((field) => field.key === key)
  );
}

function upsertFieldInList(
  fields: UIFieldValidation[],
  entry: UIFieldValidation,
): void {
  const index = fields.findIndex((field) => field.key === entry.key);
  if (index >= 0) {
    fields[index] = { ...fields[index], ...entry };
    return;
  }
  fields.push(entry);
}

function buildChubbEstimatorScalarFieldValidations(
  chubb: HomeExtractionChubbHomeCoverageEstimator,
): UIFieldValidation[] {
  const showPercentRenovated = chubb.renovated?.value === "Yes";
  const showPriorCarrierOther = chubb.priorCarrier?.value === "Other";
  const entries: UIFieldValidation[] = [];

  for (const key of Object.keys(
    CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS,
  ) as Array<keyof typeof CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS>) {
    if (key === "percentRenovated" && !showPercentRenovated) continue;
    if (key === "priorCarrierOther" && !showPriorCarrierOther) continue;

    const config = CHUBB_HOME_COVERAGE_ESTIMATOR_SCALAR_FIELDS[key];
    const fieldData = chubb[key];
    const value = readChubbFieldValue(fieldData);

    entries.push({
      key: String(key),
      label: config.label,
      value,
      status: value ? "valid" : "missing",
      confidence: fieldData?.confidence ?? "high",
      flagged: fieldData?.flagged ?? false,
      required: false,
      category: "Chubb Home Coverage Estimator",
      inputType: toUiFieldInputType(config.inputType),
      options: config.options,
    });
  }

  return entries;
}

function mergeSubmitFieldsWithChubbScalars(
  fields: UIFieldValidation[],
  extractedData: ExtractedData,
  quoteType: QuoteType,
): UIFieldValidation[] {
  if (quoteType === "auto") return fields;

  const merged = [...fields];
  const chubb = getChubbFromExtractedData(extractedData, quoteType);
  for (const entry of buildChubbEstimatorScalarFieldValidations(chubb)) {
    upsertFieldInList(merged, entry);
  }
  return merged;
}

function appendChubbHomeCoverageEstimatorFields(
  requiredFields: UIFieldValidation[],
  optionalFields: UIFieldValidation[],
  extractedData: ExtractedData,
  quoteType: QuoteType,
): void {
  if (quoteType === "auto") return;

  const chubb = getChubbFromExtractedData(extractedData, quoteType);
  for (const entry of buildChubbEstimatorScalarFieldValidations(chubb)) {
    upsertFieldInList(optionalFields, entry);
  }

  chubb.attachedStructures.forEach((entry, index) => {
    for (const fieldKey of Object.keys(
      CHUBB_ATTACHED_STRUCTURE_FIELDS,
    ) as Array<keyof typeof CHUBB_ATTACHED_STRUCTURE_FIELDS>) {
      const payloadKey = `attachedStructures[${index}].${fieldKey}`;
      if (fieldAlreadyInValidation(payloadKey, requiredFields, optionalFields)) continue;

      const config = CHUBB_ATTACHED_STRUCTURE_FIELDS[fieldKey];
      const fieldData = entry[fieldKey];
      const value = readChubbFieldValue(fieldData);
      if (!value) continue;

      optionalFields.push({
        key: payloadKey,
        label: config.label,
        value,
        status: "valid",
        confidence: fieldData?.confidence ?? "high",
        flagged: fieldData?.flagged ?? false,
        required: false,
        category: "Chubb Home Coverage Estimator",
        inputType: toUiFieldInputType(config.inputType),
        options: config.options,
      });
    }
  });

  chubb.constructionTypes.forEach((entry, index) => {
    for (const fieldKey of Object.keys(
      CHUBB_CONSTRUCTION_TYPE_FIELDS,
    ) as Array<keyof typeof CHUBB_CONSTRUCTION_TYPE_FIELDS>) {
      const payloadKey = `constructionTypes[${index}].${fieldKey}`;
      if (fieldAlreadyInValidation(payloadKey, requiredFields, optionalFields)) continue;

      const config = CHUBB_CONSTRUCTION_TYPE_FIELDS[fieldKey];
      const fieldData = entry[fieldKey];
      const value = readChubbFieldValue(fieldData);
      if (!value) continue;

      optionalFields.push({
        key: payloadKey,
        label: config.label,
        value,
        status: "valid",
        confidence: fieldData?.confidence ?? "high",
        flagged: fieldData?.flagged ?? false,
        required: false,
        category: "Chubb Home Coverage Estimator",
        inputType: toUiFieldInputType(config.inputType),
        options: config.options,
      });
    }
  });
}

function applyChubbToExtractedData(
  extractedData: ExtractedData,
  quoteType: QuoteType,
  chubbHomeCoverageEstimator: HomeExtractionChubbHomeCoverageEstimator,
): ExtractedData {
  if (
    typeof extractedData === "object" &&
    extractedData &&
    "quoteType" in extractedData &&
    (extractedData as { quoteType?: string }).quoteType === "both"
  ) {
    const combined = extractedData as CombinedUiExtractionData;
    if (quoteType === "auto") {
      return extractedData;
    }
    const home = combined.home ?? createEmptyHomeExtraction();
    return {
      ...combined,
      home: {
        ...home,
        chubbHomeCoverageEstimator,
      },
    };
  }

  const home = extractedData as HomeExtractionResult;
  return {
    ...home,
    chubbHomeCoverageEstimator,
  };
}

function readAdditionalFieldValue(
  extractedData: ExtractedData,
  quoteType: QuoteType,
  fieldKey: string,
): string | null {
  const locationSpecificKeyMap: Record<string, string> = {
    locationSpecificPleaseExplain: "pleaseExplain",
  };

  const readFieldValue = (container: unknown): string | null => {
    if (!container || typeof container !== "object") return null;
    const field = (container as Record<string, unknown>)[fieldKey];
    if (!field || typeof field !== "object") return null;
    const value = (field as { value?: unknown }).value;
    return typeof value === "string" && value.trim() !== "" ? value : null;
  };

  const readFieldValueWithKey = (
    container: unknown,
    key: string,
  ): string | null => {
    if (!container || typeof container !== "object") return null;
    const field = (container as Record<string, unknown>)[key];
    if (!field || typeof field !== "object") return null;
    const value = (field as { value?: unknown }).value;
    return typeof value === "string" && value.trim() !== "" ? value : null;
  };

  // Direct personal section (home/auto extraction objects)
  if (
    typeof extractedData === "object" &&
    extractedData &&
    "personal" in extractedData
  ) {
    const value = readFieldValue(
      (extractedData as { personal?: unknown }).personal,
    );
    if (value) return value;
  }

  // Direct locationDetail section (home extraction objects)
  if (
    typeof extractedData === "object" &&
    extractedData &&
    "locationDetail" in extractedData
  ) {
    const value = readFieldValue(
      (extractedData as { locationDetail?: unknown }).locationDetail,
    );
    if (value) return value;
  }

  // Direct locationInformation section (home extraction objects)
  if (
    typeof extractedData === "object" &&
    extractedData &&
    "locationInformation" in extractedData
  ) {
    const value = readFieldValue(
      (extractedData as { locationInformation?: unknown }).locationInformation,
    );
    if (value) return value;
  }

  // Direct policyQuestions section (home extraction objects)
  if (
    typeof extractedData === "object" &&
    extractedData &&
    "policyQuestions" in extractedData
  ) {
    const value = readFieldValue(
      (extractedData as { policyQuestions?: unknown }).policyQuestions,
    );
    if (value) return value;
  }

  // Direct homeownersInformations section (home extraction objects)
  if (
    typeof extractedData === "object" &&
    extractedData &&
    "homeownersInformations" in extractedData
  ) {
    const value = readFieldValue(
      (extractedData as { homeownersInformations?: unknown }).homeownersInformations,
    );
    if (value) return value;
  }

  // Direct property section (home extraction objects)
  if (
    typeof extractedData === "object" &&
    extractedData &&
    "property" in extractedData
  ) {
    const value = readFieldValue(
      (extractedData as { property?: unknown }).property,
    );
    if (value) return value;
  }

  // Direct chubbHomeCoverageEstimator section (home extraction objects)
  if (
    typeof extractedData === "object" &&
    extractedData &&
    "chubbHomeCoverageEstimator" in extractedData
  ) {
    const value = readFieldValue(
      (extractedData as { chubbHomeCoverageEstimator?: unknown })
        .chubbHomeCoverageEstimator,
    );
    if (value) return value;
  }

  // Direct locationSpecificQuestions section (home extraction objects)
  if (
    typeof extractedData === "object" &&
    extractedData &&
    "locationSpecificQuestions" in extractedData
  ) {
    const container = (extractedData as { locationSpecificQuestions?: unknown })
      .locationSpecificQuestions;
    const key = locationSpecificKeyMap[fieldKey] || fieldKey;
    const value = readFieldValueWithKey(container, key);
    if (value) return value;
  }

  // Combined UI extraction: read from selected quote type section first
  if (
    typeof extractedData === "object" &&
    extractedData &&
    "quoteType" in extractedData
  ) {
    const typedData = extractedData as {
      home?: {
        personal?: unknown;
        property?: unknown;
        locationDetail?: unknown;
        locationInformation?: unknown;
        policyQuestions?: unknown;
        locationSpecificQuestions?: unknown;
        homeownersInformations?: unknown;
        chubbHomeCoverageEstimator?: unknown;
      };
      auto?: {
        personal?: unknown;
        locationDetail?: unknown;
        locationInformation?: unknown;
        policyQuestions?: unknown;
        locationSpecificQuestions?: unknown;
      };
    };
    if (quoteType !== "auto") {
      const homeValue = readFieldValue(typedData.home?.personal);
      if (homeValue) return homeValue;
      const homeLocationValue = readFieldValue(typedData.home?.locationDetail);
      if (homeLocationValue) return homeLocationValue;
      const homeLocationInfoValue = readFieldValue(
        typedData.home?.locationInformation,
      );
      if (homeLocationInfoValue) return homeLocationInfoValue;
      const homePolicyQuestionsValue = readFieldValue(
        typedData.home?.policyQuestions,
      );
      if (homePolicyQuestionsValue) return homePolicyQuestionsValue;
      const homeLocationSpecificValue = readFieldValue(
        typedData.home?.locationSpecificQuestions,
      );
      if (homeLocationSpecificValue) return homeLocationSpecificValue;
      const homeHomeownersInformationsValue = readFieldValue(
        typedData.home?.homeownersInformations,
      );
      if (homeHomeownersInformationsValue) return homeHomeownersInformationsValue;
      const homePropertyValue = readFieldValue(typedData.home?.property);
      if (homePropertyValue) return homePropertyValue;
      const homeChubbValue = readFieldValue(
        typedData.home?.chubbHomeCoverageEstimator,
      );
      if (homeChubbValue) return homeChubbValue;
    }
    if (quoteType !== "home") {
      const autoValue = readFieldValue(typedData.auto?.personal);
      if (autoValue) return autoValue;
      const autoLocationValue = readFieldValue(typedData.auto?.locationDetail);
      if (autoLocationValue) return autoLocationValue;
      const autoLocationInfoValue = readFieldValue(
        typedData.auto?.locationInformation,
      );
      if (autoLocationInfoValue) return autoLocationInfoValue;
      const autoPolicyQuestionsValue = readFieldValue(
        typedData.auto?.policyQuestions,
      );
      if (autoPolicyQuestionsValue) return autoPolicyQuestionsValue;
      const autoLocationSpecificValue = readFieldValue(
        typedData.auto?.locationSpecificQuestions,
      );
      if (autoLocationSpecificValue) return autoLocationSpecificValue;
    }
  }

  return null;
}

function withAdditionalFields(
  result: UIValidationResult,
  extractedData: ExtractedData,
  quoteType: QuoteType,
): UIValidationResult {
  const requiredFields = [...result.requiredFields];
  const optionalFields = [...result.optionalFields];

  const policyCanceled = readAdditionalFieldValue(
    extractedData,
    quoteType,
    "hasAnyCompanyCanceledRefusedOrDeclinedRenewal",
  );
  const policyAutoOwners = readAdditionalFieldValue(
    extractedData,
    quoteType,
    "hasAutoOwnersInsurancePast5Years",
  );
  const needsOptions = policyCanceled === "Yes";
  const needsPreviousPolicyNumber = policyAutoOwners === "Yes";
  const bankruptcy = readAdditionalFieldValue(
    extractedData,
    quoteType,
    "hasFiledPersonalBankruptcyOrJudgementsPast5Years",
  );
  const needsBankruptcyExplain = bankruptcy === "Yes";

  const dwellingNewPurchase = readAdditionalFieldValue(
    extractedData,
    quoteType,
    "dwellingNewPurchase",
  );
  const dwellingOccupied = readAdditionalFieldValue(
    extractedData,
    quoteType,
    "dwellingOccupied",
  );
  const dayCareOnPremises = readAdditionalFieldValue(
    extractedData,
    quoteType,
    "dayCareOnPremises",
  );
  const farmingOnPremises = readAdditionalFieldValue(
    extractedData,
    quoteType,
    "farmingOnPremises",
  );
  const otherBusinessOnPremises = readAdditionalFieldValue(
    extractedData,
    quoteType,
    "otherBusinessOnPremises",
  );
  const renovation = readAdditionalFieldValue(
    extractedData,
    quoteType,
    "buildingUnderRenovationOrReconstruction",
  );

  const woodCoalHeating = readAdditionalFieldValue(
    extractedData,
    quoteType,
    "woodCoalHeating",
  );
  const needsWoodCoalHeatingLocation = woodCoalHeating === "Yes";
  const woodCoalHeatingLocation = readAdditionalFieldValue(
    extractedData,
    quoteType,
    "woodCoalHeatingLocation",
  );
  const needsWoodCoalHeatingQuantity =
    needsWoodCoalHeatingLocation && woodCoalHeatingLocation === "Dwelling";

  const needsPurchasePrice = dwellingNewPurchase === "Yes";
  const allowLocationSpecificSubs = dwellingOccupied === "No";
  const needsDayCareChildren = dayCareOnPremises === "Yes";
  const needsFarmingDetails = farmingOnPremises === "Yes";
  const needsBusinessDescribe = otherBusinessOnPremises === "Yes";
  const needsRenovationDetails = renovation === "Yes";

  const homeVacantOrUnoccupied = readAdditionalFieldValue(
    extractedData,
    quoteType,
    "homeVacantOrUnoccupied",
  );
  const businessConductedOnPremises = readAdditionalFieldValue(
    extractedData,
    quoteType,
    "businessConductedOnPremises",
  );
  const homeAvailableForRent = readAdditionalFieldValue(
    extractedData,
    quoteType,
    "homeAvailableForRentIncludingShortTermOrHomeSharing",
  );
  const homeInHighRiskFloodZone = readAdditionalFieldValue(
    extractedData,
    quoteType,
    "homeInDesignatedHighRiskFloodZone",
  );
  const needsOccupiedInNext30Days = homeVacantOrUnoccupied === "Yes";
  const needsBusinessOnPremisesSubs = businessConductedOnPremises === "Yes";
  const needsHomeRentSubs = homeAvailableForRent === "Yes";
  const needsFloodPolicy = homeInHighRiskFloodZone === "Yes";

  const swimmingPool = readAdditionalFieldValue(
    extractedData,
    quoteType,
    "swimmingPool",
  );
  const swimmingPoolType = readAdditionalFieldValue(
    extractedData,
    quoteType,
    "swimmingPoolType",
  );
  const woodCoalPelletStove = readAdditionalFieldValue(
    extractedData,
    quoteType,
    "woodCoalPelletStove",
  );
  const needsSwimmingPoolType = swimmingPool === "Yes";
  const needsSwimmingPoolSafetyFeature =
    needsSwimmingPoolType &&
    (swimmingPoolType === "Above Ground" || swimmingPoolType === "Inground");
  const needsWoodCoalPelletStoveSubs = woodCoalPelletStove === "Yes";

  const primaryFoundationType = readAdditionalFieldValue(
    extractedData,
    quoteType,
    "primaryFoundationType",
  );
  const garageType = readAdditionalFieldValue(
    extractedData,
    quoteType,
    "garageType",
  );
  const needsBasementFinished = primaryFoundationType === "Basement";
  const needsGarageSizeNumberOfCars =
    garageType !== null && garageType !== "" && garageType !== "None";

  additionalFieldDefinitions.forEach((field) => {
    if (
      !needsOptions &&
      field.category === "Policy Questions" &&
      field.key === "options"
    ) {
      return;
    }
    if (
      !needsPreviousPolicyNumber &&
      field.category === "Policy Questions" &&
      field.key === "previousPolicyNumber"
    ) {
      return;
    }
    if (
      !needsBankruptcyExplain &&
      field.category === "Policy Questions" &&
      field.key === "bankruptcyPleaseExplain"
    ) {
      return;
    }

    if (
      !needsWoodCoalHeatingLocation &&
      field.category === "Location Information" &&
      field.key === "woodCoalHeatingLocation"
    ) {
      return;
    }
    if (
      !needsWoodCoalHeatingQuantity &&
      field.category === "Location Information" &&
      field.key === "woodCoalHeatingQuantity"
    ) {
      return;
    }

    // Location Specific Questions: only include conditional fields when needed
    if (
      field.category === "Location Specific Questions" &&
      field.key === "purchasePrice" &&
      !needsPurchasePrice
    ) {
      return;
    }
    if (
      field.category === "Location Specific Questions" &&
      field.key === "childrenCaredForCount" &&
      (!allowLocationSpecificSubs || !needsDayCareChildren)
    ) {
      return;
    }
    if (
      field.category === "Location Specific Questions" &&
      (field.key === "acresFarmedByOthers" ||
        field.key === "numberOfAnimalsLarge" ||
        field.key === "numberOfAnimalsMedium" ||
        field.key === "numberOfAnimalsSmall") &&
      (!allowLocationSpecificSubs || !needsFarmingDetails)
    ) {
      return;
    }
    if (
      field.category === "Location Specific Questions" &&
      field.key === "describeBusiness" &&
      (!allowLocationSpecificSubs || !needsBusinessDescribe)
    ) {
      return;
    }
    if (
      field.category === "Location Specific Questions" &&
      (field.key === "householdMembersLivingDuringRenovation" ||
        field.key === "renovationExplanation") &&
      (!allowLocationSpecificSubs || !needsRenovationDetails)
    ) {
      return;
    }

    if (
      field.category === "Homeowners Informations" &&
      field.key === "occupiedInNext30Days" &&
      !needsOccupiedInNext30Days
    ) {
      return;
    }
    if (
      field.category === "Homeowners Informations" &&
      (field.key === "businessProvidesProfessionalAdviceOrOpinions" ||
        field.key === "businessHasEmployeesOtherThanResidenceRelatives" ||
        field.key === "businessMoreThanFourClientVisitsPerWeek") &&
      !needsBusinessOnPremisesSubs
    ) {
      return;
    }
    if (
      field.category === "Homeowners Informations" &&
      (field.key === "portionOfHomeAvailableForRent" ||
        field.key === "basisHomeAvailableForRent") &&
      !needsHomeRentSubs
    ) {
      return;
    }
    if (
      field.category === "Homeowners Informations" &&
      field.key === "hasFloodPolicy" &&
      !needsFloodPolicy
    ) {
      return;
    }
    if (
      field.category === "Homeowners Informations" &&
      field.key === "swimmingPoolType" &&
      !needsSwimmingPoolType
    ) {
      return;
    }
    if (
      field.category === "Homeowners Informations" &&
      field.key === "swimmingPoolSafetyFeature" &&
      !needsSwimmingPoolSafetyFeature
    ) {
      return;
    }
    if (
      field.category === "Homeowners Informations" &&
      (field.key === "stoveProfessionallyInstalledOrInspected" ||
        field.key === "chimneyCleanedAnnually" ||
        field.key === "ulListed") &&
      !needsWoodCoalPelletStoveSubs
    ) {
      return;
    }
    if (
      field.category === "Homeowners Informations" &&
      field.key === "basementFinished" &&
      !needsBasementFinished
    ) {
      return;
    }
    if (
      field.category === "Homeowners Informations" &&
      field.key === "garageSizeNumberOfCars" &&
      !needsGarageSizeNumberOfCars
    ) {
      return;
    }

    const alreadyExists =
      requiredFields.some((existing) => existing.key === field.key) ||
      optionalFields.some((existing) => existing.key === field.key);

    if (!alreadyExists) {
      let value = readAdditionalFieldValue(extractedData, quoteType, field.key);

      const locationSpecificDefaults: Record<string, string> = {
        dwellingForSale: "No",
        dwellingNewPurchase: "No",
        dwellingOccupied: "Yes",
        dayCareOnPremises: "No",
        farmingOnPremises: "No",
        otherBusinessOnPremises: "No",
        buildingUnderRenovationOrReconstruction: "No",
        responsesVerifiedWithApplicant: "No",
      };
      if (!value && field.category === "Location Specific Questions") {
        value = locationSpecificDefaults[field.key] || value;
      }

      if (!value && field.key === "liabilityCoverageOnly") {
        value = "No";
      }
      if (!value && field.key === "vacant") {
        value = "No";
      }
      if (field.key === "program") {
        value = "Basic";
      }

      const locationInformationDefaults: Record<string, string> = {
        hasMortgageeContractHolderOrSecuredLineOfCredit: "No",
        isStudentRental: "No",
        visibleFromOtherDwellings: "No",
        fortifiedHome: "No",
        woodCoalHeating: "No",
        gatedAccessToDwelling: "No",
        applicantWillingToCompleteDiySurvey: "No",
        screenedEnclosure: "No",
        dwellingConstructedWithAsbestos: "No",
        floodZone: "No",
        coastalStormRiskArea: "No",
        locatedOnIsland: "No",
      };
      if (!value && field.category === "Location Information") {
        value = locationInformationDefaults[field.key] || value;
      }

      const mappedField: UIFieldValidation = {
        ...field,
        value,
        status: value ? "valid" : "missing",
      };

      if (field.required) {
        requiredFields.push(mappedField);
      } else {
        optionalFields.push(mappedField);
      }
    }
  });

  appendChubbHomeCoverageEstimatorFields(
    requiredFields,
    optionalFields,
    extractedData,
    quoteType,
  );

  const completedRequired = requiredFields.filter(
    (field) =>
      field.status !== "missing" && field.value && field.value.trim() !== "",
  ).length;
  const totalRequired = requiredFields.length;
  const hasInvalidRequired = requiredFields.some(
    (field) => field.status === "invalid",
  );
  const isValid = !hasInvalidRequired && completedRequired === totalRequired;
  const completionPercentage =
    totalRequired === 0
      ? 100
      : Math.round((completedRequired / totalRequired) * 100);

  return {
    ...result,
    requiredFields,
    optionalFields,
    totalRequired,
    completedRequired,
    completionPercentage,
    isValid,
  };
}

// Category configuration for section display
// Keys must match the category values in field definitions (validation.ts)
const categoryConfig: Record<
  string,
  { icon: React.ElementType; label: string; order: number }
> = {
  // Home categories
  "Personal Information": {
    icon: User,
    label: "Personal Information",
    order: 1,
  },
  "Property Information": {
    icon: Home,
    label: "Property Information",
    order: 2,
  },
  "Household Information": {
    icon: Users,
    label: "Household Information",
    order: 3,
  },
  "Location Detail": { icon: Home, label: "Location Detail", order: 4 },
  "Location Information": {
    icon: Home,
    label: "Location Information",
    order: 5,
  },
  "Policy Questions": { icon: FileText, label: "Policy Questions", order: 6 },
  "Homeowners Informations": {
    icon: FileText,
    label: "Homeowners Informations",
    order: 6.5,
  },
  "Location Specific Questions": {
    icon: Home,
    label: "Location Specific Questions",
    order: 7,
  },
  "Occupancy & Use": { icon: Home, label: "Occupancy & Use", order: 8 },
  "Safety & Risk": { icon: Shield, label: "Safety & Risk", order: 5 },
  Coverage: { icon: Shield, label: "Coverage Details", order: 6 },
  "Insurance Details": { icon: FileText, label: "Insurance Details", order: 7 },
  "Home Updates": { icon: FileText, label: "Home Updates", order: 8 },
  "Claims History": { icon: FileText, label: "Claims History", order: 9 },
  "Occupancy Information": { icon: Home, label: "Occupancy & Use", order: 3 },
  "Safety Information": { icon: Shield, label: "Safety & Risk", order: 4 },
  "Coverage Information": { icon: Shield, label: "Coverage Details", order: 5 },
  "Insurance Information": {
    icon: FileText,
    label: "Insurance Details",
    order: 6,
  },
  "Updates Information": { icon: FileText, label: "Home Updates", order: 7 },
  "Claims Information": { icon: FileText, label: "Claims History", order: 8 },
  "Scheduled Items": { icon: FileText, label: "Scheduled Items", order: 9 },
  // Auto categories
  "Vehicle Information": { icon: Car, label: "Vehicle Information", order: 10 },
  "Driver Information": { icon: Users, label: "Driver Information", order: 11 },
  "Deductible Information": { icon: Shield, label: "Deductibles", order: 12 },
  "Lienholder Information": {
    icon: FileText,
    label: "Lienholder Details",
    order: 13,
  },
  "Prior Insurance": { icon: FileText, label: "Prior Insurance", order: 14 },
  "Accidents/Tickets": {
    icon: FileText,
    label: "Accidents & Tickets",
    order: 15,
  },
  // Legacy/fallback categories (lowercase for backward compatibility)
  personal: { icon: User, label: "Personal Information", order: 1 },
  address: { icon: Home, label: "Address Details", order: 2 },
  property: { icon: Home, label: "Property Information", order: 3 },
  coverage: { icon: Shield, label: "Coverage Details", order: 5 },
  vehicle: { icon: Car, label: "Vehicle Information", order: 10 },
  driver: { icon: Users, label: "Driver Information", order: 11 },
  other: { icon: FileText, label: "Additional Information", order: 99 },
};

const PLAYWRIGHT_POLL_INTERVAL_MS = 3000;
const PLAYWRIGHT_POLL_MAX_ATTEMPTS = 600;

type PlaywrightJobOutcome = {
  status: "completed" | "failed";
  errorMessage?: string;
};

async function pollPlaywrightJobUntilSettled(
  jobId: string,
  carrierOptionId: CarrierOptionId,
  checkStatus: (
    currentJobId: string,
    carrierId: CarrierOptionId,
  ) => Promise<Record<string, unknown>>,
): Promise<PlaywrightJobOutcome> {
  for (let attempt = 0; attempt < PLAYWRIGHT_POLL_MAX_ATTEMPTS; attempt++) {
    try {
      const jobStatus = await checkStatus(jobId, carrierOptionId);
      const status = String(jobStatus?.status ?? "").toLowerCase();
      const errorMessage =
        jobStatus?.error ||
        jobStatus?.failureReason ||
        jobStatus?.failure_reason ||
        "Automation failed.";

      if (status === "failed") {
        return { status: "failed", errorMessage: String(errorMessage) };
      }
      if (status === "completed") {
        return { status: "completed" };
      }
    } catch (error) {
      return {
        status: "failed",
        errorMessage:
          error instanceof Error
            ? error.message
            : "Unable to check automation status. Please try again.",
      };
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, PLAYWRIGHT_POLL_INTERVAL_MS);
    });
  }

  return {
    status: "failed",
    errorMessage: "Automation timed out waiting for completion.",
  };
}

// Group fields by category
function groupFieldsByCategory(
  fields: UIFieldValidation[],
): Map<string, UIFieldValidation[]> {
  const grouped = new Map<string, UIFieldValidation[]>();

  fields.forEach((field) => {
    const category = field.category || "other";
    if (!grouped.has(category)) {
      grouped.set(category, []);
    }
    grouped.get(category)!.push(field);
  });

  return grouped;
}

// Field display component
interface FieldDisplayProps {
  field: UIFieldValidation;
  onEdit: (fieldKey: string) => void;
}

function FieldDisplay({ field, onEdit }: FieldDisplayProps) {
  const hasValue = field.value !== null && field.value !== "";

  return (
    <div
      className={cn(
        "group flex items-start justify-between p-3 rounded-lg border transition-colors",
        field.flagged &&
          "border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20",
        field.status === "missing" &&
          field.required &&
          "border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/20",
        !field.flagged &&
          field.status !== "missing" &&
          "border-border hover:bg-muted/50",
      )}
    >
      <div className="flex-1 min-w-0 space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {field.label}
          </span>
          {field.required && <span className="text-xs text-red-500">*</span>}
          {field.flagged && (
            <Badge
              variant="outline"
              className="text-xs border-amber-200 bg-amber-100 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-400"
            >
              Review
            </Badge>
          )}
          {field.confidence && field.confidence !== "high" && hasValue && (
            <Badge
              variant="outline"
              className={cn(
                "text-xs",
                field.confidence === "medium" &&
                  "border-yellow-200 bg-yellow-50 text-yellow-700 dark:border-yellow-800 dark:bg-yellow-950 dark:text-yellow-400",
                field.confidence === "low" &&
                  "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-400",
              )}
            >
              {field.confidence} confidence
            </Badge>
          )}
        </div>
        {hasValue ? (
          <p className="text-sm text-foreground">{field.value}</p>
        ) : (
          <p className="text-sm text-muted-foreground italic">Not provided</p>
        )}
        {field.errorMessage && (
          <p className="text-xs text-red-600 dark:text-red-400">
            {field.errorMessage}
          </p>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2"
        onClick={() => onEdit(field.key)}
        aria-label={`Edit ${field.label}`}
      >
        <Edit2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

// Section component for grouped fields
interface FieldSectionProps {
  category: string;
  fields: UIFieldValidation[];
  onEdit: (fieldKey: string) => void;
  defaultExpanded?: boolean;
}

function FieldSection({
  category,
  fields,
  onEdit,
  defaultExpanded = true,
}: FieldSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const config = categoryConfig[category] || categoryConfig.other;
  const Icon = config.icon;

  const validCount = fields.filter((f) => f.status === "valid").length;
  const totalCount = fields.length;

  return (
    <Card className="overflow-hidden">
      <CardHeader
        className="py-4 px-5 cursor-pointer select-none hover:bg-muted/30 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="h-4.5 w-4.5 text-primary" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">
                {config.label}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {validCount} of {totalCount} fields complete
              </p>
            </div>
          </div>
          <ChevronDown
            className={cn(
              "h-5 w-5 text-muted-foreground transition-transform duration-200",
              isExpanded && "rotate-180",
            )}
          />
        </div>
      </CardHeader>
      {isExpanded && (
        <CardContent className="px-5 pb-5 pt-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {fields.map((field) => (
              <FieldDisplay key={field.key} field={field} onEdit={onEdit} />
            ))}
          </div>
        </CardContent>
      )}
    </Card>
  );
}

// Editable field component for dialog
interface EditableFieldProps {
  field: UIFieldValidation;
  value: string;
  onChange: (value: string) => void;
}

function EditableField({ field, value, onChange }: EditableFieldProps) {
  const EMPTY_SELECT_VALUE = "__EMPTY__";
  if (field.options && field.options.length > 0) {
    return (
      <Select
        value={value !== '' ? value : EMPTY_SELECT_VALUE}
        onValueChange={(next) => onChange(next === EMPTY_SELECT_VALUE ? "" : next)}
      >
        <SelectTrigger>
          <SelectValue placeholder="Select an option" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={EMPTY_SELECT_VALUE}>Select an option</SelectItem>
          {field.options
            .filter((option) => option !== '' && option !== EMPTY_SELECT_VALUE)
            .map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  return (
    <Input
      type={field.inputType || "text"}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={`Enter ${field.label.toLowerCase()}`}
      autoFocus
    />
  );
}

/**
 * Quote Preview Client - Streamlined quote preview and submission
 *
 * This component receives the quote type from the URL params (selected on review page)
 * and immediately displays the final preview for submission.
 * No redundant quote type selection step.
 */
export function QuotePreviewClient({
  extractionId,
  extractedData,
  quoteType,
}: QuotePreviewClientProps) {
  const router = useRouter();
  const [storedExtractedData, setStoredExtractedData] =
    useState<ExtractedData>(extractedData);
  const homeownersSaveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );
  const [validationResult, setValidationResult] =
    useState<UIValidationResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingField, setEditingField] = useState<UIFieldValidation | null>(
    null,
  );
  const [editValue, setEditValue] = useState("");
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [automationErrorMessage, setAutomationErrorMessage] = useState<
    string | null
  >(null);
  const [automationErrorCarrierId, setAutomationErrorCarrierId] =
    useState<CarrierOptionId | null>(null);
  const [automationStartingCarrierId, setAutomationStartingCarrierId] =
    useState<CarrierOptionId | null>(null);
  const [automationStartingStep, setAutomationStartingStep] = useState({
    current: 1,
    total: 1,
  });
  const automationErrorDismissRef = useRef<(() => void) | null>(null);
  const [carrierSuccessState, setCarrierSuccessState] = useState<{
    carrierOptionId: CarrierOptionId;
    variant: CarrierAutomationSuccessVariant;
    email?: string | null;
  } | null>(null);
  const carrierSuccessDismissRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setStoredExtractedData(extractedData);
  }, [extractedData]);

  const workflowMeta = useMemo(
    () => readWorkflowMeta(storedExtractedData),
    [storedExtractedData],
  );
  const carrierOptionIds = useMemo((): CarrierOptionId[] => {
    if (workflowMeta?.carrierOptionIds?.length) {
      return workflowMeta.carrierOptionIds;
    }
    return workflowMeta ? [workflowMeta.carrierOptionId] : [];
  }, [workflowMeta]);
  const [activeCarrierOptionId, setActiveCarrierOptionId] =
    useState<CarrierOptionId>(
      () => workflowMeta?.carrierOptionId ?? "chubb-home",
    );
  const activeWorkflowMeta = useMemo(() => {
    if (!workflowMeta) return null;
    return {
      ...workflowMeta,
      carrierOptionId: activeCarrierOptionId,
    };
  }, [workflowMeta, activeCarrierOptionId]);
  const useCarrierForm =
    activeWorkflowMeta != null &&
    supportsCarrierSchemaExtraction(activeCarrierOptionId);
  const carrierSchema = useMemo(
    () =>
      useCarrierForm ? getCarrierSchema(activeCarrierOptionId) : null,
    [useCarrierForm, activeCarrierOptionId],
  );

  const schemaCarrierOptionIds = useMemo(
    () => carrierOptionIds.filter((id) => supportsCarrierSchemaExtraction(id)),
    [carrierOptionIds],
  );

  const automationCarrierLabel = useMemo(() => {
    if (automationErrorCarrierId) {
      return getCarrierOption(automationErrorCarrierId).label;
    }
    return getAutomationCarrierLabel(activeWorkflowMeta);
  }, [automationErrorCarrierId, activeWorkflowMeta]);

  const showCarrierStartingPreview = useCallback(
    async (
      carrierOptionId: CarrierOptionId,
      currentStep: number,
      totalSteps: number,
    ) => {
      setAutomationStartingStep({ current: currentStep, total: totalSteps });
      setAutomationStartingCarrierId(carrierOptionId);
      await new Promise((resolve) =>
        setTimeout(resolve, AUTOMATION_START_PREVIEW_MS),
      );
      setAutomationStartingCarrierId(null);
    },
    [],
  );

  const dismissAutomationError = useCallback(() => {
    setAutomationErrorMessage(null);
    setAutomationErrorCarrierId(null);
    automationErrorDismissRef.current?.();
    automationErrorDismissRef.current = null;
  }, []);

  const awaitAutomationErrorDismiss = useCallback(
    (message: string, carrierOptionId: CarrierOptionId) => {
      setAutomationErrorMessage(message);
      setAutomationErrorCarrierId(carrierOptionId);
      return new Promise<void>((resolve) => {
        automationErrorDismissRef.current = resolve;
      });
    },
    [],
  );

  const dismissCarrierSuccess = useCallback(() => {
    setCarrierSuccessState(null);
    carrierSuccessDismissRef.current?.();
    carrierSuccessDismissRef.current = null;
  }, []);

  const awaitCarrierSuccessDismiss = useCallback(
    (
      carrierOptionId: CarrierOptionId,
      variant: CarrierAutomationSuccessVariant,
      email?: string | null,
    ) => {
      setCarrierSuccessState({ carrierOptionId, variant, email });
      return new Promise<void>((resolve) => {
        carrierSuccessDismissRef.current = resolve;
      });
    },
    [],
  );

  const showCarrierAutomationSuccess = useCallback(
    async (
      carrierOptionId: CarrierOptionId,
      carrierData: CarrierFormData,
    ) => {
      if (carrierOptionId === "travelers-home") {
        const email =
          getFieldBySchemaKey(carrierData, "personal.email", carrierOptionId)
            .value?.trim() || null;
        await awaitCarrierSuccessDismiss(carrierOptionId, "email", email);
        return;
      }

      if (carrierOptionId === "auto-owners-home") {
        await awaitCarrierSuccessDismiss(carrierOptionId, "pdf");
      }
      if (carrierOptionId === "national-general-auto") {
        await awaitCarrierSuccessDismiss(carrierOptionId, "pdf");
      }
      if (carrierOptionId === "safeco-home") {
        await awaitCarrierSuccessDismiss(carrierOptionId, "pdf");
      }
    },
    [awaitCarrierSuccessDismiss],
  );

  const homeCarrierData = useMemo((): CarrierFormData | null => {
    if (!useCarrierForm) return null;
    const home = getHomeExtractionData(storedExtractedData);
    if (!home) return null;
    const carrierData = storedExtractedData as CarrierFormData;
    return {
      ...home,
      carrierFields: getCarrierFieldsMap(carrierData, activeCarrierOptionId),
      carrierFieldsByOption: carrierData.carrierFieldsByOption,
    };
  }, [storedExtractedData, useCarrierForm, activeCarrierOptionId]);

  const applyCarrierHomeToExtractedData = useCallback(
    (home: CarrierFormData): ExtractedData => {
      const workflow = readWorkflowMeta(storedExtractedData);
      const withMeta: CarrierFormData = {
        ...home,
        ...(workflow ? { workflow } : {}),
        ...(home.carrierFields ? { carrierFields: home.carrierFields } : {}),
        ...(home.carrierFieldsByOption
          ? { carrierFieldsByOption: home.carrierFieldsByOption }
          : {}),
      };

      if (
        quoteType === "both" &&
        typeof storedExtractedData === "object" &&
        storedExtractedData &&
        "quoteType" in storedExtractedData &&
        (storedExtractedData as { quoteType?: string }).quoteType === "both"
      ) {
        return {
          ...(storedExtractedData as CombinedUiExtractionData),
          home: withMeta,
        };
      }

      return withMeta;
    },
    [storedExtractedData, quoteType],
  );

  const persistExtractedData = useCallback(
    async (data: ExtractedData) => {
      const supabase = createClient();
      const { error } = await supabase
        .from("extractions")
        .update({
          extracted_data: data as never,
          updated_at: new Date().toISOString(),
        })
        .eq("id", extractionId);

      if (error) {
        throw error;
      }
    },
    [extractionId],
  );

  const scheduleHomeownersPersist = useCallback(
    (data: ExtractedData) => {
      if (homeownersSaveTimeoutRef.current) {
        clearTimeout(homeownersSaveTimeoutRef.current);
      }
      homeownersSaveTimeoutRef.current = setTimeout(() => {
        void persistExtractedData(data).catch((error) => {
          console.error(
            "[QuotePreview] Failed to persist Homeowners Informations:",
            error,
          );
        });
      }, 1500);
    },
    [persistExtractedData],
  );

  useEffect(() => {
    return () => {
      if (homeownersSaveTimeoutRef.current) {
        clearTimeout(homeownersSaveTimeoutRef.current);
      }
    };
  }, []);

  // Detect the extraction data type
  const extractedDataType: ExtractedDataType = useMemo(
    () => detectExtractionType(storedExtractedData),
    [storedExtractedData],
  );

  // Extract vehicles and drivers for Auto quotes
  const vehicles = useMemo(() => {
    if (extractedDataType === "auto" || extractedDataType === "combined") {
      return extractVehicles(storedExtractedData as AutoExtractionResult);
    }
    return [];
  }, [storedExtractedData, extractedDataType]);

  const drivers = useMemo(() => {
    if (extractedDataType === "auto" || extractedDataType === "combined") {
      return extractDrivers(storedExtractedData as AutoExtractionResult);
    }
    return [];
  }, [storedExtractedData, extractedDataType]);

  const chubbHomeCoverageEstimator = useMemo(
    () => getChubbFromExtractedData(storedExtractedData, quoteType),
    [storedExtractedData, quoteType],
  );

  const handleChubbChange = useCallback(
    (nextChubb: HomeExtractionChubbHomeCoverageEstimator) => {
      const nextExtractedData = applyChubbToExtractedData(
        storedExtractedData,
        quoteType,
        nextChubb,
      );
      setStoredExtractedData(nextExtractedData);
      scheduleHomeownersPersist(nextExtractedData);
    },
    [storedExtractedData, quoteType, scheduleHomeownersPersist],
  );

  const handleCarrierSave = useCallback(
    async (data: CarrierFormData) => {
      const payload = applyCarrierHomeToExtractedData(data);
      await persistExtractedData(payload);
      setStoredExtractedData(payload);
    },
    [applyCarrierHomeToExtractedData, persistExtractedData],
  );

  const handleCarrierFormDataChange = useCallback(
    (data: CarrierFormData) => {
      setStoredExtractedData(applyCarrierHomeToExtractedData(data));
    },
    [applyCarrierHomeToExtractedData],
  );

  // Transform extraction data immediately on mount since we have the quote type
  useEffect(() => {
    if (
      useCarrierForm &&
      activeWorkflowMeta &&
      (quoteType === "home" || quoteType === "both" || quoteType === "auto")
    ) {
      const home = getHomeExtractionData(storedExtractedData);
      if (home) {
        setValidationResult(
          transformCarrierToValidation(home, activeCarrierOptionId),
        );
      }
      return;
    }

    const result = transformExtractionToValidation(
      storedExtractedData,
      quoteType,
    );
    setValidationResult(
      withAdditionalFields(result, storedExtractedData, quoteType),
    );
  }, [storedExtractedData, quoteType, useCarrierForm, activeWorkflowMeta, activeCarrierOptionId]);

  // Handle field value changes
  const handleFieldChange = useCallback(
    (fieldKey: string, value: string) => {
      if (!validationResult) return;

      if (
        useCarrierForm &&
        activeWorkflowMeta &&
        (quoteType === "home" || quoteType === "both" || quoteType === "auto")
      ) {
        const home = getHomeExtractionData(storedExtractedData);
        if (!home) return;

        const updated = updateFieldBySchemaKey(
          {
            ...home,
            carrierFields: getCarrierFieldsMap(
              storedExtractedData as CarrierFormData,
              activeCarrierOptionId,
            ),
            carrierFieldsByOption: (storedExtractedData as CarrierFormData)
              .carrierFieldsByOption,
          },
          fieldKey,
          value,
          activeCarrierOptionId,
        );
        const nextExtractedData = applyCarrierHomeToExtractedData(updated);
        setStoredExtractedData(nextExtractedData);
        scheduleHomeownersPersist(nextExtractedData);
        setValidationResult(
          transformCarrierToValidation(updated, activeCarrierOptionId),
        );
        return;
      }

      const updatedResult = updateFieldInValidation(
        validationResult,
        fieldKey,
        value,
      );
      setValidationResult(updatedResult);

      if (HOMEOWNERS_INFORMATIONS_FIELD_KEYS.has(fieldKey)) {
        const nextExtractedData = applyHomeownersFieldToExtractedData(
          storedExtractedData,
          quoteType,
          fieldKey,
          value,
        );
        setStoredExtractedData(nextExtractedData);
        scheduleHomeownersPersist(nextExtractedData);
      }
    },
    [
      validationResult,
      storedExtractedData,
      quoteType,
      useCarrierForm,
      activeWorkflowMeta,
      activeCarrierOptionId,
      applyCarrierHomeToExtractedData,
      scheduleHomeownersPersist,
    ],
  );

  // Open edit dialog for a specific field
  const handleEditField = useCallback(
    (fieldKey: string) => {
      if (!validationResult) return;

      if (fieldKey === "liabilityCoverageOnly") return;
      if (fieldKey === "vacant") return;
      if (fieldKey === "program") return;
      if (fieldKey === "applicantWillingToCompleteDiySurvey") return;

      const field =
        validationResult.requiredFields.find((f) => f.key === fieldKey) ||
        validationResult.optionalFields.find((f) => f.key === fieldKey) ||
        validationResult.flaggedFields.find((f) => f.key === fieldKey);

      if (field) {
        setEditingField(field);
        setEditValue(field.value || "");
        setIsEditDialogOpen(true);
      }
    },
    [validationResult],
  );

  // Save edit from dialog
  const handleDialogSave = useCallback(() => {
    if (editingField) {
      handleFieldChange(editingField.key, editValue);
      setIsEditDialogOpen(false);
      setEditingField(null);
      setEditValue("");
      toast.success("Field updated successfully");
    }
  }, [editingField, editValue, handleFieldChange]);

  // ! For Skyvern
  // const checkSkyvernStatus = useCallback(async (currentRunId: string) => {
  //   const statusApiBaseUrl = process.env.NEXT_PUBLIC_NODE_BACKEND_URL;

  //   if (!statusApiBaseUrl) {
  //     throw new Error("NEXT_PUBLIC_NODE_BACKEND_URL is not configured.");
  //   }

  //   const res = await fetch(
  //     `${statusApiBaseUrl}/api/skyvern/run-status/${currentRunId}?wait=false`,
  //   );

  //   if (!res.ok) {
  //     throw new Error("Failed to fetch Skyvern status.");
  //   }

  //   const responseJson = await res.json();
  //   return responseJson?.data ?? responseJson;
  // }, []);

  // useEffect(() => {
  //   if (!runId) return;

  //   let isCancelled = false;
  //   let pollInterval: ReturnType<typeof setInterval> | null = null;

  //   const poll = async () => {
  //     try {
  //       const runStatus = await checkSkyvernStatus(runId);
  //       if (isCancelled) return;
  //       const status = String(runStatus?.status ?? "").toLowerCase();
  //       const failureReason =
  //         runStatus?.failureReason ||
  //         runStatus?.failure_reason ||
  //         "Quote submission failed.";

  //       if (
  //         ["failed", "terminated", "cancelled", "canceled", "error"].includes(
  //           status,
  //         )
  //       ) {
  //         toast.error(failureReason);
  //         if (pollInterval) clearInterval(pollInterval);
  //         setRunId(null);
  //         return;
  //       }

  //       if (["completed", "succeeded", "success"].includes(status)) {
  //         toast.success("Quote submitted successfully!");
  //         if (pollInterval) clearInterval(pollInterval);
  //         setRunId(null);
  //       }
  //     } catch (error) {
  //       if (isCancelled) return;
  //       console.error("Skyvern polling error:", error);
  //       toast.error("Unable to check quote status. Please try again.");
  //       if (pollInterval) clearInterval(pollInterval);
  //     }
  //   };

  //   // Trigger one immediate check, then continue polling.
  //   void poll();
  //   pollInterval = setInterval(() => {
  //     void poll();
  //   }, 3000);

  //   return () => {
  //     isCancelled = true;
  //     if (pollInterval) clearInterval(pollInterval);
  //   };
  // }, [checkSkyvernStatus, runId]);
  // ! For Playwright
  const checkPlaywrightStatus = useCallback(
    async (currentJobId: string, carrierOptionId: CarrierOptionId) => {
    const statusApiBaseUrl = process.env.NEXT_PUBLIC_NODE_BACKEND_URL;

    if (!statusApiBaseUrl) {
      throw new Error("NEXT_PUBLIC_NODE_BACKEND_URL is not configured.");
    }

    const workflowForCarrier =
      workflowMeta != null
        ? { ...workflowMeta, carrierOptionId }
        : null;

    const res = await fetch(
      buildPlaywrightStatusUrl(
        statusApiBaseUrl,
        currentJobId,
        workflowForCarrier,
      ),
    );

    const responseJson = await res.json().catch(() => null);

    if (!res.ok) {
      const apiMessage =
        responseJson?.message ||
        responseJson?.error ||
        responseJson?.data?.error ||
        responseJson?.data?.message;
      throw new Error(
        apiMessage || `Failed to fetch automation status (${res.status}).`,
      );
    }

    return responseJson?.data ?? responseJson;
  },
    [workflowMeta],
  );
  const handleSubmit = async () => {
    const isCarrierSchemaSubmit =
      workflowMeta != null &&
      schemaCarrierOptionIds.length > 0 &&
      (quoteType === "home" || quoteType === "both" || quoteType === "auto");

    if (isCarrierSchemaSubmit) {
      const home = getHomeExtractionData(storedExtractedData);
      if (!home) return;
      for (const carrierId of schemaCarrierOptionIds) {
        const carrierValidation = validateCarrierExtraction(home, carrierId);
        if (!carrierValidation.valid) {
          setActiveCarrierOptionId(carrierId);
          const message =
            carrierValidation.messages?.[0] ??
            `${getCarrierOption(carrierId).label}: please complete required fields: ${carrierValidation.missingFields
              .map((f) => f.label)
              .join(", ")}`;
          toast.error(message);
          return;
        }
      }
    } else if (!validationResult?.isValid) {
      return;
    }

    if (
      !useCarrierForm &&
      validationResult &&
      (quoteType === "home" || quoteType === "both")
    ) {
      const findValue = (key: string) =>
        validationResult.requiredFields.find((f) => f.key === key)?.value ||
        validationResult.optionalFields.find((f) => f.key === key)?.value ||
        validationResult.flaggedFields.find((f) => f.key === key)?.value ||
        null;

      const ownerOccupied = findValue("ownerOccupied");
      const vacant = findValue("vacant");
      const liabilityCoverageOnly = findValue("liabilityCoverageOnly");
      if (
        ownerOccupied === "Yes" &&
        vacant === "Yes" &&
        liabilityCoverageOnly === "Yes"
      ) {
        toast.error(
          "No quote is available if you select Yes for all three: Owner-Occupied, Vacant, and Liability Coverage only.",
        );
        return;
      }
    }

    setIsSubmitting(true);
    try {
      const backendBaseUrl = process.env.NEXT_PUBLIC_NODE_BACKEND_URL;
      if (!backendBaseUrl) {
        throw new Error("NEXT_PUBLIC_NODE_BACKEND_URL is not configured.");
      }

      if (isCarrierSchemaSubmit) {
        const home = getHomeExtractionData(storedExtractedData);
        if (!home) {
          throw new Error("Missing home extraction data for carrier submit.");
        }
        const carrierData = storedExtractedData as CarrierFormData;
        let successCount = 0;
        let failCount = 0;

        for (let carrierIndex = 0; carrierIndex < schemaCarrierOptionIds.length; carrierIndex++) {
          const carrierId = schemaCarrierOptionIds[carrierIndex];
          const carrierLabel = getCarrierOption(carrierId).label;
          setActiveCarrierOptionId(carrierId);

          await showCarrierStartingPreview(
            carrierId,
            carrierIndex + 1,
            schemaCarrierOptionIds.length,
          );

          const submitFields = buildCarrierSubmitFields(
            {
              ...home,
              carrierFields: getCarrierFieldsMap(carrierData, carrierId),
              carrierFieldsByOption: carrierData.carrierFieldsByOption,
            },
            carrierId,
          );
          const workflowForCarrier = {
            ...workflowMeta!,
            carrierOptionId: carrierId,
          };

          let jobId: string;
          try {
            const response = await fetch(
              buildPlaywrightSubmitUrl(backendBaseUrl, workflowForCarrier),
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  extractionId,
                  quoteType,
                  extractedDataType,
                  fields: submitFields,
                  ...(quoteType !== "home" && { vehicles, drivers }),
                  options: {
                    headless: false,
                    keepBrowserOpenOnSuccessMs: 300000,
                  },
                }),
              },
            );

            if (!response.ok) {
              const errorJson = await response.json().catch(() => null);
              const apiMessage =
                errorJson?.message ||
                errorJson?.error ||
                errorJson?.data?.error ||
                errorJson?.data?.message;
              throw new Error(
                apiMessage ||
                  `Failed to submit quote for ${carrierLabel} (${response.status}).`,
              );
            }

            const result = await response.json();
            const generatedJobId = result?.data?.jobId || null;
            if (!generatedJobId) {
              throw new Error(`Missing jobId for ${carrierLabel}`);
            }
            jobId = generatedJobId;
          } catch (submitError) {
            failCount++;
            const message =
              submitError instanceof Error
                ? submitError.message
                : `Failed to submit quote for ${carrierLabel}`;
            await awaitAutomationErrorDismiss(message, carrierId);
            continue;
          }

          const outcome = await pollPlaywrightJobUntilSettled(
            jobId,
            carrierId,
            checkPlaywrightStatus,
          );

          if (outcome.status === "completed") {
            successCount++;
            const carrierFormData = {
              ...home,
              carrierFields: getCarrierFieldsMap(carrierData, carrierId),
              carrierFieldsByOption: carrierData.carrierFieldsByOption,
            };
            if (
              carrierId === "travelers-home" ||
              carrierId === "auto-owners-home" ||
              carrierId === "national-general-auto" ||
              carrierId === "safeco-home"
            ) {
              await showCarrierAutomationSuccess(carrierId, carrierFormData);
            } else {
              toast.success(`${carrierLabel} completed successfully.`);
            }
          } else {
            failCount++;
            await awaitAutomationErrorDismiss(
              outcome.errorMessage ?? "Automation failed.",
              carrierId,
            );
          }
        }

        const totalCarriers = schemaCarrierOptionIds.length;
        if (successCount === totalCarriers) {
          toast.success(
            totalCarriers > 1
              ? "All carrier automations completed successfully!"
              : "Automation completed successfully!",
          );
        } else if (successCount > 0) {
          toast.warning(
            `${successCount} of ${totalCarriers} carrier automations completed.`,
          );
        } else if (failCount > 0) {
          toast.error("All carrier automations failed.");
        }
      } else {
        const submitFields = mergeSubmitFieldsWithChubbScalars(
          [
            ...(validationResult?.requiredFields ?? []),
            ...(validationResult?.optionalFields ?? []),
          ],
          storedExtractedData,
          quoteType,
        );

        await showCarrierStartingPreview(activeCarrierOptionId, 1, 1);

        const response = await fetch(
          buildPlaywrightSubmitUrl(backendBaseUrl, activeWorkflowMeta),
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              extractionId,
              quoteType,
              extractedDataType,
              fields: submitFields,
              ...(quoteType !== "home" && { vehicles, drivers }),
              options: {
                headless: false,
                keepBrowserOpenOnSuccessMs: 300000,
              },
            }),
          },
        );

        if (!response.ok) {
          const errorJson = await response.json().catch(() => null);
          const apiMessage =
            errorJson?.message ||
            errorJson?.error ||
            errorJson?.data?.error ||
            errorJson?.data?.message;
          throw new Error(
            apiMessage || `Failed to submit quote (${response.status}).`,
          );
        }

        const result = await response.json();
        const generatedJobId = result?.data?.jobId || null;
        if (!generatedJobId) {
          throw new Error("Missing jobId in generate-quote response.");
        }

        const outcome = await pollPlaywrightJobUntilSettled(
          generatedJobId,
          activeCarrierOptionId,
          checkPlaywrightStatus,
        );

        if (outcome.status === "completed") {
          const carrierData = storedExtractedData as CarrierFormData;
          const carrierFormData = {
            ...(getHomeExtractionData(storedExtractedData) ?? createEmptyHomeExtraction()),
            carrierFields: getCarrierFieldsMap(
              carrierData,
              activeCarrierOptionId,
            ),
            carrierFieldsByOption: carrierData.carrierFieldsByOption,
          };
          if (
            activeCarrierOptionId === "travelers-home" ||
            activeCarrierOptionId === "auto-owners-home" ||
            activeCarrierOptionId === "national-general-auto" ||
            activeCarrierOptionId === "safeco-home"
          ) {
            await showCarrierAutomationSuccess(
              activeCarrierOptionId,
              carrierFormData,
            );
          } else {
            toast.success("Automation completed successfully!");
          }
        } else {
          await awaitAutomationErrorDismiss(
            outcome.errorMessage ?? "Automation failed.",
            activeCarrierOptionId,
          );
        }
      }

      // router.push(`/quotes/${result.quoteId}`)
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Failed to submit quote. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Combine all fields for display
  const allFields = useMemo(() => {
    if (!validationResult) return [];
    return [
      ...validationResult.requiredFields,
      ...validationResult.optionalFields,
    ];
  }, [validationResult]);

  // Group fields by category
  const groupedFields = useMemo(() => {
    const grouped = groupFieldsByCategory(allFields);
    // Sort categories by order
    const sortedEntries = Array.from(grouped.entries()).sort((a, b) => {
      const orderA = categoryConfig[a[0]]?.order || 99;
      const orderB = categoryConfig[b[0]]?.order || 99;
      return orderA - orderB;
    });
    return new Map(sortedEntries);
  }, [allFields]);

  // Get missing required fields for the alert
  const missingRequiredFields = useMemo(() => {
    if (!validationResult) return [];
    return validationResult.requiredFields.filter(
      (field) => !field.value || field.value.trim() === "",
    );
  }, [validationResult]);

  // Loading state while validation is being computed
  if (!validationResult) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Preparing quote preview...
          </p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary
      title="Error Loading Quote Preview"
      description="There was a problem loading the quote preview. Please try refreshing the page or go back to edit."
      onError={(error) => {
        if (process.env.NODE_ENV === "development") {
          console.error("QuotePreviewClient error:", error);
        }
      }}
    >
      <div className="min-h-screen pb-24">
        {/* Main content - centered with max width */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Page Header */}
          <div className="space-y-2">
            <h1 className="text-2xl font-bold tracking-tight">Quote Summary</h1>
            <p className="text-muted-foreground">
              {useCarrierForm && carrierSchema ? (
                <>
                  Review <span className="font-semibold text-foreground">{carrierSchema.label}</span>{" "}
                  fields before submitting your quote request.
                </>
              ) : (
                <>
                  Review all extracted data before submitting your{" "}
                  {quoteType === "both"
                    ? "Home + Auto"
                    : quoteType === "home"
                      ? "Home"
                      : "Auto"}{" "}
                  quote request.
                </>
              )}
            </p>
          </div>

          {/* Validation Summary Card */}
          <ValidationSummary
            validationResult={validationResult}
            quoteType={quoteType}
          />

          {/* Required Fields Alert - shown when there are missing required fields */}
          {missingRequiredFields.length > 0 && (
            <RequiredFieldsAlert
              missingFields={missingRequiredFields}
              extractionId={extractionId}
              onFieldClick={handleEditField}
            />
          )}

          {(quoteType === "home" || quoteType === "both" || quoteType === "auto") &&
            useCarrierForm &&
            activeWorkflowMeta &&
            homeCarrierData && (
              <div className="space-y-4">
                <CarrierWorkflowTabs
                  carrierOptionIds={carrierOptionIds}
                  activeCarrierOptionId={activeCarrierOptionId}
                  onChange={setActiveCarrierOptionId}
                />
                <CarrierExtractionForm
                  key={activeCarrierOptionId}
                  extractionId={extractionId}
                  carrierOptionId={activeCarrierOptionId}
                  initialData={homeCarrierData}
                  onSave={handleCarrierSave}
                  onDataChange={handleCarrierFormDataChange}
                />
              </div>
            )}

          {(quoteType === "home" || quoteType === "both") && !useCarrierForm && (
            <Card className="overflow-hidden">
              <CardHeader className="py-4 px-5 bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-purple-100 dark:bg-purple-950/40 flex items-center justify-center">
                    <Calculator className="h-4.5 w-4.5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold">
                      Chubb Home Coverage Estimator
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-4">
                <ChubbHomeCoverageEstimatorEditor
                  data={chubbHomeCoverageEstimator}
                  onChange={handleChubbChange}
                />
              </CardContent>
            </Card>
          )}

          {/* Vehicles Summary (for Auto quotes) */}
          {(quoteType === "auto" || quoteType === "both") &&
            vehicles.length > 0 && (
              <Card className="overflow-hidden">
                <CardHeader className="py-4 px-5 bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center">
                      <Car className="h-4.5 w-4.5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">
                        Vehicles ({vehicles.length})
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {vehicles.map((vehicle) => (
                      <div
                        key={vehicle.index}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">
                            {vehicle.displayName}
                          </span>
                          {vehicle.vin && (
                            <span className="text-xs text-muted-foreground">
                              VIN: ...{vehicle.vin.slice(-6)}
                            </span>
                          )}
                        </div>
                        {vehicle.isComplete ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 gap-1"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Complete
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400 gap-1"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Incomplete
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Drivers Summary (for Auto quotes) */}
          {(quoteType === "auto" || quoteType === "both") &&
            drivers.length > 0 && (
              <Card className="overflow-hidden">
                <CardHeader className="py-4 px-5 bg-muted/30">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-violet-100 dark:bg-violet-950/40 flex items-center justify-center">
                      <Users className="h-4.5 w-4.5 text-violet-600 dark:text-violet-400" />
                    </div>
                    <div>
                      <CardTitle className="text-base font-semibold">
                        Additional Drivers ({drivers.length})
                      </CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="px-5 pb-5 pt-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {drivers.map((driver) => (
                      <div
                        key={driver.index}
                        className="flex items-center justify-between p-3 rounded-lg border bg-card"
                      >
                        <div className="flex flex-col gap-0.5">
                          <span className="text-sm font-medium">
                            {driver.displayName}
                          </span>
                          {driver.dateOfBirth && (
                            <span className="text-xs text-muted-foreground">
                              DOB: {driver.dateOfBirth}
                            </span>
                          )}
                        </div>
                        {driver.isComplete ? (
                          <Badge
                            variant="outline"
                            className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 gap-1"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            Complete
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-400 gap-1"
                          >
                            <AlertTriangle className="h-3 w-3" />
                            Incomplete
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

          {/* Field Sections by Category (legacy broad home/auto — hidden for carrier schema) */}
          {!useCarrierForm && (
            <div className="space-y-4">
              {Array.from(groupedFields.entries()).map(
                ([category, fields], index) => (
                  <FieldSection
                    key={category}
                    category={category}
                    fields={fields}
                    onEdit={handleEditField}
                    defaultExpanded={index < 3}
                  />
                ),
              )}
            </div>
          )}

          {/* Flagged Fields Alert (if any) */}
          {validationResult.flaggedFields.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
              <CardHeader className="py-4 px-5">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-amber-100 dark:bg-amber-950/40 flex items-center justify-center">
                    <AlertTriangle className="h-4.5 w-4.5 text-amber-600 dark:text-amber-400" />
                  </div>
                  <div>
                    <CardTitle className="text-base font-semibold text-amber-800 dark:text-amber-200">
                      {validationResult.flaggedFields.length} Field
                      {validationResult.flaggedFields.length !== 1
                        ? "s"
                        : ""}{" "}
                      Flagged for Review
                    </CardTitle>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mt-0.5">
                      These fields may need verification due to low confidence
                      or ambiguous data.
                    </p>
                  </div>
                </div>
              </CardHeader>
            </Card>
          )}
        </div>

        {/* Sticky Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 border-t shadow-lg z-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center justify-between gap-4">
              {/* Status indicator */}
              <div className="hidden sm:flex items-center gap-2">
                {validationResult?.isValid ? (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-950/40">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <span className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      Ready to submit
                    </span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-950/40">
                    <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                    <span className="text-sm font-medium text-amber-700 dark:text-amber-300">
                      {validationResult.totalRequired -
                        validationResult.completedRequired}{" "}
                      required field
                      {validationResult.totalRequired -
                        validationResult.completedRequired !==
                      1
                        ? "s"
                        : ""}{" "}
                      missing
                    </span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center gap-3 ml-auto">
                <Link href={`/review/${extractionId}`}>
                  <Button variant="outline" className="gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    <span>Back to Edit</span>
                  </Button>
                </Link>
                <Button
                  size="lg"
                  className="gap-2 min-w-[140px]"
                  onClick={handleSubmit}
                  disabled={!validationResult?.isValid || isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <Send className="h-4 w-4" />
                      <span>Submit Quote</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>

        <CarrierAutomationStartingModal
          carrierOptionId={automationStartingCarrierId}
          currentStep={automationStartingStep.current}
          totalSteps={automationStartingStep.total}
        />

        <CarrierAutomationErrorModal
          open={automationErrorMessage != null}
          carrierLabel={automationCarrierLabel}
          message={automationErrorMessage}
          onDismiss={dismissAutomationError}
        />

        <CarrierAutomationSuccessModal
          open={carrierSuccessState != null}
          carrierLabel={
            carrierSuccessState
              ? getCarrierOption(carrierSuccessState.carrierOptionId).label
              : ""
          }
          variant={carrierSuccessState?.variant ?? "email"}
          email={carrierSuccessState?.email ?? null}
          onDismiss={dismissCarrierSuccess}
        />

        {/* Edit Field Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Edit Field</DialogTitle>
              <DialogDescription>
                Update the value for {editingField?.label}
              </DialogDescription>
            </DialogHeader>
            {editingField && (
              <div className="py-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="field-value">{editingField.label}</Label>
                  <EditableField
                    field={editingField}
                    value={editValue}
                    onChange={setEditValue}
                  />
                </div>
                {editingField.rawText &&
                  editingField.rawText !== editingField.value && (
                    <div className="rounded-lg bg-muted/50 border p-3 space-y-1">
                      <p className="text-xs font-medium text-muted-foreground">
                        Original Extracted Text
                      </p>
                      <p className="text-sm italic text-foreground/80">
                        {editingField.rawText}
                      </p>
                    </div>
                  )}
                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    variant="outline"
                    onClick={() => setIsEditDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleDialogSave}>Save Changes</Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </ErrorBoundary>
  );
}
