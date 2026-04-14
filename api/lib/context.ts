import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";
import { GoogleGenAI } from "@google/genai";
import { ROLE_STRINGS } from "../../src/lib/roleConstants.js";

export const maxDuration = 120;

// --- Firebase Admin Initialization (Modular ESM-native sub-packages) ---
let initError: string | null = null;

try {
  if (!getApps().length) {
    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT;
    if (!serviceAccountJson) {
      console.warn(
        "FIREBASE_SERVICE_ACCOUNT is missing - server will use ADC or fail.",
      );
    } else {
      try {
        console.log("Attempting to parse service account JSON...");
        const serviceAccount = JSON.parse(serviceAccountJson);
        console.log("Initializing Firebase Admin...");
        initializeApp({ credential: cert(serviceAccount) });
        console.log("Firebase Admin initialized successfully.");
      } catch (e: any) {
        console.error("Fatal Firebase Init Error:", e.message);
        initError = "Fatal Init Error: " + (e?.message ?? String(e));
      }
    }
  }
} catch (e: any) {
  console.error("Unexpected Global Init Error:", e.message);
  initError = "Fatal Init Error: " + (e?.message ?? String(e));
}

// Lazy-initialize service handles
export const getDB = () => getFirestore();
export const getAuthService = () => getAuth();
export const getMessagingService = () => getMessaging();

// Helper to get fresh AI instance
export const getAI = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured");
  }
  return new GoogleGenAI({ apiKey });
};

// Helper to handle AI JSON responses with potential markdown backticks
export const parseAIResponse = (text: string, defaultValue: any = []) => {
  if (!text) return defaultValue;
  let cleaned = text.trim();
  
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  }

  // 1. Try native parse
  try {
    return JSON.parse(cleaned);
  } catch (e) {}

  // 2. Find start of JSON
  const firstBrace = cleaned.indexOf('{');
  const firstBracket = cleaned.indexOf('[');
  let startIndex = -1;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIndex = firstBrace;
  } else if (firstBracket !== -1) {
    startIndex = firstBracket;
  }

  if (startIndex === -1) {
    throw new Error("No JSON structure found in output.");
  }

  let jsonStr = cleaned.substring(startIndex);
  
  // 3. Universal Auto-Healer
  let inString = false;
  let escapeNext = false;
  let stack: string[] = [];
  let validSoFar = "";
  
  for (let i = 0; i < jsonStr.length; i++) {
    const char = jsonStr[i];
    validSoFar += char;
    
    if (escapeNext) {
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      escapeNext = true;
      continue;
    }
    
    if (char === '"') {
      inString = !inString;
      continue;
    }
    
    if (!inString) {
      if (char === '{' || char === '[') {
        stack.push(char);
      } else if (char === '}' || char === ']') {
        if (stack.length > 0) {
          const lastStr = stack[stack.length - 1];
          if ((char === '}' && lastStr === '{') || (char === ']' && lastStr === '[')) {
            stack.pop();
          }
        }
        // Organic end reached
        if (stack.length === 0) {
          try {
            return JSON.parse(validSoFar);
          } catch(err) {
            break;
          }
        }
      }
    }
  }

  // 4. Force Healing for Truncated/Amputated JSON
  if (inString) {
    console.warn("[parseAIResponse] Auto-healer: closing unclosed string — response was likely truncated by maxOutputTokens limit.");
    validSoFar += '"';
  }

  // Clean trailing artifacts
  validSoFar = validSoFar.replace(/,\s*$/, "");
  
  if (validSoFar.match(/,\s*"[^"]*"$/)) {
    validSoFar = validSoFar.replace(/,\s*"[^"]*"$/, "");
  } else if (validSoFar.match(/\{\s*"[^"]*"$/)) {
    validSoFar = validSoFar.replace(/"[^"]*"$/, "");
  } else if (validSoFar.match(/:\s*$/)) {
    validSoFar += 'null';
  }

  // Balance structural stack
  if (stack.length > 0) {
    console.warn(`[parseAIResponse] Auto-healer: closing ${stack.length} unclosed bracket(s) — AI output was truncated. Consider increasing maxOutputTokens.`);
  }
  while (stack.length > 0) {
    const opener = stack.pop();
    if (opener === '{') validSoFar += '}';
    if (opener === '[') validSoFar += ']';
  }

  try {
    return JSON.parse(validSoFar);
  } catch (finalError) {
    // Escalate to Retry Interceptor
    throw new Error("AI_PARSE_CRITICAL_FAILURE_" + String(finalError));
  }
};

export type ApiContext = {
  db: ReturnType<typeof getFirestore>;
  uid: string;
  email: string;
  userData: any;
  primaryUid: string;
  isAdmin: boolean;
  isClientAdmin: boolean;
  SYSTEM_ADMIN_EMAILS: string[];
  isAuthorizedForContext: (contextId: string) => Promise<boolean>;
  getAuthService: typeof getAuthService;
  getMessagingService: typeof getMessagingService;
};

