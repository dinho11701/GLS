// app/Login.tsx
import React, { useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter, useLocalSearchParams } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { DeviceEventEmitter } from "react-native";

import { loginStyles as styles } from "./styles/login.styles";

const API_BASE = "http://127.0.0.1:5055/api/v1";
type Role = "partner" | "customer";

const stripSpaces = (s: string) =>
  s.replace(/\s+/g, "").trim().toLowerCase();

const isValidEmail = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

const AuthService = {
  async login(role: Role, email: string, password: string) {
    const endpoint =
  role === "partner"
    ? `${API_BASE}/auth/partners/login`
    : `${API_BASE}/auth/customers/login`;
    console.log("🚀 Calling:", endpoint);

    const resp = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mail: email, password }),
    });

    console.log("🟢 Status:", resp.status);

    const data = await resp.json();
    console.log("🟢 Data:", data);

    if (!resp.ok) {
      throw new Error(data?.error || "Erreur serveur");
    }

    return data;
  },

  async persistSession(token: string, role: Role, user: any) {
    console.log("💾 Saving token:", token);

    await AsyncStorage.multiSet([
      ["authToken", token],
      ["userRole", role],
      ["userJson", JSON.stringify(user)],
    ]);

    const verifyToken = await AsyncStorage.getItem("authToken");
    console.log("✅ Token saved successfully:", verifyToken);

    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem("authToken", token);
      window.localStorage.setItem("userRole", role);
      window.localStorage.setItem("userJson", JSON.stringify(user));
    }

    DeviceEventEmitter.emit("auth:changed", {
      signedIn: true,
      role,
    });
  },
};

export default function LoginScreen() {
  const router = useRouter();
  const { audience, returnTo } =
    useLocalSearchParams<{ audience?: string; returnTo?: string }>();

  const roleFromQuery =
    audience === "partner" ? "partner" : "customer";

  const [role, setRole] = useState<Role>(roleFromQuery);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = useCallback(async () => {
    if (loading) return;
    setError(null);

    const cleanEmail = stripSpaces(email);

    if (!isValidEmail(cleanEmail)) {
      setError("Adresse e-mail invalide.");
      return;
    }

    if (password.length < 6) {
      setError("Mot de passe trop court.");
      return;
    }

    setLoading(true);

    try {
      const data = await AuthService.login(
        role,
        cleanEmail,
        password
      );

      await AuthService.persistSession(
        data.token,
        role,
        data.user
      );

      setPassword("");

      if (returnTo) {
  router.replace(String(returnTo));
} else {
  router.replace("/(tabs)/HomeScreen");
}
    } catch (e: any) {
      setError(e.message || "Erreur de connexion");
    } finally {
      setLoading(false);
    }
  }, [email, password, role, returnTo, router, loading]);

return (
    <KeyboardAvoidingView
      behavior={Platform.select({ ios: "padding" })}
      style={styles.screen}
    >
      <ScrollView contentContainerStyle={styles.scrollInner}>
        <View style={styles.container}>
          <View style={styles.logoContainer}>
            <Image
              source={require("@/assets/images/new-logo.png")}
              style={styles.logo}
            />
            <Text style={styles.brandLine1}>LaSolution</Text>
            <Text style={styles.brandLine2}>App</Text>
          </View>

          <View style={styles.roleSwitchRow}>
            <TouchableOpacity
              onPress={() => setRole("customer")}
              style={[
                styles.roleChip,
                role === "customer" && styles.roleChipActive,
              ]}
            >
              <Text style={styles.roleChipText}>Client</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setRole("partner")}
              style={[
                styles.roleChip,
                role === "partner" && styles.roleChipActive,
              ]}
            >
              <Text style={styles.roleChipText}>Partenaire</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            placeholder="Adresse e-mail"
            style={styles.input}
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />

          <View style={styles.inputWrap}>
            <TextInput
              placeholder="Mot de passe"
              secureTextEntry={!showPwd}
              style={[styles.input, styles.inputWithIcon]}
              value={password}
              onChangeText={setPassword}
            />
            <TouchableOpacity
              style={styles.eyeBtn}
              onPress={() => setShowPwd((v) => !v)}
            >
              <Ionicons
                name={showPwd ? "eye-off" : "eye"}
                size={20}
                color="#fff"
              />
            </TouchableOpacity>
          </View>

          {error && (
            <Text style={styles.errorText}>{error}</Text>
          )}

          <TouchableOpacity
            style={[styles.buttonPrimary, loading && styles.disabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonPrimaryText}>
                Se connecter
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}