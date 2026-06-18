from .config import *
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
# import undetected_chromedriver as uc
from datetime import datetime
from pathlib import Path
import pyotp
import json
import time


RESULTS_DIR = Path("results")
QUOTES_DIR = Path("quotes")
RESULTS_DIR.mkdir(exist_ok=True)
QUOTES_DIR.mkdir(exist_ok=True)

# -------------------------------------------------
# Helpers
# -------------------------------------------------


def write_result(job_id: str, data: dict):
    with open(RESULTS_DIR / f"{job_id}.json", "w") as f:
        json.dump(data, f, indent=2)


def _select(driver, locator, value, strategy=By.ID, wait=False):
    if wait:
        el = WebDriverWait(driver, 10).until(
            EC.presence_of_element_located((strategy, locator))
        )
    else:
        el = driver.find_element(strategy, locator)
    Select(el).select_by_visible_text(str(value))


def select2(driver, locator, value):
    driver.find_element(By.CSS_SELECTOR, locator).click()
    time.sleep(0.3)
    driver.find_element(
        By.XPATH,
        f"//div[contains(@class,'select2-result-label') and normalize-space()='{value}']",
    ).click()


def run(payload: dict, job_id: str):
    driver = None

    try:
        write_result(job_id, {"status": "running"})
        submission = payload

        options = webdriver.ChromeOptions()
        options.add_argument("--incognito")
        options.add_argument("--start-maximized")

        
        driver = webdriver.Chrome(options=options)
        wait = WebDriverWait(driver, 15)

        # driver = uc.Chrome()
        # driver.get('https://nowsecure.nl')
        
        driver.get(AO_URL)

        wait.until(EC.presence_of_element_located((By.ID, "input_1"))).send_keys(
            AO_USERNAME
        )
        time.sleep(0.5)
        wait.until(
            EC.element_to_be_clickable((By.CSS_SELECTOR, "input[value='Continue']"))
        ).click()
        time.sleep(0.5)
        wait.until(EC.presence_of_element_located((By.ID, "password"))).send_keys(
            AO_PASSWORD
        )
        time.sleep(0.5)
        wait.until(EC.element_to_be_clickable((By.ID, "submit-button"))).click()
        time.sleep(0.5)
        wait.until(EC.presence_of_element_located((By.XPATH, "//a[normalize-space()='Try Another Method']"))).click()
        time.sleep(2)
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "div label#totp-factor-label"))).click()
        time.sleep(1)
        driver.find_element(By.XPATH, "//button[normalize-space()='Continue']").click()
        time.sleep(2)
        wait.until(EC.presence_of_element_located((By.XPATH, "//input[@id='code']"))).send_keys(pyotp.TOTP("B6I2U3DI3WDZ3EHZEL6MVC3U7XTYFDDU").now())
        wait.until(EC.element_to_be_clickable((By.ID, "startProposal"))).click()
        _select(driver, "startProposalProductCode", "Homeowners", wait=True)

        driver.execute_script(
            "arguments[0].value=arguments[1];",
            driver.find_element(By.ID, "startProposalEffectiveDate"),
            datetime.strptime(
                submission.get("home", {})
                .get("insurance", {})
                .get("effectiveDate", ""),
                "%Y-%m-%d",
            ).strftime("%m/%d/%Y"),
        )
        time.sleep(0.5)
        driver.execute_script(
            """
        return document
        .querySelector('start-proposal-ana-combo-button')
        .shadowRoot
        .querySelector('.context-menu-toggle')
        .shadowRoot
        .querySelector('button');
        """
        ).click()
        time.sleep(0.5)
        driver.find_element(By.ID, "startProposalComboButton_replacementCost").click()
        time.sleep(0.5)
        wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "label[for='accepted']"))
        ).click()
        time.sleep(0.5)
        wait.until(
            EC.element_to_be_clickable(
                (By.XPATH, "//button[normalize-space()='Continue']")
            )
        ).click()
        time.sleep(1)
        driver.switch_to.window(driver.window_handles[-1])

        wait.until(EC.presence_of_element_located((By.ID, "firstName"))).send_keys(
            submission.get("personal", {}).get("firstName", "")
        )
        time.sleep(0.5)
        driver.find_element(By.ID, "lastName").send_keys(
            submission.get("personal", {}).get("lastName", "")
        )
        time.sleep(0.5)
        driver.find_element(By.ID, "addressLine1").send_keys(
            submission.get("personal", {}).get("address", {}).get("street", "")
        )
        time.sleep(0.5)
        driver.find_element(By.ID, "city").send_keys(
            submission.get("personal", {}).get("address", {}).get("city", "")
        )
        time.sleep(0.5)
        driver.find_element(By.ID, "zipCode1To5").send_keys(
            submission.get("personal", {}).get("address", {}).get("zipCode", "")
        )
        time.sleep(0.5)
        structure_type = (
            submission.get("home", {})
            .get("property", {})
            .get("structureType", "Dwelling")
        )
        _select(driver, "locStructureType", structure_type)
        time.sleep(0.5)
        same_as_mailing = (
            submission.get("home", {})
            .get("insurance", {})
            .get("propertySameAsMailing", "Yes")
        )
        if same_as_mailing != "No":
            driver.find_element(By.ID, "locSameAsMailingAddress").click()
        else:
            prior = submission.get("personal", {}).get("priorAddress", {})
            if prior:
                driver.find_element(By.ID, "priorAddressLine1").send_keys(
                    prior.get("street", "")
                )
                time.sleep(0.3)
                driver.find_element(By.ID, "priorCity").send_keys(prior.get("city", ""))
                time.sleep(0.3)
                driver.find_element(By.ID, "priorZipCode").send_keys(
                    prior.get("zipCode", "")
                )
                time.sleep(0.3)
        time.sleep(0.5)
        driver.find_element(By.ID, "saveOrUpdateButton").click()
        time.sleep(0.5)

        wait.until(
            EC.element_to_be_clickable((By.LINK_TEXT, "Estimate Replacement Cost"))
        ).click()
        time.sleep(0.5)
        driver.switch_to.window(driver.window_handles[-1])
        time.sleep(4)
        WebDriverWait(driver, 20).until(
            EC.presence_of_element_located((By.NAME, "Sections[0].YearBuilt"))
        )
        select2(
            driver,
            "div.select2-container.homeStyle",
            submission.get("home", {}).get("property", {}).get("homeStyle", ""),
        )
        time.sleep(1)
        driver.find_element(By.NAME, "Sections[0].YearBuilt").send_keys(
            submission.get("home", {}).get("property", {}).get("yearBuilt", "")
        )
        time.sleep(1)
        driver.find_element(By.NAME, "Sections[0].FinishedLivingArea").send_keys(
            submission.get("home", {}).get("property", {}).get("livingArea", "")
        )
        time.sleep(5)
        driver.find_element(By.TAG_NAME, "body").click()
        save_btn = wait.until(EC.element_to_be_clickable((By.ID, "saveBuildingButton")))
        driver.execute_script("arguments[0].click();", save_btn)
        time.sleep(3)

        # RCT Express Page
        wait.until(
            EC.visibility_of_element_located((By.CSS_SELECTOR, ".photoFeed-viewer"))
        )
        driver.execute_script("$rct.PhotoFeed.hide();")
        time.sleep(0.5)
        driver.execute_script("$rct.AerialAssist.hide();")
        time.sleep(1)
        construction_class = (
            submission.get("home", {}).get("property", {}).get("constructionClass", "")
        )
        _select(
            driver,
            "select.ktype",
            construction_class,
            strategy=By.CSS_SELECTOR,
            wait=True,
        )
        time.sleep(3)
        driver.find_element(By.ID, "btn-recalculate-valuation").click()
        time.sleep(5)
        driver.execute_script(
            """
        var elem = document.getElementById('menu_reports');
        elem.dispatchEvent(new Event('mouseover', {bubbles:true}));
        elem.dispatchEvent(new Event('mouseenter', {bubbles:true}));
        """
        )
        driver.find_element(By.ID, "ViewDetailedReport").click()
        time.sleep(3)
        driver.find_element(By.CSS_SELECTOR, "input[value='Finish']").click()
        time.sleep(1)
        wait.until(
            EC.presence_of_element_located((By.ID, "SaveValuationButton"))
        ).click()
        time.sleep(10)
        driver.switch_to.window(driver.window_handles[-1])
        wait.until(
            EC.presence_of_element_located((By.CSS_SELECTOR, "input.F02v4"))
        ).click()
        time.sleep(2)

        result = {
            "status": "completed",
            "job_id": job_id,
            "carrier": "AutoOwners",
            "quote_type": "Homeowners",
            "completed_at": datetime.utcnow().isoformat(),
        }

        write_result(job_id, result)
        return result

    except Exception as e:
        error_result = {
            "status": "failed",
            "job_id": job_id,
            "carrier": "AutoOwners",
            "quote_type": "Homeowners",
            "error": str(e),
            "failed_at": datetime.utcnow().isoformat(),
        }

        write_result(job_id, error_result)
        return error_result

    finally:
        import pdb
        pdb.set_trace()
        if driver:
            driver.quit()



