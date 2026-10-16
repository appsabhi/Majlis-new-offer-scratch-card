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

const sanitizeText = (value) => {
    if (!value) return '';
    return String(value).replace(/₹/g, 'Rs.').trim();
};

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
            const mobile = req.query.mobileNumber || req.query.mobile;
            if (!mobile) {
                return res.status(400).json({
                    success: false,
                    error: 'mobileNumber query parameter is required.'
                });
            }

            const result = await pool.query(
                `SELECT id, full_name, mobile_number, email, branch, offer, claim_date_time, created_at FROM ${TABLE} WHERE mobile_number = $1 LIMIT 1`,
                [String(mobile).trim()]
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
        if (!fullName || !mobileNumber || !branch) {
            return res.status(400).json({
                success: false,
                error: 'fullName, mobileNumber, and branch are required.'
            });
        }

        const cleanMobile = String(mobileNumber).trim();
        const rawDate = claimDateTime ? new Date(claimDateTime) : new Date();
        const validClaimDateTime = Number.isNaN(rawDate.getTime()) ? new Date() : rawDate;
        const existingCustomer = await pool.query(
            `SELECT id, full_name, mobile_number, email, branch, offer, claim_date_time, created_at FROM ${TABLE} WHERE mobile_number = $1 LIMIT 1`,
            [cleanMobile]
        );

        if (existingCustomer.rows.length > 0) {
            return res.status(200).json({
                success: false,
                error: 'ALREADY_CLAIMED',
                claim: formatCustomer(existingCustomer.rows[0])
            });
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
            try {
                const cleanMobile = String((req.body || {}).mobileNumber || '').trim();
                const result = await pool.query(
                    `SELECT id, full_name, mobile_number, email, branch, offer, claim_date_time, created_at FROM ${TABLE} WHERE mobile_number = $1 LIMIT 1`,
                    [cleanMobile]
                );
                if (result.rows.length > 0) {
                    return res.status(200).json({
                        success: false,
                        error: 'ALREADY_CLAIMED',
                        claim: formatCustomer(result.rows[0])
                    });
                }
            } catch (fetchErr) {
                console.error('[Duplicate Customer Handle Error]', fetchErr);
            }

            return res.status(200).json({ success: false, error: 'ALREADY_CLAIMED' });
        }

        console.error('[Submit Customer API Error]', err);
        return res.status(500).json({
            success: false,
            error: 'Failed to record customer. Please try again.'
        });
    }
};
