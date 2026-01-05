import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

// 🔧 Normalise l'URL: supprime les slashs finaux pour éviter les "//"
const RAW_API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? 'http://localhost:3000/api/v1';
const API_BASE = RAW_API_BASE.replace(/\/+$/, '');

function formatBackendError(data: any): string {
  if (!data) return 'Erreur inconnue.';
  if (data.error === 'ValidationError' && Array.isArray(data.details)) {
    return data.details.map((d: any) => d?.msg || '').filter(Boolean).join(' — ');
  }
  if (typeof data.error === 'string') return data.error;
  return 'Une erreur est survenue. Réessayez.';
}

export default function InscriptionScreen() {
  const router = useRouter();

  // Debug: voir l'URL vraiment utilisée par l'app
  console.log('API_BASE =>', API_BASE);

  // Champs EXACTS demandés
  const [username, setUsername] = useState('');     // user
  const [password, setPassword] = useState('');     // password
  const [confirm, setConfirm]   = useState('');
  const [email, setEmail]       = useState('');     // mail
  const [phone, setPhone]       = useState('');     // phone (E.164 si fourni)
  const [nom, setNom]           = useState('');     // nom
  const [prenom, setPrenom]     = useState('');     // prenom
  const [adresse, setAdresse]   = useState('');     // adresse (facultatif)

  // Visibilité MDP
  const [showPwd, setShowPwd]         = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Conditions
  const [acceptTerms, setAcceptTerms] = useState(false);

  // UI
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Validations simples
  const usernameValid = useMemo(() => username.trim().length >= 3, [username]);
  const emailValid    = useMemo(() => /\S+@\S+\.\S+/.test(email), [email]);
  const pwdValid      = useMemo(() => password.length >= 6, [password]);
  const samePwd       = useMemo(() => password === confirm && confirm.length > 0, [password, confirm]);
  const nomValid      = useMemo(() => nom.trim().length >= 2, [nom]);
  const prenomValid   = useMemo(() => prenom.trim().length >= 2, [prenom]);

  const isFormValid =
    usernameValid && emailValid && pwdValid && samePwd && nomValid && prenomValid && acceptTerms;

  const goLogin = () => router.replace('/Login');

  // SUBMIT relié au backend
  const handleSignUp = async () => {
    console.log({ usernameValid, emailValid, pwdValid, samePwd, nomValid, prenomValid, acceptTerms });

    // Affiche précisément ce qui manque au lieu de bloquer le bouton
    if (!isFormValid) {
      const reasons: string[] = [];
      if (!usernameValid) reasons.push('User: 3 caractères min.');
      if (!emailValid)    reasons.push('Mail invalide');
      if (!pwdValid)      reasons.push('Password: 6 caractères min.');
      if (!samePwd)       reasons.push('Confirmation différente');
      if (!nomValid)      reasons.push('Nom: 2 caractères min.');
      if (!prenomValid)   reasons.push('Prénom: 2 caractères min.');
      if (!acceptTerms)   reasons.push('Veuillez accepter les Conditions');
      setErr(reasons.join(' — '));
      return;
    }

    if (loading) return;
    setErr(null);
    setLoading(true);

    try {
      const payload = {
        mail: email.trim(),
        password,
        user: username.trim() || undefined,
        nom: nom.trim(),
        prenom: prenom.trim(),
        phone: /^\+\d{6,15}$/.test(phone.trim()) ? phone.trim() : undefined,
        adresse: adresse.trim() || undefined,
      };

      const resp = await fetch(`${API_BASE}/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await resp.json().catch(() => ({}));

      if (!resp.ok) {
        setErr(formatBackendError(data));
        return;
      }

      // ✅ Succès: retour à la page index.tsx (racine)
      router.replace('/');

    } catch (e) {
      setErr('Impossible de joindre le serveur. Vérifiez votre connexion.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.select({ ios: 'padding', android: undefined })}
    >
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {/* En-tête */}
        <View style={styles.header}>
          <Text style={styles.title}>Créer un compte</Text>
          <Text style={styles.subtitle}>Rejoignez-nous — c’est rapide ✨</Text>
        </View>

        {/* User */}
        <View style={styles.field}>
          <Text style={styles.label}>User</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="person-circle-outline" size={18} color="#666" />
            <TextInput
              placeholder="Nom d’utilisateur"
              placeholderTextColor="#888"
              style={styles.input}
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              returnKeyType="next"
            />
          </View>
          {!usernameValid && username.length > 0 && (
            <Text style={styles.errorText}>3 caractères minimum.</Text>
          )}
        </View>

        {/* Password */}
        <View style={styles.field}>
          <Text style={styles.label}>Password</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color="#666" />
            <TextInput
              placeholder="Min. 6 caractères"
              placeholderTextColor="#888"
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPwd}
              autoCapitalize="none"
              autoCorrect={false}
              // 🔒 Anti-autofill iOS/Android
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              importantForAutofill="no"
              returnKeyType="next"
            />
            <TouchableOpacity onPress={() => setShowPwd((v) => !v)}>
              <Ionicons name={showPwd ? 'eye-off-outline' : 'eye-outline'} size={18} color="#666" />
            </TouchableOpacity>
          </View>
          {!pwdValid && password.length > 0 && (
            <Text style={styles.errorText}>6 caractères minimum.</Text>
          )}
        </View>

        {/* Confirm Password */}
        <View style={styles.field}>
          <Text style={styles.label}>Confirmer le mot de passe</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="lock-closed-outline" size={18} color="#666" />
            <TextInput
              placeholder="Retapez votre mot de passe"
              placeholderTextColor="#888"
              style={styles.input}
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry={!showConfirm}
              autoCapitalize="none"
              autoCorrect={false}
              // 🔒 Anti-autofill iOS/Android
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              importantForAutofill="no"
              returnKeyType="done"
            />
            <TouchableOpacity onPress={() => setShowConfirm((v) => !v)}>
              <Ionicons name={showConfirm ? 'eye-off-outline' : 'eye-outline'} size={18} color="#666" />
            </TouchableOpacity>
          </View>
          {!samePwd && confirm.length > 0 && (
            <Text style={styles.errorText}>Les mots de passe ne correspondent pas.</Text>
          )}
        </View>

        {/* Mail */}
        <View style={styles.field}>
          <Text style={styles.label}>Mail</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="mail-outline" size={18} color="#666" />
            <TextInput
              placeholder="adresse@email.com"
              placeholderTextColor="#888"
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              returnKeyType="next"
            />
          </View>
          {!emailValid && email.length > 0 && (
            <Text style={styles.errorText}>Adresse e-mail invalide.</Text>
          )}
        </View>

        {/* Phone */}
        <View style={styles.field}>
          <Text style={styles.label}>Phone</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="call-outline" size={18} color="#666" />
            <TextInput
              placeholder="+1 514 000 0000"
              placeholderTextColor="#888"
              style={styles.input}
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              returnKeyType="next"
            />
          </View>
        </View>

        {/* Nom / Prenom */}
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Nom</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="id-card-outline" size={18} color="#666" />
              <TextInput
                placeholder="Nom de famille"
                placeholderTextColor="#888"
                style={styles.input}
                value={nom}
                onChangeText={setNom}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
            {!nomValid && nom.length > 0 && (
              <Text style={styles.errorText}>2 caractères minimum.</Text>
            )}
          </View>

          <View style={[styles.field, { flex: 1 }]}>
            <Text style={styles.label}>Prenom</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="id-card-outline" size={18} color="#666" />
              <TextInput
                placeholder="Prénom"
                placeholderTextColor="#888"
                style={styles.input}
                value={prenom}
                onChangeText={setPrenom}
                autoCapitalize="words"
                returnKeyType="next"
              />
            </View>
            {!prenomValid && prenom.length > 0 && (
              <Text style={styles.errorText}>2 caractères minimum.</Text>
            )}
          </View>
        </View>

        {/* Adresse (facultatif) */}
        <View style={styles.field}>
          <Text style={styles.label}>Adresse (facultatif)</Text>
          <View style={styles.inputWrap}>
            <Ionicons name="home-outline" size={18} color="#666" />
            <TextInput
              placeholder="Adresse complète"
              placeholderTextColor="#888"
              style={styles.input}
              value={adresse}
              onChangeText={setAdresse}
              autoCapitalize="sentences"
              returnKeyType="done"
            />
          </View>
        </View>

        {/* Conditions */}
        <TouchableOpacity
          style={styles.termsRow}
          onPress={() => setAcceptTerms((v) => !v)}
          activeOpacity={0.8}
        >
          <Ionicons
            name={acceptTerms ? 'checkbox' : 'square-outline'}
            size={20}
            color={acceptTerms ? '#F26C5E' : '#AAA'}
          />
          <Text style={styles.termsText}>
            J’accepte les <Text style={styles.link}>Conditions</Text> et la{' '}
            <Text style={styles.link}>Politique de confidentialité</Text>.
          </Text>
        </TouchableOpacity>

        {/* Erreur globale */}
        {!!err && (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={18} color="#fff" />
            <Text style={styles.errorBannerText}>{err}</Text>
          </View>
        )}

        {/* CTA */}
        <TouchableOpacity
          style={[styles.button, (loading) && styles.buttonDisabled]}
          disabled={loading}
          onPress={handleSignUp}
        >
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Créer mon compte</Text>}
        </TouchableOpacity>

        {/* Lien vers Connexion */}
        <TouchableOpacity onPress={goLogin} style={styles.loginLinkWrap}>
          <Text style={styles.loginLink}>
            Déjà membre ? <Text style={styles.linkAccent}>Se connecter</Text>
          </Text>
        </TouchableOpacity>

        {/* Contact pro */}
        <Text style={styles.contactText}>
          Besoin d’aide ? Contactez-nous au : +1 (514) 123-4567
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0B1220' },
  scroll: { paddingHorizontal: 22, paddingTop: 50, paddingBottom: 60 },
  header: { marginBottom: 24, alignItems: 'center' },
  title: { color: '#FFFFFF', fontSize: 28, fontWeight: '700', fontFamily: 'Montserrat' },
  subtitle: { color: '#CCCCCC', fontSize: 14, marginTop: 6, fontFamily: 'Inter' },
  field: { marginBottom: 16 },
  label: { color: '#FFFFFF', fontSize: 14, marginBottom: 6, fontFamily: 'Inter' },
  inputWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F1F1F1',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 48,
  },
  input: { flex: 1, fontSize: 15, color: '#111', fontFamily: 'Inter' },
  errorText: { color: '#FF9AA2', fontSize: 12, marginTop: 6, fontFamily: 'Inter' },
  termsRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 4, marginBottom: 16 },
  termsText: { color: '#EEEEEE', fontSize: 13, flex: 1, fontFamily: 'Inter' },
  link: { textDecorationLine: 'underline', color: '#FFFFFF' },
  linkAccent: { color: '#FFC857', fontWeight: '700' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#E34B4B',
    padding: 10,
    borderRadius: 10,
    marginBottom: 10,
  },
  errorBannerText: { color: '#fff', fontSize: 13 },
  button: {
    backgroundColor: '#F26C5E',
    paddingVertical: 16,
    borderRadius: 30,
    alignItems: 'center',
    marginTop: 8,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 16, fontFamily: 'Montserrat' },
  loginLinkWrap: { alignItems: 'center', marginTop: 16 },
  loginLink: { color: '#DDDDDD', fontSize: 14, fontFamily: 'Inter' },
  contactText: { color: '#AAAAAA', fontSize: 12, marginTop: 26, textAlign: 'center', fontFamily: 'Inter' },
});
