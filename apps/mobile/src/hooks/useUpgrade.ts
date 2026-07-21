import * as WebBrowser from "expo-web-browser";
import { useState } from "react";
import { Alert } from "react-native";
import { createCheckoutSession } from "../api/billing";
import { ApiError } from "../api/client";
import { useSession } from "../ctx/auth";
import { track } from "../lib/analytics";

export function useUpgrade() {
  const { refreshUser } = useSession();
  const [isUpgrading, setIsUpgrading] = useState(false);

  async function startUpgrade() {
    setIsUpgrading(true);
    try {
      const { checkoutUrl } = await createCheckoutSession();
      await WebBrowser.openBrowserAsync(checkoutUrl);

      // Payment webhooks can take a few seconds to arrive; poll briefly before giving up.
      for (let attempt = 0; attempt < 6; attempt++) {
        const me = await refreshUser();
        if (me.tier === "premium") {
          track("upgraded_to_premium");
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Couldn't start checkout. Try again.";
      Alert.alert("Upgrade failed", message);
    } finally {
      setIsUpgrading(false);
    }
  }

  return { isUpgrading, startUpgrade };
}
