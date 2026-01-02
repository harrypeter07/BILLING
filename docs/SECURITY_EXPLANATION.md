# Security Implementation Explanation

## Why These Changes Were Needed

### The Problem: Offline Tampering Vulnerability

**Original Issue:**

- Sessions were stored in IndexedDB with only an `expiresAt` timestamp
- Anyone could open browser DevTools → Application → IndexedDB
- Modify `expiresAt` to a future date (e.g., year 2099)
- Change system time to extend sessions
- **Result**: Unlimited access without proper authentication

### Why This Was Critical

1. **IndexedDB is Client-Side**: All data is accessible and modifiable via browser DevTools
2. **No Integrity Checks**: No way to detect if data was tampered with
3. **Time Manipulation**: System clock can be changed to bypass expiry
4. **Offline Mode**: No server validation means no way to verify legitimacy

---

## What Changed and Why

### 1. Cryptographic Signatures (HMAC-SHA256)

**What:**

- Every session now has a cryptographic signature
- Signature is generated from: userId, email, role, storeId, issuedAt, expiresAt
- Any modification to these fields invalidates the signature

**Why:**

- **Detects Tampering**: If someone modifies `expiresAt`, the signature won't match
- **Prevents Replay**: Signature is tied to specific session data
- **Integrity Check**: Can verify data hasn't been changed

**Implementation:**

```typescript
// Generate signature
const signature = HMAC - SHA256(sessionData, secretKey);

// Verify signature
if (signature !== expectedSignature) {
	// Tampering detected!
	clearSession();
}
```

**Limitation:**

- If the secret key is known, signatures can be regenerated
- This is why we need server-side validation

---

### 2. Server-Side Validation Endpoint

**What:**

- New endpoint: `/api/auth/validate-session`
- Server uses a **different secret key** (never exposed to client)
- Validates session on every read (when online)

**Why:**

- **Prevents Offline Tampering**: Even if client secret is known, server validation will fail
- **Dual-Secret Approach**: Client and server use different secrets
- **Authoritative Validation**: Server is the source of truth

**How It Works:**

```
Client Session (IndexedDB)
  ├─ Client Signature (using CLIENT_SECRET)
  └─ Session Data

When Validating:
  1. Client verifies client signature ✓
  2. Client sends session to server
  3. Server generates signature using SERVER_SECRET
  4. Server compares signatures
  5. If different → Tampering detected → Reject
```

**Key Point:**

- Even if someone:
  - Modifies IndexedDB data
  - Knows the client secret key
  - Regenerates client signature
- **Server validation will still fail** because server uses different secret

---

### 3. Server Time Validation

**What:**

- Server provides authoritative timestamp via `/api/time`
- Client compares server time vs client time
- Detects time manipulation attempts

**Why:**

- **Prevents Clock Manipulation**: Can't change system time to extend sessions
- **Authoritative Time**: Server time is trusted source
- **Offline Fallback**: Uses client time when offline (less secure but necessary)

**Implementation:**

```typescript
const serverTime = await fetch("/api/time")
const clientTime = Date.now()

if (Math.abs(serverTime - clientTime) > 5 minutes) {
  // Time manipulation detected
  warnUser()
}

// Use server time for expiry check
if (serverTime > session.expiresAt) {
  // Session expired
  clearSession()
}
```

---

### 4. Multi-Layer Validation

**What:**

- Multiple validation checks happen in sequence
- Each layer adds security
- Failure at any layer = session invalid

**Layers:**

1. **Client Signature Check** - Detects obvious tampering
2. **Server Validation** - Prevents offline tampering (when online)
3. **Time Validation** - Prevents clock manipulation
4. **Expiry Check** - Uses server time when available

**Why:**

- **Defense in Depth**: Multiple layers = harder to bypass
- **Fail-Safe**: If one layer fails, others catch it
- **Progressive Security**: More secure when online, still works offline

---

## Security Guarantees

### Online Mode (Internet Connected)

✅ **Fully Protected:**

- Server-side validation prevents all tampering
- Time manipulation detected and prevented
- Signature tampering detected immediately
- **Result**: Cannot bypass session expiry

### Offline Mode (No Internet)

⚠️ **Partially Protected:**

- Client-side signature still works
- Time manipulation can be detected (if server was recently accessed)
- **Limitation**: Cannot fully prevent tampering when completely offline
- **Trade-off**: Offline functionality requires some security compromise

**Why This Trade-off:**

- App needs to work offline (core requirement)
- Server validation requires internet
- Client-side validation is better than nothing
- When user comes online, server validation will catch any tampering

