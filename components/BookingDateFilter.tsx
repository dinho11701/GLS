// components/BookingDateFilter.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
} from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

const PALETTE = {
  primary: '#0A0F2C',
  white: '#FFFFFF',
  textDark: '#0B1220',
  gold: '#FFD700',
  border: 'rgba(148,163,184,0.6)',
};

type Props = {
  selectedDate: Date | null;
  onChangeDate: (date: Date | null) => void;
};

const dayLabels = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

// Retourne la date au début du mois
const startOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const addMonths = (date: Date, n: number) =>
  new Date(date.getFullYear(), date.getMonth() + n, 1);

function getMonthMatrix(current: Date) {
  // On considère que la semaine démarre lundi
  const first = startOfMonth(current);
  const firstWeekday = (first.getDay() + 6) % 7; // 0 = lundi, ... 6 = dimanche

  const daysInMonth = new Date(
    current.getFullYear(),
    current.getMonth() + 1,
    0
  ).getDate();

  const cells: (Date | null)[] = [];
  // Jours vides avant le 1er
  for (let i = 0; i < firstWeekday; i += 1) {
    cells.push(null);
  }
  // Jours du mois
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(new Date(current.getFullYear(), current.getMonth(), d));
  }
  // Compléter pour un multiple de 7
  while (cells.length % 7 !== 0) cells.push(null);

  // Découpe en semaines
  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}

const formatHeader = (d: Date) =>
  d.toLocaleDateString('fr-CA', { month: 'long', year: 'numeric' });

/**
 * Label intelligent façon Airbnb :
 * - Aujourd’hui
 * - Demain
 * - 12 déc
 */
const formatNice = (d: Date | null) => {
  if (!d) return 'Quand ?';

  const today = new Date();
  const norm = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate());

  const day = norm(d);
  const t = norm(today);

  const msPerDay = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((day.getTime() - t.getTime()) / msPerDay);

  if (diffDays === 0) return "Aujourd’hui";
  if (diffDays === 1) return 'Demain';

  return d.toLocaleDateString('fr-CA', {
    day: 'numeric',
    month: 'short',
  });
};

export default function BookingDateFilter({
  selectedDate,
  onChangeDate,
}: Props) {
  const [visible, setVisible] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<Date>(
    selectedDate || new Date()
  );
  const [tempDate, setTempDate] = useState<Date | null>(selectedDate);

  const weeks = useMemo(() => getMonthMatrix(currentMonth), [currentMonth]);

  // 💡 Label intelligent pour le bouton
  const labelDate = useMemo(
    () => formatNice(selectedDate),
    [selectedDate],
  );

  const open = () => {
    setCurrentMonth(selectedDate || new Date());
    setTempDate(selectedDate || null);
    setVisible(true);
  };

  const close = () => setVisible(false);

  const apply = () => {
    onChangeDate(tempDate || null);
    close();
  };

  const clear = () => {
    setTempDate(null);
    onChangeDate(null);
    close();
  };

  const isSameDay = (a: Date | null, b: Date | null) => {
    if (!a || !b) return false;
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  };

  return (
    <>
      {/* Barre compacte façon Airbnb */}
      <TouchableOpacity
        style={styles.pillContainer}
        activeOpacity={0.9}
        onPress={open}
      >
        <Ionicons name="calendar-outline" size={20} color={PALETTE.textDark} />
        <Text style={styles.pillLabel}>{labelDate}</Text>
      </TouchableOpacity>

      {/* Modal calendrier */}
      <Modal
        visible={visible}
        transparent
        animationType="fade"
        onRequestClose={close}
      >
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable style={styles.modalCard} onPress={() => {}}>
            {/* Header mois + navigation */}
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choisir une date</Text>
            </View>

            <View style={styles.monthHeader}>
              <TouchableOpacity
                onPress={() => setCurrentMonth(prev => addMonths(prev, -1))}
              >
                <Ionicons
                  name="chevron-back-outline"
                  size={20}
                  color={PALETTE.textDark}
                />
              </TouchableOpacity>
              <Text style={styles.monthLabel}>
                {formatHeader(currentMonth)}
              </Text>
              <TouchableOpacity
                onPress={() => setCurrentMonth(prev => addMonths(prev, 1))}
              >
                <Ionicons
                  name="chevron-forward-outline"
                  size={20}
                  color={PALETTE.textDark}
                />
              </TouchableOpacity>
            </View>

            {/* Jours de la semaine */}
            <View style={styles.weekRow}>
              {dayLabels.map((d, idx) => (
                <Text key={`${d}-${idx}`} style={styles.weekday}>
                  {d}
                </Text>
              ))}
            </View>

            {/* Grille de dates */}
            {weeks.map((week, idx) => (
              <View key={idx} style={styles.weekRow}>
                {week.map((day, jdx) => {
                  if (!day) {
                    return <View key={jdx} style={styles.dayCell} />;
                  }
                  const selected = isSameDay(day, tempDate);
                  return (
                    <TouchableOpacity
                      key={jdx}
                      style={[
                        styles.dayCell,
                        selected && styles.dayCellSelected,
                      ]}
                      activeOpacity={0.8}
                      onPress={() => setTempDate(day)}
                    >
                      <Text
                        style={[
                          styles.dayLabel,
                          selected && styles.dayLabelSelected,
                        ]}
                      >
                        {day.getDate()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            {/* Bouton texte "Effacer la date" en bas du calendrier */}
            {tempDate && (
              <TouchableOpacity
                onPress={clear}
                style={styles.clearBottomButton}
              >
                <Text style={styles.clearBottomText}>Effacer la date</Text>
              </TouchableOpacity>
            )}

            {/* Actions */}
            <View style={styles.actionsRow}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionSecondary]}
                onPress={close}
              >
                <Text style={styles.actionSecondaryText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, styles.actionPrimary]}
                onPress={apply}
              >
                <Text style={styles.actionPrimaryText}>Appliquer</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pillContainer: {
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: PALETTE.border,
    backgroundColor: 'rgba(15,23,42,0.9)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pillLabel: {
    color: '#E5E7EB',
    fontSize: 14,
    fontWeight: '600',
  },
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.4)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  modalCard: {
    borderRadius: 20,
    backgroundColor: PALETTE.white,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: PALETTE.textDark,
  },
  monthHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginVertical: 8,
  },
  monthLabel: {
    fontSize: 15,
    fontWeight: '700',
    color: PALETTE.textDark,
    textTransform: 'capitalize',
  },
  weekRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  weekday: {
    flex: 1,
    textAlign: 'center',
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
  },
  dayCellSelected: {
    backgroundColor: PALETTE.primary,
  },
  dayLabel: {
    fontSize: 14,
    color: '#111827',
  },
  dayLabelSelected: {
    color: PALETTE.gold,
    fontWeight: '800',
  },

  // Bouton texte "Effacer la date"
  clearBottomButton: {
    alignSelf: 'flex-start',
    marginTop: 8,
  },
  clearBottomText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#6B7280',
    textDecorationLine: 'underline',
  },

  actionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
  },
  actionBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionSecondary: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    backgroundColor: '#F9FAFB',
  },
  actionSecondaryText: {
    color: '#4B5563',
    fontWeight: '600',
  },
  actionPrimary: {
    backgroundColor: PALETTE.primary,
  },
  actionPrimaryText: {
    color: PALETTE.gold,
    fontWeight: '700',
  },
});
