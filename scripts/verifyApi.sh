#!/usr/bin/env bash
# Verify the CedarGuard API answers correctly for a generated API key.
#
# Usage:
#   API_KEY=cdR_xxx [BASE_URL=https://cedarguard.co.uk/api] scripts/verifyApi.sh
#
# Exercises the pre-auth ping, a broad set of READ endpoints across every domain,
# and one create->read->write->read->delete round-trip on a throwaway project.
# Exits non-zero if any check fails. Read-only except the throwaway project it
# creates and then deletes.
set -u

BASE_URL="${BASE_URL:-https://cedarguard.co.uk/api}"
KEY="${API_KEY:-}"
PASS=0
FAIL=0

c() { printf '%s' "$1"; } # no-op helper for readability

# call <action> <json-body> [--noauth]  -> echoes body, sets HTTP_STATUS
HTTP_STATUS=0
call() {
  local action="$1" body="${2:-{\}}" noauth="${3:-}"
  local hdr=(-H "Content-Type: application/json")
  if [ "$noauth" != "--noauth" ]; then hdr+=(-H "Authorization: Bearer ${KEY}"); fi
  local out
  out=$(curl -sS -w '\n%{http_code}' -X POST "${BASE_URL}?action=${action}" "${hdr[@]}" -d "${body}" 2>/dev/null)
  HTTP_STATUS="${out##*$'\n'}"
  printf '%s' "${out%$'\n'*}"
}

# check <label> <action> <json> [--noauth]  -> 2xx + not an {error:...} body
check() {
  local label="$1" action="$2" body="${3:-{\}}" noauth="${4:-}"
  local resp; resp=$(call "$action" "$body" "$noauth")
  if [ "${HTTP_STATUS}" -ge 200 ] && [ "${HTTP_STATUS}" -lt 300 ] && ! printf '%s' "$resp" | grep -q '"error"'; then
    printf '  \033[32mPASS\033[0m  %-34s (%s)\n' "$label" "$HTTP_STATUS"
    PASS=$((PASS+1)); return 0
  fi
  printf '  \033[31mFAIL\033[0m  %-34s (%s) %s\n' "$label" "$HTTP_STATUS" "$(printf '%s' "$resp" | head -c 160)"
  FAIL=$((FAIL+1)); return 1
}

echo "Base URL: ${BASE_URL}"

# 1) Pre-auth endpoints (no key needed) ------------------------------------
echo
echo "Pre-auth:"
check "ping" "ping" "{}" --noauth
check "sendMagicLink (always 200)" "sendMagicLink" '{"email":"verify-noop@example.com"}' --noauth

if [ -z "$KEY" ]; then
  echo
  echo "No API_KEY set — skipping authenticated checks."
  echo "Run:  API_KEY=cdR_your_key scripts/verifyApi.sh"
  echo
  echo "Result: ${PASS} passed, ${FAIL} failed (pre-auth only)."
  [ "$FAIL" -eq 0 ] || exit 1
  exit 0
fi

# 2) Read endpoints across every domain ------------------------------------
echo
echo "Reads (authenticated):"
check "getApiKeys"                "getApiKeys"
check "getProfile"                "getProfile"
check "getPreferences"            "getPreferences"
check "getProjects"               "getProjects"
check "getPortfolioData"          "getPortfolioData"
check "getComplianceLibrary"      "getComplianceLibrary"
check "getComplianceDomains"      "getComplianceDomains"
check "controlsList"              "controlsList"
check "incidentsList"             "incidentsList"
check "assuranceList"             "assuranceList"
check "resourceListSchemes"       "resourceListSchemes"
check "resourceGetAssumptions"    "resourceGetAssumptions"
check "listDetectedAlerts"        "listDetectedAlerts"
check "integrationsGetStatus"     "integrationsGetStatus"
check "validationGetForContext"   "validationGetForContext"
check "governanceGetFramework"    "governanceGetFramework"
check "governanceListReports"     "governanceListReports"
check "governanceListMeetings"    "governanceListMeetings"
check "governanceListTemplates"   "governanceListTemplates"
check "governanceListForwardPlanItems" "governanceListForwardPlanItems"
check "tacListEnquiries"          "tacListEnquiries"
check "tacListCostRates"          "tacListCostRates"
check "hrcListAvailableMonths"    "hrcListAvailableMonths"

# 3) Write round-trip on a throwaway project -------------------------------
echo
echo "Write round-trip:"
PROJECT_ID="verify-$(date +%s)"
check "createProject" "createProject" "{\"project\":{\"id\":\"${PROJECT_ID}\",\"name\":\"API verify (delete me)\"}}"
check "getData(risks)" "getData" "{\"collection\":\"risks\",\"projectId\":\"${PROJECT_ID}\"}"
check "saveData(risks)" "saveData" "{\"collection\":\"risks\",\"projectId\":\"${PROJECT_ID}\",\"data\":[{\"id\":\"r-verify\",\"title\":\"verify risk\"}]}"
RISKS=$(call "getData" "{\"collection\":\"risks\",\"projectId\":\"${PROJECT_ID}\"}")
if printf '%s' "$RISKS" | grep -q 'r-verify'; then
  printf '  \033[32mPASS\033[0m  %-34s\n' "getData reflects saved risk"; PASS=$((PASS+1))
else
  printf '  \033[31mFAIL\033[0m  %-34s %s\n' "getData reflects saved risk" "$(printf '%s' "$RISKS" | head -c 160)"; FAIL=$((FAIL+1))
fi
check "deleteProject (cleanup)" "deleteProject" "{\"id\":\"${PROJECT_ID}\"}"

echo
echo "Result: ${PASS} passed, ${FAIL} failed."
[ "$FAIL" -eq 0 ] || exit 1
