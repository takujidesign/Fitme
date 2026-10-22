# Processing activities record — DRAFT

ร่าง — ต้องให้ผู้เชี่ยวชาญกฎหมายตรวจ. Owner and counsel must complete this record before launch. This is an implementation inventory, not a determination of legal compliance.

| Purpose | Data categories | Proposed basis | Recipients/processors | Cross-border | Retention |
| --- | --- | --- | --- | --- | --- |
| Personal fitness/meal planning and optional sync | Profile, age, measurements, nutrition, pregnancy/medical details (sensitive health data) | Explicit consent for sensitive health data, separate from terms | Device; Cloudflare when sync is chosen | Owner to list regions, transfer grounds and safeguards | Local until cleared; server until account deletion; backups to specify |
| Account authentication and security | Email, password hash/salt, hashed single-use tokens, session timestamps/browser family, hashed IP/email rate buckets | Owner/counsel to determine appropriate basis; health consent is not blanket consent for all purposes | Cloudflare, Resend | Owner to complete | Reset 30 min, verification 24 h; sessions 30 days; rate buckets expire and are pruned |
| Social chat | Handle, profile, message, selected photo, membership | Owner to document consent/other applicable basis | Cloudflare | Owner to complete | Text 180 days; photos 24 h; scheduled deletion; backup exception to specify |
| Gym attendance | Location, accuracy, gym, chosen visibility | User-initiated permission; explicit consent where health-related | Cloudflare; configured tile provider | Owner to complete tile provider and regions | Owner to set check-in retention and implement deletion schedule |
| Optional AI | User-selected prompt, health profile, selected photos | Explicit informed consent for sensitive content | Google (direct Gemini); Anthropic via Fixmee; user-chosen ChatGPT/Gemini copy-paste | Owner to list provider countries and transfer safeguards | No AI prompt/photo persistence in Worker; providers' retention must be documented |
| Payments/donations | Slip, transaction reference, amount, entitlement | Owner/counsel to specify contract/legal obligations | Thunder, Stripe/Wise, Cloudflare | Owner to complete | Statutory accounting period to specify; account deletion pseudonymizes required records |
| Operational telemetry and push | Sanitized categories, random install/device identifiers, subscriptions | Owner/counsel to determine; optional telemetry control | Cloudflare, browser push providers | Owner to complete | Telemetry 90 days; subscriptions expire after 8 days without renewal |

Security: PBKDF2 password hashing, AES-GCM encrypted service/TOTP secrets, token hashes, atomic single-use redemption, scoped sessions, suspension revocation, admin 2FA/recovery hashes, rate caps, optional Turnstile, HTTPS/security headers, authorization/privacy checks, audit records without secret values.

Rights workflow: in-app export/deletion and consent withdrawal; requests for access, correction, portability, erasure, restriction or objection go to the admin-configured contact email. Owner must fill controller identity/address, accountable person, request verification process, response deadlines, breach procedure, processor contracts, subprocessors, backup erasure limits and annual review date.

Open owner decisions: lawful bases for non-health processing; recipient countries; retention for check-ins, audit, payments and backups; whether skipped email verification/Turnstile is acceptable before launch. Do not treat configuration warnings as verified provider readiness.
