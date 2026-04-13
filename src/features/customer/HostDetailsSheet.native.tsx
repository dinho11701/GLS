import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator
} from "react-native";
import { useRouter } from "expo-router";

const API_BASE = (
  process.env.EXPO_PUBLIC_API_BASE ?? "http://127.0.0.1:5055/api/v1"
).replace(/\/+$/, "");

export default function HostDetailsSheet({ host, onClose }) {

  const router = useRouter();

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);

  /* ---------------- FETCH SERVICES ---------------- */

  useEffect(() => {
    if (!host?.id) return;

    setLoading(true);

    fetch(`${API_BASE}/customers/services?partnerId=${host.id}`)
      .then(res => res.json())
      .then(data => {
        setServices(data.items || []);
      })
      .catch(err => {
        console.log("services error", err);
      })
      .finally(() => setLoading(false));

  }, [host]);

  /* ---------------- UI ---------------- */

  return (
    <View style={styles.sheet}>

      {/* HEADER */}
      <Text style={styles.title}>{host.name}</Text>
      <Text style={styles.rating}>⭐ {host.rating || "N/A"}</Text>

      {/* SERVICES */}
      <Text style={styles.section}>Services disponibles</Text>

      {loading ? (
        <ActivityIndicator />
      ) : (
        <ScrollView style={{ maxHeight: 250 }}>

          {services.length === 0 && (
            <Text style={{ color: "#777" }}>
              Aucun service disponible
            </Text>
          )}

          {services.map((svc) => (
            <TouchableOpacity
              key={svc.id}
              style={styles.serviceCard}
              onPress={() => {
                router.push({
                  pathname: "/service/[id]",
                  params: {
                    id: svc.id,
                    title: svc.title,
                    price: svc.price
                  }
                });
              }}
            >
              <Text style={styles.serviceTitle}>{svc.title}</Text>
              <Text style={styles.servicePrice}>
                {svc.price}$
              </Text>
            </TouchableOpacity>
          ))}

        </ScrollView>
      )}

    </View>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({

  sheet: {
    position: "absolute",
    bottom: 10,
    width: "100%",
    backgroundColor: "#fff",
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 10
  },

  title: {
    fontSize: 20,
    fontWeight: "bold",
  },

  rating: {
    marginBottom: 10,
    color: "#666"
  },

  section: {
    marginTop: 10,
    fontWeight: "bold",
    marginBottom: 10
  },

  serviceCard: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#F5F5F5",
    marginBottom: 10
  },

  serviceTitle: {
    fontWeight: "bold"
  },

  servicePrice: {
    color: "#444"
  }

});