# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| `main` branch | ✅ Active |
| Older tags | ❌ No backport fixes |

We only maintain the current `main` branch. Always run the latest commit for security fixes.

---

## Reporting a Vulnerability

**Please do not open a public GitHub issue for security vulnerabilities.**

If you discover a security vulnerability in Solidity Smart Audit itself (the platform, API, or dependencies), please report it responsibly:

1. **Email**: security@your-org.com
2. **Subject**: `[SECURITY] <short description>`
3. **Include**:
   - A description of the vulnerability and its potential impact
   - Steps to reproduce (proof-of-concept if possible)
   - Any suggested mitigations

You will receive an acknowledgement within **48 hours** and a full response within **7 days**.

---

## Responsible Disclosure

We follow responsible disclosure:
- We will work with you to understand and fix the issue before any public disclosure
- We will credit you in the fix commit and release notes (unless you prefer anonymity)
- We ask that you give us at least **14 days** to release a fix before disclosing publicly

---

## Scope

This policy applies to the Solidity Smart Audit **platform** itself. It does **not** cover:
- Vulnerabilities in Solidity contracts submitted by users for analysis (that is the tool's purpose)
- Third-party dependencies — please report those upstream directly

---

## Security Best Practices for Self-Hosting

If you are running your own instance:

- Set a strong `NEXTAUTH_SECRET` (`openssl rand -base64 32`)
- Never expose the Express API port (`:3001`) directly — route all traffic through Nginx
- Use environment variables for all secrets — never commit `.env` files
- Keep your Docker base images updated (`postgres:16-alpine`, `node:20-alpine`)
- Restrict `DATABASE_URL` access to the app container only
- Review your GitHub OAuth App callback URLs and restrict them to your domain
