import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { getMessaging } from "firebase-admin/messaging";
import { GoogleGenAI } from "@google/genai";

export const maxDuration = 60;

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
  return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY});
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
  if (!contextId) return false;
  if (isAdmin) return true;

  // Check if it's a project
  const projectDoc = await db.collection("projects").doc(contextId).get();
  if (projectDoc.exists) {
    const project = projectDoc.data() || {};

    // Client Admins / Program Managers see all projects in their organization
    if (
      userData.role === "client_admin" ||
      userData.role === "program_manager" ||
      userData.role === "enterprise"
    ) {
      if (project.clientId === primaryUid || project.clientId === uid)
        return true;
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
          userData.role === "client_admin" ||
          userData.role === "program_manager" ||
          userData.role === "enterprise"
        )
          return true;
      }
    }
  }

  // Check if it's a programme
  const progDoc = await db.collection("programmes").doc(contextId).get();
  if (progDoc.exists) {
    const prog = progDoc.data() || {};
    if (
      prog.clientId === primaryUid ||
      prog.userId === uid ||
      prog.pm === email
    )
      return true;
  }

  return false;
};

export async function createContext(
  req: any,
  res: any,
): Promise<ApiContext | null> {
  if (initError) {
    res.status(500).json({ error: "Server Boot Error: " + initError });
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
      const userDoc = await db.collection("users").doc(uid).get();
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
    const primaryUid = userData.clientId || uid;
    // Admin Check Logic: Firestore role OR System Admin list
    const SYSTEM_ADMIN_EMAILS = (process.env.SYSTEM_ADMIN_EMAILS || "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const isAdmin =
      userData.role === "admin" || SYSTEM_ADMIN_EMAILS.includes(email);
    if (isAdmin) {
      console.log(
        `Admin access granted to: ${email} (Method: ${userData.role === "admin" ? "Firestore" : "Env Var"})`,
      );
    }
    const isClientAdmin =
      isAdmin ||
      userData.role === "client_admin" ||
      userData.role === "enterprise";

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
    res
      .status(500)
      .json({
        error: "Context creation error: " + (e?.message || "Unknown error"),
      });
    return null;
  }
}
