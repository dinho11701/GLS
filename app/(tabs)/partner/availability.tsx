// app/(tabs)/partner/availability.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import AsyncStorage from "@react-native-async-storage/async-storage";
const API_BASE = process.env.EXPO_PUBLIC_API_BASE;



type DayKey =
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

type DayConfig = {
  key: DayKey;
  label: string;
  enabled: boolean;
  start: string; // "HH:MM"
  end: string;   // "HH:MM"
};

type ExceptionPeriod = {
  id: string;
  startDate: string; // "YYYY-MM-DD"
  endDate: string;   // "YYYY-MM-DD"
  reason: string;
};

const PALETTE = {
  primary: '#0A0F2C',
  bg: '#0B1120',
  card: '#F9FAFB',
  textDark: '#0B1220',
  textMuted: '#6B7280',
  border: 'rgba(15,23,42,0.08)',
  coral: '#F97373',
  accent: '#F97316',
  accentSoft: '#FEF3C7',
};

const ALL_DAYS: DayConfig[] = [
  { key: 'monday',    label: 'Lundi',     enabled: true,  start: '09:00', end: '17:00' },
  { key: 'tuesday',   label: 'Mardi',     enabled: true,  start: '09:00', end: '17:00' },
  { key: 'wednesday', label: 'Mercredi',  enabled: true,  start: '09:00', end: '17:00' },
  { key: 'thursday',  label: 'Jeudi',     enabled: true,  start: '09:00', end: '17:00' },
  { key: 'friday',    label: 'Vendredi',  enabled: true,  start: '09:00', end: '17:00' },
  { key: 'saturday',  label: 'Samedi',    enabled: false, start: '09:00', end: '17:00' },
  { key: 'sunday',    label: 'Dimanche',  enabled: false, start: '09:00', end: '17:00' },
];

function timeToMinutes(t: string): number {
  if (!t || !t.includes(':')) return -1;
  const [h, m] = t.split(':').map((x) => parseInt(x, 10));
  if (Number.isNaN(h) || Number.isNaN(m)) return -1;
  return h * 60 + m;
}

