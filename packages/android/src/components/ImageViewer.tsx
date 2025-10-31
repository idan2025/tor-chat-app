import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform, PermissionsAndroid } from 'react-native';
import ImageView from 'react-native-image-viewing';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import Toast from 'react-native-toast-message';

export interface ImageSource {
  uri: string;
  width?: number;
  height?: number;
}

interface ImageViewerProps {
  visible: boolean;
  images: ImageSource[];
  initialIndex?: number;
  onClose: () => void;
  onDownload?: (image: ImageSource) => void;
}

export const ImageViewer: React.FC<ImageViewerProps> = ({
  visible,
  images,
  initialIndex = 0,
  onClose,
  onDownload,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  React.useEffect(() => {
    if (visible) {
      setCurrentIndex(initialIndex);
    }
  }, [visible, initialIndex]);

  const requestStoragePermission = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') {
      return true;
    }

    try {
      if (Platform.Version >= 33) {
        // Android 13+ doesn't need permission for CameraRoll.save
        return true;
      }

      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
        {
          title: 'Storage Permission',
          message: 'This app needs access to your storage to save images',
          buttonNeutral: 'Ask Me Later',
          buttonNegative: 'Cancel',
          buttonPositive: 'OK',
        }
      );

      return granted === PermissionsAndroid.RESULTS.GRANTED;
    } catch (error) {
      console.error('Permission error:', error);
      return false;
    }
  };

  const handleDownload = async () => {
    try {
      const hasPermission = await requestStoragePermission();

      if (!hasPermission) {
        Toast.show({
          type: 'error',
          text1: 'Permission denied',
          text2: 'Storage permission is required to save images',
        });
        return;
      }

      const image = images[currentIndex];

      if (onDownload) {
        onDownload(image);
      } else {
        await CameraRoll.save(image.uri, { type: 'photo' });
        Toast.show({
          type: 'success',
          text1: 'Image saved to gallery',
        });
      }
    } catch (error) {
      console.error('Download error:', error);
      Toast.show({
        type: 'error',
        text1: 'Failed to save image',
        text2: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  };

  const HeaderComponent = () => (
    <View style={styles.header}>
      <TouchableOpacity onPress={onClose} style={styles.closeButton}>
        <Icon name="close" size={28} color="#fff" />
      </TouchableOpacity>
      <View style={styles.headerRight}>
        <TouchableOpacity onPress={handleDownload} style={styles.iconButton}>
          <Icon name="download" size={24} color="#fff" />
        </TouchableOpacity>
        {images.length > 1 && (
          <Text style={styles.counter}>
            {currentIndex + 1} / {images.length}
          </Text>
        )}
      </View>
    </View>
  );

  const FooterComponent = () => {
    const image = images[currentIndex];
    if (!image) return null;

    return (
      <View style={styles.footer}>
        <Text style={styles.footerText} numberOfLines={1}>
          {image.uri.split('/').pop() || 'Image'}
        </Text>
      </View>
    );
  };

  return (
    <ImageView
      images={images}
      imageIndex={currentIndex}
      visible={visible}
      onRequestClose={onClose}
      onImageIndexChange={setCurrentIndex}
      HeaderComponent={HeaderComponent}
      FooterComponent={FooterComponent}
      backgroundColor="#000"
      presentationStyle="overFullScreen"
      animationType="fade"
      swipeToCloseEnabled={true}
      doubleTapToZoomEnabled={true}
    />
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 48 : 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  closeButton: {
    padding: 8,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  iconButton: {
    padding: 8,
  },
  counter: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    paddingBottom: Platform.OS === 'ios' ? 32 : 16,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  footerText: {
    color: '#fff',
    fontSize: 14,
    textAlign: 'center',
  },
});
