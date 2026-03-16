import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { useRouter } from "expo-router";

type Service = {
  id: string;
  title: string;
  fee: number;
  currency?: string;
  instances?: number;
  instances_left?: number;
};

type Props = {
  service: Service;
};

export default function ServiceCard({ service }: Props) {

  const router = useRouter();

  const currency = service.currency ?? "CAD";

  const price =
    currency === "CAD"
      ? `${service.fee}$`
      : `${service.fee} ${currency}`;

  const instancesLeft =
    service.instances_left ?? service.instances ?? 1;

  const disabled = instancesLeft <= 0;

  return (
    <TouchableOpacity
      style={[
        styles.card,
        disabled && styles.cardDisabled
      ]}
      disabled={disabled}
      onPress={() =>
        router.push({
          pathname: "/services/DetailServiceScreen",
          params: { id: service.id },
        })
      }
    >

      <Text style={styles.title}>
        {service.title}
      </Text>

      <Text style={styles.price}>
        {price}
      </Text>

      <View style={styles.instancesRow}>
        <Text style={styles.icon}>👥</Text>

        <Text style={styles.instancesText}>
          {instancesLeft > 1
            ? `${instancesLeft} places disponibles`
            : instancesLeft === 1
            ? "1 place disponible"
            : "Complet"}
        </Text>
      </View>

    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({

  card:{
    backgroundColor:"rgba(255,255,255,0.1)",
    padding:16,
    borderRadius:12,
    width:"48%",
    marginBottom:12
  },

  cardDisabled:{
    opacity:0.35
  },

  title:{
    color:"#fff",
    fontWeight:"700",
    fontSize:16
  },

  price:{
    marginTop:8,
    color:"#FFD700",
    fontWeight:"800",
    fontSize:15
  },

  instancesRow:{
    flexDirection:"row",
    alignItems:"center",
    marginTop:6
  },

  icon:{
    fontSize:14,
    marginRight:6
  },

  instancesText:{
    color:"#ccc",
    fontSize:13
  }

});