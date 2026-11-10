CREATE TABLE IF NOT EXISTS categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_name (name)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id INT UNSIGNED NOT NULL,
  name VARCHAR(150) NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  image_url VARCHAR(2048) NULL,
  stock INT UNSIGNED NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_items_category_id (category_id),
  KEY idx_items_name (name),
  UNIQUE KEY uq_items_category_name (category_id, name),
  CONSTRAINT fk_items_category
    FOREIGN KEY (category_id) REFERENCES categories (id)
    ON UPDATE CASCADE
    ON DELETE RESTRICT,
  CONSTRAINT chk_items_price CHECK (price >= 0)
) ENGINE=InnoDB;

INSERT INTO categories (name) VALUES
  ('Electronics'),
  ('Desk Setup'),
  ('Accessories')
ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT IGNORE INTO items (category_id, name, description, price, image_url, stock)
SELECT c.id, seed.name, seed.description, seed.price, seed.image_url, seed.stock
FROM (
  SELECT 'Electronics' AS category_name, 'Wireless Mouse' AS name, 'Ergonomic 2.4GHz optical wireless mouse with silent clicks and compact design.' AS description, 799.00 AS price, 'https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600&auto=format&fit=crop&q=80' AS image_url, 25 AS stock
  UNION ALL SELECT 'Electronics', 'Bluetooth Headphones', 'Over-ear wireless headphones with deep bass, 30-hour battery, and built-in mic.', 2499.00, 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600&auto=format&fit=crop&q=80', 14
  UNION ALL SELECT 'Electronics', 'Portable Bluetooth Speaker', 'Water-resistant compact speaker delivering punchy sound and 12-hour playtime.', 1499.00, 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=600&auto=format&fit=crop&q=80', 18
  UNION ALL SELECT 'Electronics', 'True Wireless Earbuds', 'In-ear wireless earbuds with noise reduction and fast USB-C charging case.', 1899.00, 'https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=600&auto=format&fit=crop&q=80', 8
  UNION ALL SELECT 'Desk Setup', 'Mechanical Keyboard', 'Compact mechanical gaming and typing keyboard with tactile switches and white backlighting.', 3299.00, 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=600&auto=format&fit=crop&q=80', 12
  UNION ALL SELECT 'Desk Setup', 'Wooden Monitor Stand', 'Natural solid wood monitor riser with bottom storage clearance for keyboard.', 1299.00, 'https://images.unsplash.com/photo-1593062096033-9a26b09da705?w=600&auto=format&fit=crop&q=80', 9
  UNION ALL SELECT 'Desk Setup', 'Desk Mat Large (Felt)', 'Extended felt wool desk pad with anti-slip base for smooth workspace protection.', 699.00, 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&auto=format&fit=crop&q=80', 30
  UNION ALL SELECT 'Desk Setup', 'Adjustable Laptop Stand', 'Foldable aluminum ergonomic stand with multiple height angles for laptops up to 16 inches.', 899.00, 'https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=600&auto=format&fit=crop&q=80', 20
  UNION ALL SELECT 'Accessories', 'Smart Fitness Band', 'Activity tracker with heart rate monitor, step counter, sleep tracker, and OLED screen.', 1999.00, 'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?w=600&auto=format&fit=crop&q=80', 16
  UNION ALL SELECT 'Accessories', 'Braided USB-C Cable (2m)', 'Durable nylon braided 60W fast-charging cable with reinforced stress points.', 399.00, 'https://images.unsplash.com/photo-1541689592655-f5f52825a3b8?w=600&auto=format&fit=crop&q=80', 50
  UNION ALL SELECT 'Accessories', 'Minimalist Analog Watch', 'Clean dial wristwatch with stainless steel case and genuine leather strap.', 2799.00, 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=600&auto=format&fit=crop&q=80', 5
  UNION ALL SELECT 'Accessories', 'Stainless Steel Water Bottle', 'Double-wall insulated bottle keeping beverages cold for 24 hours or hot for 12 hours.', 649.00, 'https://images.unsplash.com/photo-1517256064527-09c73fc73e38?w=600&auto=format&fit=crop&q=80', 0
) AS seed
JOIN categories AS c ON c.name = seed.category_name;
