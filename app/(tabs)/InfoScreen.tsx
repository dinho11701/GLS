import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

export default function AccueilScreen() {
  const router = useRouter();

  const handleStart = () => {
    router.push('/(tabs)');
  };

  return (
    <View style={styles.container}>
      {/* Section de bienvenue */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Bonjour!</Text>
        <Text style={styles.subtitle}>Né pour briller</Text>

        <TouchableOpacity style={styles.startButton} onPress={handleStart}>
          <Text style={styles.startButtonText}>DémarrFer</Text>
          <Text style={styles.arrow}>→</Text>
        </TouchableOpacity>
      </View>

      {/* Section Fonctionnalités */}
      <View style={styles.featuresSection}>
        <Text style={styles.featuresTitle}>Fonctionnalités</Text>

        <View style={styles.featureCard}>
          <View style={styles.iconContainer}>
            <Ionicons name="bar-chart-outline" size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.featureText}>Opportunités</Text>
        </View>

        <View style={styles.featureCard}>
          <View style={styles.iconContainer}>
            <Ionicons name="settings-outline" size={24} color="#FFFFFF" />
          </View>
          <Text style={styles.featureText}>Services</Text>
        </View>
      </View>
    </View>
  );
}


const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B1220',
    paddingHorizontal: 20,
    paddingTop: 60,
  },
  header: {
    marginBottom: 40,
  },
  greeting: {
    fontSize: 36,
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontFamily: 'Montserrat',
  },
  subtitle: {
    fontSize: 16,
    color: '#FFFFFF',
    marginTop: 4,
    fontFamily: 'Inter',
  },
  startButton: {
    flexDirection: 'row',
    backgroundColor: '#F26C5E',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 24,
    width: 180,
  },
  startButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter',
  },
  arrow: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '600',
  },
  featuresSection: {
    backgroundColor: '#F6F3EF',
    borderRadius: 20,
    padding: 20,
  },
  featuresTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 20,
    fontFamily: 'Inter',
    color: '#000',
  },
  featureCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  iconContainer: {
    backgroundColor: '#C18E3D',
    padding: 10,
    borderRadius: 10,
    marginRight: 16,
  },
  icon: {
    width: 24,
    height: 24,
    tintColor: '#fff',
  },
  featureText: {
    fontSize: 16,
    color: '#000',
    fontFamily: 'Inter',
    fontWeight: '500',
  },
});
