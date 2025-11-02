import React from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import FastImage from 'react-native-fast-image';
import Icon from 'react-native-vector-icons/MaterialIcons';

export interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
  siteName?: string;
  videoId?: string; // For YouTube
}

interface LinkPreviewProps {
  preview: LinkPreviewData;
  onPress?: () => void;
}

export const LinkPreview: React.FC<LinkPreviewProps> = ({ preview, onPress }) => {
  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      Linking.openURL(preview.url);
    }
  };

  // Security: Properly validate YouTube URLs by checking hostname
  // This prevents URL spoofing attacks (e.g., evil.com?q=youtube.com)
  const isYouTube = (() => {
    try {
      const url = new URL(preview.url);
      const hostname = url.hostname.toLowerCase();

      // Only accept legitimate YouTube hostnames
      const validYouTubeHosts = [
        'youtube.com',
        'www.youtube.com',
        'm.youtube.com',
        'youtu.be'
      ];

      return validYouTubeHosts.includes(hostname);
    } catch (error) {
      return false;
    }
  })();

  // Extract hostname from URL
  let hostname = '';
  try {
    hostname = new URL(preview.url).hostname;
  } catch (error) {
    console.error('Invalid URL:', preview.url);
    hostname = preview.url;
  }

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.7}>
      {preview.image && (
        <View style={styles.imageContainer}>
          <FastImage
            source={{ uri: preview.image }}
            style={styles.image}
            resizeMode="cover"
          />
          {isYouTube && (
            <View style={styles.playButton}>
              <Icon name="play-arrow" size={48} color="#fff" />
            </View>
          )}
        </View>
      )}

      <View style={styles.content}>
        {preview.siteName && (
          <Text style={styles.siteName}>{preview.siteName}</Text>
        )}
        {preview.title && (
          <Text style={styles.title} numberOfLines={2}>{preview.title}</Text>
        )}
        {preview.description && (
          <Text style={styles.description} numberOfLines={2}>{preview.description}</Text>
        )}
        <View style={styles.urlContainer}>
          <Icon name="link" size={14} color="#888" />
          <Text style={styles.url} numberOfLines={1}>
            {hostname}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1e1e1e',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
    marginTop: 8,
    overflow: 'hidden',
  },
  imageContainer: {
    width: '100%',
    height: 180,
    backgroundColor: '#2a2a2a',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  playButton: {
    position: 'absolute',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    borderRadius: 50,
    padding: 8,
  },
  content: {
    padding: 12,
  },
  siteName: {
    fontSize: 12,
    color: '#888',
    marginBottom: 4,
    textTransform: 'uppercase',
  },
  title: {
    fontSize: 16,
    color: '#fff',
    fontWeight: '600',
    marginBottom: 4,
  },
  description: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 8,
  },
  urlContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  url: {
    fontSize: 12,
    color: '#888',
    flex: 1,
  },
});
