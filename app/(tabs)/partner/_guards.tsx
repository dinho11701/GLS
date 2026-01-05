import { useEffect, useState } from 'react';
import { useRouter, Slot } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function RequireHost() {
  const router = useRouter();
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const role = await AsyncStorage.getItem('userRole');
      if (role !== 'host') {
        router.replace('/Login?audience=partner&returnTo=/(tabs)/partner/create/ReviewScreen');
        setOk(false);
      } else {
        setOk(true);
      }
    })();
  }, [router]);

  if (ok === null) return null; // tu peux afficher un mini loader si tu veux
  return ok ? <Slot /> : null;
}