# {
#   "metadata": {
#     "quoteId": "d9914659-00d4-4fb2-a674-4e6209d5f875",
#     "extractionId": "c505e276-e603-4c4e-9520-1a40463aeab1",
#     "userId": "886cffc6-cdd1-4ccf-a1f8-ea3da505c923",
#     "filename": "Quote sheets and tax info.pdf",
#     "submittedAt": "2026-03-06T10:52:54.652Z",
#     "quoteType": "home",
#     "carriers": [
#       "Auto-Owners"
#     ],
#     "version": "1.0.0"
#   },
#   "personal": {
#     "firstName": "Nicholas",
#     "lastName": "Elam",
#     "dateOfBirth": "1991-05-02",
#     "ssn": "",
#     "phone": "(205) 746-5350",
#     "email": "3cc0027@auburn.edu",
#     "maritalStatus": "Married",
#     "gender": "",
#     "occupation": "",
#     "relationshipToInsured": "",
#     "address": {
#       "street": "1512 Tea Rose Cir",
#       "city": "Hoover",
#       "state": "AL - Alabama",
#       "zipCode": "35244",
#       "poBox": ""
#     },
#     "yearsAtCurrentAddress": 0
#   },
#   "home": {
#     "property": {
#       "yearBuilt": 1999,
#       "squareFootage": 1993,
#       "livingArea": 1993,
#       "numberOfStories": 0,
#       "bedroomCount": 3,
#       "bathroomCount": "2",
#       "dwellingType": "Single family dwelling",
#       "structureType": "Dwelling",
#       "homeStyle": "2 Story",
#       "constructionStyle": "2 Story",
#       "constructionClass": "Vintage",
#       "constructionType": "",
#       "exteriorWalls": "",
#       "exteriorFeatures": "",
#       "roofMaterial": "",
#       "roofShape": "",
#       "foundation": "",
#       "heatType": "",
#       "garageType": "Attached",
#       "garageCapacity": "",
#       "purchaseDate": "",
#       "condoOrTownhouse": False,
#       "specialFeatures": "",
#       "dwellingLocatedIn": "",
#       "waterSupplyType": ""
#     },
#     "occupancy": {
#       "dwellingOccupancy": "Owner",
#       "locationType": "",
#       "businessOnPremises": False,
#       "shortTermRental": False,
#       "daysRentedToOthers": "",
#       "numberOfFamilies": 1,
#       "numberOfDrivers": 0,
#       "horsesOrLivestock": ""
#     },
#     "safety": {
#       "alarmSystem": True,
#       "monitoredAlarm": True,
#       "pool": False,
#       "trampoline": False,
#       "dog": False,
#       "dogBreed": ""
#     },
#     "coverage": {
#       "dwellingCoverage": "750000",
#       "liabilityCoverage": "$100,000",
#       "medicalPayments": "$1,000",
#       "deductible": "$5,000"
#     },
#     "scheduledItems": {},
#     "insurance": {
#       "effectiveDate": "2026-04-01",
#       "reasonForPolicy": "",
#       "currentlyInsured": "",
#       "propertySameAsMailing": "Yes",
#       "currentInsuranceCompany": "",
#       "currentPolicyNumber": "",
#       "safecoOriginalPolicyDate": "",
#       "priorSafecoPolicyNumber": "",
#       "ownershipDate": "",
#       "escrowed": False,
#       "insuranceCancelledDeclined": "No",
#       "cancelDeclineDetails": "",
#       "maintenanceCondition": "",
#       "numberOfLosses5Years": "",
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
#     },
#     "claimsHistory": {
#       "claims": [
#         {
#           "date": "2020-06-12",
#           "type": "Water Damage",
#           "description": "Water claim on 06/12/20, amount 80",
#           "amount": "80"
#         }
#       ]
#     }
#   }
# }