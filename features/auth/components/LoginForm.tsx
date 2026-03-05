import {
  Button,
  FieldError,
  Input,
  Label,
  Spinner,
  TextField,
  useThemeColor,
  useToast,
} from "heroui-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { useLogin } from "../auth.hooks";
import { Icon } from "@/components/Icon";
import { useRouter } from "expo-router";

const LoginForm = () => {
  const router = useRouter();
  const { toast } = useToast();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { mutateAsync: login, isPending, isError, error } = useLogin();
  const themeColorAccentForeground = useThemeColor("accent-foreground");

  const handleLogin = async () => {
    try {
      await login({ username, password });
    } catch (error: any) {
      toast.show({
        variant: "danger",
        label: "Error",
        description: error?.message,
      });
    }
  };

  return (
    <View className="p-2.5 md:p-5 gap-3 w-full max-w-md">
      {/* Changed gap-4 to gap-3 */}
      <TextField>
        <Label>Email</Label>
        <Input
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="juandelacruz@hccci.edu.ph"
          value={username}
          onChangeText={setUsername}
        />

        {isError && (
          <FieldError>
            {error?.message || "Please enter a valid email"}
          </FieldError>
        )}
      </TextField>
      <View className="gap-2">
        <TextField>
          <Label>Password</Label>
          <View className="w-full flex-row items-center">
            <Input
              value={password}
              onChangeText={setPassword}
              className="flex-1 pr-10"
              placeholder="Enter your password"
              secureTextEntry={!showPassword}
            />
            <Pressable
              className="absolute right-4"
              onPress={() => setShowPassword(!showPassword)}
            >
              <Icon
                name={showPassword ? "EyeIcon" : "EyeSlashIcon"}
                size={20}
                color="gray"
              />
            </Pressable>
          </View>
        </TextField>
        <Button
          onPress={() => router.push("/forgot-password")}
          variant="ghost"
          size="sm"
          className="self-end"
        >
          <Button.Label>Forgot Password</Button.Label>
        </Button>
      </View>
      <Button
        isDisabled={isPending}
        size="lg"
        className="mt-2"
        onPress={handleLogin}
      >
        {isPending ? (
          <Spinner color={themeColorAccentForeground} />
        ) : (
          <Button.Label>Login</Button.Label>
        )}
      </Button>
    </View>
  );
};

export default LoginForm;
