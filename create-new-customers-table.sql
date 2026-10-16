CREATE TABLE IF NOT EXISTS public.majlis_new_scratch_card_customers (
    id BIGSERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    mobile_number TEXT NOT NULL UNIQUE,
    email TEXT NOT NULL DEFAULT 'Not Provided',
    branch TEXT NOT NULL,
    offer TEXT NOT NULL DEFAULT '',
    claim_date_time TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
);
