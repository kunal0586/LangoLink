import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ScrollView, ActivityIndicator, Platform } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { apiRequest } from "@/lib/query-client";
import Colors from "@/constants/colors";

const POPULAR_LANGUAGES = [
  { code: "en", name: "English", flag: "EN" },
  { code: "es", name: "Spanish", flag: "ES" },
  { code: "fr", name: "French", flag: "FR" },
  { code: "de", name: "German", flag: "DE" },
  { code: "it", name: "Italian", flag: "IT" },
  { code: "pt", name: "Portuguese", flag: "PT" },
  { code: "ja", name: "Japanese", flag: "JA" },
  { code: "ko", name: "Korean", flag: "KO" },
  { code: "zh", name: "Chinese", flag: "ZH" },
  { code: "ar", name: "Arabic", flag: "AR" },
  { code: "hi", name: "Hindi", flag: "HI" },
  { code: "ru", name: "Russian", flag: "RU" },
];

export default function CreateRoomScreen() {
  const [name, setName] = useState("");
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(["en"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const toggleLanguage = (code: string) => {
    if (Platform.OS !== "web") Haptics.selectionAsync();
    setSelectedLanguages((prev) =>
      prev.includes(code) ? prev.filter((l) => l !== code) : [...prev, code]
    );
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      setError("Please enter a room name");
      return;
    }
    if (selectedLanguages.length === 0) {
      setError("Select at least one language");
      return;
    }
    setLoading(true);
    setError("");
    try {
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const res = await apiRequest("POST", "/api/rooms", { name: name.trim(), languages: selectedLanguages });
      const room = await res.json();
      router.dismiss();
      setTimeout(() => {
        router.push({ pathname: "/chat/[id]", params: { id: room.id.toString() } });
      }, 300);
    } catch (e: any) {
      setError("Failed to create room");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create a Room</Text>
      <Text style={styles.subtitle}>Set up a multilingual chat room</Text>

      {!!error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={16} color={Colors.dark.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Room Name</Text>
        <View style={styles.inputWrapper}>
          <TextInput
            style={styles.input}
            placeholder="e.g., Travel Buddies"
            placeholderTextColor={Colors.dark.textMuted}
            value={name}
            onChangeText={setName}
            maxLength={50}
          />
        </View>
      </View>

      <View style={styles.languageSection}>
        <Text style={styles.label}>Languages</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.languageGrid}>
          {POPULAR_LANGUAGES.map((lang) => {
            const selected = selectedLanguages.includes(lang.code);
            return (
              <Pressable
                key={lang.code}
                style={[styles.languageChip, selected && styles.languageChipSelected]}
                onPress={() => toggleLanguage(lang.code)}
              >
                <Text style={[styles.languageFlag, selected && styles.languageFlagSelected]}>{lang.flag}</Text>
                <Text style={[styles.languageName, selected && styles.languageNameSelected]}>{lang.name}</Text>
                {selected && <Ionicons name="checkmark-circle" size={16} color={Colors.dark.primary} />}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      <Pressable
        style={({ pressed }) => [styles.createButton, pressed && { opacity: 0.9 }, loading && { opacity: 0.6 }]}
        onPress={handleCreate}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#0A1628" />
        ) : (
          <Text style={styles.createButtonText}>Create Room</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
    paddingHorizontal: 24,
    paddingTop: 24,
    gap: 16,
  },
  title: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    marginTop: -8,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255, 107, 107, 0.1)",
    padding: 10,
    borderRadius: 8,
  },
  errorText: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.error,
  },
  inputGroup: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.textSecondary,
  },
  inputWrapper: {
    backgroundColor: Colors.dark.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  input: {
    height: 50,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.text,
  },
  languageSection: {
    gap: 8,
  },
  languageGrid: {
    gap: 8,
    paddingRight: 8,
  },
  languageChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: Colors.dark.surface,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  languageChipSelected: {
    backgroundColor: Colors.dark.primaryMuted,
    borderColor: "rgba(0, 212, 170, 0.4)",
  },
  languageFlag: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.textMuted,
  },
  languageFlagSelected: {
    color: Colors.dark.primary,
  },
  languageName: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textSecondary,
  },
  languageNameSelected: {
    color: Colors.dark.text,
  },
  createButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  createButtonText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: "#0A1628",
  },
});
