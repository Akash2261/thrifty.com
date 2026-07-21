import { Expo, type ExpoPushMessage } from "expo-server-sdk";

const expo = new Expo({ accessToken: process.env.EXPO_ACCESS_TOKEN });

export async function sendPushNotifications(messages: ExpoPushMessage[]) {
  const validMessages = messages.filter((m) => Expo.isExpoPushToken(m.to));
  const chunks = expo.chunkPushNotifications(validMessages);

  for (const chunk of chunks) {
    try {
      await expo.sendPushNotificationsAsync(chunk);
    } catch (err) {
      console.error("Failed to send a push notification chunk", err);
    }
  }
}
