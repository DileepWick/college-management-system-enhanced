# OWASP ZAP Evidence – IDOR & Mass Assignment (IT22105820)

| File | Code tested | Result |
|---|---|---|
| `zap-report-before-fix.html` / `.pdf` | `develop` @ `3ea205e` (before PR #10) | **4 High, 3 Medium**: all 7 attacks succeeded |
| `zap-report-after-fix.html` / `.pdf` | `develop` @ `5469287` (after PR #10 and PR #12) | **0 High, 0 Medium**: all 7 attacks blocked (logged as "Retest PASSED") |

## How the reports were produced
1. The backend was started locally against a throwaway MongoDB database with test users: one admin, one faculty member, and two students (Alice and Bob).
2. **OWASP ZAP 2.16** ran as an intercepting proxy. Every request (logins and attacks) was sent **through ZAP**, so each one appears in ZAP's History with the full request and response.
3. ZAP's automated scanner cannot detect access-control or mass-assignment flaws, because a `200 OK` looks normal to it; it doesn't know which user should own which record. These were therefore tested **manually**: the same request was replayed with a different user's token, a different object ID, or extra JSON fields.
4. Each result was recorded as a ZAP alert on the exact request/response. The response text is the evidence (e.g. `"firstName":"Hacked"`, `"isSuperAdmin":true`, or `403 Forbidden`). ZAP's passive scanner also ran on all traffic.
5. The reports were generated with ZAP's *Traditional HTML* and *Traditional PDF* templates.

## Test cases

| ID | Attack | Before | After |
|---|---|---|---|
| T1 | Student Alice `PATCH /api/student/<Bob's id>` → `{"firstName":"Hacked"}` | 200, Bob renamed | **403** |
| T2 | Student Alice `POST /api/marks/bulk` → Bob's mark 78 → 0 | 200, mark changed | **403** |
| T3 | Student Alice `GET /api/student` (admin-only list) | 200, all students' data | **403** |
| T4 | Student Alice `PATCH /api/admin/<id>` | 200, admin changed | **403** |
| T5 | Faculty `POST /api/branch` (admin-only) | 201, branch created | **403** |
| T6 | Admin `PATCH /api/admin/<own id>` + `isSuperAdmin:true, googleId, employeeId` | 200, became super admin | 200, **extra fields ignored** |
| T7 | Admin `PATCH /api/branch/<id>` with `{"$unset":{"name":1}}` | 200, branch name deleted | 200, **operator ignored** |

T6 and T7 return 200 after the fix because an admin is allowed to update these records. The fix is that the dangerous fields are silently dropped, which is shown by `"isSuperAdmin":false` and the branch name still being present in the response.

