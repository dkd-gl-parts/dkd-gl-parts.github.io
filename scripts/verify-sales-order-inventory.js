"use strict";
const fs=require("node:fs"),path=require("node:path"),acorn=require("acorn");
const verify=require("../tests/sales-order-inventory.cjs");
verify(fs.readFileSync(path.join(__dirname,"../app.js"),"utf8"),acorn).then(checks=>console.log("Sales order shelf and stock verification passed: "+checks)).catch(error=>{console.error(error);process.exitCode=1;});
