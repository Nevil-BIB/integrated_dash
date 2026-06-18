require("dotenv").config();
const speakeasy = require("speakeasy");
const { chromium } = require("playwright");

function must(value, name) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function toMMDDYYYY(input) {
  if (!input) return "";
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(input)) return input;
  const [y, m, d] = String(input).split("-");
  if (!y || !m || !d) return String(input);
  return `${m.padStart(2, "0")}/${d.padStart(2, "0")}/${y}`;
}

function digitsOnly(v) {
  return String(v || "").replace(/\D/g, "");
}

async function visible(page, selectors) {
  for (const s of selectors) {
    const loc = page.locator(s).first();
    if ((await loc.count()) > 0 && (await loc.isVisible().catch(() => false))) return loc;
  }
  return null;
}

async function click(page, selectors, required = true) {
  const loc = await visible(page, selectors);
  if (!loc) {
    if (required) throw new Error(`Element not found: ${selectors.join(" | ")}`);
    return false;
  }
  await loc.click();
  return true;
}

async function fill(page, selectors, value) {
  const loc = await visible(page, selectors);
  if (!loc) throw new Error(`Field not found: ${selectors.join(" | ")}`);
  await loc.click();
  await loc.press("Control+A");
  await loc.press("Backspace");
  await loc.type(String(value ?? ""));
  await loc.press("Tab");
}

async function select(page, selectors, value) {
  for (const s of selectors) {
    const loc = page.locator(s).first();
    if ((await loc.count()) > 0) {
      await loc.selectOption({ label: String(value) }).catch(async () => {
        await loc.selectOption(String(value));
      });
      return;
    }
  }
  throw new Error(`Dropdown not found: ${selectors.join(" | ")}`);
}

function hasValue(value) {
  return value !== undefined && value !== null && String(value).trim() !== "";
}

async function fillIfPresent(page, selectors, value) {
  if (!hasValue(value)) return false;
  const loc = await visible(page, selectors);
  if (!loc) return false;
  await fill(page, selectors, String(value));
  return true;
}

async function selectIfPresent(page, selectors, value) {
  if (!hasValue(value)) return false;
  const loc = await visible(page, selectors);
  if (!loc) return false;
  await select(page, selectors, String(value));
  return true;
}

async function loginBlock(page) {
  const username = must(process.env.AUTO_OWNERS_USERNAME, "AUTO_OWNERS_USERNAME");
  const password = must(process.env.AUTO_OWNERS_PASSWORD, "AUTO_OWNERS_PASSWORD");
  const totpSecret = must(process.env.AUTO_OWNERS_TOTP_SECRET, "AUTO_OWNERS_TOTP_SECRET");

  await page.goto("https://www.aoins.com/my.policy", { waitUntil: "domcontentloaded" });
  await click(page, ['button:has-text("Accept")', 'button:has-text("I Accept")', "text=Accept"], false);
  await fill(page, ['input[name="username"]', 'input[type="email"]'], username);

  // AO often uses partial transitions (no full refresh). Keep nudging the username step
  // and poll until password field appears.
  let passwordInput = null;
  for (let i = 0; i < 8; i += 1) {
    passwordInput = await visible(page, [
      'input[name="password"]',
      'input[type="password"]',
      'input[id*="password"]',
      'input[aria-label*="password" i]',
    ]);
    if (passwordInput) break;

    // Try advancing the step again if still on username screen.
    await click(
      page,
      [
        'button:has-text("Continue")',
        'button:has-text("Next")',
        'button:has-text("Sign in")',
        'button[type="submit"]',
      ],
      false
    );
    await page.waitForTimeout(1200);
  }
  if (!passwordInput) {
    throw new Error("Password screen did not appear after username step.");
  }

  await fill(page, ['input[name="password"]', 'input[type="password"]'], password);
  await click(page, ['button[type="submit"]', 'button:has-text("Login")', 'button:has-text("Sign In")'], false);
  await page.waitForTimeout(3000);

  const tryAnother = await click(page, ['text=/Try Another Method/i'], false);
  if (tryAnother) {
    const switched = await click(page, ['text=/Authenticator App/i'], false);
    if (!switched) throw new Error("Try Another Method worked but Authenticator App option missing.");
  }

  const otpInput = await visible(page, ['input[name*="otp"]', 'input[name*="code"]', 'input[type="tel"]']);
  if (otpInput) {
    const token = speakeasy.totp({ secret: totpSecret, encoding: "base32" });
    await otpInput.fill(token);
    await click(page, ['button:has-text("Verify")', 'button:has-text("Continue")', 'button[type="submit"]'], false);
  }
}

