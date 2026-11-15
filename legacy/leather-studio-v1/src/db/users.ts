import { eq } from 'drizzle-orm';
import { db, isPostgresConfigured } from './index.ts';
import { users } from './schema.ts';

interface FallbackUser {
  uid: string;
  email: string;
  displayName: string;
  preferencesJson: {
    preferredMaterials?: string[];
    preferredEdgeProcesses?: string[];
    defaultSeamAllowanceMm?: number;
    designHabitNotes?: string[];
    memoryConsentEnabled?: boolean;
  };
  createdAt: Date;
  updatedAt: Date;
}

const fallbackUsers = new Map<string, FallbackUser>();

export async function getOrCreateUser(uid: string, email: string, displayName = '') {
  if (!isPostgresConfigured) {
    const existing = fallbackUsers.get(uid);
    const now = new Date();
    if (existing) {
      existing.email = email || existing.email;
      if (displayName) existing.displayName = displayName;
      existing.updatedAt = now;
      return existing;
    }
    const created: FallbackUser = {
      uid,
      email,
      displayName,
      preferencesJson: { memoryConsentEnabled: true },
      createdAt: now,
      updatedAt: now,
    };
    fallbackUsers.set(uid, created);
    return created;
  }
  try {
    const result = await db
      .insert(users)
      .values({
        uid,
        email,
        displayName,
        preferencesJson: { memoryConsentEnabled: true },
      })
      .onConflictDoUpdate({
        target: users.uid,
        set: {
          email,
          ...(displayName ? { displayName } : {}),
          updatedAt: new Date(),
        },
      })
      .returning();
    return result[0];
  } catch (error) {
    console.error('Database query failed in getOrCreateUser:', error);
    throw new Error('Failed to sync user profile.', { cause: error });
  }
}

export async function getUserByUid(uid: string) {
  if (!isPostgresConfigured) {
    return fallbackUsers.get(uid) ?? null;
  }
  try {
    const rows = await db.select().from(users).where(eq(users.uid, uid)).limit(1);
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in getUserByUid:', error);
    throw new Error('Failed to fetch user profile.', { cause: error });
  }
}

export async function updateUserPreferences(
  uid: string,
  preferences: {
    preferredMaterials?: string[];
    preferredEdgeProcesses?: string[];
    defaultSeamAllowanceMm?: number;
    designHabitNotes?: string[];
    memoryConsentEnabled?: boolean;
  }
) {
  if (!isPostgresConfigured) {
    const existing = fallbackUsers.get(uid) ?? (await getOrCreateUser(uid, '', ''));
    const merged = {
      ...(existing.preferencesJson ?? { memoryConsentEnabled: true }),
      ...preferences,
    };
    existing.preferencesJson = merged;
    existing.updatedAt = new Date();
    fallbackUsers.set(uid, existing);
    return existing;
  }
  try {
    const existing = await getUserByUid(uid);
    const merged = {
      ...(existing?.preferencesJson ?? { memoryConsentEnabled: true }),
      ...preferences,
    };
    const rows = await db
      .update(users)
      .set({ preferencesJson: merged, updatedAt: new Date() })
      .where(eq(users.uid, uid))
      .returning();
    return rows[0] ?? null;
  } catch (error) {
    console.error('Database query failed in updateUserPreferences:', error);
    throw new Error('Failed to update user preferences.', { cause: error });
  }
}
