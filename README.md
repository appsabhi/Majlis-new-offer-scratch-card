# Majlis Scratch Card - Promotional Web Demo

A simple, professional, fully working **Onam Festive Campaign** web application. It features a mobile-first scratch card, real-time scratch progress detection, vanilla JS confetti animation, Instagram follow step, registration form validation, and coupon-code delivery.

Designed for **Majlis Restaurant & Banquet** festive marketing demo.

This project is a copy of the `scratch-card-demo` app. Its existing offer configuration and scratch-card behavior are intentionally unchanged. The registration form now includes a required branch selector using the three locations already listed in the footer.

---

## 📁 File Structure

```text
scratch-card-demo/
├── index.html   # Main structure (Scratch Card, Instagram step, Details Form, Success ticket stub)
├── style.css    # Festive Onam color tokens, layout styling, and animations
├── script.js    # Logic for Canvas scratching, Progress math, Confetti particles, Form validating, screen state machine
└── README.md    # Documentation and running guide (this file)
```

---

## 🚀 Real-World Campaign Architecture

In the updated campaign flow, the QR Code is **external** to the website (printed on posters, flyers, or shared on social media). The customer experience follows this flow:

```text
  [ External QR Code on Poster/Flyer ]
                   │
                   ▼  (Customer scans with mobile camera)
  [ Mobile Web Browser opens Promotional Webpage URL ]
                   │
                   ▼  (Webpage loads directly to Scratch Card)
  [ Interactive Scratch Card Screen ]
                   │
                   ▼  (User scratches 50% of the surface)
  [ Congratulations Screen & Confetti Burst ]
                   │
                   ▼  (After 3.8s delay, user is prompted to Follow Instagram)
  [ Follow @MajlisKerala on Instagram ]
                   │
                   ▼  (User clicks Continue to details)
  [ Customer Registration Form (Name, Mobile, Email) ]
                   │
                   ▼  (User submits details, system validates)
  [ Success Screen (Unlocks Coupon: ONAM20) ]
```

---

## ⚙️ Running the Demo Locally

1. Create the PostgreSQL tables using the SQL files listed below and configure the database connection.
2. In one terminal, start the backend from the `Majlis-new-scratch-card` directory:
   - **NodeJS:** `npm start`
3. In a second terminal, launch a local static web server:
   - **Python:** `python -m http.server 8000`
   - **NodeJS:** `npx http-server -p 8000`
4. Open `http://localhost:8000` for the original page or `http://localhost:8000/customers.html` for the separate customer page.
5. Test the scratch-card and customer-registration flow.

### Separate customer experience and data

The original scratch-card page remains at `/` and uses `public.majlis_new_scratch_card_claims` through `/api/claims`. A separate copy of the same experience is available at `/customers` (or `customers.html` on a basic local static server). It uses `/api/customers` and the independent `public.majlis_new_scratch_card_customers` table.

For an independent customer deployment, create a second Vercel project from this repository and set its Root Directory to [`customers-app`](./customers-app). That folder includes its own entry page, assets, API, and Vercel configuration; see its [deployment instructions](./customers-app/README.md).

Run both SQL files against the PostgreSQL database configured for the project before using the respective flows:

- [`create-new-claims-table.sql`](./create-new-claims-table.sql) creates the claims table.
- [`create-new-customers-table.sql`](./create-new-customers-table.sql) creates the separate customer table. The standalone deployment also includes a copy of this SQL file in [`customers-app`](./customers-app).

Each table enforces unique mobile numbers independently. Customer-page browser state and registrations are separate from the original campaign. The existing Google Sheets backup remains connected only to the original page, so the new customer flow does not mix its records into the existing sheet.

For the original page's Google Sheets backup, add a `Branch` header to row 1. The recommended column order is Full Name, Mobile Number, Email, Branch, Offer, Claim Date & Time.

---

## 🏗️ Backend Integration Readiness

The client-side code is structured specifically to make backend hooks easy to insert later:

### 1. Database & API Submission Hook
Inside `script.js`, look for the `handleFormSubmit(e)` function. When validation is successful, the app compiles the customer's data into a JSON object:
```javascript
const demoUserData = {
    name: inputName.value.trim(),
    mobile: inputMobile.value.trim(),
    email: inputEmail.value.trim(),
    claimedOffer: "20% OFF",
    couponCode: "ONAM20",
    timestamp: new Date().toISOString()
};
```
Currently, this is printed to the developer console and a `setTimeout` simulates network latency (1.2s). To connect a real backend:
- Replace the `setTimeout` with a fetch query:
  ```javascript
  fetch('/api/claim-coupon', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(demoUserData)
  })
  .then(response => response.json())
  .then(data => {
      if(data.success) {
          showScreen(screenSuccess);
      } else {
          alert(data.message || 'Already claimed!');
      }
  });
  ```

### 2. Double-Claim Verification
You can easily prevent duplicates by having your server inspect the database for duplicate `mobile` numbers before returning `success: true`. If a duplicate is found, the server can return a status of `400 Bad Request` and your script can apply an error class to `inputMobile` showing *"This number has already claimed this offer!"*.
