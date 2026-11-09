# Authentication Integration Guide

**Project:** Food Delivery Application  
**Backend stack:** Node.js, Express, MongoDB/Mongoose, Passport.js, Google OAuth 2.0, JWT, Argon2, EJS  
**Audience:** Frontend developer integrating the frontend with the backend authentication APIs

> This guide documents the authentication implementation discussed for the backend. It is an integration handoff, not a claim that every production-hardening item is already implemented. Pay particular attention to the **Google OAuth integration note** and the **CORS/token-handling notes** below.

---

## 1. Authentication overview

The backend supports two sign-in methods:

1. **Email and password:** the frontend sends credentials to the REST API. The backend verifies the password hash and returns an application JWT.
2. **Google OAuth:** the browser is redirected to Google through Passport.js. After Google verifies the user, the backend finds or creates the MongoDB user and issues an application JWT.

Google's OAuth access token is not the application's login token. The frontend should use the **JWT issued by this backend** when calling protected API endpoints.

### Current authentication flow

```text
Email/password:
Frontend -> POST /api/auth/login -> Express -> MongoDB + Argon2
         <- user + application JWT

Protected API:
Frontend -> Authorization: Bearer <application JWT>
Backend  -> verifies JWT -> loads active user -> handles request

Google OAuth:
Browser -> GET /api/auth/google -> Google sign-in/consent
        -> GET /api/auth/google/callback
        -> Passport verifies Google profile
        -> MongoDB finds/creates/links user
        <- backend application JWT + user JSON
```

---

## 2. Backend base URL

Set the API base URL in the frontend environment configuration. Do not hard-code it throughout the frontend source code.

| Environment | Example base URL |
|---|---|
| Local development | `http://localhost:3000` |
| Production | Use the deployed backend HTTPS URL supplied by the backend team |

Example frontend configuration:

```js
// Example only; use the environment-variable syntax of your frontend tool.
const API_BASE_URL = "http://localhost:3000";
```

The API routes below are relative to this base URL.

---

## 3. API endpoints

| Method | Endpoint | Authentication | Purpose |
|---|---|---|---|
| `POST` | `/api/auth/register` | Public | Create a customer account |
| `POST` | `/api/auth/login` | Public | Sign in with email and password |
| `GET` | `/api/auth/me` | Bearer JWT | Get the currently authenticated user |
| `GET` | `/api/auth/google` | Browser redirect | Start Google OAuth |
| `GET` | `/api/auth/google/callback` | OAuth callback | Complete Google sign-in |
| `GET` | `/health` | Public | Check whether the API is running |

### 3.1 Register

**Request**

```http
POST /api/auth/register
Content-Type: application/json
```

```json
{
  "firstName": "Alex",
  "lastName": "Johnson",
  "email": "alex@example.com",
  "password": "StrongPassword123"
}
```

**Successful response — `201 Created`**

```json
{
  "message": "Registration successful",
  "user": {
    "id": "672123456789abcdef123456",
    "firstName": "Alex",
    "lastName": "Johnson",
    "email": "alex@example.com",
    "role": "customer"
  },
  "accessToken": "<application-jwt>"
}
```

Frontend notes:

- Send JSON, not form-encoded data, to this endpoint.
- `role` is assigned by the backend. Do not send a role from the registration form.
- The password is hashed by the backend. Never hash it in the frontend and never store or log the plain-text password.
- The current backend example checks for a password length of 8–128 characters. The frontend should provide matching guidance, but backend validation remains authoritative.

### 3.2 Login

**Request**

```http
POST /api/auth/login
Content-Type: application/json
```

```json
{
  "email": "alex@example.com",
  "password": "StrongPassword123"
}
```

**Successful response — `200 OK`**

```json
{
  "message": "Login successful",
  "user": {
    "id": "672123456789abcdef123456",
    "firstName": "Alex",
    "lastName": "Johnson",
    "email": "alex@example.com",
    "role": "customer"
  },
  "accessToken": "<application-jwt>"
}
```

### 3.3 Get the current user

Call this endpoint after login or registration to validate the token and retrieve the latest user profile.

**Request**

```http
GET /api/auth/me
Authorization: Bearer <application-jwt>
```

**Successful response — `200 OK`**

```json
{
  "user": {
    "id": "672123456789abcdef123456",
    "firstName": "Alex",
    "lastName": "Johnson",
    "email": "alex@example.com",
    "role": "customer"
  }
}
```

