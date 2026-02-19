import { useState, useEffect, useRef, useCallback } from "react";
import { View, Text, FlatList, TextInput, Pressable, StyleSheet, Platform, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { KeyboardAvoidingView } from "react-native-keyboard-controller";
import * as Haptics from "expo-haptics";
import Animated, { FadeIn } from "react-native-reanimated";
import { useAuth } from "@/lib/auth-context";
import { useSocket } from "@/lib/socket-context";
import { getApiUrl } from "@/lib/query-client";
import { fetch } from "expo/fetch";
import Colors from "@/constants/colors";

interface ChatMessage {
  id: number;
  roomId: number;
  senderId: number;
  content: string;
  translatedContent: Record<string, string> | null;
  originalLanguage: string | null;
  messageType: string;
  createdAt: string;
  sender: {
    id: number;
    displayName: string;
    profilePhoto: string | null;
  };
  translationResult?: {
    detectedLanguage: string;
    translations: Record<string, string>;
    confidence: number;
  };
}

interface RoomInfo {
  id: number;
  roomCode: string;
  name: string;
  participants: Array<{
    userId: number;
    language: string;
    user: { id: number; displayName: string };
  }>;
}

export default function ChatScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const { socket, isConnected, joinRoom, leaveRoom, sendMessage: socketSendMessage, sendTyping } = useSocket();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [inputText, setInputText] = useState("");
  const [loading, setLoading] = useState(true);
  const [typingUsers, setTypingUsers] = useState<Map<number, string>>(new Map());
  const [onlineUsers, setOnlineUsers] = useState<number[]>([]);
  const [showTranslation, setShowTranslation] = useState<number | null>(null);
  const inputRef = useRef<TextInput>(null);
  const flatListRef = useRef<FlatList>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const roomId = parseInt(id || "0");
  const webTopInset = Platform.OS === "web" ? 67 : 0;
  const webBottomInset = Platform.OS === "web" ? 34 : 0;

  const myLanguage = roomInfo?.participants.find((p) => p.userId === user?.id)?.language || "en";

  useEffect(() => {
    loadRoomData();
    return () => {
      if (roomId) leaveRoom(roomId);
    };
  }, [roomId]);

  useEffect(() => {
    if (isConnected && roomId) {
      joinRoom(roomId);
    }
  }, [isConnected, roomId]);

  useEffect(() => {
    if (!socket) return;

    const handleNewMessage = (msg: ChatMessage) => {
      if (msg.roomId === roomId) {
        setMessages((prev) => [...prev, msg]);
      }
    };

    const handleTyping = (data: { userId: number; roomId: number; isTyping: boolean }) => {
      if (data.roomId !== roomId || data.userId === user?.id) return;
      setTypingUsers((prev) => {
        const next = new Map(prev);
        if (data.isTyping) {
          const participant = roomInfo?.participants.find((p) => p.userId === data.userId);
          next.set(data.userId, participant?.user.displayName || "Someone");
        } else {
          next.delete(data.userId);
        }
        return next;
      });
    };

    const handleOnlineUsers = (data: { roomId: number; users: number[] }) => {
      if (data.roomId === roomId) {
        setOnlineUsers(data.users);
      }
    };

    socket.on("new_message", handleNewMessage);
    socket.on("user_typing", handleTyping);
    socket.on("online_users", handleOnlineUsers);

    return () => {
      socket.off("new_message", handleNewMessage);
      socket.off("user_typing", handleTyping);
      socket.off("online_users", handleOnlineUsers);
    };
  }, [socket, roomId, user?.id, roomInfo]);

  const loadRoomData = async () => {
    try {
      const baseUrl = getApiUrl();
      const [roomRes, msgsRes] = await Promise.all([
        fetch(new URL(`/api/rooms/${roomId}`, baseUrl).toString(), { credentials: "include" }),
        fetch(new URL(`/api/rooms/${roomId}/messages`, baseUrl).toString(), { credentials: "include" }),
      ]);

      if (roomRes.ok) {
        const room = await roomRes.json();
        setRoomInfo(room);
      }
      if (msgsRes.ok) {
        const msgs = await msgsRes.json();
        setMessages(msgs);
      }
    } catch (e) {
      console.error("Failed to load room data:", e);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = useCallback(() => {
    const text = inputText.trim();
    if (!text || !roomId) return;

    if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    socketSendMessage(roomId, text);
    setInputText("");
    sendTyping(roomId, false);
    inputRef.current?.focus();
  }, [inputText, roomId, socketSendMessage, sendTyping]);

  const handleTextChange = (text: string) => {
    setInputText(text);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    if (text.length > 0) {
      sendTyping(roomId, true);
      typingTimeoutRef.current = setTimeout(() => sendTyping(roomId, false), 2000);
    } else {
      sendTyping(roomId, false);
    }
  };

  const getTranslatedText = (msg: ChatMessage): string | null => {
    if (msg.senderId === user?.id) return null;
    const translations = msg.translationResult?.translations || msg.translatedContent;
    if (!translations) return null;
    return translations[myLanguage] || null;
  };

  const renderMessage = useCallback(({ item }: { item: ChatMessage }) => {
    const isMe = item.senderId === user?.id;
    const translation = getTranslatedText(item);
    const showingTranslation = showTranslation === item.id;

    return (
      <View style={[styles.messageRow, isMe && styles.messageRowMe]}>
        {!isMe && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {item.sender.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
        )}
        <View style={[styles.messageBubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
          {!isMe && <Text style={styles.senderName}>{item.sender.displayName}</Text>}
          <Text style={[styles.messageText, isMe && styles.messageTextMe]}>
            {showingTranslation && translation ? translation : item.content}
          </Text>
          {translation && !isMe && (
            <Pressable
              style={styles.translateToggle}
              onPress={() => {
                if (Platform.OS !== "web") Haptics.selectionAsync();
                setShowTranslation(showingTranslation ? null : item.id);
              }}
            >
              <Ionicons name="language" size={14} color={isMe ? "rgba(10,22,40,0.5)" : Colors.dark.primary} />
              <Text style={[styles.translateText, isMe && styles.translateTextMe]}>
                {showingTranslation ? "Show original" : "Translate"}
              </Text>
            </Pressable>
          )}
          {item.translationResult && item.translationResult.confidence > 0 && item.translationResult.confidence < 1 && showingTranslation && (
            <Text style={styles.confidenceText}>
              {Math.round(item.translationResult.confidence * 100)}% confidence
            </Text>
          )}
        </View>
      </View>
    );
  }, [user?.id, showTranslation, myLanguage]);

  const typingNames = Array.from(typingUsers.values());

  if (loading) {
    return (
      <View style={[styles.container, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" color={Colors.dark.primary} />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior="padding" keyboardVerticalOffset={0}>
      <View style={[styles.chatHeader, { paddingTop: insets.top + webTopInset + 8 }]}>
        <Pressable style={styles.headerBackButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.dark.text} />
        </Pressable>
        <View style={styles.headerInfo}>
          <Text style={styles.headerTitle} numberOfLines={1}>{roomInfo?.name || "Chat"}</Text>
          <View style={styles.headerMeta}>
            <View style={[styles.statusDot, isConnected && styles.statusDotOnline]} />
            <Text style={styles.headerSubtitle}>
              {onlineUsers.length} online
              {roomInfo?.roomCode ? ` \u00B7 ${roomInfo.roomCode}` : ""}
            </Text>
          </View>
        </View>
        <Pressable
          style={styles.headerAction}
          onPress={() => {
            setShowTranslation(null);
          }}
        >
          <Ionicons name="language" size={22} color={Colors.dark.primary} />
        </Pressable>
      </View>

      <FlatList
        ref={flatListRef}
        data={messages}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.messageList}
        showsVerticalScrollIndicator={false}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <View style={styles.emptyChatIcon}>
              <Ionicons name="chatbubble-ellipses-outline" size={40} color={Colors.dark.textMuted} />
            </View>
            <Text style={styles.emptyChatText}>Send the first message!</Text>
            <Text style={styles.emptyChatSubtext}>Messages will be translated automatically</Text>
          </View>
        }
      />

      {typingNames.length > 0 && (
        <View style={styles.typingIndicator}>
          <View style={styles.typingDots}>
            <View style={[styles.dot, styles.dot1]} />
            <View style={[styles.dot, styles.dot2]} />
            <View style={[styles.dot, styles.dot3]} />
          </View>
          <Text style={styles.typingText}>
            {typingNames.join(", ")} {typingNames.length === 1 ? "is" : "are"} typing
          </Text>
        </View>
      )}

      <View style={[styles.inputContainer, { paddingBottom: insets.bottom + webBottomInset + 8 }]}>
        <View style={styles.inputRow}>
          <TextInput
            ref={inputRef}
            style={styles.chatInput}
            placeholder="Type a message..."
            placeholderTextColor={Colors.dark.textMuted}
            value={inputText}
            onChangeText={handleTextChange}
            multiline
            maxLength={2000}
          />
          <Pressable
            style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
            onPress={handleSend}
            disabled={!inputText.trim()}
          >
            <Ionicons name="send" size={20} color={inputText.trim() ? "#0A1628" : Colors.dark.textMuted} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.dark.background,
  },
  chatHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: Colors.dark.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.dark.border,
    gap: 12,
  },
  headerBackButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  headerInfo: {
    flex: 1,
    gap: 2,
  },
  headerTitle: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
  },
  headerMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: Colors.dark.textMuted,
  },
  statusDotOnline: {
    backgroundColor: Colors.dark.primary,
  },
  headerSubtitle: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
  },
  headerAction: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  messageList: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 6,
    flexGrow: 1,
  },
  messageRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    marginBottom: 4,
  },
  messageRowMe: {
    flexDirection: "row-reverse",
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: Colors.dark.accent,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#fff",
  },
  messageBubble: {
    maxWidth: "75%",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    gap: 4,
  },
  bubbleMe: {
    backgroundColor: Colors.dark.primary,
    borderBottomRightRadius: 6,
  },
  bubbleOther: {
    backgroundColor: Colors.dark.card,
    borderBottomLeftRadius: 6,
  },
  senderName: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.accent,
    marginBottom: 2,
  },
  messageText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.text,
    lineHeight: 21,
  },
  messageTextMe: {
    color: "#0A1628",
  },
  translateToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
  },
  translateText: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.dark.primary,
  },
  translateTextMe: {
    color: "rgba(10,22,40,0.5)",
  },
  confidenceText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textMuted,
  },
  typingIndicator: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingVertical: 6,
  },
  typingDots: {
    flexDirection: "row",
    gap: 3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.dark.textMuted,
  },
  dot1: { opacity: 0.4 },
  dot2: { opacity: 0.6 },
  dot3: { opacity: 0.8 },
  typingText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textMuted,
  },
  inputContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
    backgroundColor: Colors.dark.surface,
    borderTopWidth: 1,
    borderTopColor: Colors.dark.border,
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 10,
  },
  chatInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    backgroundColor: Colors.dark.inputBg,
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 12,
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.text,
    borderWidth: 1,
    borderColor: Colors.dark.border,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: Colors.dark.primary,
    justifyContent: "center",
    alignItems: "center",
  },
  sendButtonDisabled: {
    backgroundColor: Colors.dark.inputBg,
  },
  emptyChat: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingTop: 100,
    gap: 8,
  },
  emptyChatIcon: {
    width: 72,
    height: 72,
    borderRadius: 22,
    backgroundColor: Colors.dark.surface,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  emptyChatText: {
    fontSize: 17,
    fontFamily: "Inter_600SemiBold",
    color: Colors.dark.text,
  },
  emptyChatSubtext: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.dark.textSecondary,
  },
});
