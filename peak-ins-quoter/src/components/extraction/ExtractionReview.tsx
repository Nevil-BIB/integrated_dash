'use client'

import { useState, useCallback, useImperativeHandle, forwardRef, useMemo } from 'react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { HomeExtractionForm } from './HomeExtractionForm'
import { CarrierExtractionForm, type CarrierFormData } from './CarrierExtractionForm'
import { CarrierWorkflowTabs } from './CarrierWorkflowTabs'
import { AutoExtractionForm } from './AutoExtractionForm'
import { QuoteType } from './QuoteTypeSelector'
import { Home, Car } from 'lucide-react'
import {
  getHomeExtractionData,
  getAutoExtractionData,
} from '@/lib/extraction/transform'
import {
  HomeExtractionResult,
  createEmptyHomeExtraction,
  mergeChubbHomeCoverageEstimator,
  mergeChubbWithLegacyHomeownersFields,
} from '@/types/home-extraction'
import { AutoExtractionResult, createEmptyAutoExtraction } from '@/types/auto-extraction'
import { CombinedUiExtractionData, ExtractedDataType } from '@/types/database'
import { createClient } from '@/lib/supabase/client'
import {
  readWorkflowMeta,
  supportsCarrierSchemaExtraction,
  validateCarrierExtraction,
  getCarrierFieldsMap,
  type CarrierOptionId,
} from '@/lib/carriers'
import { toast } from 'sonner'

/**
 * Imperative handle exposed by ExtractionReview for parent components
 */
export interface ExtractionReviewHandle {
  /**
   * Saves all pending changes immediately (bypasses auto-save debounce).
   * Call this before navigation to ensure data is persisted.
   * Returns true if save succeeded, false if there was an error.
   */
  saveBeforeNavigation: () => Promise<boolean>
}

interface ExtractionReviewProps {
  extractionId: string
  /**
   * The initial extraction data in any supported format:
   * - HomeApiExtractionResult / AutoApiExtractionResult (from API extraction)
   * - HomeExtractionResult / AutoExtractionResult (UI form format)
   * - CombinedExtractionData / CombinedUiExtractionData (both types)
   * - ExtractionResult (legacy format)
   * - null (empty/pending extraction)
   */
  initialData: ExtractedDataType
  /**
   * The quote type selected by the user during upload.
   * This determines which form(s) to display.
   */
  quoteType: QuoteType
  className?: string
}

/**
 * Extraction Review Component
 *
 * Provides a unified interface for reviewing extracted insurance data.
 * Supports Home, Auto, and combined Home+Auto quote types.
 *
 * Features:
 * - Uses the quote type selected during upload (no re-selection needed)
 * - Transforms legacy data formats to new structured formats
 * - Provides tabbed interface for combined Home+Auto quotes
 * - Exposes saveBeforeNavigation() for parent components to force save
 */