The current public user response may also contain `phone` and `profileImageUrl` when those fields are populated. It intentionally does not return `passwordHash`.

### 3.4 Start Google OAuth

Google OAuth is a **browser navigation**, not a normal `fetch()` request.

```js
window.location.href = `${API_BASE_URL}/api/auth/google`;
```

Do not call this endpoint using `fetch()` or Axios. The browser needs to follow the redirect to Google's sign-in page.

After Google authentication, Google redirects to the backend callback configured in Google Cloud Console:

```text
http://localhost:3000/api/auth/google/callback
```

### 3.5 Google callback: current implementation and integration limitation

The current backend callback sends a JSON response containing:

```json
{
  "message": "Google login successful",
  "user": {
    "id": "672123456789abcdef123456",
    "firstName": "Alex",
    "lastName": "Johnson",
    "email": "alex@gmail.com",
    "role": "customer"
  },
  "accessToken": "<application-jwt>"
}
```

**Important:** when the browser reaches this callback through a full-page redirect, it displays the JSON response. It does not automatically pass the token into a separate frontend application's JavaScript state. This is adequate for initial backend testing, but it is not yet a polished SPA/browser integration.

Before merging Google sign-in into a separately hosted frontend, the backend and frontend developers must agree on one of these handoff patterns:

**Preferred browser pattern — HttpOnly cookie:**

1. On successful Google callback, the backend sets the application JWT in a `Secure`, `HttpOnly` cookie with an appropriate `SameSite` policy.
2. The backend redirects the browser to a frontend route such as `/auth/callback` or `/`.
3. The frontend calls `GET /api/auth/me` with credentials enabled; the browser sends the cookie automatically.
4. The auth middleware is updated to read and verify the cookie as well as (or instead of) the Bearer header.
5. The backend configures CORS for the exact frontend origin and enables credentials.

This requires backend changes; the current example middleware reads the `Authorization` header only and the current OAuth callback returns JSON only.

**Alternative — one-time authorization-code exchange:** the backend creates a short-lived, single-use code after Google sign-in, redirects to the frontend with that code, and exposes an endpoint to exchange it for an application session/token. Do not put a long-lived JWT or Google access token directly in a redirect URL.

The frontend developer should not implement a token-in-query-string workaround. URLs can be retained in browser history, logs, and referrer data.

---

## 4. Frontend API examples

The following examples use browser `fetch()` and work with the current email/password Bearer-token API. Adapt the code to the frontend framework, state-management library, and environment configuration used by the project.

### 4.1 Small API helper

```js
const API_BASE_URL = "http://localhost:3000";

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.token
        ? { Authorization: `Bearer ${options.token}` }
        : {}),
      ...options.headers,
    },
  });

  // The API normally returns JSON. Guard against an empty/non-JSON response.
  const responseBody = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(
      responseBody.message || `Request failed (${response.status})`
    );
    error.status = response.status;
    error.body = responseBody;
    throw error;
  }

  return responseBody;
}
```

### 4.2 Register

```js
import { apiRequest } from "./api";

export async function register(formValues) {
  return apiRequest("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({
      firstName: formValues.firstName,
      lastName: formValues.lastName,
      email: formValues.email,
      password: formValues.password,
    }),
  });
}
```

### 4.3 Login

```js
import { apiRequest } from "./api";

export async function login(email, password) {
  return apiRequest("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}
```

Example usage:

```js
const result = await login(email, password);

// result.user contains the safe user profile.
// result.accessToken is the backend-issued JWT.
// Keep the token out of URLs, console logs, analytics, and error reports.
```

### 4.4 Fetch the signed-in user's profile

```js
import { apiRequest } from "./api";

export async function getCurrentUser(accessToken) {
  return apiRequest("/api/auth/me", {
    method: "GET",
    token: accessToken,
  });
}
```

### 4.5 Google sign-in button

```js
const API_BASE_URL = "http://localhost:3000";

export function continueWithGoogle() {
  window.location.assign(`${API_BASE_URL}/api/auth/google`);
}
```

This starts the OAuth redirect. The frontend still needs the callback handoff described in section 3.5 before it can treat the user as signed in within the frontend application.

---

## 5. JWT handling on the frontend

The current API returns an application JWT in the `accessToken` response property after registration and login. Protected API requests must send it as:

```http
Authorization: Bearer <application-jwt>
```

Recommended handling:

