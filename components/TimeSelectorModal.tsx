import React, { useMemo } from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  StyleSheet,
} from "react-native";

const PALETTE = {
  bg: "#0A0F2C",
  white: "#FFFFFF",
  gold: "#FFD700",
  soft: "rgba(255,255,255,0.1)",
};

export default function TimeSelectorModal({
  visible,
  onClose,
  onConfirm,

  availabilityStart,
  availabilityEnd,

  selectedStartTime, // utilisé seulement pour end

  mode,
}) {

  const generateSlots = (start, end) => {

    if (!start || !end) return [];

    const slots = [];

    const [sh, sm] = start.substring(0,5).split(":").map(Number);
    const [eh, em] = end.substring(0,5).split(":").map(Number);

    let cur = sh * 60 + sm;
    const endMin = eh * 60 + em;

    while (cur <= endMin) {

      const h = String(Math.floor(cur / 60)).padStart(2, "0");
      const m = String(cur % 60).padStart(2, "0");

      slots.push(`${h}:${m}`);

      cur += 30;

    }

    return slots;

  };

  const slots = useMemo(() => {

    const all = generateSlots(availabilityStart, availabilityEnd);

    if (mode === "start") return all;

    if (mode === "end" && selectedStartTime) {

      const startMin =
        Number(selectedStartTime.split(":")[0]) * 60 +
        Number(selectedStartTime.split(":")[1]);

      return all.filter((t) => {

        const min =
          Number(t.split(":")[0]) * 60 +
          Number(t.split(":")[1]);

        return min > startMin;

      });

    }

    return [];

  }, [availabilityStart, availabilityEnd, selectedStartTime, mode]);

  return (
    <Modal visible={visible} transparent animationType="slide">

      <View style={styles.overlay}>

        <View style={styles.sheet}>

          <View style={styles.header}>

            <Text style={styles.title}>
              {mode === "start"
                ? "Sélectionnez votre heure de début"
                : `Heure de fin (après ${selectedStartTime})`}
            </Text>

            <TouchableOpacity onPress={onClose}>
              <Text style={styles.close}>Fermer</Text>
            </TouchableOpacity>

          </View>

          <FlatList
            data={slots}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (

              <TouchableOpacity
                style={styles.slot}
                onPress={() => {
                  onConfirm(item);
                  onClose();
                }}
              >

                <Text style={styles.slotText}>
                  {item}
                </Text>

              </TouchableOpacity>

            )}
          />

        </View>

      </View>

    </Modal>
  );
}

const styles = StyleSheet.create({

overlay:{
  flex:1,
  backgroundColor:"rgba(0,0,0,0.5)",
  justifyContent:"flex-end"
},

sheet:{
  backgroundColor:PALETTE.bg,
  paddingTop:20,
  paddingHorizontal:14,
  borderTopLeftRadius:24,
  borderTopRightRadius:24,
  height:"55%"
},

header:{
  flexDirection:"row",
  justifyContent:"space-between",
  marginBottom:14
},

title:{
  color:PALETTE.white,
  fontSize:18,
  fontWeight:"800"
},

close:{
  color:PALETTE.gold,
  fontSize:16,
  fontWeight:"700"
},

slot:{
  paddingVertical:18,
  borderBottomWidth:1,
  borderBottomColor:PALETTE.soft
},

slotText:{
  color:PALETTE.white,
  fontSize:17,
  fontWeight:"600"
}

});