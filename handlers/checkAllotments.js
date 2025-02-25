const { REGISTRAR } = require("../static/static");
const { Company } = require("../schema/company.schema");
// const { Pan } = require("../schema/panCards.schema");
const { Allocation } = require("../schema/allocation.schema");
const { checkPanWithBigshare } = require("./helpers/bigshare");
const { checkPanWithCameo } = require("./helpers/cameo");
const { checkPanWithLinkintime } = require("./helpers/linkintime");
const { checkPanWithMaashitla } = require("./helpers/maashitla");
const { checkPanWithKifntech } = require("./helpers/kfintech");

async function checkAllotments(req, res) {
  try {
    const { companyId } = req.params;
    const { pans } = req.body;
    if (!companyId || !pans || pans.length == 0) {
      res.status(400).json({ message: "enter company to check allotment for" });
      return;
    }
    // checking company if exists
    const company = await Company.findOne({ _id: companyId }).lean();
    if (!company) {
      res.status(400).json({ message: "could not find the company" });
      return;
    }

    // // getting all pans
    // const userPans = await Pan.find(
    //   { userId: req.userId },
    //   { panNumber: 1, _id: 0 }
    // ).lean();
    // if (userPans.length == 0) {
    //   res.status(200).json([]);
    //   return;
    // }
    // // from { panNumber: string } => [string]
    // const pans = userPans.map((entry) => entry.panNumber);

    // getting all already existsing pans result
    let response = await Allocation.find(
      { panNumber: { $in: pans }, companyId: companyId },
      { result: 1, _id: 0, panNumber: 1 }
    )
      .sort({ panNumber: 1 })
      .lean();

    // creating set to efficiently check the pans not in result set
    let givenPans = new Set(pans);
    let foundPans = new Set(response.map((ele) => ele.panNumber));

    // list for pans to get results for from site
    let diffPans = [];
    givenPans.forEach((pan) => {
      if (!foundPans.has(pan)) {
        diffPans.push({ panNumber: pan });
      }
    });

    let newEntries = await fetchFromWebsite(company, diffPans);
    response = response.concat(newEntries);

    res.status(200).json(response);
  } catch (err) {
    console.log("Failed checking allotment: ", err?.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

async function recheckAllotment(req, res) {
  const { companyId } = req.params;
  const { pans } = req.body;

  if (!companyId || !pans || pans.length == 0) {
    res.status(400).json({ message: "enter company to check allotment for" });
    return;
  }

  const company = await Company.findOne({ _id: companyId }).lean();
  if (!company) {
    res.status(400).json({ message: "could not find the company" });
    return;
  }

  let newEntries = await fetchFromWebsite(company, pans);

  if (newEntries.length == 1 && newEntries[0].result) {
    await Allocation.updateOne(
      { panNumber: pans[0], companyId: company._id },
      { result: newEntries[0].result },
      { upsert: true }
    );
  }

  res.status(200).json(newEntries);
}

async function fetchFromWebsite(company, panNumbers) {
  // for the pans which are not yet in allocated
  let resultMap = {};
  switch (company?.registrar) {
    case REGISTRAR.CAMEO:
      resultMap = await checkPanWithCameo(company, panNumbers);
      break;
    case REGISTRAR.MAASHITLA:
      resultMap = await checkPanWithMaashitla(company, panNumbers);
      break;
    case REGISTRAR.BIGSHARE:
      resultMap = await checkPanWithBigshare(company, panNumbers);
      break;
    case REGISTRAR.LINKINTIME:
      resultMap = await checkPanWithLinkintime(company, panNumbers);
      break;
    case REGISTRAR.KFINTECH:
      resultMap = await checkPanWithKifntech(company, panNumbers);
      break;
    default:
      break;
  }

  let saveToDBCalls = [];
  const response = [];

  Object.keys(resultMap).forEach((k) => {
    // add to result
    response.push({
      panNumber: k,
      result: resultMap[k],
    });
    saveToDBCalls.push(
      Allocation.create({
        companyId: company._id,
        panNumber: k,
        result: resultMap[k],
      })
    );
  });

  await Promise.all(saveToDBCalls);

  return response;
}

module.exports = { checkAllotments, recheckAllotment };
