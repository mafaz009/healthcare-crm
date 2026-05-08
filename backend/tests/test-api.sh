#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Healthcare CRM — End-to-end API test script
# Usage: bash tests/test-api.sh
# Requires: curl, jq
# ─────────────────────────────────────────────────────────────────────────────

BASE="http://localhost:5000"
PASS=0; FAIL=0

# ── Colours ───────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; NC='\033[0m'

check() {
  local label="$1" expected="$2" actual="$3"
  if [ "$actual" = "$expected" ]; then
    echo -e "  ${GREEN}✓${NC} $label"
    ((PASS++))
  else
    echo -e "  ${RED}✗${NC} $label  (expected: $expected, got: $actual)"
    ((FAIL++))
  fi
}

section() { echo -e "\n${YELLOW}── $1 ──${NC}"; }

# ─────────────────────────────────────────────────────────────────────────────
section "Health check"
STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/health")
check "GET /health → 200" "200" "$STATUS"

# ─────────────────────────────────────────────────────────────────────────────
section "Auth — Login"
LOGIN=$(curl -s -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@youragency.com","password":"Admin@1234"}')

STATUS=$(echo "$LOGIN" | jq -r '.success')
check "Login success=true" "true" "$STATUS"

TOKEN=$(echo "$LOGIN" | jq -r '.data.token')
ROLE=$(echo "$LOGIN" | jq -r '.data.user.role')
check "Role is SUPER_ADMIN" "SUPER_ADMIN" "$ROLE"

# ─────────────────────────────────────────────────────────────────────────────
section "Auth — Me + Profile"
ME=$(curl -s "$BASE/api/auth/me" -H "Authorization: Bearer $TOKEN")
check "GET /auth/me success" "true" "$(echo "$ME" | jq -r '.success')"

PROFILE=$(curl -s -X PUT "$BASE/api/auth/profile" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name":"Super Admin"}')
check "PUT /auth/profile success" "true" "$(echo "$PROFILE" | jq -r '.success')"

# ─────────────────────────────────────────────────────────────────────────────
section "Auth — Invalid login (should 401)"
BAD=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@youragency.com","password":"wrongpassword"}')
check "Bad password → 401" "401" "$BAD"

# ─────────────────────────────────────────────────────────────────────────────
section "Doctors — CRUD"
CREATE_DOC=$(curl -s -X POST "$BASE/api/doctors" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name":"Dr. Test Doctor",
    "specialty":"Dermatologist",
    "domain":"drtestdoctor.com",
    "email":"test.doctor@example.com",
    "phone":"+919876543210"
  }')
check "POST /doctors success" "true" "$(echo "$CREATE_DOC" | jq -r '.success')"

DOC_ID=$(echo "$CREATE_DOC" | jq -r '.data.doctor.id')
API_KEY=$(echo "$CREATE_DOC" | jq -r '.data.doctor.apiKey')
check "Doctor has apiKey" "true" "$([ -n "$API_KEY" ] && echo true || echo false)"

GET_DOC=$(curl -s "$BASE/api/doctors/$DOC_ID" -H "Authorization: Bearer $TOKEN")
check "GET /doctors/:id success" "true" "$(echo "$GET_DOC" | jq -r '.success')"

STATS=$(curl -s "$BASE/api/doctors/$DOC_ID/stats" -H "Authorization: Bearer $TOKEN")
check "GET /doctors/:id/stats success" "true" "$(echo "$STATS" | jq -r '.success')"

# ─────────────────────────────────────────────────────────────────────────────
section "Leads — CRUD + Comments"
CREATE_LEAD=$(curl -s -X POST "$BASE/api/leads" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"patientName\":\"Alice Test\",\"phone\":\"9000000001\",\"city\":\"Mumbai\",\"source\":\"facebook\",\"doctorId\":$DOC_ID}")
check "POST /leads success" "true" "$(echo "$CREATE_LEAD" | jq -r '.success')"

LEAD_ID=$(echo "$CREATE_LEAD" | jq -r '.data.id')

STATUS_UPDATE=$(curl -s -X PATCH "$BASE/api/leads/$LEAD_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"CONTACTED"}')
check "PATCH /leads/:id/status success" "true" "$(echo "$STATUS_UPDATE" | jq -r '.success')"

COMMENT=$(curl -s -X POST "$BASE/api/leads/$LEAD_ID/comments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"comment":"Called patient. Will follow up tomorrow."}')
check "POST /leads/:id/comments success" "true" "$(echo "$COMMENT" | jq -r '.success')"

COUNTS=$(curl -s "$BASE/api/leads/status-counts" -H "Authorization: Bearer $TOKEN")
check "GET /leads/status-counts success" "true" "$(echo "$COUNTS" | jq -r '.success')"

# ─────────────────────────────────────────────────────────────────────────────
section "Appointments — CRUD"
CREATE_APPT=$(curl -s -X POST "$BASE/api/appointments" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{\"patientName\":\"Bob Test\",\"phone\":\"9000000002\",\"preferredDate\":\"2025-12-01\",\"issue\":\"Skin rash\",\"doctorId\":$DOC_ID}")
check "POST /appointments success" "true" "$(echo "$CREATE_APPT" | jq -r '.success')"

APPT_ID=$(echo "$CREATE_APPT" | jq -r '.data.id')

CONFIRM=$(curl -s -X PATCH "$BASE/api/appointments/$APPT_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"CONFIRMED","notes":"Slot at 11 AM confirmed"}')
check "PATCH /appointments/:id/status success" "true" "$(echo "$CONFIRM" | jq -r '.success')"

TODAY=$(curl -s "$BASE/api/appointments/today" -H "Authorization: Bearer $TOKEN")
check "GET /appointments/today success" "true" "$(echo "$TODAY" | jq -r '.success')"

UPCOMING=$(curl -s "$BASE/api/appointments/upcoming" -H "Authorization: Bearer $TOKEN")
check "GET /appointments/upcoming success" "true" "$(echo "$UPCOMING" | jq -r '.success')"

# ─────────────────────────────────────────────────────────────────────────────
section "Blogs — CRUD + Publish"
CREATE_BLOG=$(curl -s -X POST "$BASE/api/blogs" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"title\":\"Test Blog Post for API\",
    \"content\":\"<p>This is test content for the blog post.</p>\",
    \"seoTitle\":\"Test Blog | Dr. Test Doctor\",
    \"metaDescription\":\"This is a test blog post for the healthcare CRM.\",
    \"keywords\":\"test, blog, healthcare\",
    \"doctorId\":$DOC_ID
  }")
check "POST /blogs success" "true" "$(echo "$CREATE_BLOG" | jq -r '.success')"

BLOG_ID=$(echo "$CREATE_BLOG" | jq -r '.data.id')
BLOG_SLUG=$(echo "$CREATE_BLOG" | jq -r '.data.slug')

PUBLISH=$(curl -s -X PATCH "$BASE/api/blogs/$BLOG_ID/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"PUBLISHED"}')
check "PATCH /blogs/:id/status PUBLISHED" "true" "$(echo "$PUBLISH" | jq -r '.success')"

check "Slug is auto-generated" "test-blog-post-for-api" "$BLOG_SLUG"

# ─────────────────────────────────────────────────────────────────────────────
section "Dashboard"
SUMMARY=$(curl -s "$BASE/api/dashboard/summary" -H "Authorization: Bearer $TOKEN")
check "GET /dashboard/summary success" "true" "$(echo "$SUMMARY" | jq -r '.success')"
check "Dashboard has counts" "true" "$(echo "$SUMMARY" | jq 'has(.data.counts)' 2>/dev/null || echo false)"

# ─────────────────────────────────────────────────────────────────────────────
section "Public API — Blog (API Key auth)"
PUBLIC_BLOGS=$(curl -s "$BASE/api/public/blogs" -H "X-Api-Key: $API_KEY")
check "GET /public/blogs success" "true" "$(echo "$PUBLIC_BLOGS" | jq -r '.success')"

PUBLIC_BLOG=$(curl -s "$BASE/api/public/blogs/$BLOG_SLUG" -H "X-Api-Key: $API_KEY")
check "GET /public/blogs/:slug success" "true" "$(echo "$PUBLIC_BLOG" | jq -r '.success')"
check "SEO package present" "true" "$(echo "$PUBLIC_BLOG" | jq 'has(.data.seo)' 2>/dev/null || echo false)"
check "Canonical URL present" "true" \
  "$(echo "$PUBLIC_BLOG" | jq -r '.data.seo.canonical' | grep -q 'http' && echo true || echo false)"
check "JSON-LD schema present" "true" \
  "$(echo "$PUBLIC_BLOG" | jq '.data.seo.schema["@type"]' 2>/dev/null | grep -q 'Article' && echo true || echo false)"

# ─────────────────────────────────────────────────────────────────────────────
section "Public API — Appointment submission"
PUBLIC_APPT=$(curl -s -X POST "$BASE/api/public/appointments" \
  -H "X-Api-Key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"patientName":"Website Patient","phone":"9000000003","preferredDate":"2025-12-10","issue":"Acne"}')
check "POST /public/appointments success" "true" "$(echo "$PUBLIC_APPT" | jq -r '.success')"

# ─────────────────────────────────────────────────────────────────────────────
section "Webhook"
WEBHOOK=$(curl -s -X POST "$BASE/api/meta-webhook" \
  -H "x-webhook-secret: ${WEBHOOK_SECRET:-change_this_webhook_secret}" \
  -H "Content-Type: application/json" \
  -d "{\"doctorId\":$DOC_ID,\"patientName\":\"Webhook Patient\",\"phone\":\"9000000004\",\"source\":\"facebook\"}")
check "POST /meta-webhook success" "true" "$(echo "$WEBHOOK" | jq -r '.success')"

# ─────────────────────────────────────────────────────────────────────────────
section "Auth — No token (should 401)"
NOAUTH=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/leads")
check "GET /leads with no token → 401" "401" "$NOAUTH"

section "Unknown route (should 404)"
NOTFOUND=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/api/nonexistent-route")
check "Unknown route → 404" "404" "$NOTFOUND"

# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "─────────────────────────────────────────────"
TOTAL=$((PASS + FAIL))
echo -e "Results: ${GREEN}$PASS passed${NC} / ${RED}$FAIL failed${NC} / $TOTAL total"
if [ "$FAIL" -eq 0 ]; then
  echo -e "${GREEN}All tests passed ✓${NC}"
else
  echo -e "${RED}Some tests failed — check output above.${NC}"
  exit 1
fi
