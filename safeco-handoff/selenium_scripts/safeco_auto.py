from .config import *
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from datetime import datetime
from pathlib import Path
import json
import time
import re
import pdb

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

def main():
    try:
        # write_result(job_id, {"status": "running"})
        # submission = payload

        opts = webdriver.ChromeOptions()
        opts.add_argument(f"--user-data-dir={PROJECT_ROOT}\\safeco")
        opts.add_argument("--profile-directory=Default")
        
        # PDF Download and Printing Settings
        prefs = {
            "download.default_directory": str(QUOTES_DIR.resolve()),
            "download.prompt_for_download": False,
            "download.directory_upgrade": True,
            "plugins.always_open_pdf_externally": True  # This disables the Chrome PDF Viewer
        }
        opts.add_experimental_option("prefs", prefs)
        opts.add_argument("--kiosk-printing") # Automatically clicks print in the print preview

        driver = webdriver.Chrome(options=opts)
        wait = WebDriverWait(driver, 30)

        driver.get(SAFECO_URL)
        wait.until(EC.presence_of_element_located((By.ID, "username"))).send_keys(SAFECO_USERNAME)
        driver.find_element(By.ID, "password").send_keys(SAFECO_PASSWORD)
        driver.find_element(By.ID, "submit1").click()
        
        time.sleep(1)
        driver.get("https://personal.safeco.com/personal/Auto/policyinfo.aspx?ModeID=2&amp;RatingState=AL")

        _select(
            driver,
            "PolicyRatingState",
            "Alabama",
            wait=True
        )
        driver.find_element(By.ID, "PolicyEffectiveDate").send_keys(
            datetime.strptime(
                "2026-04-01", "%Y-%m-%d"
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

        # Applicant Information
        driver.find_element(By.ID, "PolicyClientPersonFirstName").send_keys(
            "Nicholas"
        )
        driver.find_element(By.ID, "PolicyClientPersonLastName").send_keys(
            "Elam"
        )
        _select(driver, "PolicyClientPersonMaritalStatus", "Married")
        driver.find_element(By.ID, "PolicyClientPersonBirthdate").send_keys(
            datetime.strptime(
                "1991-05-02", "%Y-%m-%d"
            ).strftime("%m/%d/%Y")
        )

        phone = "(205) 746-5350"
        if phone:
            digits = re.sub(r"\D", "", phone)
            area, prefix, line = digits[:3], digits[3:6], digits[6:]
            driver.find_element(By.NAME, "PolicyClientHomePhoneNumberAreaCode").send_keys(area)
            driver.find_element(By.NAME, "PolicyClientHomePhoneNumberPrefix").send_keys(prefix)
            driver.find_element(By.NAME, "PolicyClientHomePhoneNumberSuffix").send_keys(line)

        email = "sec0027@auburn.edu"
        if email:
            driver.find_element(By.NAME, "PolicyClientEmailAddress").send_keys(email)
        time.sleep(0.5)
        
        driver.find_element(By.ID, "PolicyClientMailingLocationAddressLine1").send_keys("1512 Tea Rose Cir")
        time.sleep(0.5)
        driver.find_element(By.ID, "PolicyClientMailingLocationZipCode").send_keys("35244")
        time.sleep(0.5)
        driver.find_element(By.ID, "PolicyClientMailingLocationCity").send_keys("Hoover")
        time.sleep(0.5)
        _select(driver,"PolicyClientMailingLocationState", "Alabama")
        time.sleep(0.5)
        same_as_garage_address = "Yes"
        same_as_garage_address_yes = _is_yes(same_as_garage_address)
        driver.find_element(
            By.CSS_SELECTOR,
            f"label[for='PolicyHomeDataLocationSameAsMailingYN{'Y' if same_as_garage_address_yes else 'N'}']"
        ).click()
        
        _select(driver,"PolicyAutoDataAutoBusinessType", "New Auto Customer to Safeco (Coverage has not been provided by a Safeco Company)")

        reportable_incidents = "No"
        reportable_incidents_yes = _is_yes(reportable_incidents)
        driver.find_element(
            By.CSS_SELECTOR,
            f"label[for='PolicyAutoDataAnyIncidentsOnPolicyYN{'Y' if reportable_incidents_yes else 'N'}']"
        ).click()

        user_for_delivery = "No"
        user_for_delivery_yes = _is_yes(user_for_delivery)
        driver.find_element(
            By.CSS_SELECTOR,
            f"label[for='PolicyAutoDataDeliveryVehicleYN{'Y' if user_for_delivery_yes else 'N'}']"
        ).click()

        driver.find_element(By.ID, "Continue").click()
        # Find the most recent PDF in quotes directory
        # pdf_files = list(QUOTES_DIR.glob("*.pdf"))
        # if pdf_files:
        #     latest_pdf = max(pdf_files, key=lambda p: p.stat().st_mtime)
        #     pdf_path = QUOTES_DIR / f"Safeco_{job_id}.pdf"
        #     latest_pdf.rename(pdf_path)
        # else:
        #     pdf_path = None

        # result = {
        #     "status": "completed",
        #     "job_id": job_id,
        #     "carrier": "Safeco",
        #     "quote_type": "Autoowners",
        #     "pdf_path": str(pdf_path) if pdf_path else None,
        #     "completed_at": datetime.utcnow().isoformat()
        # }

    except Exception as e:
            print(f"Error: {e}")
    finally:
        pdb.set_trace()
        driver.quit()
if __name__ == "__main__":
    main()
    

    # except Exception as e:
    #     error_result = {
    #         "status": "failed",
    #         "job_id": job_id,
    #         "carrier": "Safeco",
    #         "quote_type": "Autoowners",
    #         "error": repr(e),
    #         "failed_at": datetime.utcnow().isoformat()
    #     }

    #     # write_result(job_id, error_result)
    #     return error_result

    # finally:
    #     pdb.set_trace()
    #     if driver:
    #         driver.quit()
