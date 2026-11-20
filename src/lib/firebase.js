import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const localKeyPath = path.resolve(__dirname, '../../serviceAccountKey.json');

if (!admin.apps.length) {
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    credential = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
  } else if (fs.existsSync(localKeyPath)) {
    credential = admin.credential.cert(JSON.parse(fs.readFileSync(localKeyPath, 'utf8')));
  } else {
    credential = admin.credential.applicationDefault();
  }

  admin.initializeApp({ credential, projectId: 'la-batitienda' });
}

export const db = admin.firestore();
export const auth = admin.auth();
export const FieldValue = admin.firestore.FieldValue;
