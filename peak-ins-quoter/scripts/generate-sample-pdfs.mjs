import fs from "node:fs";
import path from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function formatLines(title, fields) {
  const lines = [];
  lines.push(title);
  lines.push("Generated sample for Peak Quote extraction");
  lines.push("------------------------------------------------------------");
  for (const [label, value] of fields) {
    lines.push(`${label}: ${value}`);
  }
  return lines;
}

async function createPdf(outPath, title, fields) {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const pageMargin = 42;
  const fontSize = 10.5;
  const lineHeight = 14;

  const lines = formatLines(title, fields);

  let page = pdfDoc.addPage();
  let { width, height } = page.getSize();
  let y = height - pageMargin;

  const drawLine = (text, isTitle = false) => {
    const f = isTitle ? boldFont : font;
    const size = isTitle ? 14 : fontSize;
    page.drawText(text, {
      x: pageMargin,
      y,
      size,
      font: f,
      color: rgb(0, 0, 0),
      maxWidth: width - pageMargin * 2,
    });
    y -= isTitle ? 22 : lineHeight;
  };

  drawLine(lines[0], true);
  for (const line of lines.slice(1)) {
    if (y < pageMargin + 30) {
      page = pdfDoc.addPage();
      ({ width, height } = page.getSize());
      y = height - pageMargin;
    }
    drawLine(line, false);
  }

  const bytes = await pdfDoc.save();
  fs.writeFileSync(outPath, bytes);
}

