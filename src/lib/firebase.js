import admin from 'firebase-admin';

// Usa GOOGLE_APPLICATION_CREDENTIALS (ruta al JSON de la cuenta de servicio).
if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.applicationDefault(), projectId: 'la-batitienda' });
}

export const db = admin.firestore();
export const auth = admin.auth();
export const FieldValue = admin.firestore.FieldValue;
