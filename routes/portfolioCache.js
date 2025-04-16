const express = require("express");
const router = express.Router();
const portfolioCacheController = require("../controllers/portfolioCache");

// Portfolio Cache Routes
router.post("/", portfolioCacheController.storeCache);
router.get("/:key", portfolioCacheController.getCache);

module.exports = router;
