const express = require("express");
require("dotenv").config();
// routers
const companyRouter = require("./routers/company.router");
const allotmentRouter = require("./routers/allotment.router");
const { getGreyProfit } = require("./handlers/getGreyProfit");

// database connection
require("./dbConnection");

// for allowing expired tls certificates on 3rd class registrar sites
process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = "0";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// only using company and allotment routers for now
app.use("/", companyRouter);
app.use("/", allotmentRouter);
app.get("/getGreyProfit", getGreyProfit);

app.listen(process.env.PORT || 3000, (err, _) => {
  if (err) {
    console.log("Error initiating server");
    return;
  }
  console.log("Server listening on 3000");
});
