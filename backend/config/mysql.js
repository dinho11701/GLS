const mysql = require("mysql2/promise");

const pool = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "", // mets ton mot de passe si tu en as un
  database: "lasolution_app",
  waitForConnections: true,
  connectionLimit: 10,
});

module.exports = pool;
