from .config import *
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from datetime import datetime
from pathlib import Path
import requests
import json
import time
import re
import pdb

RESULTS_DIR = Path("results")
QUOTES_DIR = Path("quotes")
RESULTS_DIR.mkdir(exist_ok=True)
QUOTES_DIR.mkdir(exist_ok=True)
start = int(time.time())
'''
PAYLOAD EXAMPLE
{
  "metadata": {
    "quoteId": "3a5b86e4-ec40-48fa-bd0e-3a5497169059",
    "extractionId": "cdcf94e2-84eb-473f-96c0-0d1030789a54",
    "userId": "886cffc6-cdd1-4ccf-a1f8-ea3da505c923",
    "filename": "Quote sheets and tax info.pdf",
    "submittedAt": "2026-03-05T10:10:17.924Z",
    "quoteType": "home",
    "carriers": [
      "Safeco"
    ],
    "version": "1.0.0"
  },
  "personal": {
    "firstName": "Nicholas",
    "lastName": "Elam",
    "dateOfBirth": "1991-05-02",
    "ssn": "",
    "phone": "(205) 746-5350",
    "email": "sec0027@auburn.edu",
    "maritalStatus": "Married",
    "gender": "",
    "occupation": "Professor",
    "relationshipToInsured": "Spouse",
    "spouseFirstName": "Sarah",
    "spouseLastName": "Elam",
    "spouseDateOfBirth": "1993-10-03",
    "spouseSsn": "",
    "spouseMaritalStatus": "Married",
    "spouseOccupation": "Teacher",
    "spouseGender": "",
    "spouseRelationshipToPolicyholder": "Spouse",
    "address": {
      "street": "1512 Tea Rose Cir",
      "city": "Hoover",
      "state": "AL - Alabama",
      "zipCode": "35244",
      "poBox": ""
    },
    "yearsAtCurrentAddress": 0
  },
  "home": {
    "property": {
      "yearBuilt": 1999,
      "squareFootage": 1900,
      "numberOfStories": 1,
      "bedroomCount": 2,
      "bathroomCount": "2",
      "dwellingType": "Single family dwelling",
      "constructionStyle": "2 Story",
      "constructionType": "",
      "exteriorWalls": "Siding, Vinyl",
      "exteriorFeatures": "",
      "roofMaterial": "Shingles, Asphalt",
      "roofShape": "Gable",
      "foundation": "Slab",
      "heatType": "Gas, Forced Air",
      "garageType": "Attached",
      "garageCapacity": "2",
      "purchaseDate": "2018-01-13",
      "condoOrTownhouse": False,
      "specialFeatures": "",
      "dwellingLocatedIn": "City",
      "waterSupplyType": ""
    },
    "occupancy": {
      "dwellingOccupancy": "Owner Occupied - Primary",
      "locationType": "",
      "businessOnPremises": False,
      "shortTermRental": False,
      "daysRentedToOthers": "",
      "numberOfFamilies": 1,
      "numberOfDrivers": 0,
      "horsesOrLivestock": "No"
    },
    "safety": {
      "alarmSystem": False,
      "monitoredAlarm": False,
      "pool": False,
      "trampoline": False,
      "dog": False,
      "dogBreed": ""
    },
    "coverage": {
      "dwellingCoverage": "750000",
      "liabilityCoverage": "$100,000",
      "medicalPayments": "$1,000",
      "deductible": "$1,000"
    },
    "scheduledItems": {},
    "insurance": {
      "effectiveDate": "2026-04-01",
      "reasonForPolicy": "New property customer to Safeco",
      "currentlyInsured": "No, Unknown Reason",
      "propertySameAsMailing": "Yes",
      "currentInsuranceCompany": "",
      "currentPolicyNumber": "",
      "safecoOriginalPolicyDate": "",
      "priorSafecoPolicyNumber": "",
      "ownershipDate": "2018-10-13",
      "escrowed": False,
      "insuranceCancelledDeclined": "No",
      "cancelDeclineDetails": "",
      "maintenanceCondition": "Very good",
      "numberOfLosses5Years": "0",
      "priorCarrierType": "",
      "numberOfMortgagees": "",
      "cincinnatiPolicyNumber": "",
      "priorCarrierName": "",
      "monthsWithPriorCarrier": 0,
      "priorCarrierPolicyNumber": "",
      "priorCarrierExpirationDate": "",
      "isRollover": "",
      "rolloverGroup": "",
      "cincinnatiCurrentlyWritesLine": "",
      "isSpinOff": "",
      "isSecondaryHome": "",
      "isReplacingSecondaryHome": "",
      "isAgentOfRecord": "",
      "aorLetterObtained": ""
    },
    "updates": {
      "hvacUpdate": "Yes",
      "hvacYear": "1999",
      "plumbingUpdate": "Yes",
      "plumbingYear": "1999",
      "roofUpdate": "Yes",
      "roofYear": "2017",
      "electricalUpdate": "Yes",
      "electricalYear": "1999",
      "circuitBreakers": "Yes",
      "wiringUpdate": "",
      "wiringYear": ""
    },
    "claimsHistory": {
      "claims": [
        {
          "date": "2020-06-12",
          "type": "Water Damage",
          "description": "Water claim on 06/12/20, amount 80",
          "amount": "80"
        }
      ]
    }
  }
}'''


