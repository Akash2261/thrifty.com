import { Redirect } from "expo-router";
import { useSession } from "../src/ctx/auth";

export default function RootIndex() {
  const { user, isLoading } = useSession();

  if (isLoading) {
    return null;
  }

  return <Redirect href={user ? "/(app)" : "/sign-in"} />;
}
