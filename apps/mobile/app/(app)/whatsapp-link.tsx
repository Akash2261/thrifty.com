import { useFocusEffect } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import type { WhatsAppLinkResponse } from "@thrifty/shared";
import { ApiError } from "../../src/api/client";
import { createWhatsAppLinkCode, disconnectWhatsApp, getWhatsAppStatus } from "../../src/api/whatsapp";
import { track } from "../../src/lib/analytics";
import { colors, radii, spacing } from "../../src/theme/colors";

const POLL_INTERVAL_MS = 3000;

export default function WhatsAppLinkScreen() {
  const [status, setStatus] = useState<{ linked: boolean; phoneNumber: string | null } | null>(null);
  const [link, setLink] = useState<WhatsAppLinkResponse | null>(null);
  const [isGeneratingCode, setIsGeneratingCode] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const result = await getWhatsAppStatus();
      setStatus(result);
      if (result.linked && pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
        setLink(null);
        track("whatsapp_connected", {});
      }
      return result;
    } catch {
      return null;
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadStatus();
      return () => {
        if (pollRef.current) clearInterval(pollRef.current);
      };
    }, [loadStatus]),
  );

  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  async function handleGetCode() {
    setIsGeneratingCode(true);
    try {
      const result = await createWhatsAppLinkCode();
      setLink(result);
      pollRef.current = setInterval(loadStatus, POLL_INTERVAL_MS);
    } catch (err) {
      Alert.alert("Couldn't get a code", err instanceof ApiError ? err.message : "Try again.");
    } finally {
      setIsGeneratingCode(false);
    }
  }

  function handleDisconnect() {
    Alert.alert("Disconnect WhatsApp?", status?.phoneNumber ?? undefined, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Disconnect",
        style: "destructive",
        onPress: async () => {
          setIsDisconnecting(true);
          try {
            await disconnectWhatsApp();
            await loadStatus();
          } catch (err) {
            Alert.alert("Couldn't disconnect", err instanceof ApiError ? err.message : "Try again.");
          } finally {
            setIsDisconnecting(false);
          }
        },
      },
    ]);
  }

  if (status === null) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator />
      </View>
    );
  }

  if (status.linked) {
    return (
      <View style={styles.container}>
        <Text style={styles.intro}>
          Send a photo of a receipt or forward an order confirmation on WhatsApp and Thrifty will
          track it automatically.
        </Text>
        <View style={styles.linkedCard}>
          <Text style={styles.linkedLabel}>Connected number</Text>
          <Text style={styles.linkedNumber}>{status.phoneNumber}</Text>
        </View>
        {isDisconnecting ? (
          <ActivityIndicator style={{ marginTop: 16 }} />
        ) : (
          <Pressable style={styles.disconnectButton} onPress={handleDisconnect}>
            <Text style={styles.disconnectButtonText}>Disconnect</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.intro}>
        Link WhatsApp and Thrifty will scan receipt photos and order-confirmation texts you send
        it — no need to open the app.
      </Text>

      {link ? (
        <View style={styles.codeCard}>
          <Text style={styles.codeLabel}>Your code</Text>
          <Text style={styles.code}>{link.code}</Text>
          <Text style={styles.instructions}>
            Text this code to{" "}
            <Text style={styles.instructionsBold}>{link.businessNumber ?? "Thrifty's WhatsApp number"}</Text> to
            finish linking.
          </Text>
          <ActivityIndicator style={{ marginTop: 12 }} size="small" />
        </View>
      ) : (
        <Pressable style={styles.getCodeButton} onPress={handleGetCode} disabled={isGeneratingCode}>
          {isGeneratingCode ? <ActivityIndicator color={colors.textInverse} /> : <Text style={styles.getCodeButtonText}>Get linking code</Text>}
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.background },
  container: { padding: spacing.xl, gap: spacing.lg, backgroundColor: colors.background },
  intro: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
  getCodeButton: { backgroundColor: colors.primary, borderRadius: radii.md, paddingVertical: spacing.md + 2, alignItems: "center" },
  getCodeButtonText: { color: colors.textInverse, fontSize: 15, fontWeight: "600" },
  codeCard: { backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: spacing.xxl, alignItems: "center", gap: spacing.sm },
  codeLabel: { fontSize: 13, color: colors.textMuted },
  code: { fontSize: 40, fontWeight: "700", letterSpacing: 4, color: colors.textPrimary },
  instructions: { fontSize: 14, color: colors.textSecondary, textAlign: "center", marginTop: spacing.sm, lineHeight: 20 },
  instructionsBold: { fontWeight: "700", color: colors.textPrimary },
  linkedCard: { backgroundColor: colors.surfaceAlt, borderRadius: radii.md, padding: spacing.xl, gap: 4 },
  linkedLabel: { fontSize: 13, color: colors.textMuted },
  linkedNumber: { fontSize: 18, fontWeight: "600", color: colors.textPrimary },
  disconnectButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    paddingVertical: spacing.md + 2,
    alignItems: "center",
  },
  disconnectButtonText: { color: colors.danger, fontSize: 15, fontWeight: "600" },
});
