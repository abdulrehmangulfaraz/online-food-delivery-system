const mysql = require('mysql2/promise');
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: 'Sherii',
  database: 'online_food_db',
  port: 3306
});
module.exports = pool;