-- Para importar: phpMyAdmin → Importar, o por consola:  mysql -u root < proyecto.sql
CREATE DATABASE IF NOT EXISTS `reportes_vecinales` DEFAULT CHARACTER SET utf8mb4;
USE `reportes_vecinales`;
SET FOREIGN_KEY_CHECKS=0;
SET NAMES utf8mb4;

DROP TABLE IF EXISTS `categorias`;
CREATE TABLE `categorias` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO `categorias` (`id`, `nombre`) VALUES (1, 'Baches'), (2, 'Alumbrado público'), (3, 'Basura / Limpieza'), (4, 'Animales sueltos'), (5, 'Inundaciones'), (6, 'Tránsito / Señales'), (7, 'Espacios verdes'), (8, 'Vandalismo'), (9, 'Otros');

DROP TABLE IF EXISTS `historial_reportes`;
CREATE TABLE `historial_reportes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `reporte_id` int NOT NULL,
  `usuario_nombre` varchar(100) DEFAULT NULL,
  `accion` varchar(30) NOT NULL,
  `detalle` varchar(255) DEFAULT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_historial_reporte` (`reporte_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO `historial_reportes` (`id`, `reporte_id`, `usuario_nombre`, `accion`, `detalle`, `fecha`) VALUES (1, 2, 'Administración', 'estado', 'Pendiente → En proceso', '2026-11-20 14:34:18.000'), (2, 4, 'Administración', 'estado', 'Pendiente → Resuelto', '2026-11-20 14:34:18.000'), (3, 5, 'Administración', 'estado', 'Pendiente → En proceso', '2026-11-20 14:34:18.000'), (4, 7, 'Administración', 'estado', 'Pendiente → Resuelto', '2026-11-20 14:34:18.000'), (5, 9, 'Administración', 'estado', 'Pendiente → Resuelto', '2026-11-20 14:34:18.000'), (6, 10, 'Administración', 'estado', 'Pendiente → En proceso', '2026-11-20 14:34:18.000');

DROP TABLE IF EXISTS `mensajes_reporte`;
CREATE TABLE `mensajes_reporte` (
  `id` int NOT NULL AUTO_INCREMENT,
  `reporte_id` int NOT NULL,
  `autor` varchar(10) NOT NULL,
  `autor_nombre` varchar(100) DEFAULT NULL,
  `texto` text NOT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `foto_url` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_mensajes_reporte` (`reporte_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `notificaciones`;
CREATE TABLE `notificaciones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `tipo` varchar(20) NOT NULL,
  `reporte_id` int DEFAULT NULL,
  `texto` varchar(255) NOT NULL,
  `leida` tinyint(1) NOT NULL DEFAULT '0',
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_notificaciones_usuario` (`usuario_id`,`leida`,`fecha`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `recuperaciones`;
CREATE TABLE `recuperaciones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(150) NOT NULL,
  `codigo_hash` char(64) NOT NULL,
  `intentos` int NOT NULL DEFAULT '0',
  `vence` datetime NOT NULL,
  `ultimo_envio` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_recuperaciones_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `registros_pendientes`;
CREATE TABLE `registros_pendientes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `email` varchar(150) NOT NULL,
  `datos` text NOT NULL,
  `codigo_hash` char(64) NOT NULL,
  `intentos` int NOT NULL DEFAULT '0',
  `vence` datetime NOT NULL,
  `ultimo_envio` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_pendientes_email` (`email`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `reportes`;
CREATE TABLE `reportes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `categoria_id` int NOT NULL,
  `descripcion` text NOT NULL,
  `foto_url` varchar(255) DEFAULT NULL,
  `direccion` varchar(255) NOT NULL,
  `latitud` decimal(10,8) DEFAULT NULL,
  `longitud` decimal(11,8) DEFAULT NULL,
  `estado` varchar(20) NOT NULL DEFAULT 'pendiente',
  `fecha_creacion` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `fecha_resolucion` datetime DEFAULT NULL,
  `responsable` varchar(100) DEFAULT NULL,
  `notas_internas` text,
  `categoria_otro` varchar(100) DEFAULT NULL,
  `miniatura_url` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_reportes_usuario` (`usuario_id`),
  KEY `idx_reportes_fecha` (`fecha_creacion`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO `reportes` (`id`, `usuario_id`, `categoria_id`, `descripcion`, `foto_url`, `direccion`, `latitud`, `longitud`, `estado`, `fecha_creacion`, `fecha_resolucion`, `responsable`, `notas_internas`, `categoria_otro`, `miniatura_url`) VALUES (1, 2, 1, '[DEMO] Bache grande en la calzada, ya rompió una cubierta.', NULL, 'Av. San Martín 450', '-29.17920000', '-56.64310000', 'pendiente', '2026-11-18 14:34:18.000', NULL, NULL, NULL, NULL, NULL), (2, 3, 2, '[DEMO] La luminaria de la esquina lleva una semana apagada.', NULL, 'Calle Belgrano 120', '-29.18010000', '-56.64620000', 'en_proceso', '2026-11-14 14:34:18.000', NULL, NULL, NULL, NULL, NULL), (3, 2, 3, '[DEMO] Basural acumulado junto a la plaza.', NULL, 'Plaza principal', '-29.17750000', '-56.64490000', 'pendiente', '2026-11-17 14:34:18.000', NULL, NULL, NULL, NULL, NULL), (4, 3, 4, '[DEMO] Perros sueltos en la zona de la escuela.', NULL, 'Calle Mitre 310', '-29.18120000', '-56.64180000', 'resuelto', '2026-11-05 14:34:18.000', '2026-11-10 14:34:18.000', NULL, NULL, NULL, NULL), (5, 2, 5, '[DEMO] Se junta agua en la esquina cuando llueve.', NULL, 'Calle Sarmiento 88', '-29.17860000', '-56.64750000', 'en_proceso', '2026-11-11 14:34:18.000', NULL, NULL, NULL, NULL, NULL), (6, 3, 6, '[DEMO] Falta el cartel de PARE.', NULL, 'Av. Libertad y Rivadavia', '-29.17690000', '-56.64020000', 'pendiente', '2026-11-19 14:34:18.000', NULL, NULL, NULL, NULL, NULL), (7, 2, 7, '[DEMO] Pasto muy alto en la plazoleta del barrio.', NULL, 'Barrio Norte', '-29.17400000', '-56.64400000', 'resuelto', '2026-11-02 14:34:18.000', '2026-11-07 14:34:18.000', NULL, NULL, NULL, NULL), (8, 3, 8, '[DEMO] Pintadas en el frente del salón comunitario.', NULL, 'Calle Moreno 205', '-29.18220000', '-56.64550000', 'pendiente', '2026-11-16 14:34:18.000', NULL, NULL, NULL, NULL, NULL), (9, 2, 1, '[DEMO] Pozo en la entrada del barrio.', NULL, 'Acceso sur', '-29.18350000', '-56.64300000', 'resuelto', '2026-10-31 14:34:18.000', '2026-11-05 14:34:18.000', NULL, NULL, NULL, NULL), (10, 3, 2, '[DEMO] Poste con cables sueltos.', NULL, 'Calle Urquiza 77', '-29.17580000', '-56.64810000', 'en_proceso', '2026-11-13 14:34:18.000', NULL, NULL, NULL, NULL, NULL);

DROP TABLE IF EXISTS `suscripciones_push`;
CREATE TABLE `suscripciones_push` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int NOT NULL,
  `endpoint_hash` char(64) NOT NULL,
  `endpoint` varchar(1000) NOT NULL,
  `p256dh` varchar(255) NOT NULL,
  `auth` varchar(255) NOT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_push_endpoint` (`endpoint_hash`),
  KEY `idx_push_usuario` (`usuario_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

DROP TABLE IF EXISTS `usuarios`;
CREATE TABLE `usuarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) NOT NULL,
  `apellido` varchar(100) NOT NULL,
  `dni` varchar(120) NOT NULL,
  `email` varchar(150) NOT NULL,
  `password` varchar(255) NOT NULL,
  `rol` varchar(20) NOT NULL DEFAULT 'vecino',
  `consentimiento_fecha` datetime DEFAULT NULL,
  `email_verificado` tinyint(1) NOT NULL DEFAULT '0',
  `google_id` varchar(64) DEFAULT NULL,
  `facebook_id` varchar(64) DEFAULT NULL,
  `sesion_desde` bigint DEFAULT NULL,
  `dni_hash` char(64) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_usuarios_email` (`email`),
  UNIQUE KEY `uq_usuarios_dni` (`dni`),
  UNIQUE KEY `uq_usuarios_dni_hash` (`dni_hash`),
  UNIQUE KEY `uq_usuarios_google` (`google_id`),
  UNIQUE KEY `uq_usuarios_facebook` (`facebook_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
INSERT INTO `usuarios` (`id`, `nombre`, `apellido`, `dni`, `email`, `password`, `rol`, `consentimiento_fecha`, `email_verificado`, `google_id`, `facebook_id`, `sesion_desde`, `dni_hash`) VALUES (1, 'Administración', 'Municipal', '10000001', 'admin@example.com', '$2b$10$0ckFDzbdppA3jVxG2a1WwOaOgPVBKECh9mQFu3LXRFdAl7JWS0P76', 'admin', '2026-11-20 14:34:18.000', 1, NULL, NULL, NULL, NULL), (2, 'Ana', 'Gómez', '20000002', 'ana@example.com', '$2b$10$jFGC6/qesUT8SgfVvhkmQ.abC9WrvNlFiieOuyfMXM3aVsmgth/hK', 'vecino', '2026-11-20 14:34:18.000', 1, NULL, NULL, NULL, NULL), (3, 'Luis', 'Pérez', '20000003', 'luis@example.com', '$2b$10$BJh6Bsts19.7wjF3eyhSfOFLNheWoBdXSD5smideC/POBAl2IyjMa', 'vecino', '2026-11-20 14:34:18.000', 1, NULL, NULL, NULL, NULL);

SET FOREIGN_KEY_CHECKS=1;