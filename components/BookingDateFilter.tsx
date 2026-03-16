// components/BookingDateFilter.tsx
import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Pressable,
  Platform,
  useWindowDimensions,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";

const PALETTE = {
  primary: "#0A0F2C",
  white: "#FFFFFF",
  textDark: "#0B1220",
  gold: "#FFD700",
  border: "rgba(148,163,184,0.6)",
};

type Props = {
  selectedDate: Date | null;
  onChangeDate: (date: Date | null) => void;
};

const dayLabels = ["L", "Ma", "Me", "J", "V", "S", "D"];

const startOfMonth = (date: Date) =>
  new Date(date.getFullYear(), date.getMonth(), 1);

const addMonths = (date: Date, n: number) =>
  new Date(date.getFullYear(), date.getMonth() + n, 1);

function getMonthMatrix(current: Date) {
  const first = startOfMonth(current);
  const firstWeekday = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(
    current.getFullYear(),
    current.getMonth() + 1,
    0
  ).getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++)
    cells.push(new Date(current.getFullYear(), current.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7)
    weeks.push(cells.slice(i, i + 7));

  return weeks;
}

const formatHeader = (d: Date) =>
  d.toLocaleDateString("fr-CA", { month: "long", year: "numeric" });

const formatNice = (d: Date | null) => {
  if (!d) return "Quand ?";

  const today = new Date();
  const normalize = (x: Date) =>
    new Date(x.getFullYear(), x.getMonth(), x.getDate());

  const diff =
    (normalize(d).getTime() - normalize(today).getTime()) /
    (24 * 60 * 60 * 1000);

  if (diff === 0) return "Aujourd’hui";
  if (diff === 1) return "Demain";

  return d.toLocaleDateString("fr-CA", {
    day: "numeric",
    month: "short",
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

  const { width } = useWindowDimensions();
  const isWeb = Platform.OS === "web";
  const modalMaxWidth = isWeb ? Math.min(420, width * 0.9) : "100%";

  const weeks = useMemo(() => getMonthMatrix(currentMonth), [currentMonth]);
  const labelDate = useMemo(() => formatNice(selectedDate), [selectedDate]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const currentMonthStart = startOfMonth(currentMonth);
  const todayMonthStart = startOfMonth(today);

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

  const isSameDay = (a: Date | null, b: Date | null) =>
    !!a &&
    !!b &&
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const canGoPrevMonth = currentMonthStart > todayMonthStart;

  return (
    <>
      <TouchableOpacity style={styles.pillContainer} onPress={open}>
        <Ionicons name="calendar-outline" size={20} color={PALETTE.textDark} />
        <Text style={styles.pillLabel}>{labelDate}</Text>
      </TouchableOpacity>

      <Modal visible={visible} transparent animationType="fade">
        <Pressable style={styles.backdrop} onPress={close}>
          <Pressable
            style={[
              styles.modalCard,
              { maxWidth: modalMaxWidth, alignSelf: "center" },
            ]}
            onPress={() => {}}
          >

            <Text style={styles.modalTitle}>Choisir une date</Text>

            <View style={styles.monthHeader}>

              <TouchableOpacity
                disabled={!canGoPrevMonth}
                onPress={() =>
                  canGoPrevMonth &&
                  setCurrentMonth(addMonths(currentMonth, -1))
                }
                style={!canGoPrevMonth && { opacity: 0.3 }}
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
                onPress={() =>
                  setCurrentMonth(addMonths(currentMonth, 1))
                }
              >
                <Ionicons
                  name="chevron-forward-outline"
                  size={20}
                  color={PALETTE.textDark}
                />
              </TouchableOpacity>

            </View>

            <View style={styles.weekRow}>
              {dayLabels.map((d, idx) => (
                <Text key={idx} style={styles.weekday}>
                  {d}
                </Text>
              ))}
            </View>

            {weeks.map((week, idx) => (
              <View key={idx} style={styles.weekRow}>
                {week.map((day, jdx) => {

                  if (!day)
                    return <View key={jdx} style={styles.dayCell} />;

                  const selected = isSameDay(day, tempDate);
                  const disabled = day < today;

                  return (
                    <TouchableOpacity
                      key={jdx}
                      disabled={disabled}
                      style={[
                        styles.dayCell,
                        selected && styles.dayCellSelected,
                        disabled && styles.dayCellDisabled,
                      ]}
                      onPress={() => setTempDate(day)}
                    >
                      <Text
                        style={[
                          styles.dayLabel,
                          selected && styles.dayLabelSelected,
                          disabled && styles.dayLabelDisabled,
                        ]}
                      >
                        {day.getDate()}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            ))}

            {tempDate && (
              <TouchableOpacity
                onPress={clear}
                style={styles.clearBottomButton}
              >
                <Text style={styles.clearBottomText}>
                  Effacer la date
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.actionsRow}>

              <TouchableOpacity
                style={[styles.actionBtn, styles.actionSecondary]}
                onPress={close}
              >
                <Text style={styles.actionSecondaryText}>
                  Annuler
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.actionPrimary]}
                onPress={apply}
              >
                <Text style={styles.actionPrimaryText}>
                  Appliquer
                </Text>
              </TouchableOpacity>

            </View>

          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pillContainer:{
    marginHorizontal:16,
    marginTop:8,
    borderRadius:999,
    borderWidth:1,
    borderColor:PALETTE.border,
    backgroundColor:"rgba(15,23,42,0.9)",
    paddingHorizontal:14,
    paddingVertical:10,
    flexDirection:"row",
    alignItems:"center",
    gap:8
  },

  pillLabel:{
    color:"#E5E7EB",
    fontSize:14,
    fontWeight:"600"
  },

  backdrop:{
    flex:1,
    backgroundColor:"rgba(15,23,42,0.4)",
    justifyContent:"center",
    paddingHorizontal:16
  },

  modalCard:{
    borderRadius:20,
    backgroundColor:PALETTE.white,
    padding:20,
    width:"100%",
    shadowColor:"#000",
    shadowOpacity:0.15,
    shadowRadius:10,
    shadowOffset:{width:0,height:4}
  },

  modalTitle:{
    fontSize:18,
    fontWeight:"900",
    marginBottom:10,
    color:PALETTE.textDark
  },

  monthHeader:{
    marginVertical:10,
    flexDirection:"row",
    justifyContent:"space-between",
    alignItems:"center"
  },

  monthLabel:{
    fontSize:16,
    fontWeight:"700",
    color:PALETTE.textDark,
    textTransform:"capitalize"
  },

  weekRow:{
    flexDirection:"row",
    justifyContent:"space-between",
    marginBottom:4
  },

  weekday:{
    flex:1,
    textAlign:"center",
    fontSize:12,
    fontWeight:"700",
    color:"#9CA3AF"
  },

  dayCell:{
    flex:1,
    aspectRatio:Platform.OS==="web"?undefined:1,
    height:40,
    justifyContent:"center",
    alignItems:"center",
    borderRadius:999
  },

  dayCellSelected:{
    backgroundColor:PALETTE.primary
  },

  dayCellDisabled:{
    opacity:0.25
  },

  dayLabel:{
    fontSize:14,
    color:"#111827"
  },

  dayLabelSelected:{
    color:PALETTE.gold,
    fontWeight:"800"
  },

  dayLabelDisabled:{
    color:"#9CA3AF"
  },

  clearBottomButton:{
    marginTop:10
  },

  clearBottomText:{
    fontSize:13,
    fontWeight:"600",
    color:"#6B7280",
    textDecorationLine:"underline"
  },

  actionsRow:{
    flexDirection:"row",
    marginTop:14,
    gap:10
  },

  actionBtn:{
    flex:1,
    paddingVertical:12,
    borderRadius:999,
    alignItems:"center"
  },

  actionSecondary:{
    borderWidth:1,
    borderColor:"#D1D5DB",
    backgroundColor:"#F9FAFB"
  },

  actionSecondaryText:{
    color:"#4B5563",
    fontWeight:"700"
  },

  actionPrimary:{
    backgroundColor:PALETTE.primary
  },

  actionPrimaryText:{
    color:PALETTE.gold,
    fontWeight:"900"
  }
});