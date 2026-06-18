from .config import *
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.support.ui import WebDriverWait, Select
from selenium.webdriver.support import expected_conditions as EC
from datetime import datetime
from pathlib import Path
import json
import time
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

def _select(driver, locator, value, strategy=By.ID, wait=False):
    if wait: el = WebDriverWait(driver, 10).until(EC.presence_of_element_located((strategy, locator)))
    else: el = driver.find_element(strategy, locator)
    Select(el).select_by_visible_text(str(value))

def run(payload: dict, job_id: str):
    driver = None

# def main():
    try:
        write_result(job_id, {"status": "running"})
        submission = payload

        opts = webdriver.ChromeOptions()
        opts.add_argument(f"--user-data-dir={PROJECT_ROOT}\\cincinnati")
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

        driver.get(CINC_URL)
        wait.until(EC.presence_of_element_located((By.NAME, "username"))).send_keys(CINC_USERNAME)
        time.sleep(0.5)
        driver.find_element(By.NAME, "password").send_keys(CINC_PASSWORD)
        time.sleep(0.5)
        driver.find_element(By.CSS_SELECTOR, "button.btn.btn--primary-white.login-icon").click()
        time.sleep(3)
        wait.until(EC.presence_of_element_located((By.ID, "tool_Personal Lines Processing "))).click()
        time.sleep(1)
        driver.switch_to.window(driver.window_handles[-1])
        time.sleep(5)
        WebDriverWait(driver, 10).until(EC.invisibility_of_element_located((By.CSS_SELECTOR, "div.cdk-overlay-backdrop")))
        driver.get("https://cincilink.cinfin.com/PLUX/client/new-policy-client-lookup?IID=1")
        time.sleep(1)
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "button[data-name='Continue_button']"))).click()
        time.sleep(0.5)

        # Register new client
        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[data-name='firstname_inputrow_div_formField_input']"))).send_keys(submission.get("personal", {}).get("firstName", "John"))
        driver.find_element(By.CSS_SELECTOR, "input[data-name='lastname_inputrow_div_formField_input']").send_keys(submission.get("personal", {}).get("lastName", "Doe"))
        driver.find_element(By.XPATH, "//mat-label[normalize-space()='Marital Status']/ancestor::mat-form-field//mat-select").click()
        time.sleep(0.5)
        wait.until(EC.element_to_be_clickable((By.XPATH, f"//mat-option//span[normalize-space()='{submission.get('personal', {}).get('maritalStatus')}']"))).click()
        time.sleep(0.5)
        dob = submission.get("personal", {}).get("dateOfBirth", "")
        if dob:
            driver.find_element(By.CSS_SELECTOR, "input[data-name='DOB_datePicker']").send_keys(
                datetime.strptime(dob, "%Y-%m-%d").strftime("%m%d%Y")
            )
        time.sleep(0.5)
        
        driver.find_element(By.XPATH,"//mat-label[normalize-space()='DL Number']/ancestor::mat-form-field//input").send_keys("7876232")

        phone = submission.get("personal", {}).get("phone", "")
        if phone:
            phone_digits = "".join(filter(str.isdigit, phone))
            driver.find_element(By.CSS_SELECTOR, "input[data-name='personal_mobilephone_inputrow_div_formField_input']").send_keys(phone_digits)
            time.sleep(0.5)
        
        email = submission.get("personal", {}).get("email", "")
        if email:
            driver.find_element(By.CSS_SELECTOR, "input[data-name='emailaddress_inputrow_div_formField_input']").send_keys(email)
            time.sleep(0.5)
            
        occupation = submission.get("personal", {}).get("occupation", "")
        if occupation:
            driver.find_element(By.CSS_SELECTOR, "input[data-name='persoanl_occupation_inputrow_div_formField_input']").send_keys(occupation)
            time.sleep(0.5)

        # Spouse / Co-Applicant (Policyholder 2)
        spouse_first_name = submission.get("personal", {}).get("spouseFirstName", "")
        if spouse_first_name:
            driver.find_elements(By.CSS_SELECTOR, "input[data-name='firstname_inputrow_div_formField_input']")[1].send_keys(spouse_first_name)
            time.sleep(0.5)
            driver.find_elements(By.CSS_SELECTOR, "input[data-name='lastname_inputrow_div_formField_input']")[1].send_keys(submission.get("personal", {}).get("spouseLastName", ""))
            time.sleep(0.5)
            spouse_dob = submission.get("personal", {}).get("spouseDateOfBirth", "")
            if spouse_dob:
                driver.find_elements(By.CSS_SELECTOR, "input[data-name='DOB_datePicker']")[1].send_keys(
                    datetime.strptime(spouse_dob, "%Y-%m-%d").strftime("%m%d%Y")
                )
            time.sleep(0.5)
            spouse_occ = submission.get("personal", {}).get("spouseOccupation", "")
            if spouse_occ:
                driver.find_elements(By.CSS_SELECTOR, "input[data-name='persoanl_occupation_inputrow_div_formField_input']")[1].send_keys(spouse_occ)
                time.sleep(3)

        btn = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[data-name='Continue_button']")))
        driver.execute_script("arguments[0].click();", btn)
        time.sleep(0.5)

        wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[data-name='streetNameInput']"))).send_keys(submission.get("personal", {}).get("address", {}).get("street", ""))
        time.sleep(0.5)
        po_box = submission.get("personal", {}).get("address", {}).get("poBox", "")
        if po_box:
            driver.find_element(By.XPATH, "//mat-label[normalize-space()='P.O. Box']/ancestor::mat-form-field//input").send_keys(po_box)
            time.sleep(0.5)

        driver.find_element(By.XPATH, "//mat-label[normalize-space()='City']/ancestor::mat-form-field//input").send_keys(submission.get("personal", {}).get("address", {}).get("city", ""))
        time.sleep(0.5)

        wait.until(
            EC.element_to_be_clickable(
                (By.CSS_SELECTOR, "mat-select[data-name='stateInput']")
            )
        ).click()
        time.sleep(0.5)
        state_code = submission.get("personal", {}).get("address", {}).get("state", "").split(" - ")[0]
        wait.until(EC.presence_of_element_located((By.XPATH, f"//mat-option[contains(., '{state_code}')]"))).click()
        time.sleep(0.5)

        driver.find_element(By.CSS_SELECTOR, "input[data-name='zipInput']").send_keys(submission.get("personal", {}).get("address", {}).get("zipCode", ""))
        time.sleep(4)

        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
        wait.until(EC.element_to_be_clickable((By.CLASS_NAME, "btn-primary"))).click()
        time.sleep(3)
        button_1 = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[data-name='Continue_button']")))
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", button_1)
        time.sleep(1)
        button_1.click()

        wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "span[data-name='Auto_span'] input[type='checkbox']"))).click()
        time.sleep(1)
        
        button_2 = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[data-name='Continue_button']")))
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", button_2)
        time.sleep(1)
        button_2.click()

        eff_date = submission.get("home", {}).get("insurance", {}).get("effectiveDate", "")
        el = wait.until(
            EC.presence_of_element_located(
                (By.CSS_SELECTOR, "input[data-name='PolicyEffDate3']")
            )
        )
        el.clear()
        time.sleep(1)
        if eff_date:
            formatted_date = datetime.strptime(eff_date, "%Y-%m-%d").strftime("%m%d%Y")
            el.send_keys(formatted_date)
        time.sleep(5)
        
        driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")

        # Prior Carrier selection
        ins_data = submission.get("home", {}).get("insurance", {})
        prior_type = ins_data.get("priorCarrierType", "")
        prior_insurance_selector = {
            "The Cincinnati Insurance Companies": "mat-radio-button[data-name='TheCincinnatiInsuranceCompanies']",
            "Another Carrier": "mat-radio-button[data-name='Another Carrier']",
            "No Prior Insurance": "mat-radio-button[data-name='NoPriorInsurance']"
        }
        
        if prior_type in prior_insurance_selector:
            wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, prior_insurance_selector[prior_type]))).find_element(By.CSS_SELECTOR, "input").click()
            time.sleep(2)

        if "Cincinnati" in prior_type:
            policy_num = ins_data.get("cincinnatiPolicyNumber", "")
            if policy_num:
                wait.until(EC.presence_of_element_located((By.CSS_SELECTOR, "input[data-name='policynumber_input']"))).send_keys(policy_num)
            
            # New Underwriting Questions (These appear when Cincinnati is selected)
            # 1. Line of Business write
            writes_line = ins_data.get("cincinnatiCurrentlyWritesLine", "No")
            driver.find_element(By.XPATH, f"//mat-radio-group[contains(.,'Does the Cincinnati Insurance Company currently write')]//mat-radio-button[contains(.,'{writes_line}')]").click()
            time.sleep(0.5)

            if writes_line == "No":
                is_spin_off = ins_data.get("isSpinOff", "No")
                driver.find_element(By.XPATH, f"//mat-radio-group[contains(.,'insured being spun off')]//mat-radio-button[contains(.,'{is_spin_off}')]").click()
                time.sleep(0.5)

                if is_spin_off == "No":
                    is_secondary = ins_data.get("isSecondaryHome", "No")
                    driver.find_element(By.XPATH, f"//mat-radio-group[contains(.,'Is this a secondary home?')]//mat-radio-button[contains(.,'{is_secondary}')]").click()
                    time.sleep(0.5)

                    if is_secondary == "Yes":
                        is_replacing = ins_data.get("isReplacingSecondaryHome", "No")
                        driver.find_element(By.XPATH, f"//mat-radio-group[contains(.,'replacing another secondary home')]//mat-radio-button[contains(.,'{is_replacing}')]").click()
                        time.sleep(0.5)

            # 2. Agent of Record
            is_aor = ins_data.get("isAgentOfRecord", "No")
            driver.find_element(By.XPATH, f"//mat-radio-group[contains(.,'Is this an Agent of Record Policy')]//mat-radio-button[contains(.,'{is_aor}')]").click()
            time.sleep(0.5)

            if is_aor == "Yes":
                aor_letter = ins_data.get("aorLetterObtained", "No")
                driver.find_element(By.XPATH, f"//mat-radio-group[contains(.,'Agent of Record Letter been obtained')]//mat-radio-button[contains(.,'{aor_letter}')]").click()
                time.sleep(0.5)
        
        elif "Another Carrier" in prior_type:
            wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "mat-radio-button[data-name='Another Carrier']"))).click()
            time.sleep(2)
            
        else: # No Prior Insurance
            wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "mat-radio-button[data-name='NoPriorInsurance']"))).click()
            time.sleep(2)

        button = wait.until(EC.element_to_be_clickable((By.CSS_SELECTOR, "button[data-name='Continue']")))
        driver.execute_script("arguments[0].scrollIntoView({block: 'center'});", button)
        time.sleep(2)
        button.click()
        


        # Find the most recent PDF in quotes directory
        pdf_files = list(QUOTES_DIR.glob("*.pdf"))
        if pdf_files:
            latest_pdf = max(pdf_files, key=lambda p: p.stat().st_mtime)
            pdf_path = QUOTES_DIR / f"Cincinnati_{job_id}.pdf"
            latest_pdf.rename(pdf_path)
        else:
            pdf_path = None

        result = {
            "status": "completed",
            "job_id": job_id,
            "carrier": "Cincinnati",
            "quote_type": "Autoowners",
            "pdf_path": str(pdf_path) if pdf_path else None,
            "completed_at": datetime.utcnow().isoformat()
        }
    # except Exception as e:
    #     print(f"Error: {e}")
    # finally:
    #     pdb.set_trace()
    #     driver.quit()
# if __name__ == "__main__":
#     main()

    except Exception as e:
        error_result = {
            "status": "failed",
            "job_id": job_id,
            "carrier": "Cincinnati",
            "quote_type": "Autoowners",
            "error": repr(e),
            "failed_at": datetime.utcnow().isoformat()
        }

        # write_result(job_id, error_result)
        return error_result

    finally:
        pdb.set_trace()
        if driver:
            driver.quit()
