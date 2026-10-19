WITH normalized_customers AS (
    SELECT
        id,
        CASE
            WHEN regexp_replace(mobile_number, '[^0-9]', '', 'g') ~ '^00971[0-9]{9}$'
                THEN '0' || substr(regexp_replace(mobile_number, '[^0-9]', '', 'g'), 6)
            WHEN regexp_replace(mobile_number, '[^0-9]', '', 'g') ~ '^971[0-9]{9}$'
                THEN '0' || substr(regexp_replace(mobile_number, '[^0-9]', '', 'g'), 4)
            ELSE regexp_replace(mobile_number, '[^0-9]', '', 'g')
        END AS normalized_mobile
    FROM public.majlis_new_scratch_card_customers
)
SELECT
    normalized_mobile,
    COUNT(*) AS duplicate_count,
    ARRAY_AGG(id ORDER BY id) AS customer_ids
FROM normalized_customers
WHERE normalized_mobile <> ''
GROUP BY normalized_mobile
HAVING COUNT(*) > 1;

DO $$
DECLARE
    duplicate_details TEXT;
BEGIN
    WITH normalized_customers AS (
        SELECT
            id,
            CASE
                WHEN regexp_replace(mobile_number, '[^0-9]', '', 'g') ~ '^00971[0-9]{9}$'
                    THEN '0' || substr(regexp_replace(mobile_number, '[^0-9]', '', 'g'), 6)
                WHEN regexp_replace(mobile_number, '[^0-9]', '', 'g') ~ '^971[0-9]{9}$'
                    THEN '0' || substr(regexp_replace(mobile_number, '[^0-9]', '', 'g'), 4)
                ELSE regexp_replace(mobile_number, '[^0-9]', '', 'g')
            END AS normalized_mobile
        FROM public.majlis_new_scratch_card_customers
    )
    SELECT STRING_AGG(
        FORMAT('normalized mobile %s has customer IDs %s', normalized_mobile, customer_ids),
        '; '
    )
    INTO duplicate_details
    FROM (
        SELECT normalized_mobile, ARRAY_AGG(id ORDER BY id) AS customer_ids
        FROM normalized_customers
        WHERE normalized_mobile <> ''
        GROUP BY normalized_mobile
        HAVING COUNT(*) > 1
    ) duplicates;

    IF duplicate_details IS NOT NULL THEN
        RAISE EXCEPTION 'Cannot add normalized mobile unique index. Resolve these duplicate customer records without deleting them: %', duplicate_details;
    END IF;
END
$$;

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
