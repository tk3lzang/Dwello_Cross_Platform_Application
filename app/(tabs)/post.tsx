/**
 * Listing Creation & Selection (Post a Listing)
 * Section 5 of Dwello App Manual.
 * Multi-step posting form supporting Full Flats and Shared Rooms with Expo Image Picker and phone validation.
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import MapView, { Marker, MapPressEvent } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { DwelloColors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { useListings } from '@/context/ListingsContext';
import { useDebug } from '@/context/DebugContext';
import { validateBhutanPhone } from '@/utils/validation';
import { ListingCategory, BHKType, MunicipalRegion } from '@/types/listing';
import { getZoneCoordinates } from '@/constants/BhutanData';

const MUNICIPAL_REGIONS: MunicipalRegion[] = ['Thimphu', 'Phuentsholing', 'Paro'];
const BHK_OPTIONS: BHKType[] = ['1BHK', '2BHK', '3BHK'];
const AMENITY_OPTIONS = ['Water Included', 'Parking', 'WiFi', 'Furnished'];

const DEMOGRAPHIC_TAGS = ['Student Friendly', 'Working Professional', 'Female Only', 'Male Only'];
const LIFESTYLE_TAGS_ADAPTIVE = ['Non-Smoker', 'Quiet / Study Environment', 'Early Riser', 'Night Owl'];
const UTILITY_TAGS = ['Furnished', 'WiFi Included', 'Shared Kitchen', 'Separate Meter'];

export default function PostListingScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  const { createListing } = useListings();
  const { showDebugBanner } = useDebug();

  const [category, setCategory] = useState<ListingCategory>('Full Flat');
  const [title, setTitle] = useState('');
  const [region, setRegion] = useState<MunicipalRegion>('Thimphu');
  const [zone, setZone] = useState('');
  const [rent, setRent] = useState('');
  const [bhk, setBhk] = useState<BHKType>('2BHK');
  const [amenities, setAmenities] = useState<string[]>(['Water Included']);
  const [roommatePrefs, setRoommatePrefs] = useState<string[]>(['Student Friendly']);
  const [description, setDescription] = useState('');
  const [contactName, setContactName] = useState(user?.fullName || 'Tandin Kelzang');
  const [phone, setPhone] = useState(user?.phoneNumber || '17777777');
  const [photos, setPhotos] = useState<string[]>([
    'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80',
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedCoords, setSelectedCoords] = useState<{ latitude: number; longitude: number }>({
    latitude: 27.4728,
    longitude: 89.6393,
  });
  const [isManualPin, setIsManualPin] = useState(false);

  useEffect(() => {
    if (!isManualPin) {
      const coords = getZoneCoordinates(zone, region);
      setSelectedCoords(coords);
    }
  }, [zone, region, isManualPin]);

  const toggleAmenity = (item: string) => {
    setAmenities((prev) =>
      prev.includes(item) ? prev.filter((x) => x !== item) : [...prev, item]
    );
  };

  const toggleRoommateTag = (tag: string) => {
    setRoommatePrefs((prev) =>
      prev.includes(tag) ? prev.filter((x) => x !== tag) : [...prev, tag]
    );
  };

  const pickImage = async () => {
    if (photos.length >= 5) {
      Alert.alert('Maximum Photos', 'You can upload up to 5 photos per listing.');
      return;
    }

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newUri = result.assets[0].uri;
        console.log('[Dwello-DB Debug]: Photo picked:', newUri);
        setPhotos((prev) => [...prev, newUri]);
      }
    } catch (err: any) {
      console.error('[Dwello-Error Debug]: Error picking image:', err);
      showDebugBanner('error', 'Image Selection Error', 'Could not open image library.');
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    console.log('[Dwello-DB Debug]: Validating and submitting listing creation...');

    if (!title.trim()) {
      showDebugBanner('error', 'Validation Error', 'Please enter a listing title.');
      return;
    }
    if (!zone.trim()) {
      showDebugBanner('error', 'Validation Error', 'Please enter a zone/area (e.g. Babesa, Rinchending).');
      return;
    }
    const numRent = parseFloat(rent);
    if (isNaN(numRent) || numRent <= 0) {
      showDebugBanner('error', 'Validation Error', 'Please enter a valid monthly rent amount.');
      return;
    }
    if (!validateBhutanPhone(phone)) {
      showDebugBanner(
        'error',
        'Invalid Phone Number',
        'Phone number must be an 8-digit Bhutanese number starting with 17 or 77.'
      );
      return;
    }

    setIsSubmitting(true);

    try {
      const newListing = await createListing({
        title: title.trim(),
        category,
        description: description.trim() || 'No description provided.',
        price: numRent,
        bhkType: bhk,
        municipalRegion: region,
        zoneArea: zone.trim(),
        fullAddress: `${zone.trim()} • Other — ${region}`,
        latitude: selectedCoords.latitude || getZoneCoordinates(zone.trim(), region).latitude,
        longitude: selectedCoords.longitude || getZoneCoordinates(zone.trim(), region).longitude,
        images: photos.length > 0 ? photos : ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=800&q=80'],
        amenities,
        roommatePreferences: category === 'Shared Room' ? roommatePrefs : undefined,
        ownerId: user?.id || 'owner-tandin',
        ownerName: contactName.trim() || 'Dwello User',
        ownerPhone: phone.trim(),
        ownerRole: category === 'Shared Room' ? 'Primary Tenant' : 'Landlord / Host',
      });

      showDebugBanner('success', 'Listing Published', `"${newListing.title}" is now live on Dwello!`);
      // Navigate to Explore
      router.push('/(tabs)');
    } catch (err: any) {
      console.error('[Dwello-Error Debug]: Create listing failure:', err);
      showDebugBanner('error', 'Submission Failed', err.message || 'Unable to publish listing.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.screen, { paddingTop: insets.top }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Post a Listing</Text>
      </View>

      <ScrollView
        style={styles.scrollBody}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled">
        {/* Step 1: Category Selection (Manual Page 9 & 10) */}
        <Text style={styles.stepTitle}>What are you listing?</Text>
        <Text style={styles.stepSubtitle}>
          Choose 'Full Flat' for entire properties or 'Shared Room' if you're looking for a roommate.
        </Text>

        <View style={styles.categoryRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setCategory('Full Flat')}
            style={[
              styles.categoryCard,
              category === 'Full Flat' && styles.activeCategoryCard,
            ]}>
            <Ionicons
              name="business"
              size={28}
              color={category === 'Full Flat' ? DwelloColors.primary : '#9CA3AF'}
            />
            <Text
              style={[
                styles.categoryCardText,
                category === 'Full Flat' && styles.activeCategoryCardText,
              ]}>
              Full Flat
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => setCategory('Shared Room')}
            style={[
              styles.categoryCard,
              category === 'Shared Room' && styles.activeCategoryCard,
            ]}>
            <Ionicons
              name="bed"
              size={28}
              color={category === 'Shared Room' ? DwelloColors.primary : '#9CA3AF'}
            />
            <Text
              style={[
                styles.categoryCardText,
                category === 'Shared Room' && styles.activeCategoryCardText,
              ]}>
              Shared Room
            </Text>
          </TouchableOpacity>
        </View>

        {/* Section Title */}
        <View style={styles.sectionHeaderRow}>
          <Ionicons
            name={category === 'Full Flat' ? 'business' : 'bed'}
            size={18}
            color={DwelloColors.primary}
          />
          <Text style={styles.sectionHeading}>
            {category === 'Full Flat' ? 'Full Flat Details' : 'Shared Room Details'}
          </Text>
        </View>

        {/* Listing Title */}
        <Text style={styles.fieldLabel}>Listing Title</Text>
        <TextInput
          style={styles.textInput}
          placeholder="e.g., Spacious 2BHK with balcony"
          placeholderTextColor="#9CA3AF"
          value={title}
          onChangeText={setTitle}
        />

        {/* Location Municipal Region */}
        <Text style={styles.fieldLabel}>Location</Text>
        <Text style={styles.subFieldLabel}>Municipal Region</Text>
        <View style={styles.regionRow}>
          {MUNICIPAL_REGIONS.map((r) => {
            const active = region === r;
            return (
              <TouchableOpacity
                key={r}
                onPress={() => setRegion(r)}
                style={[styles.regionChip, active && styles.activeRegionChip]}>
                <Text style={[styles.regionChipText, active && styles.activeRegionChipText]}>
                  {r}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Zone / Area */}
        <Text style={styles.subFieldLabel}>Zone / Area</Text>
        <TextInput
          style={styles.textInput}
          placeholder="e.g., Motithang, Babesa, Rinchending"
          placeholderTextColor="#9CA3AF"
          value={zone}
          onChangeText={setZone}
        />

        {/* Pin Exact Location on Micro-Map */}
        <Text style={styles.subFieldLabel}>Pin Exact Location (Drag pin or tap map)</Text>
        <View style={styles.microMapContainer}>
          <MapView
            style={styles.microMap}
            region={{
              latitude: selectedCoords.latitude,
              longitude: selectedCoords.longitude,
              latitudeDelta: 0.02,
              longitudeDelta: 0.02,
            }}
            onPress={(e: MapPressEvent) => {
              const { latitude, longitude } = e.nativeEvent.coordinate;
              setSelectedCoords({ latitude, longitude });
              setIsManualPin(true);
            }}>
            <Marker
              draggable
              coordinate={selectedCoords}
              onDragEnd={(e) => {
                const { latitude, longitude } = e.nativeEvent.coordinate;
                setSelectedCoords({ latitude, longitude });
                setIsManualPin(true);
              }}
              pinColor={DwelloColors.primary}
            />
          </MapView>
          <View style={styles.coordBadge}>
            <Ionicons name="location" size={13} color={DwelloColors.primary} />
            <Text style={styles.coordBadgeText}>
              {selectedCoords.latitude.toFixed(4)}° N, {selectedCoords.longitude.toFixed(4)}° E
            </Text>
          </View>
        </View>

        {/* Rent Amount */}
        <Text style={styles.fieldLabel}>Rent Amount (Nu. per month)</Text>
        <TextInput
          style={styles.textInput}
          placeholder="e.g., 10000"
          placeholderTextColor="#9CA3AF"
          keyboardType="numeric"
          value={rent}
          onChangeText={setRent}
        />

        {/* BHK Type */}
        <Text style={styles.fieldLabel}>BHK Type</Text>
        <View style={styles.bhkRow}>
          {BHK_OPTIONS.map((item) => {
            const active = bhk === item;
            return (
              <TouchableOpacity
                key={item}
                onPress={() => setBhk(item)}
                style={[styles.bhkChip, active && styles.activeBhkChip]}>
                <Text style={[styles.bhkChipText, active && styles.activeBhkChipText]}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Amenities Included */}
        <Text style={styles.fieldLabel}>Amenities Included</Text>
        <View style={styles.chipsContainer}>
          {AMENITY_OPTIONS.map((item) => {
            const active = amenities.includes(item);
            return (
              <TouchableOpacity
                key={item}
                onPress={() => toggleAmenity(item)}
                style={[styles.toggleChip, active && styles.activeToggleChip]}>
                <Text style={[styles.toggleChipText, active && styles.activeToggleChipText]}>
                  {item}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Adaptive Tags if Shared Room is selected (Manual Page 10) */}
        {category === 'Shared Room' && (
          <View style={styles.adaptiveSection}>
            <Text style={styles.fieldLabel}>Roommate & Tenant Preferences</Text>
            <Text style={styles.stepSubtitle}>Select what best describes your ideal roommate or listing.</Text>

            <Text style={styles.tagGroupTitle}>DEMOGRAPHIC</Text>
            <View style={styles.chipsContainer}>
              {DEMOGRAPHIC_TAGS.map((tag) => {
                const active = roommatePrefs.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => toggleRoommateTag(tag)}
                    style={[styles.toggleChip, active && styles.activeToggleChip]}>
                    <Text style={[styles.toggleChipText, active && styles.activeToggleChipText]}>{tag}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.tagGroupTitle}>LIFESTYLE</Text>
            <View style={styles.chipsContainer}>
              {LIFESTYLE_TAGS_ADAPTIVE.map((tag) => {
                const active = roommatePrefs.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => toggleRoommateTag(tag)}
                    style={[styles.toggleChip, active && styles.activeToggleChip]}>
                    <Text style={[styles.toggleChipText, active && styles.activeToggleChipText]}>{tag}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text style={styles.tagGroupTitle}>UTILITY</Text>
            <View style={styles.chipsContainer}>
              {UTILITY_TAGS.map((tag) => {
                const active = roommatePrefs.includes(tag);
                return (
                  <TouchableOpacity
                    key={tag}
                    onPress={() => toggleRoommateTag(tag)}
                    style={[styles.toggleChip, active && styles.activeToggleChip]}>
                    <Text style={[styles.toggleChipText, active && styles.activeToggleChipText]}>{tag}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        )}

        {/* Description */}
        <Text style={styles.fieldLabel}>Description</Text>
        <TextInput
          style={[styles.textInput, styles.textArea]}
          placeholder="Write about security deposit, lease period, preferred tenants..."
          placeholderTextColor="#9CA3AF"
          multiline
          numberOfLines={4}
          value={description}
          onChangeText={setDescription}
        />

        {/* Your Contact Details */}
        <View style={styles.contactSection}>
          <Text style={styles.fieldLabel}>Your Contact Details</Text>
          <Text style={styles.stepSubtitle}>Shown to anyone who wants to reach you about this listing.</Text>

          <Text style={styles.subFieldLabel}>Your Name</Text>
          <TextInput
            style={styles.textInput}
            value={contactName}
            onChangeText={setContactName}
          />

          <Text style={styles.subFieldLabel}>WhatsApp Phone Number</Text>
          <TextInput
            style={styles.textInput}
            value={phone}
            onChangeText={setPhone}
            keyboardType="phone-pad"
            placeholder="17xxxxxx or 77xxxxxx"
          />
        </View>

        {/* Photos (Upload up to 5 with thumbnail previews & remove overlay) */}
        <Text style={styles.fieldLabel}>Photos</Text>
        <View style={styles.photosGrid}>
          {photos.map((uri, index) => (
            <View key={index} style={styles.photoThumbnailWrapper}>
              <Image source={{ uri }} style={styles.photoThumbnail} />
              <TouchableOpacity
                onPress={() => removePhoto(index)}
                style={styles.removePhotoBtn}>
                <Ionicons name="close" size={14} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          ))}

          {photos.length < 5 && (
            <TouchableOpacity onPress={pickImage} style={styles.addPhotoBtn}>
              <Ionicons name="camera-outline" size={26} color={DwelloColors.primary} />
              <Text style={styles.addPhotoText}>Add</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={isSubmitting}
          activeOpacity={0.88}
          style={styles.submitBtn}>
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" size="small" />
          ) : (
            <Text style={styles.submitBtnText}>Publish Listing</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#111827',
  },
  scrollBody: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  stepSubtitle: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 16,
    lineHeight: 18,
  },
  categoryRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  categoryCard: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 14,
    paddingVertical: 20,
    alignItems: 'center',
    backgroundColor: '#FAFAFA',
  },
  activeCategoryCard: {
    borderColor: DwelloColors.primary,
    backgroundColor: DwelloColors.primaryLight,
  },
  categoryCardText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B7280',
    marginTop: 8,
  },
  activeCategoryCardText: {
    color: DwelloColors.primary,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    gap: 6,
  },
  sectionHeading: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 8,
    marginTop: 14,
  },
  subFieldLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#4B5563',
    marginBottom: 6,
    marginTop: 6,
  },
  textInput: {
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    color: '#111827',
  },
  textArea: {
    height: 90,
    textAlignVertical: 'top',
  },
  regionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  regionChip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 18,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  activeRegionChip: {
    backgroundColor: DwelloColors.primary,
    borderColor: DwelloColors.primary,
  },
  regionChipText: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '600',
  },
  activeRegionChipText: {
    color: '#FFFFFF',
  },
  bhkRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  bhkChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  activeBhkChip: {
    backgroundColor: '#111827',
    borderColor: '#111827',
  },
  bhkChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  activeBhkChipText: {
    color: '#FFFFFF',
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  toggleChip: {
    backgroundColor: '#F3F4F6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  activeToggleChip: {
    backgroundColor: DwelloColors.primaryLight,
    borderColor: DwelloColors.primary,
  },
  toggleChipText: {
    fontSize: 12,
    color: '#374151',
    fontWeight: '500',
  },
  activeToggleChipText: {
    color: DwelloColors.primary,
    fontWeight: '700',
  },
  adaptiveSection: {
    backgroundColor: '#F9FAFB',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 14,
  },
  tagGroupTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#6B7280',
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 6,
  },
  contactSection: {
    marginTop: 10,
  },
  photosGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginVertical: 12,
  },
  photoThumbnailWrapper: {
    width: 80,
    height: 80,
    borderRadius: 10,
    overflow: 'hidden',
    position: 'relative',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  photoThumbnail: {
    width: '100%',
    height: '100%',
  },
  removePhotoBtn: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.65)',
    borderRadius: 10,
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addPhotoBtn: {
    width: 80,
    height: 80,
    borderRadius: 10,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: DwelloColors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: DwelloColors.primaryLight,
  },
  addPhotoText: {
    fontSize: 11,
    color: DwelloColors.primary,
    fontWeight: '700',
    marginTop: 2,
  },
  submitBtn: {
    backgroundColor: DwelloColors.primary,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 24,
  },
  submitBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
  },
  microMapContainer: {
    height: 160,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 6,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    position: 'relative',
  },
  microMap: {
    width: '100%',
    height: '100%',
  },
  coordBadge: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.94)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
    elevation: 2,
  },
  coordBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#374151',
  },
});
