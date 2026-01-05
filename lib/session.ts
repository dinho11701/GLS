// lib/session.ts
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function logoutAll() {
  await AsyncStorage.multiRemove([
    'idToken',
    'refreshToken',
    'userRole',
    'userJson',
    'uid',
    'lastEmail',
  ]);
}

export async function getSnapshot() {
  const entries = await AsyncStorage.multiGet([
    'idToken','refreshToken','userRole','userJson','uid','lastEmail'
  ]);
  return Object.fromEntries(entries.map(([k, v]) => [k, v]));
}
