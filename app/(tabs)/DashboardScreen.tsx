import React from 'react';
import { View, Text, StyleSheet, Image, ScrollView } from 'react-native';

export default function DashboardScreen() {
  return (
    <ScrollView contentContainerStyle={styles.container}>
      {/* En-tête */}
      <View style={styles.header}>
        <Text style={styles.title}>Tableau de bord</Text>
        <Image source={require('@/assets/images/icon.png')} style={styles.profileIcon} />
      </View>

      {/* Section Statistiques */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Statistiques</Text>
        <Image
          source={require('@/assets/images/new-logo.png')} // Image du graphique (exemple statique)
          style={styles.chart}
          resizeMode="contain"
        />
      </View>

      {/* Section Tâches */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Mes tâches</Text>

        <View style={styles.taskItem}>
          <View style={styles.bullet} />
          <Text style={styles.taskText}>Publier un article</Text>
        </View>

        <View style={styles.taskItem}>
          <View style={styles.bullet} />
          <Text style={styles.taskText}>Mettre à jour le profil</Text>
        </View>

        <Text style={styles.dateText}>Aujourd'hui</Text>
      </View>
    </ScrollView>
  );
}


const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    backgroundColor: '#0B1220',
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    fontFamily: 'Montserrat',
  },
  profileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
  },
  section: {
    backgroundColor: '#F6F3EF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    color: '#000000',
    fontFamily: 'Inter',
  },
  chart: {
    width: '100%',
    height: 150,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  bullet: {
    width: 10,
    height: 10,
    backgroundColor: '#0B1220',
    borderRadius: 5,
    marginRight: 12,
  },
  taskText: {
    fontSize: 16,
    color: '#000',
    fontFamily: 'Inter',
  },
  dateText: {
    marginTop: 12,
    fontSize: 13,
    color: '#888',
    fontFamily: 'Inter',
  },
});
