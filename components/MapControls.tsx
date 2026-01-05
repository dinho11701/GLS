// components/MapControls.tsx
import React from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

type Props = {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onToggleMapType: () => void;
  onRecenterUser: () => void;
  onRecenterHost?: () => void;         // optionnel
  onToggleFullscreen: () => void;      // 👈 toggle carte plein écran
  isFullscreen: boolean;               // 👈 pour changer l’icône
  mapType: 'standard' | 'satellite';
};

export default function MapControls({
  onZoomIn,
  onZoomOut,
  onToggleMapType,
  onRecenterUser,
  onRecenterHost,
  onToggleFullscreen,
  isFullscreen,
  mapType,
}: Props) {
  return (
    <View style={styles.container}>
      {/* Zoom + */}
      <TouchableOpacity style={styles.btn} onPress={onZoomIn}>
        <Ionicons name="add" size={22} color="#0A0F2C" />
      </TouchableOpacity>

      {/* Zoom - */}
      <TouchableOpacity style={styles.btn} onPress={onZoomOut}>
        <Ionicons name="remove" size={22} color="#0A0F2C" />
      </TouchableOpacity>

      {/* Plein écran / quitter plein écran */}
      <TouchableOpacity style={styles.btn} onPress={onToggleFullscreen}>
        <Ionicons
          name={isFullscreen ? 'contract' : 'expand'}
          size={20}
          color="#0A0F2C"
        />
      </TouchableOpacity>

      {/* Vue satellite / plan */}
      <TouchableOpacity style={styles.btn} onPress={onToggleMapType}>
        <Ionicons
          name={mapType === 'satellite' ? 'earth' : 'map'}
          size={20}
          color="#0A0F2C"
        />
      </TouchableOpacity>

      {/* Recentrer sur le client */}
      <TouchableOpacity style={styles.btn} onPress={onRecenterUser}>
        <Ionicons name="locate" size={20} color="#0A0F2C" />
      </TouchableOpacity>

      {/* Recentrer sur host (si fourni) */}
      {onRecenterHost && (
        <TouchableOpacity style={styles.btn} onPress={onRecenterHost}>
          <Ionicons name="navigate" size={20} color="#0A0F2C" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    right: 16,
    bottom: 40,
    flexDirection: 'column',
    gap: 10,
    zIndex: 999,
  },
  btn: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
  },
});
