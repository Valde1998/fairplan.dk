CREATE TABLE IF NOT EXISTS periods (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    CHECK (start_date < end_date)
);

CREATE TABLE IF NOT EXISTS sections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    color CHAR(7) NOT NULL
);

CREATE TABLE IF NOT EXISTS staff_groups (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(254) NOT NULL UNIQUE,
    is_admin BOOLEAN NOT NULL,
    is_staff BOOLEAN NOT NULL,
    password_hash VARCHAR(255),
    CHECK (is_admin OR is_staff)
);

CREATE TABLE IF NOT EXISTS employments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    section_id INT NOT NULL,
    staff_group_id INT NOT NULL,
    hours_per_week INT NOT NULL CHECK (hours_per_week BETWEEN 0 AND 37),
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (section_id) REFERENCES sections(id),
    FOREIGN KEY (staff_group_id) REFERENCES staff_groups(id),
    CHECK (start_date < end_date),
    INDEX (user_id, start_date, end_date)
);

CREATE TABLE IF NOT EXISTS login_sessions (
    token_hash CHAR(64) PRIMARY KEY,
    user_id INT NOT NULL,
    expires_at BIGINT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS app_meta (
    name VARCHAR(40) PRIMARY KEY,
    value VARCHAR(100) NOT NULL
);
