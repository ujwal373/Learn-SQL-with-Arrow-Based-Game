-- Dataset "company": employees, their managers and departments.
-- Salaries are all different, so rankings have no ties. The Legal department (5) has no employees.
-- Managers are employees too: manager_id points at another row of employees. Some have no manager.
CREATE TABLE departments (
  id INTEGER PRIMARY KEY,
  name TEXT,
  location TEXT
);
INSERT INTO departments VALUES
  (1, 'Engineering', 'Dublin'),
  (2, 'Sales', 'Cork'),
  (3, 'Finance', 'Dublin'),
  (4, 'Support', 'Galway'),
  (5, 'Legal', 'Cork');

CREATE TABLE employees (
  id INTEGER PRIMARY KEY,
  name TEXT,
  department_id INTEGER,
  salary INTEGER,
  hire_year INTEGER,
  manager_id INTEGER
);
INSERT INTO employees VALUES
  (1, 'Alice', 1, 120000, 2018, NULL),
  (2, 'Bob', 1, 95000, 2020, 1),
  (3, 'Carla', 1, 88000, 2021, 1),
  (4, 'Dmitri', 2, 70000, 2019, 7),
  (5, 'Elena', 2, 64000, 2022, 7),
  (6, 'Femi', 3, 82000, 2017, 8),
  (7, 'Gus', 2, 90000, 2016, NULL),
  (8, 'Hana', 3, 105000, 2015, NULL),
  (9, 'Ivan', 4, 52000, 2023, 10),
  (10, 'Jade', 4, 61000, 2020, NULL),
  (11, 'Kofi', 1, 99000, 2019, 1),
  (12, 'Lena', 3, 76000, 2022, 8);