// Multi-tenancy check function to ensure strict tenant isolation
export const isAuthorizedForContextImpl = async (
  contextId: string,
  db: any,
  uid: string,
  email: string,
  userData: any,
  primaryUid: string,
  isAdmin: boolean,
): Promise<boolean> => {
  if (!contextId || contextId.length > 128) return false;
  if (isAdmin) return true;

  // Check if it's a project
  const projectDoc = await db.collection("projects").doc(contextId).get();
  if (projectDoc.exists) {
    const project = projectDoc.data() || {};

    // Client Admins and Enterprise users see all projects in their organization
    if (
      userData.role === ROLE_STRINGS.CLIENT_ADMIN ||
      userData.role === ROLE_STRINGS.ENTERPRISE
    ) {
      if (project.clientId === primaryUid || project.clientId === uid)
        return true;
    }

    // Programme Managers see only projects under a programme they manage
    if (userData.role === ROLE_STRINGS.PROGRAMME_MANAGER && project.programmeId) {
      const assignedProgDoc = await db.collection("programmes").doc(project.programmeId).get();
      if (assignedProgDoc.exists) {
        const assignedProg = assignedProgDoc.data() || {};
        if (assignedProg.pm === email || assignedProg.userId === uid)
          return true;
      }
    }

    // Project Managers see only their own projects or assigned ones
    if (
      project.userId === uid ||
      project.userId === email ||
      project.pm === email ||
      project.pmId === uid ||
      project.creatorId === uid ||
      project.createdBy === uid ||
      project.projectManagerId === uid ||
      project.projectManagerId === email
    )
      return true;

    // Legacy check for owners if clientId missing
    if (!project.clientId) {
      const ownerDoc = await db.collection("users").doc(project.userId).get();
      if (
        ownerDoc.exists &&
        (ownerDoc.data()?.clientId === primaryUid || ownerDoc.id === primaryUid)
      ) {
        if (
          userData.role === ROLE_STRINGS.CLIENT_ADMIN ||
          userData.role === ROLE_STRINGS.ENTERPRISE
        )
          return true;
      }
    }
  }

  // Check if it's a programme
  const progDoc = await db.collection("programmes").doc(contextId).get();
  if (progDoc.exists) {
    const prog = progDoc.data() || {};
    const canAccessOrgProgramme =
      userData.role === ROLE_STRINGS.CLIENT_ADMIN ||
      userData.role === ROLE_STRINGS.PROGRAMME_MANAGER ||
      userData.role === ROLE_STRINGS.ENTERPRISE;
    if (canAccessOrgProgramme && prog.clientId === primaryUid)
      return true;
    if (prog.userId === uid || prog.pm === email)
      return true;
  }

  return false;
};

export async function createContext(
  req: any,
  res: any,
): Promise<ApiContext | null> {
  if (initError) {
    console.error("Server boot error:", initError);
    res.status(500).json({ error: "Server configuration error" });
    return null;
  }

  try {
    const db = getDB();

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      res.status(401).json({ error: "Unauthorized: Missing or invalid token" });
      return null;
    }

    const token = authHeader.split("Bearer ")[1].trim();
    let uid = "";
    let email = "";

    if (token.startsWith("cdR_")) {
      const apiKeyDoc = await db.collection("apiKeys").doc(token).get();
      if (!apiKeyDoc.exists) {
        res.status(401).json({ error: "Unauthorized: Invalid API Key" });
        return null;
      }
      uid = apiKeyDoc.data()?.uid;
      if (!uid) {
        res.status(401).json({ error: "Unauthorized: Malformed API key" });
        return null;
      }
      const userDoc = await db.collection("users").doc(uid).get();
      if (!userDoc.exists) {
        res.status(401).json({ error: "Unauthorized: API key owner no longer exists" });
        return null;
      }
      email = (userDoc.data()?.email || "").toLowerCase();
    } else {
      let decodedToken: any;
      try {
        decodedToken = await getAuthService().verifyIdToken(token);
      } catch (e) {
        res
          .status(401)
          .json({ error: "Unauthorized: Token verification failed" });
        return null;
      }

      uid = decodedToken.uid;
      email = (decodedToken.email || "").toLowerCase();
    }

    // CENTRALIZED USER CONTEXT
    const userDoc = await db.collection("users").doc(uid).get();
    const userData = userDoc.data() || {};
    // Verify clientId points to a real org owner document before trusting it as the tenant key.
    // Prevents a user who writes an arbitrary clientId into their own doc from claiming another org.
    let primaryUid = uid;
    if (userData.clientId) {
      const orgOwnerDoc = await db.collection("users").doc(userData.clientId).get();
      if (orgOwnerDoc.exists) {
        primaryUid = userData.clientId;
      }
    }
    // Admin Check Logic: Firestore role OR System Admin list
    const SYSTEM_ADMIN_EMAILS = (process.env.SYSTEM_ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const isAdmin =
      userData.role === ROLE_STRINGS.ADMIN || SYSTEM_ADMIN_EMAILS.includes(email);
    if (isAdmin) {
      console.log(
        `Admin access granted to: ${email} (Method: ${userData.role === ROLE_STRINGS.ADMIN ? "Firestore" : "Env Var"})`,
      );
    }
    const isClientAdmin =
      isAdmin ||
      userData.role === ROLE_STRINGS.CLIENT_ADMIN ||
      userData.role === ROLE_STRINGS.ENTERPRISE;

    const isAuthorizedForContext = async (contextId: string) => {
      return isAuthorizedForContextImpl(
        contextId,
        db,
        uid,
        email,
        userData,
        primaryUid,
        isAdmin,
      );
    };

    return {
      db,
      uid,
      email,
      userData,
      primaryUid,
      isAdmin,
      isClientAdmin,
      SYSTEM_ADMIN_EMAILS,
      isAuthorizedForContext,
      getAuthService,
      getMessagingService,
    };
  } catch (e: any) {
    console.error("Context creation error:", e?.message || e);
    res.status(500).json({ error: "An internal error occurred" });
    return null;
  }
}
