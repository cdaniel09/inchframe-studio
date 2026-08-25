import { randomBytes, scryptSync } from 'node:crypto';

const password = process.argv[2];
if (!password || password.length < 12) {
  console.error('Pass a password of at least 12 characters.');
  console.error('Example: npm run hash-password -- "a-long-private-password"');
  process.exit(1);
}

const salt = randomBytes(16).toString('base64url');
const hash = scryptSync(password, salt, 64).toString('base64url');
console.log(`scrypt$${salt}$${hash}`);
