import { DEMO_AUTH_USERS } from "./demoUsers.js";
import { queryDb } from "./db.js";

export function sanitizeUser(user) {
  if (!user) {
    return null;
  }

  return {
    id: Number(user.id),
    full_name: user.full_name,
    role: user.role,
    display_name: user.display_name,
    pin_label: user.pin_label || "PIN",
    is_active: user.is_active !== false,
    must_rotate_pin: Boolean(user.must_rotate_pin),
    last_login_at: user.last_login_at || null,
  };
}

export async function listUsers(dataMode) {
  if (dataMode === "demo") {
    return DEMO_AUTH_USERS.filter((user) => user.is_active !== false);
  }

  const result = await queryDb(
    `SELECT id, full_name, role, display_name, pin_label, pin_hash, must_rotate_pin, last_login_at, is_active
     FROM users
     WHERE COALESCE(is_active, TRUE) = TRUE
     ORDER BY id`,
  );

  return result.rows;
}

export async function getUserById(userId, dataMode) {
  if (!userId) {
    return null;
  }

  if (dataMode === "demo") {
    return DEMO_AUTH_USERS.find((user) => Number(user.id) === Number(userId)) || null;
  }

  const result = await queryDb(
    `SELECT id, full_name, role, display_name, pin_label, pin_hash, must_rotate_pin, last_login_at, is_active
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId],
  );

  return result.rows[0] || null;
}

export async function markUserLogin(userId, dataMode) {
  if (dataMode === "demo" || !userId) {
    return;
  }

  await queryDb("UPDATE users SET last_login_at = NOW() WHERE id = $1", [userId]);
}
