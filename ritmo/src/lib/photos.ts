/**
 * Fotos privadas: upload em <group>/<user>/<clientId>.jpg no bucket workout-photos
 * e leitura via URL assinada (só quem passa na política de SELECT consegue gerar).
 */
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { supabase } from '@/lib/supabase';
import { toApiError } from '@/lib/api';

export const PHOTO_BUCKET = 'workout-photos';

export type PickedPhoto = { uri: string; width: number; height: number; mimeType: string };

async function pick(source: 'camera' | 'library'): Promise<PickedPhoto | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) return null;
  } else {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return null;
  }
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, allowsEditing: false, exif: false };
  const result = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (result.canceled || !result.assets?.length) return null;
  const a = result.assets[0];
  return { uri: a.uri, width: a.width, height: a.height, mimeType: a.mimeType ?? 'image/jpeg' };
}

export const photos = {
  pickFromCamera: () => pick('camera'),
  pickFromLibrary: () => pick('library'),

  photoPath: (groupId: string, userId: string, clientId: string) => `${groupId}/${userId}/${clientId}.jpg`,

  /** Idempotente: o mesmo caminho é sobrescrito em reenvios (upsert). */
  upload: async (path: string, photo: PickedPhoto): Promise<string> => {
    try {
      const bytes = await new File(photo.uri).arrayBuffer();
      const { error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, bytes, { contentType: photo.mimeType || 'image/jpeg', upsert: true });
      if (error) throw error;
      return path;
    } catch (err) {
      throw toApiError(err);
    }
  },

  signedUrl: async (path: string, expiresInSec = 60 * 60): Promise<string | null> => {
    const { data, error } = await supabase.storage.from(PHOTO_BUCKET).createSignedUrl(path, expiresInSec);
    if (error) return null;
    return data.signedUrl;
  },
};
