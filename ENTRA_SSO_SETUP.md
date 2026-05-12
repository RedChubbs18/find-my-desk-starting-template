# Entra ID SSO Setup Guide

This guide covers the complete end-to-end Entra ID Single Sign-On (SSO) flow for Team Orbit.

## Configuration Summary

### Entra App Registration
- **Client ID:** `993fb07a-161e-452f-9081-f2db2e6b5930`
- **Tenant ID:** `a96476fa-ab5b-4694-88e2-5843ab149973`
- **JWT Issuer:** `https://login.microsoftonline.com/a96476fa-ab5b-4694-88e2-5843ab149973/v2.0`
- **API Audience:** `api://993fb07a-161e-452f-9081-f2db2e6b5930`

### Entra Configuration Done
✅ App registration created  
✅ Graph API app credentials configured (client secret stored separately)  

### Entra Configuration Remaining
If using a different app registration or wanting to customize further:
- [ ] Expose API with App ID URI = `api://993fb07a-161e-452f-9081-f2db2e6b5930`
- [ ] Add delegated scope (optional for MVP, currently skipped)
- [ ] Configure front-channel logout (optional, for sign-out UX)

## Backend Configuration

### Variables Set in Code

All services (`api-gateway-bff`, `directory-service`, `neighbourhood-service`, `booking-service`, `recommendation-service`) now include:

```typescript
const API_AUDIENCE = process.env.API_AUDIENCE || 'api://993fb07a-161e-452f-9081-f2db2e6b5930';
const API_REQUIRED_SCOPE = process.env.API_REQUIRED_SCOPE || '';

const authConfig: AuthConfig = {
  jwtSecret: JWT_SECRET,
  jwtIssuer: JWT_ISSUER,
  jwtAudience: API_AUDIENCE,
  jwtRequiredScope: API_REQUIRED_SCOPE,
};
```

### What It Does
1. **JWT Issuer Validation:** Verifies token came from your Entra tenant
2. **Audience Validation:** Ensures token `aud` claim matches API audience
3. **Scope Validation:** (Currently skipped with `API_REQUIRED_SCOPE=""`) Can enforce delegated permissions

### Token Validation Flow
```
Frontend acquires token
         ↓
Frontend sends Authorization: Bearer <token>
         ↓
Backend validates:
  - Signature (using JWT_SECRET)
  - Issuer (must match JWT_ISSUER)
  - Audience (must include API_AUDIENCE)
  - Expiration
  - Scope (if API_REQUIRED_SCOPE is set)
         ↓
Token valid → Request proceeds
Token invalid → 401 Unauthorized
```

## Frontend Configuration

### MSAL Integration
Frontend now uses Microsoft Authentication Library (MSAL) for React to handle Entra login.

**Install dependencies:**
```bash
npm install
```

**Environment variables (in `.env` or passed to Vite):**
```
VITE_ENTRA_CLIENT_ID=993fb07a-161e-452f-9081-f2db2e6b5930
VITE_ENTRA_AUTHORITY=https://login.microsoftonline.com/a96476fa-ab5b-4694-88e2-5843ab149973
VITE_ENTRA_REDIRECT_URI=http://localhost:5173
VITE_ENTRA_SCOPES=openid profile email
```

**Local Development:**
```bash
cd apps/frontend
npm run dev  # Runs on http://localhost:5173
```

### Login Flow
1. User clicks "Sign In with Entra" button
2. MSAL opens pop-up to Entra login
3. User authenticates with org credentials
4. MSAL acquires access token with specified scopes
5. Token stored in localStorage by MSAL
6. API client automatically includes token in Authorization header

### Token Inspection
When a token is acquired, MSAL logs it to browser console:
```javascript
console.log('Token acquired. Payload:', JSON.parse(atob(token.split('.')[1])));
```

Check browser DevTools → Console to see decoded token payload with `aud` and `iss` claims.

## Testing the Full SSO Flow

### 1. Start Backend Services
```bash
npm run dev:services
```

This starts:
- API Gateway BFF on port 3000
- Directory Service on port 3001
- Neighbourhood Service on port 3002
- Booking Service on port 3003
- Recommendation Service on port 3004

### 2. Start Frontend
```bash
cd apps/frontend
npm run dev
```

Runs on `http://localhost:5173`

### 3. Test Sign-In
1. Open browser to `http://localhost:5173`
2. Click "Sign In with Entra"
3. Enter your org email and password
4. Check browser console for token payload
5. Verify `aud` = `api://993fb07a-161e-452f-9081-f2db2e6b5930`
6. Verify `iss` = `https://login.microsoftonline.com/.../v2.0`

