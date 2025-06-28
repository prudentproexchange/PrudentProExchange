// netlify/functions/list-users.js
import { createClient } from "@supabase/supabase-js";

export async function handler(event) {
  // initialize Supabase with service-role key:
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) {
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
  return { statusCode: 200, body: JSON.stringify(users) };
}
