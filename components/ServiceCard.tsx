import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Animated, StyleSheet } from "react-native";
import { Service } from "../types";

const PALETTE = {
  primary: "#0A0F2C",
  white: "#FFFFFF",
  textDark: "#0B1220",
  gold: "#FFD700",
};

type Props = {
  item: Service;
  pulse: boolean;
  cardWidth: number;
  onPress: () => void;
};

export default function ServiceCard({ item, pulse, cardWidth, onPress }: Props) {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  // Animation pulse
  useEffect(() => {
    if (pulse) {
      Animated.sequence([
        Animated.timing(scaleAnim, {
          toValue: 1.05,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [pulse]);

  // ⭐ total venant du backend
  const total =
  typeof item.instancesTotal === "number"
    ? item.instancesTotal
    : item.Availability?.instances ?? 0;


const remaining =
  typeof item?.remainingInstances === "number"
    ? item.remainingInstances
    : (item.instancesTotal - item.instancesBooked);


  const isFull = remaining === 0;

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={[
          styles.serviceCard,
          { width: cardWidth },
          isFull && styles.serviceCardDisabled,
        ]}
        disabled={isFull}
        onPress={onPress}
      >
        <View style={styles.serviceThumb} />

        <Text style={[styles.serviceTitle, isFull && { color: "#777" }]}>
          {item.Service}
        </Text>

        <Text style={[styles.serviceMeta, isFull && { color: "#999" }]}>
          ${item.Fee} • {item.Activity_Secteur}
        </Text>

        {/* ⭐ Affichage 2/3 places */}
        <Text style={[styles.servicePlaces, isFull && { color: "#999" }]}>
          {remaining} / {total} places
        </Text>

        {isFull && (
          <View style={styles.fullBadge}>
            <Text style={styles.fullBadgeText}>Complet</Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  serviceCard: {
    backgroundColor: PALETTE.white,
    borderRadius: 18,
    padding: 12,
    paddingBottom: 16,
    minHeight: 190,
  },
  serviceCardDisabled: {
    opacity: 0.55,
  },
  serviceThumb: {
    height: 95,
    backgroundColor: "#EEE2C8",
    borderRadius: 12,
    marginBottom: 10,
  },
  serviceTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: PALETTE.textDark,
  },
  serviceMeta: {
    color: "rgba(11,18,32,0.6)",
    marginTop: 3,
  },
  servicePlaces: {
    marginTop: 4,
    fontSize: 13,
    color: "#444",
  },
  fullBadge: {
    marginTop: 8,
    backgroundColor: "#222",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  fullBadgeText: {
    color: "white",
    fontSize: 11,
    fontWeight: "700",
  },
});
