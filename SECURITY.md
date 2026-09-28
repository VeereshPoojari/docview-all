# Security Policy

## Supported Versions

We actively maintain and provide security updates for the following versions of `docview-all`:

| Version | Supported          |
| ------- | ------------------ |
| 1.0.x   | :white_check_mark: |
| < 1.0   | :x:                |

---

## Security Architecture & Design Principles

`docview-all` is built with a **Zero-Trust, Zero-Dependency** security model for document rendering in modern web applications:

1. **Zero External Dependencies**:
   - Zero runtime npm dependencies eliminates 100% of third-party supply-chain attacks, malicious dependency injections, and Dependabot vulnerability alerts.
2. **Context-Aware Output Encoding & Sanitization**:
   - Every text node, attribute value, and user-provided string parsed from documents (DOCX, PPTX, XLSX, Markdown, XML, CSV, etc.) is strictly escaped before DOM insertion.
   - All external link targets enforce safe protocol allowlists (`https:`, `http:`, `mailto:`) and prohibit dangerous schemes (`javascript:`, `vbscript:`, `data:text/html`).
   - Outgoing anchor tags enforce `rel="noopener noreferrer"`.
3. **Safe Parsing (Anti-XXE & Anti-Zip-Slip)**:
   - XML parsing is executed via standard browser `DOMParser` or pure regex with external entity loading disabled, mitigating XML External Entity (XXE) vulnerabilities.
   - ZIP decompression operates purely in-memory via streams, immune to directory traversal filesystem attacks.
4. **Content Security Policy (CSP) Compatibility**:
   - Designed to work cleanly under strict Content Security Policies without requiring `unsafe-eval`.

---

## Reporting a Vulnerability

We take the security of `docview-all` very seriously. If you discover a security vulnerability, please do **NOT** open a public issue.

Instead, please report it via one of the following channels:

- **GitHub Private Vulnerability Reporting**: [Submit a Security Advisory](https://github.com/veereshpoojari/docview-all/security/advisories/new)
- **Email Security Team**: Contact `veeresha3993@gmail.com` with the subject `[SECURITY VULNERABILITY] docview-all`.

### What to Include in Your Report:
- Detailed steps to reproduce the issue (including sample documents or payloads).
- The version of `docview-all` and browser/environment used.
- Impact assessment of the vulnerability.
- Any suggested mitigations or patches, if available.

### Response SLA:
- **Initial Response**: Within 24–48 hours.
- **Triage & Status Update**: Within 72 hours.
- **Fix & Advisory Release**: Coordinated disclosure within 7–14 days depending on severity.
