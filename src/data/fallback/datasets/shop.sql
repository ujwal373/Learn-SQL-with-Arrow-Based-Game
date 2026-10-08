-- Dataset "shop": products, customers and their orders.
-- The Watch (product 10) was never ordered. Uma (customer 7) has no orders.
CREATE TABLE products (
  id INTEGER PRIMARY KEY,
  name TEXT,
  category TEXT,
  price REAL,
  stock INTEGER
);
INSERT INTO products VALUES
  (1, 'Laptop', 'Electronics', 899.0, 12),
  (2, 'Phone', 'Electronics', 599.0, 30),
  (3, 'Headphones', 'Electronics', 89.5, 45),
  (4, 'Desk', 'Furniture', 210.0, 8),
  (5, 'Chair', 'Furniture', 135.0, 15),
  (6, 'Lamp', 'Furniture', 35.0, 40),
  (7, 'Notebook', 'Stationery', 4.5, 200),
  (8, 'Pen', 'Stationery', 1.2, 500),
  (9, 'Backpack', 'Accessories', 49.0, 25),
  (10, 'Watch', 'Accessories', 150.0, 0);

CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  name TEXT,
  country TEXT
);
INSERT INTO customers VALUES
  (1, 'Orla', 'Ireland'),
  (2, 'Priya', 'India'),
  (3, 'Quentin', 'France'),
  (4, 'Rosa', 'Spain'),
  (5, 'Sam', 'Ireland'),
  (6, 'Tara', 'India'),
  (7, 'Uma', 'Spain');

CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER,
  product_id INTEGER,
  quantity INTEGER,
  order_date TEXT
);
INSERT INTO orders VALUES
  (1, 1, 1, 1, '2026-01-05'),
  (2, 1, 3, 2, '2026-01-19'),
  (3, 2, 2, 1, '2026-02-02'),
  (4, 2, 7, 10, '2026-02-14'),
  (5, 3, 4, 1, '2026-02-20'),
  (6, 3, 5, 2, '2026-03-03'),
  (7, 4, 6, 3, '2026-03-11'),
  (8, 5, 1, 1, '2026-03-25'),
  (9, 5, 9, 2, '2026-04-01'),
  (10, 1, 8, 20, '2026-04-09'),
  (11, 2, 5, 1, '2026-04-18'),
  (12, 6, 3, 1, '2026-05-02');
