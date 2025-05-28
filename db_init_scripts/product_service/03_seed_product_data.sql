-- Вставляем данные только если таблица products пуста, чтобы избежать дублирования при перезапусках без удаления volume
-- (Хотя docker-entrypoint-initdb.d обычно выполняется один раз при инициализации)
-- Для полной идемпотентности можно было бы проверять наличие конкретных записей.
-- Но для простоты, предположим, что это для "чистой" инициализации.

INSERT INTO products (
    name, article, description, price, stock_quantity, is_active,
    manufacturer, product_technology, socket, power, lumens, color_temperature, voltage, class_energy_efficiency
)
SELECT
    'Лампа Накаливания Е27 60Вт Классика',
    'LMP-INC-E27-60W-C',
    'Классическая лампа накаливания с цоколем E27, мощностью 60 Вт. Создает теплое и уютное освещение. Идеально подходит для жилых помещений.',
    55.90,
    150,
    TRUE,
    'Завод "Свет России"',
    'Накаливания',
    'E27',
    60.0,
    710,
    2700,
    '220-240V',
    'E'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE article = 'LMP-INC-E27-60W-C');

INSERT INTO products (
    name, article, description, price, stock_quantity, is_active,
    manufacturer, product_technology, socket, power, lumens, color_temperature, voltage, class_energy_efficiency
)
SELECT
    'Лампа Светодиодная GU10 5Вт Нейтральный Свет',
    'LMP-LED-GU10-5W-NW',
    'Энергоэффективная светодиодная лампа с цоколем GU10, мощностью 5 Вт. Нейтральный белый свет (4000K), подходит для рабочих зон и офисов.',
    149.00,
    250,
    TRUE,
    'EcoLight Tech',
    'Светодиодная',
    'GU10',
    5.0,
    450,
    4000,
    '220-240V',
    'A+'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE article = 'LMP-LED-GU10-5W-NW');

INSERT INTO products (
    name, article, description, price, stock_quantity, is_active,
    manufacturer, product_technology, socket, power, lumens, color_temperature, voltage, class_energy_efficiency
)
SELECT
    'Лампа Светодиодная E14 7W Теплый Свет "Свеча"',
    'LMP-LED-E14-7W-WW-CNDL',
    'Декоративная светодиодная лампа в форме свечи с цоколем E14 (миньон). Мощность 7 Вт, теплый белый свет (3000K). Отлично смотрится в люстрах и бра.',
    185.50,
    80,
    TRUE,
    'Aura Lamps',
    'Светодиодная',
    'E14',
    7.0,
    600,
    3000,
    '230V',
    'A++'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE article = 'LMP-LED-E14-7W-WW-CNDL');

INSERT INTO products (
    name, article, description, price, stock_quantity, is_active,
    manufacturer, product_technology, socket, power, lumens, color_temperature, voltage, class_energy_efficiency
)
SELECT
    'Лампа Галогенная G9 40W Капсульная',
    'LMP-HAL-G9-40W-CAPS',
    'Компактная галогенная капсульная лампа с цоколем G9. Мощность 40 Вт, яркий теплый свет. Используется в точечных светильниках и подсветке.',
    89.00,
    120,
    FALSE, -- Пример неактивного товара
    'Bright Spark',
    'Галогенная',
    'G9',
    40.0,
    520,
    2800,
    '230V',
    'C'
WHERE NOT EXISTS (SELECT 1 FROM products WHERE article = 'LMP-HAL-G9-40W-CAPS');


-- Добавляем изображения для некоторых товаров
-- Для этого нам нужны product_id. Мы можем их получить, если знаем артикулы.

DO $$
DECLARE
    product1_id UUID;
    product2_id UUID;
    product3_id UUID;
BEGIN
    -- Получаем ID для товаров по их уникальным артикулам
    SELECT product_id INTO product1_id FROM products WHERE article = 'LMP-INC-E27-60W-C';
    SELECT product_id INTO product2_id FROM products WHERE article = 'LMP-LED-GU10-5W-NW';
    SELECT product_id INTO product3_id FROM products WHERE article = 'LMP-LED-E14-7W-WW-CNDL';

    -- Добавляем изображения, если товары найдены
    IF product1_id IS NOT NULL THEN
        INSERT INTO product_images (product_id, image_url)
        SELECT product1_id, 'https://example.com/images/LMP-INC-E27-60W-C_1.jpg'
        WHERE NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = product1_id AND image_url = 'https://example.com/images/LMP-INC-E27-60W-C_1.jpg');

        INSERT INTO product_images (product_id, image_url)
        SELECT product1_id, 'https://example.com/images/LMP-INC-E27-60W-C_2.png'
        WHERE NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = product1_id AND image_url = 'https://example.com/images/LMP-INC-E27-60W-C_2.png');
    END IF;

    IF product2_id IS NOT NULL THEN
        INSERT INTO product_images (product_id, image_url)
        SELECT product2_id, 'https://example.com/images/LMP-LED-GU10-5W-NW_main.webp'
        WHERE NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = product2_id AND image_url = 'https://example.com/images/LMP-LED-GU10-5W-NW_main.webp');
    END IF;

    IF product3_id IS NOT NULL THEN
        INSERT INTO product_images (product_id, image_url)
        SELECT product3_id, 'https://example.com/images/LMP-LED-E14-7W-WW-CNDL_front.jpg'
        WHERE NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = product3_id AND image_url = 'https://example.com/images/LMP-LED-E14-7W-WW-CNDL_front.jpg');

        INSERT INTO product_images (product_id, image_url)
        SELECT product3_id, 'https://example.com/images/LMP-LED-E14-7W-WW-CNDL_pack.jpg'
        WHERE NOT EXISTS (SELECT 1 FROM product_images WHERE product_id = product3_id AND image_url = 'https://example.com/images/LMP-LED-E14-7W-WW-CNDL_pack.jpg');
    END IF;

END $$;