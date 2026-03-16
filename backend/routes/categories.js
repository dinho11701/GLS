const express = require("express");
const router = express.Router();
const pool = require("../config/mysql");

// GET /api/v1/categories
router.get("/", async (req, res) => {

  try {

    const [rows] = await pool.execute(`
      SELECT id, name, slug
      FROM categories
      ORDER BY name
    `);

    res.json({
      items: rows
    });

  } catch (err) {

    console.error("CATEGORIES ERROR:", err);

    res.status(500).json({
      error: "Failed to fetch categories"
    });

  }

});

module.exports = router;