# HisaabBook Backend (multi-tenant)

Each registered user creates a **business (tenant)**. All data (sales, purchases, dealers,
expenses, balances, transactions) belongs to one tenant and is invisible to others.

## How isolation works
- `middlewares/auth.js` verifies the JWT and stores the user's tenant in an `AsyncLocalStorage` context.
- `plugins/tenantPlugin.js` (applied to every business model) adds `tenant` to each document and injects it
  into every `find/update/delete/count/aggregate`. A query with no tenant context **throws** (fails closed).
- IDs (`bill_id`, `dealer_id`, ...) are unique **per tenant**, so two shops can both have bill `1001`.
- Scripts that must run unscoped use `.setOptions({ skipTenant: true })`.

## Auth
Send `Authorization: Bearer <access_token>` on every route except `/api/auth/*` and `/api/health`.
Access tokens last 15 min; refresh tokens last 30 days and are single-use (rotated on every refresh).

| Method | Route | Notes |
|---|---|---|
| POST | `/api/auth/register` | `{name, email, password(>=8), business_name, phone?, address?}` -> user, business, tokens |
| POST | `/api/auth/login` | `{email, password}` |
| POST | `/api/auth/refresh` | `{refresh_token}` -> new token pair |
| POST | `/api/auth/logout` | `{refresh_token}` |
| GET | `/api/auth/me` | current user + business |
| POST | `/api/auth/change-password` | signs out all devices |
| DELETE | `/api/auth/account` | owner only, `{password}`; deletes the business and all its data |
| GET/PUT | `/api/business` | business profile (PUT: owner). |
| GET/POST | `/api/business/staff` | owner only |
| PATCH/DELETE | `/api/business/staff/:id` | owner only; `{is_active}` to disable |

Roles: `owner` (everything) and `staff` (all business data, but no business settings / staff management / account deletion).
On a `401` with `code: "TOKEN_EXPIRED"`, call `/api/auth/refresh` and retry.

Business endpoints are unchanged: `/api/sales`, `/api/purchases`, `/api/dealers`, `/api/expenses`,
`/api/balances`, `/api/transactions`.

## Setup
```
cp .env.example .env        # fill MONGO_URI, JWT_SECRET (>=32 chars)
npm install
npm run dev
```

## Migrating existing single-user data
```
npm run migrate:tenant -- you@example.com "StrongPassword" "Rajasthan Steel and Crockery" "Murtaza Bohra"
```
Creates the owner login + business, assigns all existing documents to it, and rebuilds indexes per tenant.
Run it **before** the new server handles traffic.
