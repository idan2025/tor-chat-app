import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useServerStore } from '../store/serverStore';
import { validateOnionAddress, ConnectionStatus } from '../types/Server';

export default function AddServerScreen({ navigation }: any) {
  const [name, setName] = useState('');
  const [onionAddress, setOnionAddress] = useState('');
  const [isValidating, setIsValidating] = useState(false);
  const [validationProgress, setValidationProgress] = useState('');

  const { addServer, updateServerStatus } = useServerStore();

  const handleAddServer = async () => {
    // Trim inputs
    const trimmedAddress = onionAddress.trim().toLowerCase();
    const trimmedName = name.trim();

    // Validate address
    if (!trimmedAddress) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Input',
        text2: 'Please enter a .onion address',
      });
      return;
    }

    if (!validateOnionAddress(trimmedAddress)) {
      Toast.show({
        type: 'error',
        text1: 'Invalid Address',
        text2: 'Must be a valid .onion address (16 or 56 characters)',
      });
      return;
    }

    setIsValidating(true);
    setValidationProgress('Creating server...');

    try {
      // Add server to storage
      const newServer = await addServer(trimmedName, trimmedAddress);

      setValidationProgress('Server added successfully');

      Toast.show({
        type: 'success',
        text1: 'Server Added',
        text2: `${newServer.name} has been added to your servers`,
      });

      // Navigate back to server list
      navigation.goBack();
    } catch (error: any) {
      Toast.show({
        type: 'error',
        text1: 'Failed to Add Server',
        text2: error.message || 'An error occurred',
      });
    } finally {
      setIsValidating(false);
      setValidationProgress('');
    }
  };

  const handleTestConnection = () => {
    Alert.alert(
      'Test Connection',
      'Connection testing will be available once TOR integration is complete. For now, you can add the server and test it during login.',
      [{ text: 'OK' }]
    );
  };

  const isFormValid = onionAddress.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          <Text style={styles.title}>Add Server</Text>
          <Text style={styles.description}>
            Add a TOR hidden service (.onion) to connect to
          </Text>

          {/* Server Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Server Name (Optional)</Text>
            <TextInput
              style={styles.input}
              placeholder="My TOR Server"
              placeholderTextColor="#666"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              autoCorrect={false}
              editable={!isValidating}
            />
            <Text style={styles.hint}>
              A friendly name to identify this server
            </Text>
          </View>

          {/* Onion Address */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>
              .onion Address <Text style={styles.required}>*</Text>
            </Text>
            <TextInput
              style={styles.input}
              placeholder="example.onion"
              placeholderTextColor="#666"
              value={onionAddress}
              onChangeText={setOnionAddress}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              keyboardType="url"
              editable={!isValidating}
            />
            <Text style={styles.hint}>
              The .onion address of the hidden service
            </Text>
          </View>

          {/* Validation Progress */}
          {isValidating && (
            <View style={styles.progressContainer}>
              <ActivityIndicator size="small" color="#7c3aed" />
              <Text style={styles.progressText}>{validationProgress}</Text>
            </View>
          )}

          {/* Info Box */}
          <View style={styles.infoBox}>
            <Text style={styles.infoIcon}>ℹ️</Text>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>About .onion Addresses</Text>
              <Text style={styles.infoText}>
                TOR hidden service addresses are 16 characters (v2) or 56
                characters (v3) followed by .onion
              </Text>
            </View>
          </View>

          {/* Buttons */}
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[
                styles.button,
                styles.secondaryButton,
                isValidating && styles.buttonDisabled,
              ]}
              onPress={handleTestConnection}
              disabled={isValidating || !isFormValid}
            >
              <Text style={styles.secondaryButtonText}>Test Connection</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.primaryButton,
                (!isFormValid || isValidating) && styles.buttonDisabled,
              ]}
              onPress={handleAddServer}
              disabled={!isFormValid || isValidating}
            >
              {isValidating ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>Add Server</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Cancel Button */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
            disabled={isValidating}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  description: {
    fontSize: 16,
    color: '#999',
    marginBottom: 30,
  },
  inputGroup: {
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 8,
  },
  required: {
    color: '#ef4444',
  },
  input: {
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    padding: 15,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#3d3d54',
  },
  hint: {
    fontSize: 12,
    color: '#666',
    marginTop: 6,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    padding: 12,
    marginBottom: 20,
  },
  progressText: {
    color: '#7c3aed',
    fontSize: 14,
    marginLeft: 10,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#2d2d44',
    borderRadius: 8,
    padding: 15,
    marginBottom: 30,
    borderLeftWidth: 4,
    borderLeftColor: '#7c3aed',
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: '#999',
    lineHeight: 18,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 15,
  },
  button: {
    flex: 1,
    borderRadius: 8,
    padding: 15,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  primaryButton: {
    backgroundColor: '#7c3aed',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#7c3aed',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  secondaryButtonText: {
    color: '#7c3aed',
    fontSize: 16,
    fontWeight: 'bold',
  },
  cancelButton: {
    padding: 15,
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#999',
    fontSize: 16,
  },
});
