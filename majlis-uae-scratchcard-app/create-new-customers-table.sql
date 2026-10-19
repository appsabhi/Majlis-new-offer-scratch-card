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

CREATE UNIQUE INDEX IF NOT EXISTS majlis_customers_normalized_mobile_unique
ON public.majlis_new_scratch_card_customers (
    (
        CASE
            WHEN regexp_replace(mobile_number, '[^0-9]', '', 'g') ~ '^00971[0-9]{9}$'
                THEN '0' || substr(regexp_replace(mobile_number, '[^0-9]', '', 'g'), 6)
            WHEN regexp_replace(mobile_number, '[^0-9]', '', 'g') ~ '^971[0-9]{9}$'
                THEN '0' || substr(regexp_replace(mobile_number, '[^0-9]', '', 'g'), 4)
            ELSE regexp_replace(mobile_number, '[^0-9]', '', 'g')
        END
    )
)
WHERE regexp_replace(mobile_number, '[^0-9]', '', 'g') <> '';
