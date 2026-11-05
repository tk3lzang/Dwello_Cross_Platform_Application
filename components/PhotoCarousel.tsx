/**
 * PhotoCarousel Component
 * Swipeable property photo gallery with index pagination indicator (e.g., 1/4)
 * Matching section 4.1 of the Dwello App Manual.
 */

import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Image,
  Dimensions,
  FlatList,
  NativeSyntheticEvent,
  NativeScrollEvent,
  Text,
} from 'react-native';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface PhotoCarouselProps {
  images: string[];
  height?: number;
}

export function PhotoCarousel({ images, height = 280 }: PhotoCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  const displayImages =
    images && images.length > 0
      ? images
      : ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80'];

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const slide = Math.round(event.nativeEvent.contentOffset.x / SCREEN_WIDTH);
    if (slide !== currentIndex) {
      setCurrentIndex(slide);
    }
  };

  return (
    <View style={[styles.container, { height }]}>
      <FlatList
        data={displayImages}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item }) => (
          <Image
            source={{ uri: item }}
            style={[styles.carouselImage, { width: SCREEN_WIDTH, height }]}
            resizeMode="cover"
          />
        )}
      />

      {/* Pagination pill matching manual (e.g. 1/4) */}
      <View style={styles.paginationBadge}>
        <Text style={styles.paginationText}>
          {currentIndex + 1}/{displayImages.length}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    position: 'relative',
    backgroundColor: '#000000',
  },
  carouselImage: {
    backgroundColor: '#374151',
  },
  paginationBadge: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  paginationText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
  },
});

