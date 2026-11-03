// Prints a random Admin ID, password and session secret to paste into Vercel (Settings > Environment Variables).
// Run: npm run admin:credentials     Nothing is stored; copy the values before closing the terminal.
import crypto from "node:crypto";

const pick = (chars, n) => Array.from(crypto.randomBytes(n), (b) => chars[b % chars.length]).join("");
console.log(`
Add these three variables in Vercel (Production) and redeploy:

  ADMIN_USERNAME = admin-${pick("abcdefghjkmnpqrstuvwxyz23456789", 5)}
  ADMIN_PASSWORD = ${pick("ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789", 14)}${pick("!@#$%*-_", 2)}
  SESSION_SECRET = ${crypto.randomBytes(32).toString("hex")}

Sign in at https://YOUR-DOMAIN/admin. You can change the Admin ID and password later under Account.
`);
