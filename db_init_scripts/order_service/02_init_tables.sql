-- Order Service Tables
CREATE TABLE IF NOT EXISTS promocodes (
    promocode_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    promocode_name VARCHAR(32) NOT NULL UNIQUE,
    percent INT CHECK (percent IS NULL OR (percent > 0 AND percent <= 100)),
    value DECIMAL(10, 2) CHECK (value IS NULL OR value > 0),
    min_order_cost DECIMAL(10, 2),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    CONSTRAINT chk_promocode_discount_type CHECK (
        (percent IS NOT NULL AND value IS NULL) OR (percent IS NULL AND value IS NOT NULL) OR (percent IS NULL AND value IS NULL AND min_order_cost IS NOT NULL)
    )
);

CREATE TABLE IF NOT EXISTS orders (
    order_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    number VARCHAR(32) NOT NULL UNIQUE,
    status order_status_enum NOT NULL DEFAULT 'NEW',
    customer_surname VARCHAR(128) NOT NULL,
    customer_first_name VARCHAR(128) NOT NULL,
    customer_email VARCHAR(128) NOT NULL,
    customer_phone_number VARCHAR(32) NOT NULL,
    promocode_uuid UUID REFERENCES promocodes(promocode_id) ON DELETE SET NULL,
    total_cost DECIMAL(12, 2) NOT NULL,
    total_cost_with_promo DECIMAL(12, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    order_item_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(order_id) ON DELETE CASCADE,
    product_id UUID NOT NULL, -- Это будет просто UUID, без FK на другую БД
    quantity INT NOT NULL CHECK (quantity > 0),
    price_per_one DECIMAL(10, 2) NOT NULL,
    name VARCHAR(128) NOT NULL, -- Название товара на момент заказа (копия из Product Service)
    CONSTRAINT uq_order_product UNIQUE (order_id, product_id)
);

-- Indexes for Order Service
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders (status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders (created_at);
CREATE INDEX IF NOT EXISTS idx_orders_customer_email ON orders (customer_email);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON order_items (order_id);
CREATE INDEX IF NOT EXISTS idx_promocodes_name ON promocodes (promocode_name);