import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Alert,
  ActivityIndicator,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const API_BASE = "http://127.0.0.1:5055/api/v1";

export default function SupportModal({ visible, onClose }) {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const sendSupport = async () => {
    console.log("🔥 sendSupport triggered");

    if (message.length < 10) {
      Alert.alert("Message trop court");
      return;
    }

    try {
      setLoading(true);

      const token = await AsyncStorage.getItem("authToken");

      console.log("🟡 TOKEN FROM STORAGE:", token);

      if (!token) {
        console.log("❌ NO TOKEN FOUND");
        Alert.alert("Erreur", "Non authentifié");
        return;
      }

      console.log("🚀 Sending request to support endpoint...");

      const res = await fetch(`${API_BASE}/partners/support/contact`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
      });

      console.log("🟢 RESPONSE STATUS:", res.status);

      const data = await res.json();

      console.log("🟢 RESPONSE DATA:", data);

      if (data.ok) {
        Alert.alert("Message envoyé ✅");
        setMessage("");
        onClose();
      } else {
        Alert.alert("Erreur envoi");
      }
    } catch (err) {
      console.log("🔥 FETCH ERROR:", err);
      Alert.alert("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide">
      <View style={styles.container}>
        <Text style={styles.title}>Support partenaire</Text>

        <TextInput
          placeholder="Décrivez votre problème..."
          value={message}
          onChangeText={setMessage}
          style={[styles.input, { height: 120 }]}
          multiline
        />

        <TouchableOpacity style={styles.button} onPress={sendSupport}>
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text style={{ color: "white" }}>Envoyer</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity onPress={onClose}>
          <Text style={{ marginTop: 10 }}>Fermer</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "bold", marginBottom: 15 },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 8,
    padding: 10,
    marginBottom: 10,
  },
  button: {
    backgroundColor: "#FF6B6B",
    padding: 12,
    borderRadius: 8,
    alignItems: "center",
  },
});