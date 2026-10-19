const assert = require('node:assert/strict');
const Module = require('node:module');
const test = require('node:test');

let databaseQuery;
const originalLoad = Module._load;

class MockPool {
    query(...args) {
        return databaseQuery(...args);
    }
}

Module._load = function (request, parent, isMain) {
    if (request === 'pg') return { Pool: MockPool };
    return originalLoad.call(this, request, parent, isMain);
};

let handler;
try {
    handler = require('./customers');
} finally {
    Module._load = originalLoad;
}

const duplicateMessage = 'This mobile number has already claimed an offer. Each customer can claim only once.';

function createResponse() {
    return {
        statusCode: 200,
        headers: {},
        body: undefined,
        setHeader(name, value) {
            this.headers[name] = value;
        },
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(body) {
            this.body = body;
            return this;
        },
        end() {
            return this;
        }
    };
}

async function postClaim(body) {
    const req = { method: 'POST', body };
    const res = createResponse();
    await handler(req, res);
    return res;
}

test('accepts a new UAE mobile and stores its canonical local format', async () => {
    const calls = [];
    databaseQuery = async (sql, values) => {
        calls.push({ sql, values });
        if (sql.startsWith('SELECT')) return { rows: [] };
        return { rows: [] };
    };

    const response = await postClaim({
        fullName: 'New Customer',
        mobileNumber: '+971 50 123 4567',
        branch: 'Qusais',
        offer: 'AED 5 OFF'
    });

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, { success: true });
    assert.equal(calls.length, 2);
    assert.equal(calls[0].values[0], '0501234567');
    assert.match(calls[0].sql, /regexp_replace/);
    assert.equal(calls[1].values[1], '0501234567');
});

test('rejects a previously claimed mobile with formatting differences', async () => {
    const calls = [];
    databaseQuery = async (sql, values) => {
        calls.push({ sql, values });
        return {
            rows: [{
                id: 1,
                full_name: 'Existing Customer',
                mobile_number: '050-123-4567',
                email: 'customer@example.com',
                branch: 'Karama',
                offer: 'AED 5 OFF'
            }]
        };
    };

    const response = await postClaim({
        fullName: 'Returning Customer',
        mobileNumber: '050 123 4567',
        branch: 'Sharjah',
        offer: 'AED 10 OFF'
    });

    assert.equal(response.statusCode, 409);
    assert.deepEqual(response.body, {
        success: false,
        error: 'ALREADY_CLAIMED',
        message: duplicateMessage
    });
    assert.equal(calls.length, 1);
    assert.equal(calls[0].values[0], '0501234567');
});

test('returns conflict when the unique index catches a concurrent duplicate', async () => {
    let callCount = 0;
    databaseQuery = async () => {
        callCount += 1;
        if (callCount === 1) return { rows: [] };
        throw Object.assign(new Error('duplicate key'), { code: '23505' });
    };

    const response = await postClaim({
        fullName: 'Concurrent Customer',
        mobileNumber: '0501234567',
        branch: 'Abudhabi',
        offer: 'AED 15 OFF'
    });

    assert.equal(response.statusCode, 409);
    assert.equal(response.body.error, 'ALREADY_CLAIMED');
    assert.equal(response.body.message, duplicateMessage);
    assert.equal(callCount, 2);
});

test('normalizes UAE numbers when looking up existing claims', async () => {
    let queryArgs;
    databaseQuery = async (...args) => {
        queryArgs = args;
        return { rows: [] };
    };

    const response = createResponse();
    await handler({ method: 'GET', query: { mobileNumber: '00971 (50) 123-4567' } }, response);

    assert.equal(response.statusCode, 200);
    assert.deepEqual(response.body, { success: true, claimed: false });
    assert.equal(queryArgs[1][0], '0501234567');
});
