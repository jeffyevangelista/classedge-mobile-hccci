import MsLogo from "@/assets/ms-logo.svg";
import { Button, Spinner, useThemeColor, useToast } from "heroui-native";
import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import { useEffect, useRef, useState } from "react";
import { useMsLogin } from "../auth.hooks";
import { env } from "@/utils/env";

WebBrowser.maybeCompleteAuthSession();

const MSAuthButton = () => {
  const { toast } = useToast();
  const [authInProgress, setAuthInProgress] = useState(false);
  const msLoginMutation = useMsLogin();
  const themeColorAccentForeground = useThemeColor("accent-foreground");
  const processedCodeRef = useRef<string | null>(null);

  const discovery = {
    authorizationEndpoint: `https://login.microsoftonline.com/${env.EXPO_PUBLIC_MICROSOFT_TENANT_ID}/oauth2/v2.0/authorize`,
    tokenEndpoint: `https://login.microsoftonline.com/${env.EXPO_PUBLIC_MICROSOFT_TENANT_ID}/oauth2/v2.0/token`,
  };

  const redirectUri = AuthSession.makeRedirectUri({
    scheme: "classedge",
    path: "auth/callback",
  });

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID,
      scopes: ["api://183431e3-ef34-43eb-8dbe-c4e4b7da7786/read"],
      redirectUri,
      extraParams: {
        prompt: "select_account",
      },
    },
    discovery,
  );

  useEffect(() => {
    const getTokenAndUser = async () => {
      if (response?.type === "success" && request) {
        const authCode = response.params.code;

        // Prevent duplicate token exchanges with the same code
        if (processedCodeRef.current === authCode) {
          console.log("Authorization code already processed, skipping");
          return;
        }

        processedCodeRef.current = authCode;

        try {
          const tokenResult = await AuthSession.exchangeCodeAsync(
            {
              clientId: env.EXPO_PUBLIC_MICROSOFT_CLIENT_ID,
              code: authCode,
              redirectUri,
              extraParams: { code_verifier: request.codeVerifier! },
            },
            discovery,
          );
          if (tokenResult.accessToken) {
            msLoginMutation.mutateAsync(tokenResult.accessToken);
          } else {
            toast.show({
              variant: "danger",
              label: "No access token returned",
              description: JSON.stringify(tokenResult),
            });
            console.error("No access token returned:", tokenResult);
          }
        } catch (err) {
          toast.show({
            variant: "danger",
            label: "Token exchange failed",
            description: err instanceof Error ? err.message : "Unknown error",
          });
          console.error("Token exchange failed:", err);
          // Reset the ref on error so user can retry
          processedCodeRef.current = null;
        } finally {
          setAuthInProgress(false); // reset guard after exchange
        }
      } else if (response?.type !== "success") {
        setAuthInProgress(false); // reset even if canceled
      }
    };

    getTokenAndUser();
  }, [response]);

  const handleSignIn = async () => {
    if (!request || authInProgress) return;

    try {
      setAuthInProgress(true);
      await promptAsync();
    } catch (error) {
      toast.show({
        variant: "danger",
        label: "Sign-in failed",
        description: error instanceof Error ? error.message : "Unknown error",
      });
      console.error("Error during sign-in:", error);
      setAuthInProgress(false);
    }
  };

  return (
    <Button
      className="w-full"
      variant="primary"
      size="lg"
      onPress={handleSignIn}
      isDisabled={msLoginMutation.isPending || authInProgress}
    >
      {msLoginMutation.isPending || authInProgress ? (
        <Spinner color={themeColorAccentForeground} />
      ) : (
        <>
          <MsLogo width={24} height={24} />
          <Button.Label>Continue with Microsoft</Button.Label>
        </>
      )}
    </Button>
  );
};

export default MSAuthButton;
