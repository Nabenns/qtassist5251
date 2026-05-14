const { AdminUser } = require('../database/models');

/**
 * Auto-seed the first admin user from environment variables on startup.
 *
 * Env vars consumed:
 *   ADMIN_USERNAME
 *   ADMIN_PASSWORD_HASH   (bcrypt hash, generate with: npm run hash-password -- <password>)
 *
 * Behavior:
 * - If no AdminUser rows exist and both env vars are set: create one.
 * - If admin with that username exists: update password hash to match env
 *   (lets you rotate the seed password by editing .env and restarting).
 * - If env vars missing and no admin exists: warn loudly so the operator knows.
 * - Otherwise: no-op.
 */
async function seedAdmin() {
  try {
    const username = process.env.ADMIN_USERNAME;
    const passwordHash = process.env.ADMIN_PASSWORD_HASH;

    const existingCount = await AdminUser.count();

    if (!username || !passwordHash) {
      if (existingCount === 0) {
        console.warn(
          '⚠️ No admin users in database and ADMIN_USERNAME/ADMIN_PASSWORD_HASH are not set. ' +
          'Web dashboard login will be unusable. Generate a hash with `npm run hash-password -- <pw>` ' +
          'and set ADMIN_USERNAME + ADMIN_PASSWORD_HASH in your .env, then restart.'
        );
      }
      return;
    }

    const existing = await AdminUser.findOne({ where: { username } });

    if (existing) {
      if (existing.passwordHash !== passwordHash) {
        existing.passwordHash = passwordHash;
        await existing.save();
        console.log(`🔐 Admin "${username}" password hash updated from environment.`);
      }
      return;
    }

    await AdminUser.create({ username, passwordHash });
    console.log(`🔐 Seeded admin user "${username}" from environment.`);
  } catch (error) {
    console.error('Error seeding admin user:', error);
  }
}

module.exports = { seedAdmin };
