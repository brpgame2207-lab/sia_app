// CommonJS env validator for required Firebase VITE_ keys
const dotenv = require('dotenv');
dotenv.config();

const required = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
  'GROQ_API_KEY',
  'VITE_CAPSULE_FIREBASE_API_KEY',
  'VITE_CAPSULE_FIREBASE_AUTH_DOMAIN',
  'VITE_CAPSULE_FIREBASE_PROJECT_ID',
  'VITE_CAPSULE_FIREBASE_STORAGE_BUCKET',
  'VITE_CAPSULE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_CAPSULE_FIREBASE_APP_ID'
];

const missing = required.filter(k => !process.env[k]);
if (missing.length) {
  console.log('Missing Firebase env keys:');
  missing.forEach(k => console.log('  -', k));
  process.exitCode = 1;
} else {
  console.log('All required Firebase env keys are present.');
}
