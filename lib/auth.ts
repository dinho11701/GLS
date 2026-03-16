// app/(tabs)/lib/auth.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

type Role = 'host' | 'customer';

function coerceToken(token: unknown): string {
  if (typeof token === 'string') return token;
  if (token && typeof token === 'object') {
    const t = (token as any);
    return String(t.idToken ?? t.token ?? '');
  }
  return '';
}

export async function saveAuth(opts: { token: unknown; role: Role; user?: any; refreshToken?: unknown }) {
  const idToken = coerceToken(opts.token);
  if (!idToken) throw new Error('Invalid token payload (idToken empty)');

  const refreshToken =
    typeof opts.refreshToken === 'string'
      ? opts.refreshToken
      : (opts as any)?.refreshToken?.refreshToken
        ? String((opts as any).refreshToken.refreshToken)
        : '';

  await AsyncStorage.multiSet([
    ['idToken', idToken],
    ['refreshToken', refreshToken],
    ['userRole', opts.role],
    ['userProfile', JSON.stringify(opts.user ?? {})],
  ]);
}

export async function getAuth() {
  const [idToken, role, userProfile] = await Promise.all([
    AsyncStorage.getItem('idToken'),
    AsyncStorage.getItem('userRole'),
    AsyncStorage.getItem('userProfile'),
  ]);
  return {
    idToken,
    role: (role as Role | null) ?? null,
    user: userProfile ? JSON.parse(userProfile) : null,
  };
}