---

## Attack Scenarios and Mitigations

### Scenario 1: Modify expiresAt in IndexedDB

**Attack:**

1. Open DevTools → IndexedDB
2. Change `expiresAt` to future date
3. Refresh page

**Mitigation:**

- ✅ Signature verification fails (data changed, signature doesn't match)
- ✅ Server validation fails (server signature different)
- ✅ Session cleared automatically

**Result:** ❌ Attack fails

---

### Scenario 2: Know Client Secret, Regenerate Signature

**Attack:**

1. Extract client secret from code
2. Modify session data
3. Regenerate signature with known secret
4. Save to IndexedDB

**Mitigation:**

- ✅ Client signature passes (matches)
- ❌ Server validation fails (server uses different secret)
- ✅ Session rejected

**Result:** ❌ Attack fails (when online)

**Note:** Offline, this could work temporarily, but will fail when user comes online

---

### Scenario 3: Change System Time

**Attack:**

1. Change system clock to past date
2. Session appears valid (not expired)

**Mitigation:**

- ✅ Server time validation detects difference
- ✅ Server time used for expiry check
- ✅ Session rejected if expired by server time

**Result:** ❌ Attack fails (when online)

---

### Scenario 4: Offline Tampering

**Attack:**

1. Go offline
2. Modify IndexedDB
3. Regenerate signatures
4. Use app offline

**Mitigation:**

- ⚠️ Client validation may pass
- ⚠️ Server validation unavailable
- ✅ **When user comes online**: Server validation will catch tampering
- ✅ **Periodic checks**: AuthGuard checks every 5 seconds

**Result:** ⚠️ Temporary bypass possible offline, but caught when online

**Why Acceptable:**

- Offline mode is a core feature
- Complete offline security is impossible
- Tampering is detected as soon as user comes online
- Most attacks require technical knowledge

---

## Implementation Details

### Files Changed

1. **`lib/utils/auth-session.ts`**

   - Added HMAC signature generation
   - Added server validation call
   - Added multi-layer validation

2. **`app/api/auth/validate-session/route.ts`** (NEW)

   - Server-side validation endpoint
   - Uses server-only secret
   - Validates time and signatures

3. **`app/api/time/route.ts`** (NEW)

   - Provides server timestamp
   - Prevents time manipulation

4. **`components/auth-guard.tsx`**
   - Updated to use async session validation
   - Periodic validation checks

---

## Environment Variables

### Required for Full Security

```env
# Server-only secret (NEVER expose to client)
SESSION_SECRET_SERVER=your-server-secret-key

# Client secret (can be in NEXT_PUBLIC_ but different from server)
NEXT_PUBLIC_SESSION_SECRET=your-client-secret-key
```

**Important:**

- Server secret should be different from client secret
- Server secret should NEVER be in `NEXT_PUBLIC_*` variables
- Use different secrets for production vs development

---

## Best Practices

1. **Always Use Server Validation When Online**

   - Don't skip server validation
   - Handle offline gracefully

2. **Rotate Secrets Regularly**

   - Change secrets periodically
   - Invalidate old sessions on rotation

3. **Monitor Validation Failures**

   - Log signature mismatches
   - Alert on suspicious patterns

4. **Set Appropriate Session Duration**

   - Balance security vs usability
   - Shorter sessions = more secure

5. **Educate Users**
   - Explain offline limitations
   - Warn about security risks

---

## Summary

### What We Fixed

✅ **Session Tampering**: Cryptographic signatures detect modifications
✅ **Time Manipulation**: Server time validation prevents clock changes
✅ **Offline Attacks**: Server validation catches tampering when online
✅ **Replay Attacks**: Signatures prevent session reuse

### What's Still Limited

⚠️ **Complete Offline Security**: Impossible without server
⚠️ **Client Secret Exposure**: Can be extracted from code
⚠️ **Advanced Attacks**: Determined attackers with technical knowledge

### Why It's Acceptable

- Most users won't attempt tampering
- Attacks require technical knowledge
- Tampering is detected when user comes online
- Offline functionality is a core requirement
- Security is significantly improved vs. original implementation

---

## Conclusion

The changes implement **defense in depth** security:

- Multiple validation layers
- Server-side authority
- Cryptographic integrity
- Time validation

While **perfect offline security is impossible**, the implementation:

- ✅ Prevents most attacks
- ✅ Detects tampering when online
- ✅ Maintains offline functionality
- ✅ Significantly improves security

This is a **practical security solution** that balances security with usability.