export const ExtractionReview = forwardRef<ExtractionReviewHandle, ExtractionReviewProps>(
  function ExtractionReview({
    extractionId,
    initialData,
    quoteType,
    className,
  }, ref) {
  const hasInvalidLocationDetailTripleYes = useCallback((data: HomeExtractionResult): boolean => {
    const ld = data.locationDetail
    if (!ld) return false
    return (
      ld.ownerOccupied?.value === 'Yes' &&
      ld.vacant?.value === 'Yes' &&
      ld.liabilityCoverageOnly?.value === 'Yes'
    )
  }, [])

  const hasMissingLivedAtDifferentAddressPast6Months = useCallback(
    (data: HomeExtractionResult): boolean => {
      const value = data.personal?.livedAtDifferentAddressPast6Months?.value
      return typeof value !== 'string' || value.trim() === ''
    },
    []
  )

  const hasMissingLocationDetailFields = useCallback((data: HomeExtractionResult): boolean => {
    const locationDetail = data.locationDetail
    if (!locationDetail) return true

    const requiredKeys: (keyof HomeExtractionResult['locationDetail'])[] = [
      'locationOccupancy',
      'ownerOccupied',
      'vacant',
      'liabilityCoverageOnly',
      'personalPropertyOnly',
    ]

    return requiredKeys.some((key) => {
      const value = locationDetail[key]?.value
      return typeof value !== 'string' || value.trim() === ''
    })
  }, [])

  const hasMissingLocationInformationFields = useCallback((data: HomeExtractionResult): boolean => {
    const locationInformation = data.locationInformation
    if (!locationInformation) return true

    const requiredKeys: (keyof HomeExtractionResult['locationInformation'])[] = [
      'program',
      'coverageA',
      'coverageF',
      'personalInjury',
      'coverageG',
      'construction',
      'foundation',
      'numberOfFamiliesUnits',
      'hasMortgageeContractHolderOrSecuredLineOfCredit',
      'boardingOrLodgingOrStudentRentals',
      'isStudentRental',
      'visibleFromOtherDwellings',
      'fortifiedHome',
      'woodCoalHeating',
      'gatedAccessToDwelling',
      'applicantWillingToCompleteDiySurvey',
      'screenedEnclosure',
      'dwellingConstructedWithAsbestos',
      'floodZone',
      'coastalStormRiskArea',
      'locatedOnIsland',
      'dogsOwnedOrKept',
      'specificBreed',
      'biteHistoryAggressiveBehavior',
      'isLocationWithinCity',
      'respondingFireDepartment',
      'communityName',
      'within1000FeetOfHydrant',
      'bridgeAccess',
      'windHailDeductible',
      'hurricaneDeductible',
      'county',
      'locationInformationOccupancy',
      'territory',
      'ownership',
      'allOtherPerilsDeductible',
      'roofingMaterial',
      'roofUpdateYear',
      'distanceToHydrantFeet',
      'distanceToFireStationMiles',
      'protectionClass',
    ]

    const woodCoalNeedsLocation =
      locationInformation.woodCoalHeating?.value === 'Yes'

    if (woodCoalNeedsLocation) {
      requiredKeys.push('woodCoalHeatingLocation')
    }

    const woodCoalNeedsQuantity =
      woodCoalNeedsLocation &&
      locationInformation.woodCoalHeatingLocation?.value === 'Dwelling'
    if (woodCoalNeedsQuantity) {
      requiredKeys.push('woodCoalHeatingQuantity')
    }

    return requiredKeys.some((key) => {
      const value = locationInformation[key]?.value
      return typeof value !== 'string' || value.trim() === ''
    })
  }, [])

  const hasMissingPolicyQuestionsFields = useCallback((data: HomeExtractionResult): boolean => {
    const policyQuestions = data.policyQuestions
    if (!policyQuestions) return true

    const baseRequiredKeys: (keyof HomeExtractionResult['policyQuestions'])[] = [
      'pleaseExplain',
      'hasAnyCompanyCanceledRefusedOrDeclinedRenewal',
      'hasAutoOwnersInsurancePast5Years',
      'hasFiledPersonalBankruptcyOrJudgementsPast5Years',
      'hasAnyApplicantBeenConvictedOfArson',
    ]

    const needsOptions =
      policyQuestions.hasAnyCompanyCanceledRefusedOrDeclinedRenewal?.value === 'Yes'
    const needsPreviousPolicyNumber =
      policyQuestions.hasAutoOwnersInsurancePast5Years?.value === 'Yes'
    const needsBankruptcyExplain =
      policyQuestions.hasFiledPersonalBankruptcyOrJudgementsPast5Years?.value === 'Yes'

    const requiredKeys: (keyof HomeExtractionResult['policyQuestions'])[] = [
      ...baseRequiredKeys,
      ...(needsOptions ? (['options'] as const) : []),
      ...(needsPreviousPolicyNumber ? (['previousPolicyNumber'] as const) : []),
      ...(needsBankruptcyExplain ? (['bankruptcyPleaseExplain'] as const) : []),
    ]

    return requiredKeys.some((key) => {
      const value = policyQuestions[key]?.value
      return typeof value !== 'string' || value.trim() === ''
    })
  }, [])

  const hasMissingHomeownersInformationsFields = useCallback(
    (data: HomeExtractionResult): boolean => {
      const hi = data.homeownersInformations
      if (!hi) return true

      const baseRequired: (keyof HomeExtractionResult['homeownersInformations'])[] = [
        'homeownersInsuranceCancelledDeclinedNonrenewedLast3Years',
        'homeVacantOrUnoccupied',
        'businessConductedOnPremises',
        'homeAvailableForRentIncludingShortTermOrHomeSharing',
        'homeInDesignatedHighRiskFloodZone',
        'petsOrAnimalsBittenOrInjuredAnyone',
        'ownsRestrictedDogBreedsOrMix',
        'insuranceStatus',
        'burglarAlarm',
        'feetFromHydrant',
        'yearBuilt',
        'purchaseMonthYear',
        'numberOfFamilies',
        'primarySourceOfHeat',
        'residenceType',
        'seasonalDwelling',
        'swimmingPool',
        'woodCoalPelletStove',
        'squareFootage',
        'buildingConstructionType',
        'sidingType',
        'primaryFoundationType',
        'numberOfBathrooms',
        'garageType',
        'numberOfStories',
        'roofShape',
        'roofType',
        'yearRoofingReplaced',
        'numberOfSolarPanelsOnRoof',
        'currentAutoPolicyBodilyInjuryLimit',
        'baseCoverageLevel',
        'replacementCost',
        'aDwellingLimit',
        'ePersonalLiability',
        'fMedicalPayments',
        'deductible',
      ]

      const poolType = hi.swimmingPoolType?.value?.trim() ?? ''
      const garageType = hi.garageType?.value?.trim() ?? ''
      const showPoolSafety =
        hi.swimmingPool?.value === 'Yes' &&
        (poolType === 'Above Ground' || poolType === 'Inground')

      const required: (keyof HomeExtractionResult['homeownersInformations'])[] = [
        ...baseRequired,
        ...(hi.homeVacantOrUnoccupied?.value === 'Yes'
          ? (['occupiedInNext30Days'] as const)
          : []),
        ...(hi.businessConductedOnPremises?.value === 'Yes'
          ? ([
              'businessProvidesProfessionalAdviceOrOpinions',
              'businessHasEmployeesOtherThanResidenceRelatives',
              'businessMoreThanFourClientVisitsPerWeek',
            ] as const)
          : []),
        ...(hi.homeAvailableForRentIncludingShortTermOrHomeSharing?.value === 'Yes'
          ? (['portionOfHomeAvailableForRent', 'basisHomeAvailableForRent'] as const)
          : []),
        ...(hi.homeInDesignatedHighRiskFloodZone?.value === 'Yes'
          ? (['hasFloodPolicy'] as const)
          : []),
        ...(hi.swimmingPool?.value === 'Yes' ? (['swimmingPoolType'] as const) : []),
        ...(showPoolSafety ? (['swimmingPoolSafetyFeature'] as const) : []),
        ...(hi.woodCoalPelletStove?.value === 'Yes'
          ? ([
              'stoveProfessionallyInstalledOrInspected',
              'chimneyCleanedAnnually',
              'ulListed',
            ] as const)
          : []),
        ...(hi.primaryFoundationType?.value === 'Basement'
          ? (['basementFinished'] as const)
          : []),
        ...(garageType !== '' && garageType !== 'None'
          ? (['garageSizeNumberOfCars'] as const)
          : []),
      ]

      return required.some((key) => {
        const value = hi[key]?.value
        return typeof value !== 'string' || value.trim() === ''
      })
    },
    []
  )

  const hasMissingLocationSpecificQuestionsFields = useCallback((data: HomeExtractionResult): boolean => {
    const qs = data.locationSpecificQuestions
    if (!qs) return true

    const baseRequired: (keyof HomeExtractionResult['locationSpecificQuestions'])[] = [
      'dwellingForSale',
      'isNewVentureNoPreviousLandlordOrRentalPropertyExperience',
      'areThereAnyOutbuildingsOnPremises',
      'anyFloodingBrushLandslideOrUnusualHazards',
      'areDogsAllowed',
      'anyAnimalsOtherThanLivestockNotTypicallyHouseholdPets',
      'anyUncorrectedFireCodeViolations',
      'difficultAccessByFireAndPoliceDepartments',
      'dwellingNewPurchase',
      'dwellingOccupied',
      'pleaseExplain',
      'expectedOccupancyDate',
      'dayCareOnPremises',
      'farmingOnPremises',
      'otherBusinessOnPremises',
      'buildingUnderRenovationOrReconstruction',
      'responsesVerifiedWithApplicant',
    ]

    const allowSubs = qs.dwellingOccupied?.value === 'No'

    const required: (keyof HomeExtractionResult['locationSpecificQuestions'])[] = [
      ...baseRequired,
      ...(qs.dwellingNewPurchase?.value === 'Yes' ? (['purchasePrice'] as const) : []),
      ...(allowSubs && qs.dayCareOnPremises?.value === 'Yes'
        ? (['childrenCaredForCount'] as const)
        : []),
      ...(allowSubs && qs.farmingOnPremises?.value === 'Yes'
        ? ([
            'acresFarmedByOthers',
            'numberOfAnimalsLarge',
            'numberOfAnimalsMedium',
            'numberOfAnimalsSmall',
          ] as const)
        : []),
      ...(allowSubs && qs.otherBusinessOnPremises?.value === 'Yes'
        ? (['describeBusiness'] as const)
        : []),
      ...(allowSubs && qs.buildingUnderRenovationOrReconstruction?.value === 'Yes'
        ? (['householdMembersLivingDuringRenovation', 'renovationExplanation'] as const)
        : []),
    ]

    return required.some((key) => {
      const value = qs[key]?.value
      return typeof value !== 'string' || value.trim() === ''
    })
  }, [])

  const workflowMeta = useMemo(() => readWorkflowMeta(initialData), [initialData])
  const carrierOptionIds = useMemo(
    (): CarrierOptionId[] =>
      workflowMeta?.carrierOptionIds?.length
        ? workflowMeta.carrierOptionIds
        : workflowMeta
          ? [workflowMeta.carrierOptionId]
          : [],
    [workflowMeta],
  )
  const [activeCarrierOptionId, setActiveCarrierOptionId] = useState<CarrierOptionId>(
    () => workflowMeta?.carrierOptionId ?? 'chubb-home',
  )
  const useCarrierForm =
    workflowMeta != null && supportsCarrierSchemaExtraction(activeCarrierOptionId)

  // Debug logging - only in development
  if (process.env.NODE_ENV === 'development') {
    console.log('[ExtractionReview] Received initialData:', initialData)
    console.log('[ExtractionReview] initialData keys:', initialData ? Object.keys(initialData) : 'null')
    console.log('[ExtractionReview] Quote type from props:', quoteType)
  }

  // Track which tab is active for "both" mode
  const [activeTab, setActiveTab] = useState<'home' | 'auto'>('home')
  const [carrierMissingHighlight, setCarrierMissingHighlight] = useState<string[]>([])

  // Initialize home extraction data
  const [homeData, setHomeData] = useState<CarrierFormData>(() => {
    const data = getHomeExtractionData(initialData)
    if (process.env.NODE_ENV === 'development') {
      console.log('[ExtractionReview] Home data from getHomeExtractionData:', data)
      console.log('[ExtractionReview] Home data personal.firstName:', data?.personal?.firstName)
    }
    if (!data) return createEmptyHomeExtraction()
    const empty = createEmptyHomeExtraction()
    return {
      ...empty,
      ...data,
      homeownersInformations: {
        ...empty.homeownersInformations,
        ...(data.homeownersInformations ?? {}),
      },
      chubbHomeCoverageEstimator: mergeChubbWithLegacyHomeownersFields(
        mergeChubbHomeCoverageEstimator(data.chubbHomeCoverageEstimator),
        data.homeownersInformations,
      ),
      carrierFields: getCarrierFieldsMap(
        initialData as CarrierFormData,
        workflowMeta?.carrierOptionId ?? 'chubb-home',
      ) ?? (initialData as CarrierFormData | null)?.carrierFields,
      carrierFieldsByOption: (initialData as CarrierFormData | null)?.carrierFieldsByOption,
    }
  })

  // Initialize auto extraction data
  const [autoData, setAutoData] = useState<AutoExtractionResult>(() => {
    const data = getAutoExtractionData(initialData)
    if (process.env.NODE_ENV === 'development') {
      console.log('[ExtractionReview] Auto data from getAutoExtractionData:', data)
      console.log('[ExtractionReview] Auto data personal.ownerFirstName:', data?.personal?.ownerFirstName)
    }
    return data || createEmptyAutoExtraction()
  })

  // Save handler for home data
  const handleSaveHome = useCallback(
    async (data: HomeExtractionResult | CarrierFormData) => {
      const supabase = createClient()
      const workflow = readWorkflowMeta(initialData)
      const carrierData = data as CarrierFormData
      const carrierFieldsByOption = {
        ...(initialData as CarrierFormData | null)?.carrierFieldsByOption,
        ...carrierData.carrierFieldsByOption,
        [activeCarrierOptionId]:
          getCarrierFieldsMap(carrierData, activeCarrierOptionId) ??
          carrierData.carrierFields,
      }

      const extracted_data = {
        ...data,
        ...(workflow
          ? {
              workflow: {
                ...workflow,
                carrierOptionId: activeCarrierOptionId,
                carrierOptionIds,
              },
            }
          : {}),
        carrierFields: carrierFieldsByOption[activeCarrierOptionId],
        carrierFieldsByOption,
      }

      const { error } = await supabase
        .from('extractions')
        .update({
          extracted_data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', extractionId)

      if (error) {
        console.error('Error saving home extraction:', error)
        throw error
      }

      setHomeData(data)
    },
    [extractionId, initialData, activeCarrierOptionId, carrierOptionIds]
  )

  // Save handler for auto data
  const handleSaveAuto = useCallback(
    async (data: AutoExtractionResult) => {
      const supabase = createClient()

      const { error } = await supabase
        .from('extractions')
        .update({
          extracted_data: data,
          updated_at: new Date().toISOString(),
        })
        .eq('id', extractionId)

      if (error) {
        console.error('Error saving auto extraction:', error)
        throw error
      }

      setAutoData(data)
    },
    [extractionId]
  )

  // Save handler for combined data (both quote types)
  const handleSaveCombined = useCallback(
    async (type: 'home' | 'auto', data: HomeExtractionResult | AutoExtractionResult) => {
      const supabase = createClient()

      // For combined mode, we store both datasets
      const combinedData: CombinedUiExtractionData = {
        quoteType: 'both',
        home: type === 'home' ? (data as HomeExtractionResult) : homeData,
        auto: type === 'auto' ? (data as AutoExtractionResult) : autoData,
      }

      const { error } = await supabase
        .from('extractions')
        .update({
          extracted_data: combinedData,
          updated_at: new Date().toISOString(),
        })
        .eq('id', extractionId)

      if (error) {
        console.error('Error saving combined extraction:', error)
        throw error
      }

      if (type === 'home') {
        setHomeData(data as HomeExtractionResult)
      } else {
        setAutoData(data as AutoExtractionResult)
      }
    },
    [extractionId, homeData, autoData]
  )

  const handleCarrierHomeDataChange = useCallback(
    (data: CarrierFormData) => {
      setHomeData(data)
      if (!workflowMeta) return
      const validation = validateCarrierExtraction(data, activeCarrierOptionId)
      if (validation.valid) {
        setCarrierMissingHighlight([])
      } else if (carrierMissingHighlight.length > 0) {
        setCarrierMissingHighlight(validation.missingFields.map((f) => f.key))
      }
    },
    [workflowMeta, activeCarrierOptionId, carrierMissingHighlight.length],
  )

  // Expose imperative handle for parent components to trigger save
  useImperativeHandle(ref, () => ({
    saveBeforeNavigation: async (): Promise<boolean> => {
      try {
        if (useCarrierForm && workflowMeta && (quoteType === 'home' || quoteType === 'both' || quoteType === 'auto')) {
          const validation = validateCarrierExtraction(homeData, activeCarrierOptionId)
          if (!validation.valid) {
            setCarrierMissingHighlight(validation.missingFields.map((f) => f.key))
            const message =
              validation.messages?.[0] ??
              `Please complete required fields: ${validation.missingFields.map((f) => f.label).join(', ')}`
            toast.error(message)
            return false
          }
          setCarrierMissingHighlight([])
        } else if (quoteType === 'home' || quoteType === 'both') {
          if (hasMissingLivedAtDifferentAddressPast6Months(homeData)) {
            toast.error(
              'Please select Yes or No for "Have you lived at a different address in the past 6 months?" before proceeding.'
            )
            return false
          }
          if (hasInvalidLocationDetailTripleYes(homeData)) {
            toast.error('No quote is available if you select Yes for all three: Owner-Occupied, Vacant, and Liability Coverage only.')
            return false
          }
          if (hasMissingHomeownersInformationsFields(homeData)) {
            toast.error(
              'Please fill all required fields in Homeowners Informations before proceeding.'
            )
            return false
          }
          if (
            hasMissingLocationDetailFields(homeData) ||
            hasMissingLocationInformationFields(homeData) ||
            hasMissingPolicyQuestionsFields(homeData) ||
            hasMissingLocationSpecificQuestionsFields(homeData)
          ) {
            toast.error('Please fill all required fields in Location Detail and Location Information before proceeding.')
            return false
          }
        }

        // Save based on current quote type
        if (quoteType === 'home' || (quoteType === 'auto' && useCarrierForm)) {
          await handleSaveHome(homeData)
        } else if (quoteType === 'auto') {
          await handleSaveAuto(autoData)
        } else if (quoteType === 'both') {
          // For combined quotes, save both home and auto
          await handleSaveCombined('home', homeData)
          await handleSaveCombined('auto', autoData)
        }
        console.log('[ExtractionReview] saveBeforeNavigation completed successfully')
        return true
      } catch (error) {
        console.error('[ExtractionReview] saveBeforeNavigation failed:', error)
        return false
      }
    },
  }), [quoteType, homeData, autoData, useCarrierForm, workflowMeta, activeCarrierOptionId, handleSaveHome, handleSaveAuto, handleSaveCombined, hasMissingLivedAtDifferentAddressPast6Months, hasInvalidLocationDetailTripleYes, hasMissingHomeownersInformationsFields, hasMissingLocationDetailFields, hasMissingLocationInformationFields, hasMissingPolicyQuestionsFields, hasMissingLocationSpecificQuestionsFields])

  // Render content based on quote type
  const renderContent = () => {
    switch (quoteType) {
      case 'home':
        if (useCarrierForm && workflowMeta) {
          return (
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
                initialData={{
                  ...homeData,
                  carrierFields: getCarrierFieldsMap(homeData, activeCarrierOptionId),
                  carrierFieldsByOption: homeData.carrierFieldsByOption,
                }}
                onSave={handleSaveHome}
                onDataChange={handleCarrierHomeDataChange}
                missingRequiredKeys={carrierMissingHighlight}
                className={className}
              />
            </div>
          )
        }
        return (
          <HomeExtractionForm
            extractionId={extractionId}
            initialData={homeData}
            onSave={handleSaveHome}
            onDataChange={setHomeData}
            className={className}
          />
        )

      case 'auto':
        if (useCarrierForm && workflowMeta) {
          return (
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
                initialData={{
                  ...homeData,
                  carrierFields: getCarrierFieldsMap(homeData, activeCarrierOptionId),
                  carrierFieldsByOption: homeData.carrierFieldsByOption,
                }}
                onSave={handleSaveHome}
                onDataChange={handleCarrierHomeDataChange}
                missingRequiredKeys={carrierMissingHighlight}
                className={className}
              />
            </div>
          )
        }
        return (
          <AutoExtractionForm
            extractionId={extractionId}
            initialData={autoData}
            onSave={handleSaveAuto}
            onDataChange={setAutoData}
            className={className}
          />
        )

      case 'both':
        return (
          <Tabs
            value={activeTab}
            onValueChange={(value) => setActiveTab(value as 'home' | 'auto')}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 mb-6 h-12">
              <TabsTrigger value="home" className="flex items-center gap-2 text-base">
                <Home className="h-4 w-4" />
                Home Insurance
              </TabsTrigger>
              <TabsTrigger value="auto" className="flex items-center gap-2 text-base">
                <Car className="h-4 w-4" />
                Auto Insurance
              </TabsTrigger>
            </TabsList>

            <TabsContent value="home" className="mt-0">
              <HomeExtractionForm
                extractionId={extractionId}
                initialData={homeData}
                onSave={(data) => handleSaveCombined('home', data)}
                onDataChange={setHomeData}
                className={className}
              />
            </TabsContent>

            <TabsContent value="auto" className="mt-0">
              <AutoExtractionForm
                extractionId={extractionId}
                initialData={autoData}
                onSave={(data) => handleSaveCombined('auto', data)}
                onDataChange={setAutoData}
                className={className}
              />
            </TabsContent>
          </Tabs>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      {renderContent()}
    </div>
  )
})
