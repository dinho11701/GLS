// components/RequireHost.tsx
import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { usePathname, useRouter } from 'expo-router';
import { getAuth } from '@/lib/auth';

const PALETTE = { primary:'#0A0F2C', cream:'#F9FAFB' };

export default function RequireHost({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    (async () => {
      const { idToken, role } = await getAuth();
      if (!idToken || role !== 'host') {
        // 🔁 réutilise TA page co customer
        router.replace({ pathname: '/auth/Sign', params: { next: pathname } });
        return;
      }
      setReady(true);
    })();
  }, [router, pathname]);

  if (!ready) {
    return (
      <View style={{ flex:1, backgroundColor:PALETTE.cream, alignItems:'center', justifyContent:'center' }}>
        <ActivityIndicator color={PALETTE.primary} />
      </View>
    );
  }
  return <>{children}</>;
}
