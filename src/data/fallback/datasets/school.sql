-- Dataset "school": students, courses and which student took which course.
-- Isla (9) has no score and no enrollments. The course Ethics (4) has no students.
CREATE TABLE students (
  id INTEGER PRIMARY KEY,
  name TEXT,
  age INTEGER,
  city TEXT,
  score INTEGER
);
INSERT INTO students VALUES
  (1, 'Aisha', 20, 'Dublin', 88),
  (2, 'Ben', 22, 'Cork', 72),
  (3, 'Chloe', 19, 'Dublin', 95),
  (4, 'Dev', 21, 'Galway', 64),
  (5, 'Emma', 23, 'Cork', 81),
  (6, 'Farid', 20, 'Dublin', 58),
  (7, 'Grace', 22, 'Limerick', 77),
  (8, 'Hugo', 19, 'Galway', 90),
  (9, 'Isla', 21, 'Dublin', NULL),
  (10, 'Jack', 24, 'Cork', 69);

CREATE TABLE courses (
  id INTEGER PRIMARY KEY,
  title TEXT,
  credits INTEGER
);
INSERT INTO courses VALUES
  (1, 'Databases', 6),
  (2, 'Statistics', 5),
  (3, 'Python', 5),
  (4, 'Ethics', 3);

CREATE TABLE enrollments (
  student_id INTEGER,
  course_id INTEGER,
  grade INTEGER
);
INSERT INTO enrollments VALUES
  (1, 1, 90), (1, 2, 85), (2, 1, 70), (3, 1, 96), (3, 3, 92),
  (4, 2, 60), (5, 3, 80), (5, 1, 78), (6, 2, 55), (7, 3, 75),
  (8, 1, 91), (8, 3, 88), (10, 2, 65);