async function startNewBusinessBlock(page, payload) {
  await click(page, ['text=/Line of Business/i']);
  await click(page, ['text=/Dwelling Fire/i']);
  await fill(page, ['input[name="namedInsured"]'], `${payload.firstName} ${payload.lastName}`);
  await select(page, ['select[name="entityType"]'], payload.entity);
  await fill(page, ['input[name="effectiveDate"]'], toMMDDYYYY(payload.insuranceDetails?.effectiveDate));
  await click(page, ['button:has-text("Start New Business")', "text=Start New Business"]);
}

async function checkScoreDisclosureBlock(page) {
  const modal = await visible(page, ['text=/Score Disclosure/i']);
  if (!modal) return;
  for (let i = 0; i < 3; i += 1) {
    await click(page, ['input[type="checkbox"]', 'label:has-text("I understand")'], false);
    const done = await click(page, ['button:has-text("Continue")'], false);
    if (done) return;
  }
  throw new Error("Score Disclosure modal present but could not be acknowledged.");
}

async function attemptFireDwellingQuoteBlock(page, payload) {
  await fill(page, ['input[name="firstName"]'], payload.firstName);
  await fill(page, ['input[name="lastName"]'], payload.lastName);
  await fill(page, ['input[name="address"]'], payload.mailingAddress);
  await fill(page, ['input[name="city"]'], payload.city);
  await select(page, ['select[name="state"]'], payload.state);
  await fill(page, ['input[name="zip"]'], payload.zipCode);
  await fill(page, ['input[name="phone"]'], digitsOnly(payload.phone));
  await fill(page, ['input[name="email"]'], payload.email);
  await select(page, ['select[name="termLength"]'], payload.termLength);
  await select(page, ['select[name="agent"]'], payload.agentProducerName).catch(() =>
    select(page, ['select[name="agent"]'], "NOT LISTED")
  );
  await select(page, ['select[name="losses5Years"]'], payload.numberOfLosses5Years === "0" ? "None" : payload.numberOfLosses5Years);
  await click(page, ['button:has-text("Continue")', 'button:has-text("Next")']);
}

async function fillHouseholdMemberBlock(page, payload) {
  await click(page, ['[role="tab"]:has-text("Household Member")', 'text=/Household Member/i'], false);
  await fill(page, ['input[name="hh_firstName"]'], payload.householdMember.firstName);
  await fill(page, ['input[name="hh_lastName"]'], payload.householdMember.lastName);
  if (payload.householdMember.suffix) await fill(page, ['input[name="hh_suffix"]'], payload.householdMember.suffix);
  await fill(page, ['input[name="dob"]'], payload.householdMember.dob);
  await fill(page, ['input[name="ssn"]'], payload.householdMember.ssn);
  await select(page, ['select[name="relationship"]'], payload.householdMember.relationship);
  await select(page, ['select[name="maritalStatus"]'], payload.householdMember.maritalStatus);
  await select(page, ['select[name="dlState"]'], payload.state);
  await fill(page, ['input[name="dlNumber"]'], payload.householdMember.dlNumber);
  await click(page, ['button:has-text("Save")', "text=Save"]);
  await click(page, ['button:has-text("Continue")', "text=Continue"]);
}

async function handleInsuranceScoreBlock(page) {
  await click(page, ['[role="tab"]:has-text("Insurance Score")', 'text=/Insurance Score/i'], false);
  const noScore = await click(page, ['label:has-text("No Score")', 'text=/No Score/i'], false);
  if (!noScore) throw new Error("No Score option missing on Insurance Score page.");
  await click(page, ['button:has-text("Continue")', "text=Continue"]);
}