### 4. Test API Calls
After sign-in:
1. Click "Get Recommendations" or "Book" buttons
2. Requests should succeed (backend validates token)
3. Check Network tab → Authorization header has Bearer token
4. If audience/issuer mismatch, backend returns 401

## Environment Variables Reference

### Backend (All Services)
```env
JWT_SECRET=dev-secret-change-in-prod
JWT_ISSUER=https://login.microsoftonline.com/a96476fa-ab5b-4694-88e2-5843ab149973/v2.0
API_AUDIENCE=api://993fb07a-161e-452f-9081-f2db2e6b5930
API_REQUIRED_SCOPE=  # Leave empty for MVP (no scope enforcement)
```

### Directory Service (Graph Integration)
```env
GRAPH_CLIENT_ID=993fb07a-161e-452f-9081-f2db2e6b5930
GRAPH_CLIENT_SECRET=<stored-securely>  # Never in source control
GRAPH_TENANT_ID=a96476fa-ab5b-4694-88e2-5843ab149973
```

### Frontend
```env
VITE_ENTRA_CLIENT_ID=993fb07a-161e-452f-9081-f2db2e6b5930
VITE_ENTRA_AUTHORITY=https://login.microsoftonline.com/a96476fa-ab5b-4694-88e2-5843ab149973
VITE_ENTRA_REDIRECT_URI=http://localhost:5173  # Change for production
VITE_ENTRA_SCOPES=openid profile email
```

## Deployment (Helm/AKS)

Helm values in `deploy/helm/values.yaml`:

```yaml
globalEnv:
  ENTRA_CLIENT_ID: "993fb07a-161e-452f-9081-f2db2e6b5930"
  ENTRA_TENANT_ID: "a96476fa-ab5b-4694-88e2-5843ab149973"
  API_AUDIENCE: "api://993fb07a-161e-452f-9081-f2db2e6b5930"
  API_REQUIRED_SCOPE: ""

frontend:
  env:
    VITE_ENTRA_CLIENT_ID: "993fb07a-161e-452f-9081-f2db2e6b5930"
    VITE_ENTRA_AUTHORITY: "https://login.microsoftonline.com/a96476fa-ab5b-4694-88e2-5843ab149973"
    VITE_ENTRA_REDIRECT_URI: "https://team-orbit.example.com"  # Update for your domain
    VITE_ENTRA_SCOPES: "openid profile email"
```

Secrets stored in Kubernetes or Azure Key Vault:
- `JWT_SECRET`
- `GRAPH_CLIENT_SECRET`

## Troubleshooting

### Frontend Token Acquisition Fails
- Check browser console for MSAL errors
- Verify `VITE_ENTRA_CLIENT_ID` and `VITE_ENTRA_AUTHORITY` are correct
- Ensure redirect URI is whitelisted in Entra app registration

### Backend Returns 401
- Check token payload: `aud` should equal `api://993fb07a-161e-452f-9081-f2db2e6b5930`
- Check token payload: `iss` should contain your tenant ID
- Verify `JWT_SECRET` and `JWT_ISSUER` match across all services
- Check browser Network tab for full Authorization header

### CORS Errors
- Frontend URL must be in `api-gateway-bff` CORS whitelist
- Check `FRONTEND_URL` env var or hardcoded localhost:5173

## Next Steps

### Phase 1 (Current - MVP)
✅ MSAL login integrated  
✅ Token acquisition and validation  
✅ Backend audience/issuer validation  
✅ Scope enforcement ready (disabled for MVP)  

### Phase 2 (Future)
- [ ] Graph API integration to fetch real user profiles
- [ ] Fine-grained scope permissions (`access_as_user`, etc.)
- [ ] Advanced consent and incremental scoping
- [ ] Production hardening (key rotation, token caching, refresh tokens)
- [ ] Multi-tenant support

## Security Notes

1. **Never commit secrets** to source control
   - `JWT_SECRET` → Store in env/vault
   - `GRAPH_CLIENT_SECRET` → Store in Key Vault/vault

2. **Token storage**
   - MSAL automatically stores in `localStorage` by default
   - For higher security, use `sessionStorage` or in-memory storage

3. **CORS allowlist**
   - Keep production redirect URI specific
   - Don't use wildcard origins with credentials

4. **Audience matching**
   - Ensure all services validate same `API_AUDIENCE`
   - Prevents tokens for other APIs from being accepted
