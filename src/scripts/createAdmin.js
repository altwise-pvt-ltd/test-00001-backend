// Bootstrap a platform SUPER-ADMIN out of band.
//
//   node src/scripts/createAdmin.js
//   node src/scripts/createAdmin.js --name "Site Admin" --email admin@x.test --password "Secret@123"
//
// This is the ONLY way a super-admin comes into existence — there is no HTTP
// route that mints super-admins. A super-admin sits ABOVE the per-school tenant
// boundary (schoolId null) and provisions/oversees every school.
//
// INPUT: command-line flags first (--name / --email / --password); any flag that
// is omitted is PROMPTED for interactively (password input is not echoed). So it
// works both unattended (CI / scripted) and as an interactive setup step.
//
// Refuses to create a duplicate (another super-admin with the same email — see
// the partial unique index uniq_superadmin_email). Clean connect / disconnect.
const readline = require('readline');
const bcrypt = require('bcryptjs');
const config = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../modules/users/user.model');
const { USER_ROLES } = require('../constant/constant');

const isEmail = (v) => typeof v === 'string' && /^\S+@\S+\.\S+$/.test(v);

// --flag value  parser (also supports --flag=value).
function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    const eq = arg.indexOf('=');
    if (eq !== -1) {
      out[arg.slice(2, eq)] = arg.slice(eq + 1);
    } else {
      out[arg.slice(2)] = argv[i + 1];
      i += 1;
    }
  }
  return out;
}

function ask(rl, question, { hidden = false } = {}) {
  return new Promise((resolve) => {
    if (!hidden) {
      rl.question(question, (answer) => resolve(answer));
      return;
    }
    // Mute echo for password entry.
    const onData = (char) => {
      const s = char.toString();
      if (s === '\n' || s === '\r' || s === '') process.stdin.removeListener('data', onData);
      else rl.output.write('\x1B[2K\x1B[200D' + question + '*'.repeat(rl.line.length));
    };
    rl.input.on('data', onData);
    rl.question(question, (answer) => {
      rl.input.removeListener('data', onData);
      rl.output.write('\n');
      resolve(answer);
    });
  });
}

// Collect each field from flags, falling back to an interactive prompt. Loops
// until each value is valid so a typo doesn't abort the whole run.
async function collectInput(flags) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  try {
    let name = (flags.name || '').trim();
    while (name.length < 2) {
      name = (await ask(rl, 'Super-admin name: ')).trim();
      if (name.length < 2) console.log('  Name must be at least 2 characters.');
    }

    let email = (flags.email || '').trim().toLowerCase();
    while (!isEmail(email)) {
      email = (await ask(rl, 'Super-admin email: ')).trim().toLowerCase();
      if (!isEmail(email)) console.log('  Please enter a valid email.');
    }

    let password = flags.password || '';
    while (typeof password !== 'string' || password.length < 8) {
      password = await ask(rl, 'Super-admin password (min 8 chars): ', { hidden: true });
      if (!password || password.length < 8) console.log('  Password must be at least 8 characters.');
    }

    return { name, email, password };
  } finally {
    rl.close();
  }
}

async function main() {
  const flags = parseArgs(process.argv.slice(2));
  const { name, email, password } = await collectInput(flags);

  await connectDB();
  try {
    // Refuse duplicates: a super-admin with this email already exists.
    const existing = await User.findOne({ email, role: USER_ROLES.SUPER_ADMIN });
    if (existing) {
      console.error(`[createAdmin] a super-admin with email "${email}" already exists (id: ${existing._id}). Aborting.`);
      process.exitCode = 1;
      return;
    }

    const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
    const admin = await User.create({
      name,
      email,
      passwordHash,
      role: USER_ROLES.SUPER_ADMIN,
      schoolId: null, // above the tenant boundary
    });

    console.log('\n[createAdmin] super-admin created');
    console.log('  id    :', admin._id.toString());
    console.log('  name  :', admin.name);
    console.log('  email :', admin.email);
    console.log('\n  Log in at POST /api/auth/login with this email + the password you set.');
  } finally {
    await disconnectDB();
  }
}

main().catch((err) => {
  console.error('[createAdmin] failed:', err.message || err);
  process.exitCode = 1;
  // Ensure we don't hang on an open connection after a mid-flight failure.
  disconnectDB().catch(() => {});
});