async function locationBlock(page, payload) {
  let locationReady = await visible(page, ['text=/No valid locations were found/i', 'text=/Add Location/i']);
  if (!locationReady) {
    await click(page, ['[role="tab"]:has-text("Location")', '[role="tab"]:has-text("Location(s)")', 'text=/Location/i'], false);
    await page.waitForTimeout(3000);
    locationReady = await visible(page, ['text=/No valid locations were found/i', 'text=/Add Location/i']);
  }
  if (!locationReady) throw new Error("Location page not properly loaded.");

  const sameAsMailing = await click(page, ['label:has-text("Same as mailing address")', 'text=/Same as mailing address/i'], false);
  if (!sameAsMailing) {
    await fill(page, ['input[name="address"]', 'input[name="streetAddress"]'], payload.streetAddress);
    await fill(page, ['input[name="city"]'], payload.city);
    await select(page, ['select[name="state"]'], payload.state);
    await fill(page, ['input[name="zip"]', 'input[name="zipCode"]'], payload.zipCode);
  }

  await selectIfPresent(page, ['select[name="occupancy"]', 'select[name="locationOccupancy"]'], payload.locationOccupancy || "Primary");
  await selectIfPresent(page, ['select[name="ownerOccupied"]'], payload.ownerOccupied ? "Yes" : "No");
  await selectIfPresent(page, ['select[name="vacant"]'], payload.vacant ? "Yes" : "No");
  await selectIfPresent(
    page,
    ['select[name="liabilityCoverageOnly"]'],
    payload.liabilityCoverageOnly ? "Yes" : "No"
  );

  await click(page, ['button:has-text("Save")', "text=Save"]);
  await page.waitForTimeout(2500);
  await click(page, ['button:has-text("Continue")', "text=Continue"]);
}

async function keepSessionAliveIfNeeded(page) {
  const modal = await visible(page, ['text=/Session Expiring/i', 'text=/inactive/i', 'text=/sign-out warning/i']);
  if (!modal) return;
  await click(page, ['button:has-text("Stay Signed In")'], false);
}

async function locationInformationBlock(page, payload) {
  await keepSessionAliveIfNeeded(page);
  let sectionVisible = await visible(page, [
    'text=/Program/i',
    'text=/Coverage F/i',
    'text=/Construction Year/i',
    'text=/Responding Fire Department/i',
  ]);
  if (!sectionVisible) {
    await click(page, ['[role="tab"]:has-text("Information")', 'text=/Information/i'], false);
    await page.waitForTimeout(8000);
    await keepSessionAliveIfNeeded(page);
    sectionVisible = await visible(page, ['text=/Program/i', 'text=/Coverage F/i']);
    if (!sectionVisible) {
      await click(page, ['[role="tab"]:has-text("Information")', 'text=/Information/i'], false);
      await page.waitForTimeout(8000);
    }
  }

  const fieldMap = [
    ["program", payload.program],
    ["type", payload.type],
    ["coverageF", payload.coverageF],
    ["personalInjury", payload.personalInjury],
    ["coverageG", payload.coverageG],
    ["constructionYear", payload.constructionYear],
    ["construction", payload.construction],
    ["foundation", payload.foundation],
    ["finishedLivingArea", payload.finishedLivingArea],
    ["numberOfFamiliesUnits", payload.numberOfFamiliesUnits],
    ["replacementCost100", payload.replacementCost100],
    ["roofLossSettlementWindstormHail", payload.roofLossSettlementWindstormHail],
    ["marketValue", payload.marketValue],
    ["boardingOrLodgingOrStudentRentals", payload.boardingOrLodgingOrStudentRentals],
    ["visibleFromOtherDwellings", payload.visibleFromOtherDwellings],
    ["floodZone", payload.floodZone],
    ["coastalStormRiskArea", payload.coastalStormRiskArea],
    ["locatedOnIsland", payload.locatedOnIsland],
    ["conditionOfDwelling", payload.conditionOfDwelling],
    ["dogsOwnedOrKept", payload.dogsOwnedOrKept],
    ["specificBreed", payload.specificBreed],
    ["biteHistoryAggressiveBehavior", payload.biteHistoryAggressiveBehavior],
    ["isLocationWithinCity", payload.isLocationWithinCity],
    ["respondingFireDepartment", payload.respondingFireDepartment],
    ["communityName", payload.communityName],
    ["within1000FeetOfHydrant", payload.within1000FeetOfHydrant],
    ["bridgeAccess", payload.bridgeAccess],
    ["county", payload.county],
    ["locationInformationOccupancy", payload.locationInformationOccupancy],
    ["territory", payload.territory],
    ["ownership", payload.ownership],
    ["allOtherPerilsDeductible", payload.allOtherPerilsDeductible],
    ["distanceToHydrantFeet", payload.distanceToHydrantFeet],
    ["distanceToFireStationMiles", payload.distanceToFireStationMiles],
    ["protectionClass", payload.protectionClass],
  ];

  for (const [name, value] of fieldMap) {
    await keepSessionAliveIfNeeded(page);
    const selectDone = await selectIfPresent(page, [`select[name="${name}"]`], value);
    if (!selectDone) await fillIfPresent(page, [`input[name="${name}"]`, `textarea[name="${name}"]`], value);
  }

  await click(page, ['button:has-text("Continue")', "text=Continue"]);
  await page.waitForTimeout(5000);
  let progressed = await visible(page, ['[role="tab"][aria-selected="true"]:has-text("Information Continued")', '[role="tab"][aria-selected="true"]:has-text("Additional Interests")']);
  if (!progressed) {
    await click(page, ['button:has-text("Continue")', "text=Continue"], false);
    await page.waitForTimeout(8000);
    progressed = await visible(page, ['[role="tab"][aria-selected="true"]:has-text("Information Continued")', '[role="tab"][aria-selected="true"]:has-text("Additional Interests")']);
  }
  if (!progressed) {
    await click(page, ['[role="tab"]:has-text("Information Continued")'], false);
    await page.waitForTimeout(4000);
    progressed = await visible(page, ['[role="tab"][aria-selected="true"]:has-text("Information Continued")', '[role="tab"][aria-selected="true"]:has-text("Additional Interests")']);
  }
  if (!progressed) throw new Error("Location Information page transition failed after retries.");
}

