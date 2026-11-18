import AsyncStorage from '@react-native-async-storage/async-storage';

const KEYS = {
  activeGroup: 'ritmo.activeGroupId',
  pendingInvite: 'ritmo.pendingInviteCode',
  lastEmail: 'ritmo.lastEmail',
} as const;

export const localStore = {
  getActiveGroup: () => AsyncStorage.getItem(KEYS.activeGroup),
  setActiveGroup: (id: string | null) =>
    id ? AsyncStorage.setItem(KEYS.activeGroup, id) : AsyncStorage.removeItem(KEYS.activeGroup),
  getPendingInvite: () => AsyncStorage.getItem(KEYS.pendingInvite),
  setPendingInvite: (code: string | null) =>
    code ? AsyncStorage.setItem(KEYS.pendingInvite, code) : AsyncStorage.removeItem(KEYS.pendingInvite),
  getLastEmail: () => AsyncStorage.getItem(KEYS.lastEmail),
  setLastEmail: (email: string) => AsyncStorage.setItem(KEYS.lastEmail, email),
};
