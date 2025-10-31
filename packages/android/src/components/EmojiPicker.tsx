/**
 * EmojiPicker Component
 *
 * A simple emoji picker with categories and search functionality.
 * Displays common emojis organized by category with recently used emojis at the top.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  FlatList,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface EmojiPickerProps {
  visible: boolean;
  onEmojiSelect: (emoji: string) => void;
  onClose: () => void;
}

interface EmojiCategory {
  name: string;
  emojis: string[];
}

const EMOJI_CATEGORIES: EmojiCategory[] = [
  {
    name: 'Smileys',
    emojis: [
      '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂',
      '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩',
      '😘', '😗', '😚', '😙', '😋', '😛', '😜', '🤪',
      '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨',
    ],
  },
  {
    name: 'Gestures',
    emojis: [
      '👍', '👎', '👊', '✊', '🤛', '🤜', '🤞', '✌️',
      '🤟', '🤘', '👌', '🤌', '🤏', '👈', '👉', '👆',
      '👇', '☝️', '👋', '🤚', '🖐', '✋', '🖖', '👏',
      '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💪', '🦾',
    ],
  },
  {
    name: 'People',
    emojis: [
      '🧑', '👨', '👩', '🧔', '🧓', '👴', '👵', '👶',
      '👼', '🎅', '🤶', '🧙', '🧚', '🧛', '🧜', '🧝',
      '🧞', '🧟', '💆', '💇', '🚶', '🧍', '🧎', '🧑‍🦯',
      '🧑‍🦼', '🧑‍🦽', '🏃', '💃', '🕺', '🕴', '👯', '🧖',
    ],
  },
  {
    name: 'Nature',
    emojis: [
      '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼',
      '🐨', '🐯', '🦁', '🐮', '🐷', '🐽', '🐸', '🐵',
      '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤',
      '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄',
    ],
  },
  {
    name: 'Food',
    emojis: [
      '🍏', '🍎', '🍐', '🍊', '🍋', '🍌', '🍉', '🍇',
      '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥',
      '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶',
      '🫑', '🌽', '🥕', '🫒', '🧄', '🧅', '🥔', '🍠',
    ],
  },
  {
    name: 'Travel',
    emojis: [
      '🚗', '🚕', '🚙', '🚌', '🚎', '🏎', '🚓', '🚑',
      '🚒', '🚐', '🛻', '🚚', '🚛', '🚜', '🦯', '🦽',
      '🦼', '🛴', '🚲', '🛵', '🏍', '🛺', '🚨', '🚔',
      '🚍', '🚘', '🚖', '🚡', '🚠', '🚟', '🚃', '🚋',
    ],
  },
  {
    name: 'Objects',
    emojis: [
      '⌚', '📱', '📲', '💻', '⌨️', '🖥', '🖨', '🖱',
      '🖲', '🕹', '🗜', '💾', '💿', '📀', '📼', '📷',
      '📸', '📹', '🎥', '📽', '🎞', '📞', '☎️', '📟',
      '📠', '📺', '📻', '🎙', '🎚', '🎛', '🧭', '⏱',
    ],
  },
  {
    name: 'Symbols',
    emojis: [
      '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍',
      '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
      '💘', '💝', '💟', '☮️', '✝️', '☪️', '🕉', '☸️',
      '✡️', '🔯', '🕎', '☯️', '☦️', '🛐', '⛎', '♈',
    ],
  },
];

const RECENT_EMOJIS_KEY = '@TorChat:recentEmojis';
const MAX_RECENT_EMOJIS = 24;

export const EmojiPicker: React.FC<EmojiPickerProps> = ({
  visible,
  onEmojiSelect,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(0);
  const [recentEmojis, setRecentEmojis] = useState<string[]>([]);

  useEffect(() => {
    loadRecentEmojis();
  }, []);

  const loadRecentEmojis = async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_EMOJIS_KEY);
      if (stored) {
        setRecentEmojis(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Failed to load recent emojis:', error);
    }
  };

  const saveRecentEmoji = async (emoji: string) => {
    try {
      const updated = [emoji, ...recentEmojis.filter(e => e !== emoji)].slice(
        0,
        MAX_RECENT_EMOJIS
      );
      setRecentEmojis(updated);
      await AsyncStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(updated));
    } catch (error) {
      console.error('Failed to save recent emoji:', error);
    }
  };

  const handleEmojiSelect = (emoji: string) => {
    saveRecentEmoji(emoji);
    onEmojiSelect(emoji);
  };

  const filterEmojis = (emojis: string[]) => {
    if (!searchQuery) return emojis;
    // Simple filter - in production you might want to add emoji names/keywords
    return emojis.filter(emoji => emoji.includes(searchQuery));
  };

  const getAllFilteredEmojis = () => {
    if (!searchQuery) return [];
    return EMOJI_CATEGORIES.flatMap(category => filterEmojis(category.emojis));
  };

  const renderEmojiButton = (emoji: string) => (
    <TouchableOpacity
      key={emoji}
      style={styles.emojiButton}
      onPress={() => handleEmojiSelect(emoji)}
      activeOpacity={0.7}
    >
      <Text style={styles.emoji}>{emoji}</Text>
    </TouchableOpacity>
  );

  const renderCategory = (category: EmojiCategory) => {
    const emojis = filterEmojis(category.emojis);
    if (emojis.length === 0) return null;

    return (
      <View key={category.name} style={styles.categorySection}>
        <Text style={styles.categoryTitle}>{category.name}</Text>
        <View style={styles.emojiGrid}>
          {emojis.map(emoji => renderEmojiButton(emoji))}
        </View>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.container} onPress={e => e.stopPropagation()}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Choose Emoji</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search emoji..."
              placeholderTextColor="#666"
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
          </View>

          {/* Category Tabs */}
          {!searchQuery && (
            <ScrollView
              horizontal
              style={styles.categoryTabs}
              showsHorizontalScrollIndicator={false}
            >
              {recentEmojis.length > 0 && (
                <TouchableOpacity
                  style={[
                    styles.categoryTab,
                    selectedCategory === -1 && styles.categoryTabActive,
                  ]}
                  onPress={() => setSelectedCategory(-1)}
                >
                  <Text style={styles.categoryTabText}>🕐</Text>
                </TouchableOpacity>
              )}
              {EMOJI_CATEGORIES.map((category, index) => (
                <TouchableOpacity
                  key={category.name}
                  style={[
                    styles.categoryTab,
                    selectedCategory === index && styles.categoryTabActive,
                  ]}
                  onPress={() => setSelectedCategory(index)}
                >
                  <Text style={styles.categoryTabText}>
                    {category.emojis[0]}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Emoji Grid */}
          <ScrollView style={styles.emojiScrollView}>
            {searchQuery ? (
              <View style={styles.emojiGrid}>
                {getAllFilteredEmojis().map(emoji => renderEmojiButton(emoji))}
              </View>
            ) : (
              <>
                {/* Recent Emojis */}
                {selectedCategory === -1 && recentEmojis.length > 0 && (
                  <View style={styles.categorySection}>
                    <Text style={styles.categoryTitle}>Recently Used</Text>
                    <View style={styles.emojiGrid}>
                      {recentEmojis.map(emoji => renderEmojiButton(emoji))}
                    </View>
                  </View>
                )}

                {/* Selected Category */}
                {selectedCategory >= 0 &&
                  renderCategory(EMOJI_CATEGORIES[selectedCategory])}
              </>
            )}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: '#1a1a2e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    paddingBottom: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    color: '#999',
    fontSize: 24,
    fontWeight: '300',
  },
  searchContainer: {
    padding: 16,
    paddingBottom: 8,
  },
  searchInput: {
    backgroundColor: '#2d2d44',
    color: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    fontSize: 15,
  },
  categoryTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
  },
  categoryTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  categoryTabActive: {
    backgroundColor: '#7c3aed',
  },
  categoryTabText: {
    fontSize: 24,
  },
  emojiScrollView: {
    flex: 1,
    paddingHorizontal: 16,
  },
  categorySection: {
    marginTop: 16,
  },
  categoryTitle: {
    color: '#999',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  emojiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-start',
  },
  emojiButton: {
    width: '12.5%', // 8 emojis per row
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 8,
  },
  emoji: {
    fontSize: 28,
  },
});

export default EmojiPicker;