async function informationContinuedBlock(page, payload) {
  let active = await visible(page, ['[role="tab"][aria-selected="true"]:has-text("Information Continued")']);
  if (!active) {
    await click(page, ['[role="tab"]:has-text("Information Continued")', 'text=/Information Continued/i'], false);
    await page.waitForTimeout(8000);
    active = await visible(page, ['[role="tab"][aria-selected="true"]:has-text("Information Continued")']);
    if (!active) {
      await click(page, ['[role="tab"]:has-text("Information Continued")', 'text=/Information Continued/i'], false);
      await page.waitForTimeout(8000);
    }
  }

  const fieldMap = [
    ["roofYear", payload.roofYear],
    ["roofMaterial", payload.roofMaterial],
    ["roofShape", payload.roofShape],
    ["heatingType", payload.heatingType],
    ["plumbingType", payload.plumbingType],
    ["electricalType", payload.electricalType],
    ["numberOfStories", payload.numberOfStories],
    ["garageType", payload.garageType],
    ["swimmingPool", payload.swimmingPool],
    ["trampoline", payload.trampoline],
    ["burglarAlarm", payload.burglarAlarm],
    ["fireAlarm", payload.fireAlarm],
    ["sprinklerSystem", payload.sprinklerSystem],
    ["gatedCommunity", payload.gatedCommunity],
  ];
  for (const [name, value] of fieldMap) {
    const selectDone = await selectIfPresent(page, [`select[name="${name}"]`], value);
    if (!selectDone) await fillIfPresent(page, [`input[name="${name}"]`, `textarea[name="${name}"]`], value);
  }

  await click(page, ['button:has-text("Continue")', "text=Continue"]);
  await page.waitForTimeout(5000);
  let progressed = await visible(page, ['[role="tab"][aria-selected="true"]:has-text("Additional Interests")']);
  if (!progressed) {
    await click(page, ['button:has-text("Continue")', "text=Continue"], false);
    await page.waitForTimeout(8000);
    progressed = await visible(page, ['[role="tab"][aria-selected="true"]:has-text("Additional Interests")']);
  }
  if (!progressed) {
    await click(page, ['[role="tab"]:has-text("Additional Interests")'], false);
    await page.waitForTimeout(4000);
  }
}

async function runAutoOwnersFlow(payload) {
  const browser = await chromium.launch({ headless: false, slowMo: 80 });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();

    await loginBlock(page);
    await startNewBusinessBlock(page, payload);
    await checkScoreDisclosureBlock(page);
    await attemptFireDwellingQuoteBlock(page, payload);
    await fillHouseholdMemberBlock(page, payload);
    await handleInsuranceScoreBlock(page);
    await locationBlock(page, payload);
    await locationInformationBlock(page, payload);
    await informationContinuedBlock(page, payload);

    await page.waitForTimeout(10000);
  } finally {
    await browser.close();
  }
}

module.exports = { runAutoOwnersFlow };
