"use strict";
const fs=require("node:fs"),path=require("node:path"),acorn=require("acorn");
const source=fs.readFileSync(path.join(__dirname,"../app.js"),"utf8");
Promise.all([require("../tests/sales-order-inventory.cjs")(source,acorn),require("../tests/sales-product-shelf.cjs")(source,acorn)]).then(checks=>console.log("Dispatch inventory and product detail shelf verification passed: "+checks.join(" + "))).catch(error=>{console.error(error);process.exitCode=1;});
