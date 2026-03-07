CREATE DATABASE IF NOT EXISTS `necropunk`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE `necropunk`;

CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  username VARCHAR(191) NOT NULL,
  password VARCHAR(255) NOT NULL,
  token VARCHAR(128) NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_users_username (username),
  KEY idx_users_token (token)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS knowledge_items (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  section ENUM('player', 'gm') NOT NULL,
  title VARCHAR(255) NOT NULL,
  available TEXT NOT NULL,
  description TEXT NOT NULL,
  tags JSON NOT NULL,
  created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  PRIMARY KEY (id),
  KEY idx_knowledge_section_title (section, title),
  KEY idx_knowledge_updated_at (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
