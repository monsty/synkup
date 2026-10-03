import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StyleSheet, useColorScheme, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Palette } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/providers/auth-provider';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const colorScheme = useColorScheme();
  return (
    <GestureHandlerRootView style={styles.root}>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <AuthProvider>
          <AnimatedSplashOverlay />
          <RootNavigator />
        </AuthProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}

/**
 * Routes protégées : tant que la session est en cours de restauration, on n'affiche rien
 * (le splash couvre). Ensuite, soit la connexion, soit l'app, jamais les deux.
 */
function RootNavigator() {
  const { status } = useAuth();
  if (status === 'loading') return <View style={styles.blank} />;

  const signedIn = status === 'signed-in';
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" options={{ animation: 'fade' }} />
      </Stack.Protected>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="index" options={{ animation: 'fade' }} />
        <Stack.Screen name="album/new" />
        <Stack.Screen name="album/manage" />
        <Stack.Screen name="album/members" />
        <Stack.Screen name="album/[id]" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="language" />
        <Stack.Screen name="subscription" />
        <Stack.Screen
          name="swipe"
          options={{ presentation: 'transparentModal', animation: 'fade' }}
        />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  blank: {
    flex: 1,
    backgroundColor: Palette.background,
  },
});
