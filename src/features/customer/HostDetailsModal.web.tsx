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

import BookingDateFilter from "@/components/BookingDateFilter.web";

const API_BASE = (
  process.env.EXPO_PUBLIC_API_BASE ?? "http://127.0.0.1:5055/api/v1"
).replace(/\/+$/, "");

export default function HostDetailsModal({ host, onClose }) {
  const router = useRouter();

  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(false);

  const [selectedService, setSelectedService] = useState(null);
  const [showCalendar, setShowCalendar] = useState(false);

  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  /* ---------------- FETCH SERVICES ---------------- */

  useEffect(() => {
    if (!host?.id || !selectedDate) return;

    console.log("FETCH SERVICES FOR DATE:", selectedDate);

    setLoading(true);

    fetch(
      `${API_BASE}/customers/services?partnerId=${host.id}&date=${selectedDate}`
    )
      .then(res => res.json())
      .then(data => {
        console.log("SERVICES:", data.items);
        setServices(data.items || []);
      })
      .catch(err => console.log("services error", err))
      .finally(() => setLoading(false));

  }, [host, selectedDate]);

  /* ---------------- UI ---------------- */

  return (
    <View style={styles.overlay}>

      <View style={styles.modal}>

        {/* CLOSE */}
        <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
          <Text style={{ fontSize: 18 }}>✕</Text>
        </TouchableOpacity>

        {/* HEADER */}
        <Text style={styles.title}>{host.name}</Text>
        <Text style={styles.rating}>⭐ {host.rating || "N/A"}</Text>

        {/* 🔥 CALENDAR DIRECT */}
        <BookingDateFilter
          onChangeDate={(date) => {
            if (!date) return;
            console.log("DATE SELECTED:", date);
            setSelectedDate(date);
          }}
        />

        {/* SERVICES */}
        <Text style={styles.section}>Services disponibles</Text>

        {loading ? (
          <ActivityIndicator />
        ) : (
          <ScrollView style={{ maxHeight: 300 }}>

            {services.length === 0 && (
              <Text style={{ color: "#777" }}>
                Aucun service disponible pour cette date
              </Text>
            )}

            {services.map((svc) => (
              <View key={svc.id} style={styles.serviceCard}>

                <Text style={styles.serviceTitle}>{svc.title}</Text>
                <Text style={styles.servicePrice}>{svc.price}$</Text>

                <TouchableOpacity
                  style={styles.bookBtn}
                  onPress={() => {
                    router.push({
                      pathname: "/services/DetailServiceScreen",
                      params: {
                        id: svc.id,
                        date: selectedDate,
                        title: svc.title,
                        price: svc.price
                      }
                    });
                  }}
                >
                  <Text style={styles.bookText}>Choisir ce service</Text>
                </TouchableOpacity>

              </View>
            ))}

          </ScrollView>
        )}

      </View>

    </View>
  );
}

/* ---------------- STYLES ---------------- */

const styles = StyleSheet.create({

  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 50,
  },

  modal: {
    width: "400px",
    maxWidth: "90%",
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 20,
  },

  closeBtn: {
    position: "absolute",
    top: 10,
    right: 10,
  },

  title: {
    fontSize: 20,
    fontWeight: "bold",
  },

  rating: {
    marginBottom: 10,
    color: "#666",
  },

  section: {
    marginTop: 10,
    fontWeight: "bold",
    marginBottom: 10,
  },

  serviceCard: {
    padding: 12,
    borderRadius: 10,
    backgroundColor: "#F5F5F5",
    marginBottom: 10,
  },

  serviceTitle: {
    fontWeight: "bold",
  },

  servicePrice: {
    color: "#444",
  },

  bookBtn: {
    marginTop: 8,
    backgroundColor: "#FF6B6B",
    padding: 10,
    borderRadius: 8,
    alignItems: "center",
  },

  bookText: {
    color: "#fff",
    fontWeight: "bold",
  },

});