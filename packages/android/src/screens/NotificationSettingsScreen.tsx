/**
 * NotificationSettingsScreen
 *
 * Allows users to configure notification preferences:
 * - Enable/disable notifications
 * - Sound control
 * - Vibration control
 * - Mentions only mode
 * - Do Not Disturb mode
 * - Mute specific rooms
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  NotificationSettings,
  DEFAULT_NOTIFICATION_SETTINGS,
} from '../types/Notification';
import NotificationService from '../services/NotificationService';

const SETTINGS_KEY = '@notification_settings';

interface NotificationSettingsScreenProps {
  navigation: any;
}

export const NotificationSettingsScreen: React.FC<NotificationSettingsScreenProps> = ({
  navigation,
}) => {
  const [settings, setSettings] = useState<NotificationSettings>(DEFAULT_NOTIFICATION_SETTINGS);
  const [isLoading, setIsLoading] = useState(true);
  const [hasPermissions, setHasPermissions] = useState(false);

  useEffect(() => {
    loadSettings();
    checkPermissions();
  }, []);

  /**
   * Load settings from AsyncStorage
   */
  const loadSettings = async () => {
    try {
      const stored = await AsyncStorage.getItem(SETTINGS_KEY);
      if (stored) {
        const parsedSettings = JSON.parse(stored);
        setSettings(parsedSettings);
      }
    } catch (error) {
      console.error('[NotificationSettingsScreen] Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Save settings to AsyncStorage
   */
  const saveSettings = async (newSettings: NotificationSettings) => {
    try {
      await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(newSettings));
      setSettings(newSettings);
      console.log('[NotificationSettingsScreen] Settings saved:', newSettings);
    } catch (error) {
      console.error('[NotificationSettingsScreen] Failed to save settings:', error);
      Alert.alert('Error', 'Failed to save notification settings');
    }
  };

  /**
   * Check notification permissions
   */
  const checkPermissions = async () => {
    try {
      const permissions = await NotificationService.checkPermissions();
      setHasPermissions(permissions.alert && permissions.badge && permissions.sound);
    } catch (error) {
      console.error('[NotificationSettingsScreen] Failed to check permissions:', error);
    }
  };

  /**
   * Request notification permissions
   */
  const requestPermissions = async () => {
    try {
      const granted = await NotificationService.requestPermissions();
      setHasPermissions(granted);

      if (granted) {
        Alert.alert('Success', 'Notification permissions granted');
      } else {
        Alert.alert('Error', 'Notification permissions denied');
      }
    } catch (error) {
      console.error('[NotificationSettingsScreen] Failed to request permissions:', error);
      Alert.alert('Error', 'Failed to request notification permissions');
    }
  };

  /**
   * Toggle a setting
   */
  const toggleSetting = (key: keyof NotificationSettings) => {
    const newSettings = { ...settings, [key]: !settings[key] };
    saveSettings(newSettings);
  };

  /**
   * Clear all notifications
   */
  const clearAllNotifications = () => {
    Alert.alert(
      'Clear Notifications',
      'Are you sure you want to clear all notifications?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: () => {
            NotificationService.cancelAllNotifications();
            NotificationService.clearBadge();
            Alert.alert('Success', 'All notifications cleared');
          },
        },
      ]
    );
  };

  /**
   * Reset settings to default
   */
  const resetToDefault = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all notification settings to default?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            saveSettings(DEFAULT_NOTIFICATION_SETTINGS);
            Alert.alert('Success', 'Settings reset to default');
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      {/* Permissions Section */}
      {!hasPermissions && (
        <View style={styles.permissionBanner}>
          <Text style={styles.permissionText}>
            Notifications are disabled. Tap to enable.
          </Text>
          <TouchableOpacity
            style={styles.permissionButton}
            onPress={requestPermissions}
          >
            <Text style={styles.permissionButtonText}>Enable</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* General Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>General</Text>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Enable Notifications</Text>
          <Switch
            value={settings.enabled}
            onValueChange={() => toggleSetting('enabled')}
            trackColor={{ false: '#333', true: '#7c3aed' }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Sound</Text>
          <Switch
            value={settings.sound}
            onValueChange={() => toggleSetting('sound')}
            disabled={!settings.enabled}
            trackColor={{ false: '#333', true: '#7c3aed' }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Vibration</Text>
          <Switch
            value={settings.vibration}
            onValueChange={() => toggleSetting('vibration')}
            disabled={!settings.enabled}
            trackColor={{ false: '#333', true: '#7c3aed' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Advanced Settings */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Advanced</Text>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Mentions Only</Text>
            <Text style={styles.settingDescription}>
              Only notify when you're mentioned
            </Text>
          </View>
          <Switch
            value={settings.mentionsOnly}
            onValueChange={() => toggleSetting('mentionsOnly')}
            disabled={!settings.enabled}
            trackColor={{ false: '#333', true: '#7c3aed' }}
            thumbColor="#fff"
          />
        </View>

        <View style={styles.settingRow}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingLabel}>Do Not Disturb</Text>
            <Text style={styles.settingDescription}>
              Disable all notifications temporarily
            </Text>
          </View>
          <Switch
            value={settings.doNotDisturb}
            onValueChange={() => toggleSetting('doNotDisturb')}
            disabled={!settings.enabled}
            trackColor={{ false: '#333', true: '#7c3aed' }}
            thumbColor="#fff"
          />
        </View>
      </View>

      {/* Muted Rooms */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Muted Rooms</Text>
        <Text style={styles.description}>
          {settings.mutedRooms.length > 0
            ? `${settings.mutedRooms.length} room(s) muted`
            : 'No muted rooms'}
        </Text>
        <Text style={styles.description}>
          Manage room-specific notification settings from each room's settings.
        </Text>
      </View>

      {/* Actions */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Actions</Text>

        <TouchableOpacity
          style={styles.actionButton}
          onPress={clearAllNotifications}
        >
          <Text style={styles.actionButtonText}>Clear All Notifications</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionButton, styles.actionButtonDanger]}
          onPress={resetToDefault}
        >
          <Text style={styles.actionButtonText}>Reset to Default</Text>
        </TouchableOpacity>
      </View>

      {/* Info */}
      <View style={styles.section}>
        <Text style={styles.infoText}>
          Notifications are local only and do not use remote push notification
          services. Your privacy is protected.
        </Text>
      </View>

      {/* Spacer for bottom padding */}
      <View style={styles.bottomSpacer} />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  loadingText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
    marginTop: 50,
  },
  permissionBanner: {
    backgroundColor: '#7c3aed',
    padding: 16,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  permissionText: {
    color: '#fff',
    fontSize: 14,
    flex: 1,
  },
  permissionButton: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 20,
  },
  permissionButtonText: {
    color: '#7c3aed',
    fontWeight: '600',
    fontSize: 14,
  },
  section: {
    marginVertical: 16,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 16,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '500',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingDescription: {
    fontSize: 14,
    color: '#888',
    marginTop: 4,
  },
  description: {
    fontSize: 14,
    color: '#888',
    lineHeight: 20,
    marginBottom: 8,
  },
  actionButton: {
    backgroundColor: '#7c3aed',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    alignItems: 'center',
  },
  actionButtonDanger: {
    backgroundColor: '#ef4444',
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoText: {
    fontSize: 13,
    color: '#666',
    lineHeight: 18,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  bottomSpacer: {
    height: 40,
  },
});

export default NotificationSettingsScreen;
