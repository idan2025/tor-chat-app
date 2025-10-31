/**
 * AdminCard Component
 *
 * Reusable card component for displaying statistics in the admin panel.
 * Shows an icon, title, value, optional subtitle, and supports press action.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

export interface AdminCardProps {
  icon: string;
  title: string;
  value: string | number;
  subtitle?: string;
  color?: string;
  onPress?: () => void;
}

export const AdminCard: React.FC<AdminCardProps> = ({
  icon,
  title,
  value,
  subtitle,
  color = '#7c3aed',
  onPress,
}) => {
  const CardWrapper = onPress ? TouchableOpacity : View;

  return (
    <CardWrapper
      style={[styles.card, { borderLeftColor: color, borderLeftWidth: 4 }]}
      onPress={onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <View style={styles.content}>
        <View style={[styles.iconContainer, { backgroundColor: color + '20' }]}>
          <Text style={styles.icon}>{icon}</Text>
        </View>

        <View style={styles.info}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.value}>{value}</Text>
          {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
        </View>
      </View>
    </CardWrapper>
  );
};

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#2d2d44',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  icon: {
    fontSize: 28,
  },
  info: {
    flex: 1,
  },
  title: {
    color: '#999',
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  value: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 2,
  },
  subtitle: {
    color: '#7c3aed',
    fontSize: 12,
    fontWeight: '500',
  },
});

export default AdminCard;
