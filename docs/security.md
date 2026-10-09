<!-- SECURITY.md -->

# Security policy

EventOps stores event data that includes guests' names, contact details and accessibility needs.
Please report security problems privately so they can be fixed before anyone else learns about them.

## Supported versions

Only the latest commit on the `main` branch and the current deployment are supported. There are no
older releases.

## Reporting a vulnerability

**Do not open a public issue.**

Use GitHub's private vulnerability reporting: open the repository's **Security** tab and choose
**Report a vulnerability**. Please include:

- What the problem is and where it is (page, route or file).
- Steps to reproduce it, or a proof of concept.
- What an attacker could do with it, for example read or change another event's data.

Do not access, change or delete data that is not yours, and do not run tests that could disrupt the
service for others.

## What to expect

This is a small hackathon team, so responses are best effort. We will acknowledge your report,
keep you updated while we investigate, and credit you when the fix is published, unless you prefer
not to be named.

## Most important areas

- Access to another event's data (cross-event isolation and object-level authorization).
- Role checks for Owner, Coordinator and Viewer.
- File uploads and spreadsheet import, including formula injection in exported CSV.
- AI import: prompt injection and unvalidated model output.
- Exposure of secrets or personal data in responses, logs or client bundles.