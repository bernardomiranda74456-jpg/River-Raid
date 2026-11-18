import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps, PropsWithChildren, ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type PressableProps,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Screen({
  children,
  scroll = true,
  padded = true,
  style,
  contentStyle,
  keyboard,
  onRefresh,
  refreshing = false,
}: PropsWithChildren<{
  scroll?: boolean;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  keyboard?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}>) {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const inner = [
    { maxWidth: MaxContentWidth, width: '100%' as const, alignSelf: 'center' as const },
    padded && { padding: Spacing.three, paddingBottom: Spacing.five + insets.bottom },
    contentStyle,
  ];
  if (!scroll) {
    return <View style={[{ flex: 1, backgroundColor: theme.background }, style]}>{padded ? <View style={[{ flex: 1 }, inner]}>{children}</View> : children}</View>;
  }
  return (
    <ScrollView
      style={[{ flex: 1, backgroundColor: theme.background }, style]}
      contentContainerStyle={inner}
      keyboardShouldPersistTaps={keyboard ? 'handled' : 'never'}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} /> : undefined}
      contentInsetAdjustmentBehavior="automatic">
      {children}
    </ScrollView>
  );
}

export function Txt({
  children,
  variant = 'body',
  color,
  style,
  ...rest
}: PropsWithChildren<{ variant?: keyof typeof text; color?: string; style?: StyleProp<TextStyle> } & ComponentProps<typeof Text>>) {
  const theme = useTheme();
  const secondary = variant === 'caption' || variant === 'label';
  return (
    <Text style={[{ color: color ?? (secondary ? theme.textSecondary : theme.text) }, text[variant], style]} {...rest}>
      {children}
    </Text>
  );
}

const text = StyleSheet.create({
  display: { fontSize: 34, lineHeight: 40, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  heading: { fontSize: 18, lineHeight: 24, fontWeight: '700' },
  body: { fontSize: 16, lineHeight: 22, fontWeight: '400' },
  bodyBold: { fontSize: 16, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  label: { fontSize: 12, lineHeight: 16, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  mono: { fontSize: 22, lineHeight: 28, fontWeight: '800', letterSpacing: 4 },
});

export function Card({ children, style, onPress }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; onPress?: () => void }>) {
  const theme = useTheme();
  const base: ViewStyle = {
    backgroundColor: theme.card,
    borderRadius: Radius.lg,
    padding: Spacing.three,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border,
  };
  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [base, pressed && { opacity: 0.85 }, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[base, style]}>{children}</View>;
}

export function Button({
  title,
  variant = 'primary',
  icon,
  loading,
  disabled,
  style,
  right,
  ...rest
}: PressableProps & { title: string; variant?: 'primary' | 'accent' | 'ghost' | 'danger' | 'outline'; icon?: IconName; loading?: boolean; right?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const theme = useTheme();
  const palette = {
    primary: { bg: theme.primary, fg: theme.onPrimary, border: theme.primary },
    accent: { bg: theme.accent, fg: theme.onAccent, border: theme.accent },
    ghost: { bg: 'transparent', fg: theme.primary, border: 'transparent' },
    outline: { bg: 'transparent', fg: theme.text, border: theme.border },
    danger: { bg: theme.danger, fg: '#fff', border: theme.danger },
  }[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: isDisabled ? 0.55 : pressed ? 0.85 : 1 },
        style,
      ]}
      {...rest}>
      {loading ? <ActivityIndicator color={palette.fg} /> : icon ? <Ionicons name={icon} size={18} color={palette.fg} /> : null}
      <Text style={[styles.buttonText, { color: palette.fg }]}>{title}</Text>
      {right}
    </Pressable>
  );
}

export function Input({ label, hint, error, style, ...rest }: TextInputProps & { label?: string; hint?: string; error?: string | null }) {
  const theme = useTheme();
  return (
    <View style={{ gap: Spacing.one }}>
      {label ? <Txt variant="label">{label}</Txt> : null}
      <TextInput
        placeholderTextColor={theme.textMuted}
        style={[
          styles.input,
          { backgroundColor: theme.card, color: theme.text, borderColor: error ? theme.danger : theme.border },
          style,
        ]}
        {...rest}
      />
      {error ? <Txt variant="caption" color={theme.danger}>{error}</Txt> : hint ? <Txt variant="caption">{hint}</Txt> : null}
    </View>
  );
}