- Never place a JWT in a URL or query parameter.
- Never log the JWT or include it in analytics/error telemetry.
- Prefer keeping short-lived access tokens in application memory where practical.
- Avoid storing authentication tokens in `localStorage` for a production browser application because JavaScript running through an XSS vulnerability can read them.
- A production browser application should preferably use Secure, HttpOnly cookies with appropriate CSRF protection, or a carefully designed short-lived access-token/refresh-token architecture.

**Current implementation limitation:** there is no refresh-token endpoint and no logout endpoint yet. The current access token expires according to `JWT_EXPIRES_IN` (the example default is `1d`). If a token is lost or expires, the user must sign in again until refresh-token functionality is implemented.

A frontend-only logout can clear the token from in-memory application state, but it does not revoke an already-issued JWT. A proper server-side logout/session invalidation flow is a future backend feature.

---

## 6. User object and roles

The backend's safe user response is based on this shape:

```ts
interface AuthUser {
  id: string;
  firstName: string;
  lastName?: string;
  email: string;
  phone?: string;
  profileImageUrl?: string;
  role: "customer" | "restaurant_owner" | "delivery_partner" | "admin";
}
```

Use `user.id` as the frontend's user identifier. Do not assume the response includes `passwordHash` or Google OAuth tokens; it must not.

### Role-aware frontend UI

The frontend may use `user.role` to decide which navigation items or dashboard links to display:

- `customer`: customer-facing experience
- `restaurant_owner`: restaurant management experience
- `delivery_partner`: delivery experience
- `admin`: administrative experience

This is only a UI convenience. Hiding a button is not authorization. The backend must enforce role permissions on every protected operation. Registration must not allow the client to choose its role.

---

## 7. Error handling

The current controllers return JSON errors with a `message` field for common failures.

| HTTP status | Meaning | Suggested frontend behaviour |
|---|---|---|
| `400` | Missing or invalid request fields | Show a validation message near the form |
| `401` | Missing, invalid, or expired authentication | Ask the user to sign in again |
| `403` | Account is not active, or access is forbidden | Show an access/account status message |
| `409` | Email or another unique value already exists | Tell the user the account already exists or offer login |
| `500` | Unexpected backend error | Show a generic error and allow retry |

Example error body:

```json
{
  "message": "Invalid email or password"
}
```

Do not depend on exact wording for program logic. Use HTTP status codes for branching and display the `message` as user-facing text only after appropriate handling.

---

## 8. MongoDB user fields relevant to the frontend

The backend User model is designed around these fields:

| Field | Type | Frontend use |
|---|---|---|
| `firstName` | String | Display name / registration |
| `lastName` | String | Display name / registration |
| `email` | String, unique index | Login and account identity |
| `passwordHash` | String, private | Never request or display |
| `googleId` | String, unique sparse index | Backend-only account linking |
| `phone` | String | Profile/contact UI when profile APIs are added |
| `profileImageUrl` | String | Avatar |
| `role` | Enum | Role-aware UI |
| `status` | Enum | Account status; backend enforces access |
| `isEmailVerified` | Boolean | Verification state when exposed by an API |
| `addresses` | Array of address objects | Delivery address UI when address APIs are added |
| `lastLoginAt` | Date | Usually not needed by customer UI |
| `createdAt`, `updatedAt` | Date | Account metadata if needed |

The current authentication endpoints do not yet provide CRUD endpoints for profile data or delivery addresses. Do not build frontend calls to those routes until the backend team adds them.

---

## 9. CORS and local development

If the frontend and backend use different origins (for example, frontend at `http://localhost:5173` and backend at `http://localhost:3000`), the backend must configure CORS. The earlier `app.js` example does **not** yet include CORS configuration.

For a Bearer-token API, the backend can allow the exact frontend origin and the required methods/headers. Do not use a wildcard origin when credentials/cookies are enabled.

For the recommended cookie-based OAuth handoff, the backend must additionally:

- allow the exact frontend origin with `credentials: true`;
- configure the frontend requests with `credentials: "include"`;
- set cookies with appropriate `HttpOnly`, `Secure`, and `SameSite` attributes;
- add CSRF protection for state-changing requests, and validate expected origins where appropriate.

Coordinate the actual frontend origin with the backend developer rather than guessing it.

---

## 10. Google OAuth configuration checklist

The backend `.env` uses:

```env
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=http://localhost:3000/api/auth/google/callback
```

The Google Cloud OAuth client must have the exact matching redirect URI:

