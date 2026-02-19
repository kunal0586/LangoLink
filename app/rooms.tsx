import { useState, useEffect, useCallback } from "react";
import { View, Text, FlatList, Pressable, StyleSheet, Platform, ActivityIndicator, RefreshControl } from "react-native";
import { router } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import { useAuth } from "@/lib/auth-context";
import { apiRequest, getApiUrl } from "@/lib/query-client";
import { fetch } from "expo/fetch";
import Colors from "@/constants/colors";

interface Room {
  id: number;
  roomCode: string;
  name: string;
  createdBy: number;
  languages: string[];
  participantCount: number;
  createdAt: string;
}

export default function RoomsScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  const fetchRooms = useCallback(async () => {
    try {
      const baseUrl = getApiUrl();
      const url = new URL("/api/rooms", baseUrl);
      const res = await fetch(url.toString(), { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setRooms(data);
      }
    } catch (e) {
      console.error("Failed to fetch rooms:", e);
    }
  }, []);

  useEffect(() => {
    fetchRooms().finally(() => setLoading(false));
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRooms();
    setRefreshing(false);
  };

  const renderRoom = ({ item }: { item: Room }) => (
    <Pressable
      style={({ pressed }) => [styles.roomCard, pressed && { opacity: 0.8, transform: [{ scale: 0.98 }] }]}
      onPress={() => {
        if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        router.push({ pathname: "/chat/[id]", params: { id: item.id.toString() } });
      }}
    >
      <View style={styles.roomIcon}>
        <Ionicons name="chatbubbles" size={22} color={Colors.dark.primary} />
      </View>
      <View style={styles.roomInfo}>
        <Text style={styles.roomName} numberOfLines={1}>{item.name}</Text>
        <View style={styles.roomMeta}>
          <View style={styles.roomMetaItem}>
            <Ionicons name="people-outline" size={14} color={Colors.dark.textMuted} />
            <Text style={styles.roomMetaText}>{item.participantCount}</Text>
          </View>
          <View style={styles.roomMetaDot} />
          <View style={styles.roomMetaItem}>
            <Ionicons name="key-outline" size={14} color={Colors.dark.textMuted} />
            <Text style={styles.roomMetaText}>{item.roomCode}</Text>
          </View>
        </View>
      </View>
      <Ionicons name="chevron-forward" size={20} color={Colors.dark.textMuted} />
    </Pressable>
  );

  const EmptyState = () => (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <Ionicons name="chatbubbles-outline" size={48} color={Colors.dark.textMuted} />
      </View>
      <Text style={styles.emptyTitle}>No rooms yet</Text>
      <Text style={styles.emptySubtitle}>Create a room or join one with a code to start chatting</Text>
    </View>
  );

  return (
    <View style={[styles.container, { paddingTop: insets.top + webTopInset }]}>
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hello, {user?.displayName?.split(" ")[0]}</Text>
          <Text style={styles.headerTitle}>Your Rooms</Text>
        </View>
        <Pressable
          style={styles.settingsButton}
          onPress={() => router.push("/settings")}
        >
          <Ionicons name="settings-outline" size={22} color={Colors.dark.text} />
        </Pressable>
      </View>

      <View style={styles.actionRow}>
        <Pressable
          style={({ pressed }) => [styles.actionButton, styles.actionPrimary, pressed && { opacity: 0.9 }]}
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/create-room");
          }}
        >
          <Ionicons name="add" size={20} color="#0A1628" />
          <Text style={styles.actionPrimaryText}>Create Room</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [styles.actionButton, styles.actionSecondary, pressed && { opacity: 0.9 }]}
          onPress={() => {
            if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            router.push("/join-room");
          }}
        >
          <Ionicons name="enter-outline" size={20} color={Colors.dark.primary} />
          <Text style={styles.actionSecondaryText}>Join Room</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.dark.primary} />
        </View>
      ) : (
        <FlatList
          data={rooms}
          renderItem={renderRoom}
          keyExtractor={(item) => item.id.toString()}
          contentContainerStyle={[styles.listContent, { paddingBottom: insets.bottom + webBottomInset + 20 }]}
          ListEmptyComponent={EmptyState}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={Colors.dark.primary}
            />
          }
        />
      )}
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
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  greeting: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.textSecondary,
    marginBottom: 2,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    color: Colors.dark.text,
  },
  settingsButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: Colors.dark.surface,
    justifyContent: "center",
    alignItems: "center",
  },
  actionRow: {
    flexDirection: "row",
    paddingHorizontal: 24,
    gap: 12,
    marginBottom: 16,
  },
  actionButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  actionPrimary: {
    backgroundColor: Colors.dark.primary,
  },
  actionSecondary: {
    backgroundColor: Colors.dark.primaryMuted,
    borderWidth: 1,
    borderColor: "rgba(0, 212, 170, 0.3)",
  },
  actionPrimaryText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: "#0A1628",
  },
  actionSecondaryText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.primary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  listContent: {
    paddingHorizontal: 24,
    gap: 10,
  },
  roomCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.dark.surface,
    borderRadius: 14,
    padding: 16,
    gap: 14,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  roomIcon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: Colors.dark.primaryMuted,
    justifyContent: "center",
    alignItems: "center",
  },
  roomInfo: {
    flex: 1,
    gap: 4,
  },
  roomName: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
  },
  roomMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  roomMetaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  roomMetaText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textMuted,
  },
  roomMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: Colors.dark.textMuted,
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 80,
    paddingHorizontal: 40,
    gap: 12,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: Colors.dark.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 20,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
  },
  emptySubtitle: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
    textAlign: "center",
    lineHeight: 22,
  },
});