export function Chip({ label, selected, onPress, icon, small }: { label: string; selected?: boolean; onPress?: () => void; icon?: IconName; small?: boolean }) {
  const theme = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: Boolean(selected) }}
      style={({ pressed }) => [
        styles.chip,
        small && { paddingVertical: 6, paddingHorizontal: 12 },
        { backgroundColor: selected ? theme.primary : theme.backgroundElement, opacity: pressed ? 0.8 : 1 },
      ]}>
      {icon ? <Ionicons name={icon} size={16} color={selected ? theme.onPrimary : theme.text} /> : null}
      <Text style={[styles.chipText, { color: selected ? theme.onPrimary : theme.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Avatar({ name, size = 40, highlight }: { name: string; size?: number; highlight?: boolean }) {
  const theme = useTheme();
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: highlight ? theme.accent : theme.primary,
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ color: highlight ? theme.onAccent : theme.onPrimary, fontWeight: '700', fontSize: size * 0.4 }}>{initials || '?'}</Text>
    </View>
  );
}

export function PointsBadge({ points, size = 'md' }: { points: number; size?: 'sm' | 'md' | 'lg' }) {
  const theme = useTheme();
  const font = { sm: 13, md: 15, lg: 22 }[size];
  return (
    <View style={[styles.points, { backgroundColor: theme.accent, paddingHorizontal: size === 'lg' ? 14 : 10, paddingVertical: size === 'lg' ? 6 : 3 }]}>
      <Text style={{ color: theme.onAccent, fontWeight: '800', fontSize: font }}>{points}</Text>
      <Text style={{ color: theme.onAccent, fontWeight: '600', fontSize: font * 0.75 }}> pts</Text>
    </View>
  );
}

export function Banner({ kind = 'error', message, onRetry, retryLabel = 'Tentar de novo' }: { kind?: 'error' | 'success' | 'info'; message: string; onRetry?: () => void; retryLabel?: string }) {
  const theme = useTheme();
  const color = kind === 'error' ? theme.danger : kind === 'success' ? theme.success : theme.primary;
  const icon: IconName = kind === 'error' ? 'alert-circle' : kind === 'success' ? 'checkmark-circle' : 'information-circle';
  return (
    <View style={[styles.banner, { borderColor: color, backgroundColor: theme.card }]}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={{ color: theme.text, flex: 1 }}>{message}</Text>
      {onRetry ? (
        <Pressable onPress={onRetry} accessibilityRole="button">
          <Text style={{ color, fontWeight: '700' }}>{retryLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Empty({ icon = 'leaf', title, text }: { icon?: IconName; title: string; text?: string }) {
  const theme = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: Spacing.five, gap: Spacing.two }}>
      <Ionicons name={icon} size={36} color={theme.textMuted} />
      <Txt variant="heading" style={{ textAlign: 'center' }}>{title}</Txt>
      {text ? <Txt variant="caption" style={{ textAlign: 'center' }}>{text}</Txt> : null}
    </View>
  );
}

export function Loading({ text }: { text?: string }) {
  const theme = useTheme();
  return (
    <View style={{ padding: Spacing.five, alignItems: 'center', gap: Spacing.two }}>
      <ActivityIndicator color={theme.primary} />
      {text ? <Txt variant="caption">{text}</Txt> : null}
    </View>
  );
}

export function Row({ children, style, gap = Spacing.two }: PropsWithChildren<{ style?: StyleProp<ViewStyle>; gap?: number }>) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap }, style]}>{children}</View>;
}

export function Divider() {
  const theme = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: theme.border, marginVertical: Spacing.two }} />;
}

export function SegmentedControl<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  const theme = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: theme.backgroundElement }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={[styles.segmentItem, active && { backgroundColor: theme.card }]}>
            <Text style={{ color: active ? theme.text : theme.textSecondary, fontWeight: active ? '700' : '500' }}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    paddingVertical: 14,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.md,
    borderWidth: 1,
  },
  buttonText: { fontSize: 16, fontWeight: '700' },
  input: { borderWidth: 1, borderRadius: Radius.md, paddingHorizontal: 14, paddingVertical: 12, fontSize: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 10, paddingHorizontal: 14, borderRadius: Radius.pill },
  chipText: { fontWeight: '600', fontSize: 14 },
  points: { flexDirection: 'row', alignItems: 'baseline', borderRadius: Radius.pill },
  banner: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, padding: Spacing.three, borderRadius: Radius.md, borderWidth: 1 },
  segment: { flexDirection: 'row', padding: 3, borderRadius: Radius.md },
  segmentItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: Radius.md - 3 },
});
