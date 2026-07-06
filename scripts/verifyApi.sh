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

# req <action> <body> [--noauth]  -> echoes "<body>\n<http_code>"
req() {
  local action="$1" body="${2:-{}}" noauth="${3:-}"
  local hdr=(-H "Content-Type: application/json")
  [ "$noauth" != "--noauth" ] && hdr+=(-H "Authorization: Bearer ${KEY}")
  curl -sS -m 30 -w $'\n%{http_code}' -X POST "${BASE_URL}?action=${action}" "${hdr[@]}" -d "${body}" 2>/dev/null
}

# check <label> <action> [body] [--noauth]  -> 2xx + no {"error"...} in body
check() {
  local label="$1" action="$2" body="${3:-{}}" noauth="${4:-}"
  local raw code resp
  raw=$(req "$action" "$body" "$noauth")
  code="${raw##*$'\n'}"
  resp="${raw%$'\n'*}"
  # Retry twice on any non-2xx — absorbs `vercel dev` cold-start / HMR races
  # (transient 000 connection drops and 5xx during recompiles).
  local tries=0
  while [[ ! "$code" =~ ^2[0-9][0-9]$ && $tries -lt 2 ]]; do
    sleep 1
    raw=$(req "$action" "$body" "$noauth")
    code="${raw##*$'\n'}"
    resp="${raw%$'\n'*}"
    tries=$((tries + 1))
  done
  if [[ "$code" =~ ^2[0-9][0-9]$ ]] && ! printf '%s' "$resp" | grep -q '"error"'; then
    printf '  \033[32mPASS\033[0m  %-32s (%s)\n' "$label" "$code"
    PASS=$((PASS + 1))
    return 0
  fi
  printf '  \033[31mFAIL\033[0m  %-32s (%s) %s\n' "$label" "${code:-?}" "$(printf '%s' "$resp" | head -c 140)"
  FAIL=$((FAIL + 1))
  return 1
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
check "validationGetForContext"   "validationGetForContext" '{"contextId":"portfolio"}'
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
CREATE=$(req "createProject" '{"data":{"name":"API verify (delete me)","type":"Verification"}}')
CBODY="${CREATE%$'\n'*}"
CCODE="${CREATE##*$'\n'}"
PID=$(printf '%s' "$CBODY" | grep -oE '"id":"[^"]+"' | head -1 | sed 's/"id":"//; s/"//')
if [[ "$CCODE" =~ ^2[0-9][0-9]$ ]] && [ -n "$PID" ]; then
  printf '  \033[32mPASS\033[0m  %-32s (%s) id=%s\n' "createProject" "$CCODE" "$PID"; PASS=$((PASS + 1))
else
  printf '  \033[31mFAIL\033[0m  %-32s (%s) %s\n' "createProject" "${CCODE:-?}" "$(printf '%s' "$CBODY" | head -c 140)"; FAIL=$((FAIL + 1)); PID=""
fi

if [ -n "$PID" ]; then
  check "getData(risks)"  "getData"  "{\"collection\":\"risks\",\"projectId\":\"${PID}\"}"
  check "saveData(risks)" "saveData" "{\"collection\":\"risks\",\"projectId\":\"${PID}\",\"data\":[{\"id\":\"r-verify\",\"title\":\"verify risk\"}]}"
  RB=$(req "getData" "{\"collection\":\"risks\",\"projectId\":\"${PID}\"}"); RB="${RB%$'\n'*}"
  if printf '%s' "$RB" | grep -q 'r-verify'; then
    printf '  \033[32mPASS\033[0m  %-32s\n' "getData reflects saved risk"; PASS=$((PASS + 1))
  else
    printf '  \033[31mFAIL\033[0m  %-32s %s\n' "getData reflects saved risk" "$(printf '%s' "$RB" | head -c 140)"; FAIL=$((FAIL + 1))
  fi
  check "deleteProject (cleanup)" "deleteProject" "{\"id\":\"${PID}\"}"
fi

echo
echo "Result: ${PASS} passed, ${FAIL} failed."
[ "$FAIL" -eq 0 ] || exit 1
