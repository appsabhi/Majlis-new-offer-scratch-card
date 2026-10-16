# Majlis Customer Scratch Card

This folder is a self-contained copy of the scratch-card experience for an independent customer deployment. It has its own frontend, API, browser storage namespace, and PostgreSQL customer table. The main project and its claims table remain separate.

## Deploy as a separate Vercel project

1. Create a second Vercel project connected to this repository.
2. Set its **Root Directory** to `customers-app`.
3. Add `DATABASE_URL` (or the supported `POSTGRES_URL`) to the Vercel project's environment variables.
4. Run `create-new-customers-table.sql` against that database before accepting registrations.
5. Deploy. The customer experience is served at `/`, and its API is `/api/customers`.

## Run locally

1. Configure the database connection in this folder's environment.
2. Run `create-new-customers-table.sql` against PostgreSQL.
3. Start the API with `npm install` followed by `npm start`.
4. Serve this folder's static files on a local web server and open `index.html` from that server.

The standalone frontend points to `http://127.0.0.1:5000/api/customers` on localhost and to `/api/customers` in a deployment.
