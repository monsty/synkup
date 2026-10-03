import { SymbolView } from 'expo-symbols';
import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PageLoader } from '@/components/page-loader';
import { BackButton, HEADER_SCROLL_THRESHOLD, ScreenHeader } from '@/components/screen-header';
import {
  formatPrice,
  formatQuota,
  getPlan,
  PLANS,
  type Plan,
  type PlanId,
} from '@/constants/plans';
import { Fonts, Palette, Radii, Spacing } from '@/constants/theme';
import { useMyUsage } from '@/queries/albums';
import { settingsApi } from '@/services/settings-api';

export default function SubscriptionScreen() {
  const insets = useSafeAreaInsets();
  const [planId, setPlanId] = useState<PlanId | null>(null);
  const usage = useMyUsage().data ?? null;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let active = true;
    settingsApi.getSettings().then((settings) => {
      if (active) setPlanId(settings.plan);
    });
    return () => {
      active = false;
    };
  }, []);

  const current = planId ? getPlan(planId) : null;
  const ratio = current && usage ? Math.min(1, usage.photos / current.photoQuota) : 0;

  const choose = (plan: Plan) => {
    // POC : pas de paiement. On montre juste l'intention.
    Alert.alert(
      `Passer à l'offre ${plan.name}`,
      "Les abonnements arrivent bientôt. Tu seras prévenu dès qu'ils seront disponibles.",
      [{ text: 'OK' }]
    );
  };

  return (
    <View style={styles.container}>
      <ScreenHeader left={<BackButton />} scrolled={scrolled} />
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        onScroll={(e) => setScrolled(e.nativeEvent.contentOffset.y > HEADER_SCROLL_THRESHOLD)}
        scrollEventThrottle={16}
        contentContainerStyle={[
          styles.content,
          { paddingTop: Spacing.two, paddingBottom: insets.bottom + Spacing.six },
        ]}>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Mon abonnement</Text>
          <Text style={styles.subtitle}>
            Seules les photos des albums que tu crées comptent. Participer est toujours gratuit.
          </Text>
        </View>

        {current && usage && (
          <>
            {/* Usage actuel */}
            <View style={styles.usage}>
              <View style={styles.usageHeader}>
                <Text style={styles.usageTitle}>Offre {current.name}</Text>
                <Text style={styles.usageAlbums}>
                  {usage.albums} album{usage.albums > 1 ? 's' : ''} créé
                  {usage.albums > 1 ? 's' : ''}
                </Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${Math.max(2, ratio * 100)}%` }]} />
              </View>
              <Text style={styles.usageText}>
                <Text style={styles.usageStrong}>{formatQuota(usage.photos)}</Text> photo
                {usage.photos > 1 ? 's' : ''} active{usage.photos > 1 ? 's' : ''} sur{' '}
                {formatQuota(current.photoQuota)}
              </Text>
              <Text style={styles.usageHint}>
                Seules les photos encore présentes dans tes albums comptent : en supprimer, ou
                supprimer un album, libère de la place.
              </Text>
            </View>

            {/* Les trois offres : même carte pour toutes, l'état se lit aux étiquettes. */}
            <View style={styles.plans}>
              {PLANS.map((plan) => {
                const isCurrent = plan.id === current.id;
                const recommended = plan.id === 'pro';
                return (
                  <View key={plan.id} style={[styles.plan, isCurrent && styles.planCurrent]}>
                    <View style={styles.planHeader}>
                      <View style={styles.planTitleBlock}>
                        <View style={styles.planTitleRow}>
                          <Text style={styles.planName}>{plan.name}</Text>
                          {isCurrent && (
                            <View style={[styles.tag, styles.tagCurrent]}>
                              <Text style={[styles.tagText, styles.tagTextCurrent]}>Ton offre</Text>
                            </View>
                          )}
                          {!isCurrent && recommended && (
                            <View style={[styles.tag, styles.tagRecommended]}>
                              <Text style={[styles.tagText, styles.tagTextRecommended]}>
                                Recommandée
                              </Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.planTagline}>{plan.tagline}</Text>
                      </View>
                      <Text style={styles.planPrice}>{formatPrice(plan)}</Text>
                    </View>
                    <View style={styles.planFeatures}>
                      <View style={styles.planFeature}>
                        <SymbolView
                          name={{
                            ios: 'photo.on.rectangle',
                            android: 'photo_library',
                            web: 'photo_library',
                          }}
                          size={16}
                          weight="bold"
                          tintColor={Palette.pink}
                          fallback={<Text style={styles.featureFallback}>▣</Text>}
                        />
                        <Text style={styles.planFeatureText}>
                          Jusqu&apos;à {formatQuota(plan.photoQuota)} photos actives
                        </Text>
                      </View>
                    </View>
                    {isCurrent ? (
                      <View style={[styles.planButton, styles.planButtonCurrent]}>
                        <Text style={styles.planButtonCurrentText}>Offre actuelle</Text>
                      </View>
                    ) : (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`Choisir l'offre ${plan.name}`}
                        onPress={() => choose(plan)}
                        style={({ pressed }) => [
                          styles.planButton,
                          styles.planButtonPink,
                          pressed && styles.pressed,
                        ]}>
                        <Text style={styles.planButtonText}>Choisir {plan.name}</Text>
                      </Pressable>
                    )}
                  </View>
                );
              })}
            </View>

            <Text style={styles.footnote}>
              Les membres de tes albums n&apos;ont rien à payer, quelle que soit ton offre. Prix
              indicatifs, abonnements bientôt disponibles.
            </Text>
          </>
        )}
      </ScrollView>
      {!(current && usage) && <PageLoader />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Palette.background,
  },
  content: {
    paddingHorizontal: Spacing.three,
    gap: Spacing.four,
  },
  titleBlock: {
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
  },
  title: {
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 26,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '600',
    textAlign: 'center',
  },
  usage: {
    gap: Spacing.two,
    padding: Spacing.three,
    borderRadius: Radii.tile,
    backgroundColor: Palette.card,
  },
  usageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  usageTitle: {
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 18,
    fontWeight: '800',
  },
  usageAlbums: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 13,
    fontWeight: '600',
  },
  track: {
    height: 8,
    borderRadius: Radii.pill,
    backgroundColor: Palette.surfaceStrong,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: Radii.pill,
    backgroundColor: Palette.pink,
  },
  usageText: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 14,
    fontWeight: '600',
  },
  usageStrong: {
    color: Palette.text,
    fontWeight: '800',
  },
  usageHint: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
  },
  plans: {
    gap: Spacing.three,
  },
  plan: {
    gap: Spacing.three,
    padding: Spacing.four,
    borderRadius: Radii.card,
    backgroundColor: Palette.card,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  /** L'offre en cours : bordure rose, tout le reste identique aux autres. */
  planCurrent: {
    borderColor: Palette.pink,
  },
  planTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    flexWrap: 'wrap',
  },
  tag: {
    height: 24,
    paddingHorizontal: Spacing.two,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tagCurrent: {
    backgroundColor: Palette.pink,
  },
  tagRecommended: {
    backgroundColor: Palette.mint,
  },
  tagText: {
    fontFamily: Fonts.rounded,
    fontSize: 12,
    fontWeight: '800',
  },
  tagTextCurrent: {
    color: Palette.onPhoto,
  },
  tagTextRecommended: {
    color: Palette.onMint,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  planTitleBlock: {
    flex: 1,
    gap: Spacing.half,
  },
  planName: {
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 22,
    fontWeight: '800',
  },
  planTagline: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 13,
    fontWeight: '600',
  },
  planPrice: {
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 16,
    fontWeight: '800',
    textAlign: 'right',
  },
  planFeatures: {
    gap: Spacing.two,
  },
  planFeature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  planFeatureText: {
    flex: 1,
    color: Palette.text,
    fontFamily: Fonts.rounded,
    fontSize: 15,
    fontWeight: '700',
  },
  featureFallback: {
    color: Palette.pink,
    fontSize: 14,
  },
  planButton: {
    height: 48,
    borderRadius: Radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planButtonPink: {
    backgroundColor: Palette.pink,
  },
  planButtonCurrent: {
    backgroundColor: Palette.surface,
  },
  planButtonText: {
    color: Palette.onPhoto,
    fontFamily: Fonts.rounded,
    fontSize: 16,
    fontWeight: '800',
  },
  planButtonCurrentText: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 15,
    fontWeight: '800',
  },
  footnote: {
    color: Palette.textMuted,
    fontFamily: Fonts.rounded,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
    paddingHorizontal: Spacing.two,
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }],
  },
});
