import { useState, useEffect } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Platform, ScrollView } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { apiRequest } from "@/lib/query-client";
import { useAuth } from "@/lib/auth-context";
import Colors from "@/constants/colors";

const LANGUAGES = [
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

export default function JoinRoomScreen() {
  const { user } = useAuth();
  const [roomCode, setRoomCode] = useState("");
  const [selectedLanguage, setSelectedLanguage] = useState(user?.preferredLanguage || "en");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleJoin = async () => {
    const code = roomCode.trim().toUpperCase();
    if (code.length !== 6) {
      setError("Room code must be 6 characters");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const res = await apiRequest("POST", "/api/rooms/join", { 
        roomCode: code,
        language: selectedLanguage 
      });
      const room = await res.json();
      if (Platform.OS !== "web") Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.dismiss();
      setTimeout(() => {
        router.push({ pathname: "/chat/[id]", params: { id: room.id.toString() } });
      }, 300);
    } catch (e: any) {
      const msg = e.message || "";
      if (msg.includes("404")) {
        setError("Room not found. Check the code and try again.");
      } else {
        setError("Failed to join room");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Join a Room</Text>
      <Text style={styles.subtitle}>Enter the 6-character room code</Text>

      {!!error && (
        <View style={styles.errorContainer}>
          <Ionicons name="alert-circle" size={16} color={Colors.dark.error} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      <View style={styles.inputGroup}>
        <Text style={styles.label}>Room Code</Text>
        <View style={styles.codeInput}>
          <TextInput
            style={styles.input}
            placeholder="ABC123"
            placeholderTextColor={Colors.dark.textMuted}
            value={roomCode}
            onChangeText={(t) => setRoomCode(t.toUpperCase().slice(0, 6))}
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={6}
            textAlign="center"
          />
        </View>
      </View>

      <View style={styles.languageSection}>
        <Text style={styles.label}>Your Language for this Room</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.languageGrid}>
          {LANGUAGES.map((lang) => {
            const selected = selectedLanguage === lang.code;
            return (
              <Pressable
                key={lang.code}
                style={[styles.languageChip, selected && styles.languageChipSelected]}
                onPress={() => {
                  if (Platform.OS !== "web") Haptics.selectionAsync();
                  setSelectedLanguage(lang.code);
                }}
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
        style={({ pressed }) => [styles.joinButton, pressed && { opacity: 0.9 }, loading && { opacity: 0.6 }]}
        onPress={handleJoin}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator color="#0A1628" />
        ) : (
          <Text style={styles.joinButtonText}>Join Room</Text>
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
    gap: 20,
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
    marginTop: -12,
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
  codeInput: {
    backgroundColor: Colors.dark.inputBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  input: {
    height: 64,
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
    letterSpacing: 8,
    paddingHorizontal: 24,
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
  joinButton: {
    backgroundColor: Colors.dark.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: "center",
    marginTop: 8,
  },
  joinButtonText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: "#0A1628",
  },
});
