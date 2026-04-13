# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🧭 High-Level Architecture & Overview

This application is a full-stack e-commerce platform for custom shirts, built with **Node.js/Express.js** on the backend and serving static HTML/JS/CSS on the frontend.

### 📜 Project Context: Special One
*   **Brand:** Special One
*   **Tagline:** "Don't wear the brand. Be the brand."
*   **Concept:** India's first identity-driven custom shirt platform. Customers design their shirts online, which are then manufactured and shipped.
*   **Pricing:** **₹3,999 FIXED** for every product. This price never varies.
*   **Website:** specialone.in
*   **Support Email:** support@specialone.in
*   **Payments:** Razorpay (Integration keys are in `.env`).
*   **Delivery:** Shiprocket (Credentials are in `.env`).
*   **Exclusions:** Do not accept corporate bulk orders or wedding/shaadi orders.

### 📂 File Structure:
The codebase is highly structured:
*   **Frontend (Static Assets):** Located in the root directory (e.g., `index.html`, `customizer.html`, `cart.html`, etc.). This is the client-side experience.
*   **Backend Core:** Handled in `specialone/server/server.js`. This file manages middleware, connects to MongoDB, and mounts all API routes.
*   **Models:** Database schemas are defined in `specialone/server/models/*.js` (`Customer.js`, `Order.js`, `Product.js`, etc.).
*   **Routes:** API endpoints are grouped in `specialone/server/routes/*`.
*   **Middleware:** Security, authentication, and business logic validation reside in `specialone/server/middleware/`.
*   **Services:** External integrations (Payments, Shipping, Email) are abstracted in `specialone/server/services/`.

## ✨ Design System & Frontend Principles
**Rule:** Pure CSS implementation only. NO Bootstrap, NO Tailwind, NO React/Vue framework required.

**Design System Variables (Must be implemented in `global.css`):**
*   **Colors:** `--white: #FFFFFF;`, `--cream: #F8F5F0;`, `--ivory: #F2EDE6;`, `--preview-bg: #F5F2EE;`, `--text-primary: #0D0D0D;`, `--text-secondary: #4A4A4A;`, `--gold: #C9A84C;`, `--gold-dark: #A8892E;`, `--navy: #0A1628;`, `--navy-light: #162440;`, `--charcoal: #1C1C2E;`, `--divider: #E8E0D5;`
*   **Fonts:** `--font-display: 'Bebas Neue', sans-serif;` (Headings), `--font-serif: 'Cormorant Garamond', serif;` (Body), `--font-ui: 'Montserrat', sans-serif;` (Labels/Buttons).
*   **Spacing:** `--section-padding: 80px 0;`, `--container-max: 1200px;`

**Customizer (CRITICAL):**
*   **Layout:** Two-panel split (55% Preview | 45% Selector).
*   **SVG Layers:** The preview must be built from **STACKED SVG LAYERS** (e.g., `shirt-body-front.svg`, `collar-[name].svg`, etc.). All layers must share `position: absolute`, `top: 0`, `left: 0`, `width: 100%`, `height: 100%`.
*   **Interaction:** Layer changes must use CSS transitions (`opacity`) to fade, *not* instant swaps.

## 🔑 Security & Authentication Details

### 🔒 Security Middleware (Must be applied first):
Security is paramount. Middleware layers must be applied in this order in `server.js`:
1.  `helmet()`: Sets necessary HTTP security headers.
2.  `cors()`: Whitelist allowed origins (e.g., `https://specialone.in`, `http://localhost:3000`).
3.  `mongoSanitize()`: Prevents NoSQL injection in queries.
4.  **Rate Limiting:** Different endpoints require different limits (e.g., `/api/payment` uses a tight limit, `/api/auth/login` uses a separate limit).

### 🌐 Authentication (JWT & Cookies):
*   **Token Handling:** Tokens **MUST NOT** be stored in `localStorage` on the client side. Use `httpOnly` cookies only for the access token (`adminToken`) and refresh token (`adminRefreshToken`).
*   **Token Generation:** Use `jwt.sign()` with secrets from `.env`.
*   **Token Refresh:** Implement a dedicated `/api/auth/refresh` endpoint that verifies the `adminRefreshToken` against the stored value in the `AdminUser` document and issues a new access token.

### 🔑 Credentials Handling:
*   **All Secrets:** Never commit secrets (`.env`, `JWT_SECRET`, `RAZORPAY_KEY_SECRET`, etc.) to Git. They must be loaded from the local `.env` file.
*   **Hashing:** Passwords must be hashed using `bcrypt.hash(password, 12)` before saving to the DB.
*   **Input Validation:** All incoming text (e.g., user names, addresses) must be passed through `sanitizeHtml()` to strip dangerous characters.

## 🛠️ Development & Deployment Workflow

### 🚀 Running the App:
1.  **Install Dependencies:** `npm install`
2.  **Seed Data (One Time):** `npm run seed` (Sets up the super admin)
3.  **Run Locally:** `npm run dev` (Uses `nodemon` for hot-reloading, runs on port 5000 by default).

### 🎯 Key Process Flows:
*   **Order Placement:** Client $\to$ API (`/api/payment/create-order`) $\to$ **Razorpay** $\to$ Client confirms $\to$ API (`/api/payment/verify`) $\to$ Server verifies signature $\to$ API (`/api/shipping/create`) $\to$ **Shiprocket** $\to$ Order saves to DB $\to$ Email sent.
*   **Admin Actions:** All critical actions (user creation, status change, etc.) **MUST** be logged to the `AuditLog` collection, referencing both the `adminUser` and the affected `entity`.

### 🛠️ Tech Stack & Packages:
*   **Backend:** Express, Mongoose, bcrypt, jsonwebtoken, helmet, cors, express-rate-limit, express-mongo-sanitize, sanitize-html, multer, nodemailer, razorpay, dotenv.
*   **Database:** MongoDB Atlas.

## 📚 Admin Panel Details
**Design:** Light theme (Cream/White). Must implement Role-Based Access Control (RBAC) using roles defined in `AdminUser.js` (SuperAdmin, Admin, Vendor, Support).
*   **Roles:** SuperAdmin has full rights. Vendor/Support roles have restricted read/write access (e.g., Support can view orders but not modify payment statuses).
*   **Dashboard:** Must display live statistics (Today's Orders, Today's Revenue, etc.) using data aggregated from the `Order` and `Customer` collections.

## ⚠️ ABSOLUTE RULES (DO NOT DEVIATE)
1.  **Styling:** Must be pure CSS only.
2.  **Pricing:** Price is **ALWAYS ₹3,999**.
3.  **Auth:** Use `httpOnly` cookies for all sessions.
4.  **Sanitization:** Sanitize *all* user-provided text inputs server-side.
5.  **Logging:** Every significant administrative action must write to `AuditLog`.

---
*Special One — India's first identity-driven custom shirt platform*
*"Don't wear the brand. Be the brand."*
*Website: specialone.in | Email: support@specialone.in*