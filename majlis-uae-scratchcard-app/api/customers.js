const { Pool } = require('pg');

const connectionString = process.env.POSTGRES_URL || process.env.DATABASE_URL;

const pool = connectionString
    ? new Pool({
        connectionString,
        ssl: connectionString.includes('sslmode=') || connectionString.includes('neon.tech') ? { rejectUnauthorized: false } : false
    })
    : new Pool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: parseInt(process.env.DB_PORT || '5434', 10),
        database: process.env.DB_NAME || 'majlis_scratchcard',
        user: process.env.DB_USER || 'postgres',
        password: process.env.DB_PASSWORD || ''
    });

const TABLE = 'public.majlis_new_scratch_card_customers';
const DUPLICATE_CLAIM_MESSAGE = 'This mobile number has already claimed an offer. Each customer can claim only once.';
const NORMALIZED_MOBILE_SQL = `CASE
    WHEN regexp_replace(mobile_number, '[^0-9]', '', 'g') ~ '^00971[0-9]{9}$'
        THEN '0' || substr(regexp_replace(mobile_number, '[^0-9]', '', 'g'), 6)
    WHEN regexp_replace(mobile_number, '[^0-9]', '', 'g') ~ '^971[0-9]{9}$'
        THEN '0' || substr(regexp_replace(mobile_number, '[^0-9]', '', 'g'), 4)
    ELSE regexp_replace(mobile_number, '[^0-9]', '', 'g')
END`;

const sanitizeText = (value) => {
    if (!value) return '';
    return String(value).replace(/₹/g, 'Rs.').trim();
};

const normalizeMobile = (value) => {
    const digits = String(value || '').replace(/\D/g, '');
    if (/^00971[0-9]{9}$/.test(digits)) return `0${digits.slice(5)}`;
    if (/^971[0-9]{9}$/.test(digits)) return `0${digits.slice(3)}`;
    return digits;
};

const duplicateClaimResponse = (res) => res.status(409).json({
    success: false,
    error: 'ALREADY_CLAIMED',
    message: DUPLICATE_CLAIM_MESSAGE
});

const formatCustomer = (row) => ({
    id: row.id,
    fullName: row.full_name,
    mobileNumber: row.mobile_number,
    email: row.email,
    branch: row.branch,
    offer: row.offer,
    claimDateTime: row.claim_date_time || row.created_at
});

module.exports = async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method === 'GET') {
        try {
            const mobile = normalizeMobile(req.query.mobileNumber || req.query.mobile || '');
            if (mobile.length !== 10) {
                return res.status(400).json({
                    success: false,
                    error: 'A valid 10-digit mobile number is required.'
                });
            }

            const result = await pool.query(
                `SELECT id, full_name, mobile_number, email, branch, offer, claim_date_time, created_at FROM ${TABLE} WHERE ${NORMALIZED_MOBILE_SQL} = $1 LIMIT 1`,
                [mobile]
            );

            if (result.rows.length === 0) {
                return res.status(200).json({ success: true, claimed: false });
            }

            return res.status(200).json({
                success: true,
                claimed: true,
                claim: formatCustomer(result.rows[0])
            });
        } catch (err) {
            console.error('[GET Customer API Error]', err);
            return res.status(500).json({
                success: false,
                error: 'Failed to fetch customer status. Please try again.'
            });
        }
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ success: false, error: 'Method Not Allowed' });
    }

    try {
        const { fullName, mobileNumber, email, branch, offer, claimDateTime } = req.body || {};
        const cleanMobile = normalizeMobile(mobileNumber);
        if (!fullName || cleanMobile.length !== 10 || !branch) {
            return res.status(400).json({
                success: false,
                error: 'fullName, a valid 10-digit mobileNumber, and branch are required.'
            });
        }

        const rawDate = claimDateTime ? new Date(claimDateTime) : new Date();
        const validClaimDateTime = Number.isNaN(rawDate.getTime()) ? new Date() : rawDate;
        const existingCustomer = await pool.query(
            `SELECT id, full_name, mobile_number, email, branch, offer, claim_date_time, created_at FROM ${TABLE} WHERE ${NORMALIZED_MOBILE_SQL} = $1 LIMIT 1`,
            [cleanMobile]
        );

        if (existingCustomer.rows.length > 0) {
            return duplicateClaimResponse(res);
        }

        await pool.query(
            `INSERT INTO ${TABLE}
                (full_name, mobile_number, email, branch, offer, claim_date_time, created_at)
             VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
            [
                sanitizeText(fullName),
                cleanMobile,
                email ? sanitizeText(email) : 'Not Provided',
                sanitizeText(branch),
                sanitizeText(offer),
                validClaimDateTime
            ]
        );

        return res.status(200).json({ success: true });
    } catch (err) {
        if (err.code === '23505') {
            return duplicateClaimResponse(res);
        }

        console.error('[Submit Customer API Error]', err);
        return res.status(500).json({
            success: false,
            error: 'Failed to record customer. Please try again.'
        });
    }
};