function buildFields({ firstName, lastName, householdFirstName, householdLastName }) {
  return [
    ["First Name", firstName],
    ["Mufutau", "Mufutau"],

    ["Last Name", lastName],
    ["Knox", "Knox"],

    ["Street Address", "1800 University Blvd"],
    ["City", "BIRMINGHAM"],
    ["State", "AL"],
    ["ZIP Code", "35233"],
    ["Phone", "1111111111"],
    ["Applicant Date of Birth", "2018-08-10"],
    ["Marital Status", "Single"],
    ["Co-Applicant/Spouse Present", "No"],

    // Auto personal (both-type)
    ["Policy Effective Date", "2026-04-30"],
    ["Owner First Name", "AS"],
    ["Owner Last Name", "as"],
    ["Owner Date of Birth", "2026-04-29"],
    ["Street Address (Auto)", "1800 University Blvd"],
    ["Owner Driver's License", "9012348"],
    ["Garaging Address Same as Mailing", "Yes"],
    ["Ride Share Driver (Uber/Lyft)", "Yes"],
    ["Delivery Driver (DoorDash/Instacart)", "Yes"],

    // Additional personal required
    ["Mailing Address", "123 MAPLE ST"],
    ["Term length", "Annually"],
    ["Agent / Producer Name", "JONES, TIMOTHY L"],
    ["Country", "USA"],
    ["Entity", "Individual"],

    // Property required
    ["Year Built", "2013"],
    ["Square Footage", "76"],
    ["Number of Stories", "1"],
    ["Number of Bedrooms", "1"],
    ["Number of Bathrooms", "1"],
    ["Exterior Construction", "Frame"],
    ["Roof Age", "1989"],
    ["Roof Construction", "Asphalt Shingle"],
    ["Foundation Type", "Basement"],
    ["Heat Type", "Gas"],
    ["Dwelling Type", "Single Family"],
    ["Construction Style", "Ranch"],

    // Household (change only name)
    ["Household Member First Name", householdFirstName],
    ["Household Member Last Name", householdLastName],
    ["Suffix", "Jr"],
    ["Date of Birth", "2005-12-04"],
    ["SSN", "987-65-4327"],
    ["Relationship", "Self"],
    ["Marital Status (Household)", "Single"],
    ["Driver's License State", "AL"],
    ["Driver's License Number", "9012341"],

    // Location Detail
    ["Occupancy (Location Detail)", "Primary"],
    ["Is the location Owner-Occupied", "No"],
    ["Is the location Vacant", "No"],
    ["Liability Coverage only", "No"],
    ["Personal Property Only", "No"],

    // Location Information required
    ["Program", "Basic"],
    ["Coverage A", "40000"],
    ["Coverage F", "100,000"],
    ["Personal Injury", "No"],
    ["Coverage G", "5,000"],
    ["Construction", "Frame"],
    ["Foundation", "Open"],
    ["Number Of Families/Units", "1"],
    ["Roofing Material", "Asphalt - Non-Hail Resistive"],
    ["Roof Update Year", "2018"],
    [
      "Is there a Mortgagee, Contract Holder or secured line of credit for this Location?",
      "No",
    ],
    [
      "Is the property used as a boarding or lodging house or for student rentals?",
      "No",
    ],
    ["Is this a student rental?", "No"],
    ["Visible from other dwellings", "No"],
    ["FORTIFIED Home™?", "No"],
    ["Wood/Coal Heating", "No"],
    ["Gated access to dwelling?", "No"],
    ["Is applicant willing to complete a DIY survey for this location?", "No"],
    ["Screened Enclosure?", "No"],
    ["Is the dwelling constructed with material containing asbestos?", "No"],
    ["Flood Zone", "No"],
    ["Coastal Storm Risk Area", "No"],
    ["Is the property located on an island", "No"],
    ["Any dogs owned by the insured around/ kept at the insured location(s)?", "No"],
    ["Specific Breed", "Bullmastiff (Include hybrid/mixes)"],
    ["Any bite history or history of aggressive behavior?", "No"],
    ["Is Location Within A City?", "No"],
    ["Responding Fire Department", "Mollit ad excepturi"],
    ["Community Name", "Eleanor Campos"],
    ["Within 1000 Feet Of Hydrant", "Yes"],
    ["Is there bridge access", "Yes"],
    ["Wind/Hail Deductible", "1500"],
    ["Hurricane Deductible", "5%"],
    ["County", "USA"],
    ["Occupancy (Location Information)", "Primary"],
    ["Territory", "Distinctio Nihil te"],
    ["Ownership", "Married Property"],
    ["All Other Perils Deductible", "1,000"],
    ["Distance to Hydrant (feet)", "93"],
    ["Distance to Fire Station (miles)", "93"],
    ["Protection Class", "Id autem ea do quis"],
    ["Type", "Dwelling"],
    ["Market Value", "2"],

    // Home Coverage + Auto Coverage required
    ["Dwelling Coverage", "Id asperiores distin"],
    ["Liability Coverage", "$100,000"],
    ["Deductible", "$500"],
    ["Bodily Injury (BI)", "15/30"],
    ["Property Damage (PD)", "10"],

    // Policy Questions
    ["Please explain", "Soluta ea pariatur"],
    ["Has any company canceled, refused to write or declined renewal for this applicant", "No"],
    ["Has the applicant had insurance with any Auto-Owners Group Company within the past 5 years", "No"],
    ["Has this applicant filed personal bankruptcy, had repossessions, court judgements or substantially past due mortgage, utility or property tax payments within the past 5 years", "No"],
    ["Has any applicant been convicted of arson", "No"],

    // Insurance Details
    ["Effective Date", "2026-04-30"],
    ["Reason for Policy", "New Purchase"],
    ["Currently Insured", "No - Lapse"],
    ["Number of Losses (5 Years)", "1"],

    // Location Specific Questions
    ["Is the dwelling for sale", "No"],
    ["Is this a new venture (no previous landlord or rental property experience)?", "No"],
    ["Are there any outbuildings on the premises:", "No"],
    ["Any flooding/brush/landslide or unusual hazards:", "No"],
    ["Are dogs allowed?", "No"],
    ["Any animals, other than livestock, not typically regarded as household pets kept on premises?", "No"],
    ["Any uncorrected fire code violations:", "No"],
    ["Difficult access by fire and police departments:", "No"],
    ["Is the dwelling a new purchase", "No"],
    ["Is the dwelling occupied", "Yes"],
    ["Please explain (Location Specific)", "bm,"],
    ["Expected occupancy date", "2009-10-07"],
    ["Is there day care on the premises", "No"],
    ["Is there farming on the premises", "No"],
    ["Is there any other business on the premises", "No"],
    ["Is the building undergoing renovation or reconstruction", "No"],
    ["Have all responses been verified with the applicant?", "Yes"],

    // Occupancy & Use
    ["Dwelling Occupancy", "Owner Occupied"],
    ["Business on Premises", "Yes"],
    ["Short-Term Rental", "Yes"],
    ["Number of Families", "1"],
  ];
}

async function main() {
  const outDir = path.resolve("sample-pdfs");
  ensureDir(outDir);

  const alexFields = buildFields({
    firstName: "Alex",
    lastName: "Knox",
    householdFirstName: "Alex",
    householdLastName: "Hogan",
  });
  const johnFields = buildFields({
    firstName: "John",
    lastName: "Knox",
    householdFirstName: "John",
    householdLastName: "Hogan",
  });

  await createPdf(path.join(outDir, "alex.pdf"), "Alex Sample Fact Finder", alexFields);
  await createPdf(path.join(outDir, "john.pdf"), "John Sample Fact Finder", johnFields);

  console.log("Generated:", path.join(outDir, "alex.pdf"));
  console.log("Generated:", path.join(outDir, "john.pdf"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