# -------------------------------------------------
# Helpers
# -------------------------------------------------
def write_result(job_id: str, data: dict):
    with open(RESULTS_DIR / f"{job_id}.json", "w") as f:
        json.dump(data, f, indent=2)

def _select(
    driver: webdriver.Chrome,
    locator: str,
    value: str,
    strategy: By = By.ID,
    wait: bool = False,
    timeout: int = 5
):
    if wait: element = WebDriverWait(driver, timeout).until(EC.presence_of_element_located((strategy, locator)))
    else: element = driver.find_element(by=strategy, value=locator)

    Select(element).select_by_visible_text(str(value))

def _is_yes(value) -> bool:
    return str(value).strip().lower() in {"yes", "y", "true", "1"}

def _try_fill_text(driver, ids, value: str):
    if not value:
        return
    for field_id in ids:
        elements = driver.find_elements(By.ID, field_id)
        if elements:
            elements[0].clear()
            elements[0].send_keys(value)
            return

def run(payload: dict, job_id: str):
    driver = None

    try:
        write_result(job_id, {"status": "running"})
        submission = payload

        options = webdriver.ChromeOptions()
        options.add_argument("--incognito")
        options.add_argument("--start-maximized")
        safeco_quotes_dir = (QUOTES_DIR / "Safeco")
        safeco_quotes_dir.mkdir(parents=True, exist_ok=True)
        prefs = {
            "download.default_directory": str(safeco_quotes_dir.resolve()),
            "download.prompt_for_download": False,
            "download.directory_upgrade": True,
            "safebrowsing.enabled": True,
        }
        options.add_experimental_option("prefs", prefs)
        # options.add_argument(f"--user-data-dir={PROJECT_ROOT}\\safeco")
        # options.add_argument("--profile-directory=Default")

        driver = webdriver.Chrome(options=options)
        wait = WebDriverWait(driver, 10)


        driver.get(SAFECO_URL)
        wait.until(EC.presence_of_element_located((By.ID, "username"))).send_keys(SAFECO_USERNAME)
        driver.find_element(By.ID, "password").send_keys(SAFECO_PASSWORD)
        driver.find_element(By.ID, "submit1").click()

        current_time = int(time.time() * 1000)
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "[id^='email_icon_container'] svg"))).click()

        otp = None
        for _ in range(10):
            data = requests.get("https://archway-ai.app.n8n.cloud/webhook/3e6abd68-d36c-496e-880a-9c354883f15b").json()
            if isinstance(data, list):
                data = data[0] if data else {}
            if data.get("time", 0) > current_time:
                otp = data.get("otp")
                break
            time.sleep(3)

        print(otp)
        if not otp:
            raise Exception("OTP not received")

        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "#passcode"))).send_keys(otp)
        time.sleep(1)
        wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "#sign-on"))).click()

        time.sleep(1)
        driver.get("https://personal.safeco.com/Personal/home/PolicyInfo.aspx?ModeID=2")

        _select(
            driver,
            "PolicyRatingState",
            submission.get("personal", {}).get("address", {}).get("state", "").split(" - ")[-1],
            wait=True
        )
        _select(
            driver,
            "PolicyProduct",
            "Homeowners",
            wait=True
        )
        driver.find_element(By.ID, "PolicyEffectiveDate").send_keys(
            datetime.strptime(
                submission.get("home", {}).get("insurance", {}).get("effectiveDate", ""), "%Y-%m-%d"
            ).strftime("%m/%d/%Y")
        )
        _select(
            driver,
            "PolicyAgentNumber",
            "40-0591"
        )
        try:
            wait.until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, ".ui-dialog-titlebar-close"))
            ).click() 
        except:
            pass
        driver.find_element(By.ID, "PolicyClientPersonFirstName").send_keys(
            submission.get("personal", {}).get("firstName", "")
        )
        driver.find_element(By.ID, "PolicyClientPersonLastName").send_keys(
            submission.get("personal", {}).get("lastName", "")
        )
        driver.find_element(By.ID, "PolicyClientPersonBirthdate").send_keys(
            datetime.strptime(
                submission.get("personal", {}).get("dateOfBirth", ""), "%Y-%m-%d"
            ).strftime("%m/%d/%Y")
        )

        _select(driver, "PolicyClientPersonMaritalStatus", submission.get("personal", {}).get("maritalStatus", ""))
        time.sleep(0.5)

        spouse_first_name = submission.get("personal", {}).get("spouseFirstName", "")
        driver.find_element(
            By.CSS_SELECTOR,
            f"label[for='PolicyDwellingCoApplicantYN{'Y' if spouse_first_name else 'N'}']"
        ).click()
        if spouse_first_name:
            driver.find_element(By.ID, "PolicyDwellingCoApplicantFirstName").send_keys(spouse_first_name)
            driver.find_element(By.ID, "PolicyDwellingCoApplicantLastName").send_keys(
                submission.get("personal", {}).get("spouseLastName", "")
            )
            dob = submission.get("personal", {}).get("spouseDateOfBirth", "")
            if dob:
                formatted_dob = datetime.strptime(dob, "%Y-%m-%d").strftime("%m/%d/%Y")
                driver.find_element(By.ID, "PolicyDwellingCoApplicantBirthdate").send_keys(formatted_dob)
            _select(
                driver,
                "PolicyDwellingCoApplicantMaritalStatus",
                submission.get("personal", {}).get("spouseMaritalStatus", "") or submission.get("personal", {}).get("maritalStatus", "")
            )
        phone = submission.get("personal", {}).get("phone", "")

        if phone:
            digits = re.sub(r"\D", "", phone)
            area, prefix, line = digits[:3], digits[3:6], digits[6:]
            driver.find_element(By.NAME, "PolicyClientHomePhoneNumberAreaCode").send_keys(area)
            driver.find_element(By.NAME, "PolicyClientHomePhoneNumberPrefix").send_keys(prefix)
            driver.find_element(By.NAME, "PolicyClientHomePhoneNumberSuffix").send_keys(line)

        email = submission.get("personal", {}).get("email", "")
        if email:
            driver.find_element(By.NAME, "PolicyClientEmailAddress").send_keys(email)
        time.sleep(0.5)
        _select(driver,"PolicyBusinessType", submission.get("home", {}).get("insurance", {}).get("reasonForPolicy", ""))

        short_term = submission.get("home", {}).get("occupancy", {}).get("shortTermRental", False)
        driver.find_element(
            By.CSS_SELECTOR,
            f"label[for='PolicyAdditionalInterestsYN{'Y' if short_term else 'N'}']"
        ).click()

        time.sleep(0.5)
        driver.find_element(By.ID, "Continue").click()

        # ---Address Page---
        WebDriverWait(driver,5).until(EC.presence_of_element_located((By.ID, "PolicyClientMailingLocationAddressLine1"))).send_keys(submission.get("personal", {}).get("address", {}).get("street", ""))
        time.sleep(0.5)
        driver.find_element(By.ID, "PolicyClientMailingLocationCity").send_keys(submission.get("personal", {}).get("address", {}).get("city", ""))
        time.sleep(0.5)
        _select(driver,"PolicyClientMailingLocationState", submission.get("personal", {}).get("address", {}).get("state", "").split(" - ")[-1])
        time.sleep(0.5)
        driver.find_element(By.ID, "PolicyClientMailingLocationZipCode").send_keys(submission.get("personal", {}).get("address", {}).get("zipCode", ""))
        time.sleep(0.5)
        same_as_mailing = submission.get("home", {}).get("insurance", {}).get("propertySameAsMailing", "Yes")
        same_as_mailing_yes = _is_yes(same_as_mailing)
        driver.find_element(
            By.CSS_SELECTOR,
            f"label[for='PolicyHomeDataLocationSameAsMailingYN{'Y' if same_as_mailing_yes else 'N'}']"
        ).click()
        if not same_as_mailing_yes:
            property_address = submission.get("personal", {}).get("priorAddress", {}) or {}
            if not property_address:
                property_address = submission.get("personal", {}).get("address", {}) or {}

            _try_fill_text(driver, ["PolicyHomeDataLocationAddressLine1"], property_address.get("street", ""))
            _try_fill_text(driver, ["PolicyHomeDataLocationCity"], property_address.get("city", ""))
            state_value = property_address.get("state", "")
            if state_value:
                try:
                    _select(driver, "PolicyHomeDataLocationState", state_value.split(" - ")[-1])
                except Exception:
                    pass
            _try_fill_text(driver, ["PolicyHomeDataLocationZipCode"], property_address.get("zipCode", ""))
        time.sleep(0.5)
        driver.find_element(By.ID, "Continue").click()

        # ---Underwriting Page---
        home_under_construction = submission.get('home', {}).get('property', {}).get('homeUnderConstruction', 'No')
        home_construction_yn = 'Y' if home_under_construction == 'Yes' else 'N'
        WebDriverWait(driver,5).until(EC.presence_of_element_located((By.CSS_SELECTOR, f"label[for='PolicyDwellingCourseConstructionYN{home_construction_yn}']"))).click()
        time.sleep(0.5)
        business_on_premises = submission.get('home', {}).get('occupancy', {}).get('businessOnPremises', False)
        business_yn = 'Y' if business_on_premises else 'N'
        driver.find_element(By.CSS_SELECTOR, f"label[for='PolicyDwellingBusinessOnPremisesYN{business_yn}']").click()
        time.sleep(0.5)
        short_term_rental = submission.get('home', {}).get('occupancy', {}).get('shortTermRental', False)
        rental_yn = 'Y' if short_term_rental else 'N'
        driver.find_element(By.CSS_SELECTOR, f"label[for='PolicyDwellingRentedToOthersSTB{rental_yn}']").click()
        time.sleep(0.5)
        horses_livestock = submission.get('home', {}).get('occupancy', {}).get('horsesOrLivestock', 'No')
        horses_yn = 'Y' if _is_yes(horses_livestock) else 'N'
        driver.find_element(By.CSS_SELECTOR, f"label[for='PolicyDwellingHorsesLivestockYN{horses_yn}']").click()
        time.sleep(0.5)
        _select(driver,"PolicyDwellingOccupancy", submission.get('home', {}).get('occupancy', {}).get('dwellingOccupancy', ''))
        time.sleep(0.5)
        insured = submission.get('home', {}).get('insurance', {}).get('currentlyInsured', '')
        _select(driver,"PolicyCurrentlyInsured", insured)
        if insured == "Yes":
            current_carrier = submission.get('home', {}).get('insurance', {}).get('currentInsuranceCompany', '')
            _select(driver, "PolicyPrevInsuranceCarrierValue", current_carrier)
            
            if current_carrier == "Safeco":
                safeco_date = submission.get('home', {}).get('insurance', {}).get('safecoOriginalPolicyDate', '')
                if safeco_date:
                    formatted_safeco_date = datetime.strptime(safeco_date, "%Y-%m-%d").strftime("%m/%d/%Y")
                    driver.find_element(By.ID, "PolicyCustomerSinceDate").send_keys(formatted_safeco_date)
                
                prior_policy_num = submission.get('home', {}).get('insurance', {}).get('priorSafecoPolicyNumber', '')
                if prior_policy_num:
                    driver.find_element(By.ID, "PolicyPrevInsurancePolicyNumber").send_keys(prior_policy_num)
        
        _select(driver,"PolicyDwellingMaintenanceCondition", submission.get('home', {}).get('insurance', {}).get('maintenanceCondition', ''))
        time.sleep(0.5)
        
        cancel_declined = submission.get('home', {}).get('insurance', {}).get('insuranceCancelledDeclined', 'No')
        if _is_yes(cancel_declined):
           driver.find_element(By.XPATH, "//label[@for='PolicyInsuranceCancelNonRenewYNY']").click()
        else:
           driver.find_element(By.XPATH, "//label[@for='PolicyInsuranceCancelNonRenewYNN']").click()
        if _is_yes(cancel_declined):
            details = submission.get('home', {}).get('insurance', {}).get('cancelDeclineDetails', '')
            _try_fill_text(
                driver,
                [
                    "PolicyInsuranceCancelNonRenewDetails",
                    "PolicyInsuranceCancelNonRenewDescription",
                    "PolicyInsuranceCancelNonRenewDesc",
                    "PolicyInsuranceCancelNonRenewalDetails",
                    "PolicyInsuranceCancelNonRenewalExplanation",
                ],
                details
            )
            
        time.sleep(0.5)
        driver.find_element(By.ID, "PolicyDwellingNumberOfLosses").send_keys(submission.get('home', {}).get('insurance', {}).get('numberOfLosses5Years', '0'))
        time.sleep(0.5)
        
        purchase_date_str = submission.get('home', {}).get('property', {}).get('purchaseDate', '')
        if purchase_date_str:
            purchase_date = datetime.strptime(purchase_date_str, "%Y-%m-%d")
            _select(driver, "PolicyDwellingOwnershipMonth", purchase_date.strftime("%B"))
            driver.find_element(By.ID, "PolicyDwellingOwnershipYear").send_keys(purchase_date.strftime("%Y"))
        
        time.sleep(0.5)
        driver.find_element(By.ID, "Continue").click()

        # ---Applicant Page---
        wait.until(EC.presence_of_element_located((By.ID, "PolicyDwellingCoApplicantRelationshipToInsured")))
        relationship = submission.get("personal", {}).get("relationshipToInsured", "")
        if spouse_first_name and relationship:
            _select(
                driver,
                "PolicyDwellingCoApplicantRelationshipToInsured",
                relationship,
                wait=True
            )

        WebDriverWait(driver,5).until(EC.presence_of_element_located((By.ID, "Continue"))).click()

        # ---Dwelling Information Page---
        WebDriverWait(driver,5).until(EC.presence_of_element_located((By.ID, "PolicyDwellingConstructionYear"))).send_keys(submission.get('home', {}).get('property', {}).get('yearBuilt', ''))
        time.sleep(0.5)
        _select(driver,"PolicyDwellingConstructionStyle", submission.get("home", {}).get("property", {}).get("constructionStyle", ""))
        time.sleep(0.5)
        driver.find_element(By.ID, "PolicyDwellingLivingAreaSqFeetTotal").clear()
        time.sleep(0.5)
        driver.find_element(By.ID, "PolicyDwellingLivingAreaSqFeetTotal").send_keys(submission.get('home', {}).get('property', {}).get('squareFootage', ''))
        time.sleep(0.5)
        _select(driver,"PolicyDwellingDwellingTypeDesc", submission.get('home', {}).get('property', {}).get('dwellingType', ''))
        time.sleep(0.5)
        _select(driver,"PolicyDwellingInCitySuburbDistrict", submission.get('home', {}).get('property', {}).get('dwellingLocatedIn', ''), wait=True)
        time.sleep(0.5)
        _select(driver,"PolicyDwellingRoofs1ID", submission.get('home', {}).get('property', {}).get('roofMaterial', ''))
        time.sleep(2)
        # _select(driver,"PolicyDwellingRoofingRenovationType", submission.get('home', {}).get('updates', {}).get('roofUpdate', ''))
        roof_update = submission.get('home', {}).get('updates', {}).get('roofUpdate', '')
        if roof_update == "Yes":
            roof_update = "Full"
        elif roof_update == "No":
            roof_update = "None"
        _select(driver, "PolicyDwellingRoofingRenovationType", roof_update)
        time.sleep(2)
        if submission.get('home', {}).get('updates', {}).get('roofUpdate', '') == "Yes":
            wait.until(EC.presence_of_element_located((By.ID, "PolicyDwellingRoofingRenovationYear"))).send_keys(submission.get('home', {}).get('updates', {}).get('roofYear', ''))
            # driver.find_element(By.ID, "PolicyDwellingRoofingRenovationYear").send_keys(submission.get('home', {}).get('updates', {}).get('roofYear', ''))
        time.sleep(0.5)
        # _select(driver,"PolicyDwellingPlumbingRenovationType", submission.get('home', {}).get('updates', {}).get('plumbingUpdate', ''))
        plumbinng_update = submission.get('home', {}).get('updates', {}).get('plumbingUpdate', '')
        if plumbinng_update == "Yes":
            plumbinng_update = "Full"
        elif plumbinng_update == "No":
            plumbinng_update = "None"
        _select(driver, "PolicyDwellingRoofingRenovationType", plumbinng_update)
        time.sleep(1)
        if submission.get('home', {}).get('updates', {}).get('plumbingUpdate', '') == "Yes":
            try:
                WebDriverWait(driver, 5).until(EC.element_to_be_clickable((By.CSS_SELECTOR, ".ui-dialog-titlebar-close"))).click()
            except:
                pass
        time.sleep(0.5)
        _select(driver,"PolicyDwellingHeatingSystems1ID", submission.get('home', {}).get('property', {}).get('heatType', ''))
        time.sleep(0.5)
        driver.find_element(By.ID, "Continue").click()

        # ---Cost Guide Features Page---
        wait.until(EC.presence_of_element_located((By.ID, "PolicyDwellingFloorFinishes1Amount"))).clear()
        driver.find_element(By.ID, "PolicyDwellingFloorFinishes1Amount").send_keys("75")
        time.sleep(0.5)
        driver.find_element(By.ID, "PolicyDwellingFloorFinishes2Amount").clear()
        driver.find_element(By.ID, "PolicyDwellingFloorFinishes2Amount").send_keys("10")
        time.sleep(0.5)
        driver.find_element(By.ID, "PolicyDwellingFloorFinishes3Amount").clear()
        driver.find_element(By.ID, "PolicyDwellingFloorFinishes3Amount").send_keys("10")
        time.sleep(0.5)
        driver.find_element(By.ID, "PolicyDwellingFloorFinishes4Amount").clear()
        driver.find_element(By.ID, "PolicyDwellingFloorFinishes4Amount").send_keys("5")
        time.sleep(0.5)
        driver.find_element(By.ID, "Continue").click()

        time.sleep(3)
        WebDriverWait(driver,5).until(EC.presence_of_element_located((By.ID, "Continue"))).click()

        time.sleep(3)
        WebDriverWait(driver,5).until(EC.presence_of_element_located((By.ID, "Continue"))).click()
        
        time.sleep(3)
        WebDriverWait(driver,5).until(EC.presence_of_element_located((By.ID, "Continue"))).click()

        # ---Summary Page---
        time.sleep(3)

        contextGUID = driver.find_element(By.CSS_SELECTOR, "input[name='__ContextGUID']").get_attribute("value")
        activityTypeID = driver.find_element(By.CSS_SELECTOR, "input[name='__ActivityTypeID']").get_attribute("value")
        printOptionsURL = driver.current_url.split("packageselection.aspx")[0] + f"ReportMenu.aspx?context={contextGUID}&activitytype={activityTypeID}"
        print(printOptionsURL)
        driver.get(printOptionsURL)

        WebDriverWait(driver,5).until(EC.element_to_be_clickable((By.ID, "PolicyReportsQuoteSummary"))).click()
        time.sleep(0.5)
        driver.find_element(By.ID, "PolicyReportsPrintWithoutHouseImageYN").click()
        time.sleep(0.5)
        driver.find_element(By.ID, "PolicyReportsApplication").click()
        time.sleep(0.5)
        driver.find_element(By.ID, "PolicyReportsPackageSelection").click()
        time.sleep(0.5)
        driver.find_element(By.ID, "PolicyReportsPaymentOptions").click()
        time.sleep(0.5)
        driver.find_element(By.ID, "btnPrint").click() 

         # Wait for PDF download to complete
        time.sleep(15)
        
        # Download PDF from current URL and write to carrier-specific directory
        pdf = requests.get(driver.current_url)
        pdf_path = safeco_quotes_dir / f"Safeco_{job_id}.pdf"
        pdf_path.write_bytes(pdf.content)

        pdb.set_trace()
        result = {
            "status": "completed",
            "job_id": job_id,
            "carrier": "Safeco",
            "quote_type": "Homeowners",
            "pdf_path": str(pdf_path) if pdf_path else None,
            "completed_at": datetime.utcnow().isoformat()
        }

        write_result(job_id, result)
        return result

    except Exception as e:
        error_result = {
            "status": "failed",
            "job_id": job_id,
            "carrier": "Safeco",
            "quote_type": "Homeowners",
            "error": str(e),
            "failed_at": datetime.utcnow().isoformat()
        }

        write_result(job_id, error_result)
        return error_result

    finally:
        pdb.set_trace()
        if driver:
            driver.quit()

