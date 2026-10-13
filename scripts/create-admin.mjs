// Creates (or promotes) an admin account. There is no public sign-up.
//
//   node scripts/create-admin.mjs email@example.com
//
// Reads NEXT_PUBLIC_SUPABASE_URL (.env) and SUPABASE_SERVICE_ROLE_KEY
// (.dev.vars). A new account gets a random temporary password, printed once.
import { randomInt } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (!match || process.env[match[1]]) continue;
    process.env[match[1]] = match[2].replace(/^(['"])(.*)\1$/, "$2");
  }
}

// Easy to read aloud and type on a tablet: no 0/O, 1/l/I.
function temporaryPassword() {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  const group = () =>
    Array.from({ length: 4 }, () => alphabet[randomInt(alphabet.length)]).join(
      "",
    );
  return `${group()}-${group()}-${group()}`;
}

async function findUserByEmail(supabase, email) {
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw error;
    const user = data.users.find((u) => u.email?.toLowerCase() === email);
    if (user) return user;
    if (data.users.length < 200) return null;
  }
}

const email = process.argv[2]?.trim().toLowerCase();
if (!email || !email.includes("@")) {
  console.error("Uso: node scripts/create-admin.mjs email@exemplo.com");
  process.exit(1);
}

loadEnvFile(".env");
loadEnvFile(".env.local");
loadEnvFile(".dev.vars");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRoleKey) {
  console.error(
    "Faltam NEXT_PUBLIC_SUPABASE_URL (.env) ou SUPABASE_SERVICE_ROLE_KEY (.dev.vars).",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let user = await findUserByEmail(supabase, email);
let password = null;
if (!user) {
  password = temporaryPassword();
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  user = data.user;
}

const { error } = await supabase
  .from("admins")
  .upsert({ user_id: user.id }, { onConflict: "user_id" });
if (error) throw error;

console.log(`Admin: ${email}`);
console.log(
  password
    ? `Senha provisória: ${password}`
    : "A conta já existia; a senha não foi alterada.",
);
