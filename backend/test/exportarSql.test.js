const test = require('node:test');
const assert = require('node:assert/strict');
const { limpiarCrearTabla, generarDump } = require('../scripts/backup');

const MYSQL8 = 'CREATE TABLE `categorias` (\n  `id` int NOT NULL AUTO_INCREMENT,\n  `nombre` varchar(100) COLLATE utf8mb4_0900_ai_ci NOT NULL,\n  PRIMARY KEY (`id`)\n) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci';

test('quita lo que MariaDB (XAMPP) no entiende', () => {
  const limpio = limpiarCrearTabla(MYSQL8);
  assert.ok(!/COLLATE|0900|AUTO_INCREMENT=/.test(limpio), limpio);
  assert.ok(limpio.includes('`nombre` varchar(100) NOT NULL'));
  assert.ok(limpio.includes('AUTO_INCREMENT,')); // la columna autoincremental se conserva
  assert.ok(limpio.endsWith('DEFAULT CHARSET=utf8mb4'));
});

test('fuerza InnoDB aunque el servidor local use MyISAM', () => {
  const limpio = limpiarCrearTabla(MYSQL8.replace('InnoDB', 'MyISAM'));
  assert.match(limpio, /ENGINE=InnoDB/);
  assert.ok(!/MyISAM/.test(limpio));
});

test('el script portable crea la base, la usa y es compatible', async () => {
  const consultas = [];
  const consultar = async (sql) => {
    consultas.push(sql);
    if (/^SHOW FULL TABLES/.test(sql)) return [{ Tables_in_x: 'categorias' }];
    if (/^SHOW CREATE TABLE/.test(sql)) return [{ 'Create Table': MYSQL8 }];
    if (/^SELECT/.test(sql)) return [{ id: 1, nombre: "Baches y 'pozos'" }];
    return [];
  };
  const sql = await generarDump(consultar, 'reportes_vecinales', { portable: true, titulo: 'Prueba' });
  assert.match(sql, /CREATE DATABASE IF NOT EXISTS `reportes_vecinales`/);
  assert.match(sql, /USE `reportes_vecinales`;/);
  assert.match(sql, /DROP TABLE IF EXISTS `categorias`;/);
  assert.match(sql, /INSERT INTO `categorias` \(`id`, `nombre`\) VALUES \(1, 'Baches y \\'pozos\\''\);/);
  assert.ok(!/0900/.test(sql));
});