# {
#   "metadata": {
#     "quoteId": "ee393e98-371c-4125-b78f-84e3ce11af03",
#     "extractionId": "bd9104a2-b9b8-448e-997e-78837228ebdd",
#     "userId": "886cffc6-cdd1-4ccf-a1f8-ea3da505c923",
#     "filename": "Quote sheets and tax info.pdf",
#     "submittedAt": "2026-02-18T12:03:04.175Z",
#     "quoteType": "home",
#     "carriers": [
#       "Safeco"
#     ],
#     "version": "1.0.0"
#   },
#   "personal": {
#     "firstName": "Nicholas",
#     "lastName": "Elam",
#     "dateOfBirth": "1991-05-02",
#     "ssn": "",
#     "phone": "(205) 746-5350",
#     "email": "sec0027@auburn.edu",
#     "maritalStatus": "Married",
#     "clientInformation": "",
#     "gender": "",
#     "occupation": "Professor",
#     "relationshipToInsured": "Spouse",
#     "spouseFirstName": "Sarah",
#     "spouseLastName": "Elam",
#     "spouseDateOfBirth": "1993-10-03",
#     "spouseSsn": "",
#     "spouseMaritalStatus": "Married",
#     "spouseOccupation": "",
#     "spouseGender": "",
#     "spouseRelationshipToPolicyholder": "",
#     "address": {
#       "street": "1512 Tea Rose Cir",
#       "city": "Hoover",
#       "state": "AL - Alabama",
#       "zipCode": "35244",
#       "poBox": ""
#     },
#     "yearsAtCurrentAddress": 5
#   },
#   "home": {
#     "property": {
#       "yearBuilt": 1999,
#       "squareFootage": 1900,
#       "numberOfStories": 1,
#       "bedroomCount": 3,
#       "bathroomCount": "2",
#       "dwellingType": "Single family dwelling",
#       "constructionStyle": "2 Story",
#       "constructionType": "",
#       "exteriorWalls": "Siding, Vinyl",
#       "exteriorFeatures": "",
#       "roofMaterial": "Shingles, Asphalt",
#       "roofShape": "All Other",
#       "foundation": "Slab",
#       "heatType": "Gas, Forced Air",
#       "garageType": "Attached",
#       "garageCapacity": "2",
#       "purchaseDate": "2018-10-13",
#       "condoOrTownhouse": false,
#       "specialFeatures": "",
#       "dwellingLocatedIn": "City",
#       "waterSupplyType": ""
#     },
#     "occupancy": {
#       "dwellingOccupancy": "Owner Occupied - Primary",
#       "locationType": "",
#       "businessOnPremises": false,
#       "shortTermRental": false,
#       "daysRentedToOthers": "",
#       "numberOfFamilies": 1,
#       "numberOfDrivers": 0,
#       "horsesOrLivestock": "No"
#     },
#     "safety": {
#       "alarmSystem": false,
#       "monitoredAlarm": false,
#       "pool": false,
#       "trampoline": false,
#       "dog": false,
#       "dogBreed": ""
#     },
#     "coverage": {
#       "dwellingCoverage": "750000",
#       "liabilityCoverage": "$300,000",
#       "medicalPayments": "",
#       "deductible": "$5,000"
#     },
#     "scheduledItems": {},
#     "insurance": {
#       "effectiveDate": "2026-05-03",
#       "reasonForPolicy": "New property customer to Safeco",
#       "currentlyInsured": "Yes",
#       "propertySameAsMailing": "Yes",
#       "currentInsuranceCompany": "Farmers",
#       "currentPolicyNumber": "",
#       "safecoOriginalPolicyDate": "",
#       "priorSafecoPolicyNumber": "",
#       "ownershipDate": "2000-03-14",
#       "escrowed": false,
#       "insuranceCancelledDeclined": "No",
#       "cancelDeclineDetails": "",
#       "maintenanceCondition": "Very good",
#       "numberOfLosses5Years": "1",
#       "priorCarrierType": "",
#       "numberOfMortgagees": "",
#       "cincinnatiPolicyNumber": "",
#       "priorCarrierName": "",
#       "monthsWithPriorCarrier": 0,
#       "priorCarrierPolicyNumber": "",
#       "priorCarrierExpirationDate": "",
#       "isRollover": "",
#       "rolloverGroup": "",
#       "cincinnatiCurrentlyWritesLine": "",
#       "isSpinOff": "",
#       "isSecondaryHome": "",
#       "isReplacingSecondaryHome": "",
#       "isAgentOfRecord": "",
#       "aorLetterObtained": ""
#     },
#     "updates": {
#       "hvacUpdate": "Yes",
#       "hvacYear": "1999",
#       "plumbingUpdate": "Yes",
#       "plumbingYear": "1999",
#       "roofUpdate": "Yes",
#       "roofYear": "2017",
#       "electricalUpdate": "Yes",
#       "electricalYear": "1999",
#       "circuitBreakers": "Yes",
#       "wiringUpdate": "",
#       "wiringYear": ""
#     }
#   }
# }
