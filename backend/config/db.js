require('dotenv').config();
const mysql = require('mysql2');
const { opcionesConexion } = require('./opcionesDb');

const pool = mysql.createPool({
  ...opcionesConexion(),
  waitForConnections: true,
  connectionLimit: 10,
  enableKeepAlive: true,
});

module.exports = pool.promise();