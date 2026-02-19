import { useState } from "react";
import { View, Text, Pressable, StyleSheet, Platform, Alert, ScrollView } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth-context";
import { apiRequest } from "@/lib/query-client";
import Colors from "@/constants/colors";

const LANGUAGES = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "zh", name: "Chinese" },
  { code: "ar", name: "Arabic" },
  { code: "hi", name: "Hindi" },
  { code: "ru", name: "Russian" },
  { code: "tr", name: "Turkish" },
  { code: "nl", name: "Dutch" },
  { code: "th", name: "Thai" },
  { code: "vi", name: "Vietnamese" },
];

export default function SettingsScreen() {
  const { user, logout, refreshUser } = useAuth();
  const insets = useSafeAreaInsets();
  const [selectedLang, setSelectedLang] = useState(user?.preferredLanguage || "en");
  const [showLanguages, setShowLanguages] = useState(false);

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  const handleLanguageChange = async (code: string) => {
    setSelectedLang(code);
    setShowLanguages(false);
    if (Platform.OS !== "web") Haptics.selectionAsync();
    try {
      await apiRequest("PUT", "/api/auth/profile", { preferredLanguage: code });
      refreshUser();
    } catch (e) {
      console.error("Failed to update language:", e);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      router.replace("/");
    } catch (e) {
      console.error("Logout error:", e);
    }
  };

  const handleDeleteAccount = async () => {
    if (Platform.OS === "web") {
      if (confirm("Are you sure? This will permanently delete your account and all data.")) {
        try {
          await apiRequest("DELETE", "/api/auth/account");
          router.replace("/");
        } catch (e) {
          console.error("Delete error:", e);
        }
      }
    } else {
      Alert.alert(
        "Delete Account",
        "This will permanently delete your account and all data. This cannot be undone.",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await apiRequest("DELETE", "/api/auth/account");
                router.replace("/");
              } catch (e) {
                console.error("Delete error:", e);
              }
            },
          },
        ]
      );
    }
  };

  const currentLangName = LANGUAGES.find((l) => l.code === selectedLang)?.name || selectedLang;

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.dark.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + webBottomInset + 20 }]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileSection}>
          <View style={styles.avatarLarge}>
            <Text style={styles.avatarLargeText}>
              {user?.displayName?.charAt(0).toUpperCase() || "?"}
            </Text>
          </View>
          <Text style={styles.profileName}>{user?.displayName}</Text>
          <Text style={styles.profileEmail}>{user?.email}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <Pressable
            style={styles.settingRow}
            onPress={() => setShowLanguages(!showLanguages)}
          >
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.dark.primaryMuted }]}>
                <Ionicons name="language" size={18} color={Colors.dark.primary} />
              </View>
              <View>
                <Text style={styles.settingLabel}>Preferred Language</Text>
                <Text style={styles.settingValue}>{currentLangName}</Text>
              </View>
            </View>
            <Ionicons name={showLanguages ? "chevron-up" : "chevron-down"} size={20} color={Colors.dark.textMuted} />
          </Pressable>

          {showLanguages && (
            <View style={styles.languageList}>
              {LANGUAGES.map((lang) => (
                <Pressable
                  key={lang.code}
                  style={[styles.languageOption, selectedLang === lang.code && styles.languageOptionSelected]}
                  onPress={() => handleLanguageChange(lang.code)}
                >
                  <Text style={[styles.languageOptionText, selectedLang === lang.code && styles.languageOptionTextSelected]}>
                    {lang.name}
                  </Text>
                  {selectedLang === lang.code && (
                    <Ionicons name="checkmark" size={18} color={Colors.dark.primary} />
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <Pressable style={styles.settingRow} onPress={handleLogout}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: Colors.dark.accentMuted }]}>
                <Ionicons name="log-out-outline" size={18} color={Colors.dark.accent} />
              </View>
              <Text style={styles.settingLabel}>Sign Out</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.dark.textMuted} />
          </Pressable>

          <Pressable style={styles.settingRow} onPress={handleDeleteAccount}>
            <View style={styles.settingLeft}>
              <View style={[styles.settingIcon, { backgroundColor: "rgba(255, 107, 107, 0.15)" }]}>
                <Ionicons name="trash-outline" size={18} color={Colors.dark.error} />
              </View>
              <Text style={[styles.settingLabel, { color: Colors.dark.error }]}>Delete Account</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.dark.textMuted} />
          </Pressable>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
  },
  content: {
    paddingHorizontal: 24,
    gap: 24,
  },
  profileSection: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: Colors.dark.accent,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 4,
  },
  avatarLargeText: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  profileName: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
  },
  profileEmail: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
  },
  section: {
    gap: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.textMuted,
    textTransform: "uppercase" as const,
    letterSpacing: 1,
    marginBottom: 4,
  },
  settingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  settingLabel: {
    fontSize: 15,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.text,
  },
  settingValue: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    marginTop: 1,
  },
  languageList: {
    backgroundColor: Colors.dark.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
    overflow: "hidden",
  },
  languageOption: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
  },
  languageOptionSelected: {
    backgroundColor: Colors.dark.primaryMuted,
  },
  languageOptionText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.text,
  },
  languageOptionTextSelected: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.primary,
  },
});