export default function AvailabilityScreen() {
  const router = useRouter();

  const [days, setDays] = useState<DayConfig[]>(ALL_DAYS);
  const [exceptions, setExceptions] = useState<ExceptionPeriod[]>([]);
  const [saving, setSaving] = useState(false);

  /* ---------- PRESETS ---------- */
  const applyPreset = (preset: 'week' | 'all' | 'custom') => {
    setDays((prev) =>
      prev.map((d) => {
        if (preset === 'week') {
          const isWeekday =
            d.key === 'monday' ||
            d.key === 'tuesday' ||
            d.key === 'wednesday' ||
            d.key === 'thursday' ||
            d.key === 'friday';
          return {
            ...d,
            enabled: isWeekday,
            start: '09:00',
            end: '17:00',
          };
        }
        if (preset === 'all') {
          return {
            ...d,
            enabled: true,
            start: '09:00',
            end: '21:00',
          };
        }
        // custom → ne touche pas aux valeurs
        return d;
      })
    );
  };

  /* ---------- JOURS ---------- */
  const toggleDayEnabled = (key: DayKey) => {
    setDays((prev) =>
      prev.map((d) => (d.key === key ? { ...d, enabled: !d.enabled } : d))
    );
  };

  const updateDayTime = (key: DayKey, field: 'start' | 'end', value: string) => {
    // garde que chiffres et :
    const clean = value.replace(/[^0-9:]/g, '');
    setDays((prev) =>
      prev.map((d) => (d.key === key ? { ...d, [field]: clean } : d))
    );
  };

  const applyToRestOfWeek = () => {
    const ref = days.find((d) => d.enabled) ?? days[0];
    setDays((prev) =>
      prev.map((d) => ({
        ...d,
        start: ref.start,
        end: ref.end,
        enabled: ref.enabled,
      }))
    );
  };

  /* ---------- EXCEPTIONS ---------- */
  const addException = () => {
    const now = new Date();
    const iso = now.toISOString().slice(0, 10);
    const id = `${now.getTime()}-${Math.random().toString(36).slice(2, 7)}`;
    setExceptions((prev) => [
      ...prev,
      { id, startDate: iso, endDate: iso, reason: '' },
    ]);
  };

  const updateException = (
    id: string,
    field: keyof ExceptionPeriod,
    value: string
  ) => {
    setExceptions((prev) =>
      prev.map((ex) => (ex.id === id ? { ...ex, [field]: value } : ex))
    );
  };

  const removeException = (id: string) => {
    setExceptions((prev) => prev.filter((ex) => ex.id !== id));
  };

  /* ---------- VALIDATION ---------- */
  const errors = useMemo(() => {
    const errs: string[] = [];

    const anyEnabled = days.some((d) => d.enabled);
    if (!anyEnabled) {
      errs.push('Au moins un jour doit être disponible.');
    }

    days.forEach((d) => {
      if (!d.enabled) return;
      const s = timeToMinutes(d.start);
      const e = timeToMinutes(d.end);
      if (s < 0 || e < 0) {
        errs.push(`Format horaire invalide pour ${d.label}.`);
      } else if (e <= s) {
        errs.push(`L’heure de fin doit être après l’heure de début pour ${d.label}.`);
      }
    });

    exceptions.forEach((ex) => {
      if (ex.startDate && ex.endDate && ex.startDate > ex.endDate) {
        errs.push(
          `La date de fin doit être après la date de début pour la période "${ex.reason || ex.startDate}".`
        );
      }
    });

    return errs;
  }, [days, exceptions]);

  const hasErrors = errors.length > 0;

// ----- Transformation FRONT --> BACKEND -----

function mapDaysToWeekly(days: DayConfig[]) {
  const tz = "America/Toronto";
  const dayOrder: DayKey[] = [
    'monday','tuesday','wednesday','thursday','friday','saturday','sunday'
  ];

  return dayOrder.map((key, index) => {
    const d = days.find(x => x.key === key)!;

    return {
      kind: "weekly",
      tz,
      day: index, // 0 = lundi
      closed: !d.enabled,
      ranges: d.enabled ? [{ start: d.start, end: d.end }] : []
    };
  });
}

function mapExceptionsToOverrides(exceptions: ExceptionPeriod[]) {
  const tz = "America/Toronto";

  const docs = [];

  exceptions.forEach(ex => {
    const start = ex.startDate;
    const end = ex.endDate;

    // Expand dates into each individual day
    let cursor = new Date(start);
    const last = new Date(end);

    while (cursor <= last) {
      const iso = cursor.toISOString().slice(0, 10);

      docs.push({
        kind: "override",
        tz,
        date: iso,
        closed: true,
        ranges: [],
        reason: ex.reason || null
      });

      cursor.setDate(cursor.getDate() + 1);
    }
  });

  return docs;
}


  /* ---------- SAUVEGARDE ---------- */
  const handleSave = async () => {
  if (hasErrors) {
    Alert.alert("Erreur", "Corrige les erreurs avant de sauvegarder.");
    return;
  }

  try {
    setSaving(true);

    // 1. Transformer les données
    const weeklyDocs = mapDaysToWeekly(days);
    const overrideDocs = mapExceptionsToOverrides(exceptions);

    console.log("[AVAILABILITY][WEEKLY]", weeklyDocs);
    console.log("[AVAILABILITY][OVERRIDES]", overrideDocs);

    const token = await AsyncStorage.getItem("idToken");

    // 2. Envoyer chaque weekly
    for (const w of weeklyDocs) {
      await fetch(`${API_BASE}/partners/availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(w),
      });
    }

    // 3. Envoyer chaque override
    for (const o of overrideDocs) {
      await fetch(`${API_BASE}/partner/availability`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(o),
      });
    }

    Alert.alert("Succès", "Disponibilités sauvegardées.");
    router.back();

  } catch (err) {
    console.error(err);
    Alert.alert("Erreur", "Impossible de sauvegarder.");
  } finally {
    setSaving(false);
  }
};


  const handleCancel = () => {
    setDays(ALL_DAYS);
    setExceptions([]);
    router.back();
  };

  /* ---------- RENDER ---------- */
  return (
    <View style={{ flex: 1, backgroundColor: PALETTE.bg }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => router.back()}
            hitSlop={{ top: 10, left: 10, right: 10, bottom: 10 }}
          >
            <Ionicons name="chevron-back" size={24} color="#F9FAFB" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Gestion des disponibilités</Text>
          <View style={{ width: 24 }} />
        </View>

        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 32 }}
          showsVerticalScrollIndicator={false}
        >
          {/* CARD PRINCIPALE */}
          <View style={styles.card}>
            {/* Intro */}
            <View style={styles.cardHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.title}>Définir vos disponibilités</Text>
                <Text style={styles.subtitle}>
                  Configurez vos jours, horaires et périodes de fermeture pour vos réservations.
                </Text>
              </View>
              <View style={styles.badgeInfo}>
                <Text style={styles.badgeText}>
                  ℹ️ Ces paramètres s’appliquent aux nouvelles réservations.
                </Text>
              </View>
            </View>

            {/* PRESETS */}
            <Text style={styles.sectionTitle}>Configuration rapide</Text>
            <Text style={styles.sectionText}>
              Choisissez une base d’horaire, vous pourrez l’ajuster ensuite.
            </Text>
            <View style={styles.pillsRow}>
              <PresetBtn label="Lun–Ven, 9h–17h" onPress={() => applyPreset('week')} />
              <PresetBtn label="Tous les jours, 9h–21h" onPress={() => applyPreset('all')} />
              <PresetBtn label="Personnaliser" onPress={() => applyPreset('custom')} />
            </View>

            {/* HORAIRES RÉCURRENTS */}
            <View style={styles.sectionHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Horaires récurrents</Text>
                <Text style={styles.sectionText}>
                  Définissez vos heures habituelles pour chaque jour de la semaine.
                </Text>
              </View>
              <TouchableOpacity onPress={applyToRestOfWeek} style={styles.smallBtn}>
                <Text style={styles.smallBtnText}>Appliquer à toute la semaine</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.daysCard}>
              {days.map((d) => (
                <View key={d.key} style={styles.dayRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.dayLabel}>{d.label}</Text>
                    <View style={styles.daySwitchRow}>
                      <Text style={styles.daySwitchText}>Disponible</Text>
                      <Switch
                        value={d.enabled}
                        onValueChange={() => toggleDayEnabled(d.key)}
                      />
                    </View>
                  </View>
                  <View style={styles.timeColumn}>
                    <Text style={styles.timeLabel}>De</Text>
                    <TextInput
                      value={d.start}
                      onChangeText={(txt) => updateDayTime(d.key, 'start', txt)}
                      placeholder="09:00"
                      placeholderTextColor="#9CA3AF"
                      style={[styles.timeInput, !d.enabled && styles.timeInputDisabled]}
                      editable={d.enabled}
                    />
                  </View>
                  <View style={styles.timeColumn}>
                    <Text style={styles.timeLabel}>À</Text>
                    <TextInput
                      value={d.end}
                      onChangeText={(txt) => updateDayTime(d.key, 'end', txt)}
                      placeholder="17:00"
                      placeholderTextColor="#9CA3AF"
                      style={[styles.timeInput, !d.enabled && styles.timeInputDisabled]}
                      editable={d.enabled}
                    />
                  </View>
                </View>
              ))}
              <Text style={styles.helperText}>
                Format HH:MM (24h). L’heure de fin doit être après l’heure de début.
              </Text>
            </View>

            {/* EXCEPTIONS */}
            <View style={styles.sectionHeaderRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>Exceptions (jours fermés, congés)</Text>
                <Text style={styles.sectionText}>
                  Ajoutez les périodes pendant lesquelles vous ne souhaitez pas recevoir de réservations.
                </Text>
              </View>
              <TouchableOpacity onPress={addException} style={styles.smallBtn}>
                <Text style={styles.smallBtnText}>+ Ajouter une période</Text>
              </TouchableOpacity>
            </View>

            {exceptions.length === 0 ? (
              <Text style={styles.helperText}>
                Aucune période d’exception définie pour le moment.
              </Text>
            ) : (
              <View style={{ gap: 8 }}>
                {exceptions.map((ex) => (
                  <View key={ex.id} style={styles.exceptionRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exceptionLabel}>Du (YYYY-MM-DD)</Text>
                      <TextInput
                        value={ex.startDate}
                        onChangeText={(txt) =>
                          updateException(ex.id, 'startDate', txt)
                        }
                        placeholder="2025-01-01"
                        placeholderTextColor="#9CA3AF"
                        style={styles.exceptionInput}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.exceptionLabel}>Au (YYYY-MM-DD)</Text>
                      <TextInput
                        value={ex.endDate}
                        onChangeText={(txt) =>
                          updateException(ex.id, 'endDate', txt)
                        }
                        placeholder="2025-01-07"
                        placeholderTextColor="#9CA3AF"
                        style={styles.exceptionInput}
                      />
                    </View>
                    <View style={{ flex: 1.3 }}>
                      <Text style={styles.exceptionLabel}>Motif</Text>
                      <TextInput
                        value={ex.reason}
                        onChangeText={(txt) =>
                          updateException(ex.id, 'reason', txt)
                        }
                        placeholder="Vacances, jour férié…"
                        placeholderTextColor="#9CA3AF"
                        style={styles.exceptionInput}
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => removeException(ex.id)}
                      style={styles.exceptionDeleteBtn}
                    >
                      <Ionicons name="trash-outline" size={18} color={PALETTE.coral} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}

            {/* ERREURS */}
            {hasErrors && (
              <View style={styles.errorBox}>
                <Text style={styles.errorTitle}>Merci de corriger :</Text>
                {errors.map((err, idx) => (
                  <Text key={idx} style={styles.errorText}>
                    • {err}
                  </Text>
                ))}
              </View>
            )}

            {/* ACTIONS */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionBtnSecondary]}
                onPress={handleCancel}
              >
                <Text style={[styles.actionText, { color: PALETTE.textDark }]}>
                  Annuler
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  styles.actionBtnPrimary,
                  (saving || hasErrors) && { opacity: 0.6 },
                ]}
                onPress={handleSave}
                disabled={saving || hasErrors}
              >
                <Text style={styles.actionText}>
                  {saving ? 'Enregistrement…' : 'Enregistrer mes disponibilités'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

/* ----- Petits composants ----- */
function PresetBtn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.pillBtn} onPress={onPress} activeOpacity={0.9}>
      <Text style={styles.pillText}>{label}</Text>
    </TouchableOpacity>
  );
}

/* ----- Styles ----- */
const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 56,
    justifyContent: 'space-between',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    color: '#F9FAFB',
    fontSize: 18,
    fontWeight: '800',
  },
  card: {
    backgroundColor: PALETTE.card,
    borderRadius: 24,
    padding: 18,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 14,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: PALETTE.textDark,
  },
  subtitle: {
    fontSize: 13,
    color: PALETTE.textMuted,
    marginTop: 4,
  },
  badgeInfo: {
    backgroundColor: PALETTE.accentSoft,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    maxWidth: 180,
  },
  badgeText: {
    fontSize: 11,
    color: PALETTE.textDark,
  },
  sectionTitle: {
    marginTop: 10,
    fontSize: 15,
    fontWeight: '800',
    color: PALETTE.textDark,
  },
  sectionText: {
    fontSize: 12,
    color: PALETTE.textMuted,
    marginTop: 2,
    marginBottom: 6,
  },
  pillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  pillBtn: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: '#FFFFFF',
  },
  pillText: {
    fontSize: 12,
    fontWeight: '700',
    color: PALETTE.textDark,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginTop: 10,
  },
  smallBtn: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#4F46E5',
    backgroundColor: '#EEF2FF',
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  smallBtnText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#4338CA',
  },
  daysCard: {
    marginTop: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  dayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  dayLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: PALETTE.textDark,
  },
  daySwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 8,
  },
  daySwitchText: {
    fontSize: 12,
    color: PALETTE.textMuted,
  },
  timeColumn: {
    width: 80,
  },
  timeLabel: {
    fontSize: 11,
    color: PALETTE.textMuted,
    marginBottom: 2,
  },
  timeInput: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 13,
    textAlign: 'center',
    color: PALETTE.textDark,
  },
  timeInputDisabled: {
    backgroundColor: '#F3F4F6',
    color: '#9CA3AF',
  },
  helperText: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 4,
  },
  exceptionRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    padding: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  exceptionLabel: {
    fontSize: 11,
    color: PALETTE.textMuted,
    marginBottom: 2,
  },
  exceptionInput: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 6,
    paddingHorizontal: 8,
    fontSize: 12,
    color: PALETTE.textDark,
    backgroundColor: '#FFFFFF',
  },
  exceptionDeleteBtn: {
    padding: 6,
  },
  errorBox: {
    marginTop: 12,
    borderRadius: 12,
    padding: 10,
    backgroundColor: '#FEF2F2',
  },
  errorTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#B91C1C',
    marginBottom: 4,
  },
  errorText: {
    fontSize: 12,
    color: '#B91C1C',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 16,
  },
  actionBtn: {
    borderRadius: 999,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  actionBtnSecondary: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  actionBtnPrimary: {
    backgroundColor: PALETTE.accent,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
