-- ENUM Types for Product Service
CREATE TYPE lamp_technology AS ENUM ('Светодиодная', 'Накаливания', 'Галогенная', 'Люминесцентная', 'Другая');
CREATE TYPE energy_efficiency_class AS ENUM ('A++', 'A+', 'A', 'B', 'C', 'D', 'E', 'F', 'G');