```text
http://localhost:3000/api/auth/google/callback
```

For local development, the authorized JavaScript origin is normally:

```text
http://localhost:3000
```

The Google OAuth app's consent screen/test-user configuration must also permit the Google account being used for testing. Keep `GOOGLE_CLIENT_SECRET` on the backend only; never add it to frontend environment variables or browser bundles.

Production must use HTTPS and the production callback URL registered in Google Cloud Console.

---

## 11. Frontend/backend integration checklist

### Email/password integration

- [ ] Frontend and backend agree on the backend base URL.
- [ ] Register form sends `firstName`, `lastName`, `email`, and `password` as JSON.
- [ ] Login form sends `email` and `password` as JSON.
- [ ] Successful login/register stores the returned safe user profile in frontend state.
- [ ] Frontend attaches the returned application JWT as a Bearer token to protected API requests.
- [ ] App startup checks authentication with `GET /api/auth/me` when a token is available.
- [ ] `401`, `403`, `409`, and `500` responses are handled appropriately.
- [ ] Tokens and passwords are not written to logs or URLs.

### Google OAuth integration

- [ ] Google sign-in uses browser navigation to `/api/auth/google`.
- [ ] Google Cloud redirect URI exactly matches the backend callback URL.
- [ ] Backend and frontend agree on the callback handoff (HttpOnly cookie is the recommended browser option).
- [ ] Backend callback redirects to the correct frontend route after successful authentication.
- [ ] Frontend calls `/api/auth/me` after the callback to load the signed-in user.
- [ ] Failed/cancelled Google sign-in displays an appropriate frontend error state.

### Before merging / deployment

- [ ] CORS is configured for the actual frontend origin.
- [ ] Production uses HTTPS and secure secrets stored in the deployment environment.
- [ ] The production OAuth callback URI is registered in Google Cloud.
- [ ] OAuth session storage is not Express's in-memory development store in production.
- [ ] Backend rate limiting and stricter request validation are added to authentication routes.
- [ ] Token storage, expiry, refresh, logout, and CSRF strategy are agreed upon.
- [ ] Backend authorization is implemented for every role-restricted endpoint.

---

## 12. Run and test the backend locally

From the backend project directory:

```bash
npm install
npm run dev
```

Check the health endpoint:

```text
GET http://localhost:3000/health
```

Then test in this order:

1. Register a new test customer using Postman or the frontend.
2. Confirm the user exists in MongoDB and that `passwordHash` is hashed (not plain text).
3. Log in using the same credentials.
4. Call `/api/auth/me` with the returned Bearer JWT.
5. Call `/api/auth/me` without a token and confirm it is rejected with `401`.
6. Open `/login` or `/api/auth/google` in a browser and complete Google sign-in.
7. Confirm that Google sign-in creates or links the intended MongoDB user.
8. Complete the agreed frontend callback handoff before marking Google OAuth as integrated in the UI.

---

## 13. Known gaps in the current MVP

The following items should be treated as follow-up backend work, not as existing functionality:

- Google callback currently returns JSON; a frontend redirect/cookie or one-time-code handoff is still required for a smooth browser integration.
- CORS is not configured in the current `app.js` example.
- The current JWT middleware reads the `Authorization: Bearer` header; cookie-based authentication requires middleware changes.
- Refresh-token rotation and a logout/revocation endpoint are not implemented.
- Authentication rate limiting and a full validation layer are not implemented in the example.
- Email verification and password-reset flows are not implemented.
- Role-based authorization middleware and role-specific API routes still need to be added.
- The default Express session MemoryStore is for development only; use a persistent session store in production.

Please coordinate these points with the backend developer before assuming the corresponding frontend feature is ready.

---

## 14. Team integration agreement

Before merging, both developers should confirm these values and decisions in the project README or team notes:

| Item | Agreed value |
|---|---|
| Frontend local origin | To be confirmed |
| Backend local origin | `http://localhost:3000` (unless changed) |
| Production API URL | To be confirmed |
| Google callback URL | `http://localhost:3000/api/auth/google/callback` locally |
| Browser token strategy | Bearer token for current MVP; cookie handoff recommended for production browser auth |
| Google callback handoff | Must be implemented and agreed before frontend integration is complete |
| Customer default role | `customer` |

**Integration rule:** the frontend should consume the documented API contract and should not directly access MongoDB, read backend `.env` values, or attempt to verify passwords or Google tokens itself. Authentication and authorization decisions belong to the backend.
