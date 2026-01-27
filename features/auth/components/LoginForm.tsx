import { Button, Spinner, TextField, useThemeColor } from "heroui-native";
import { useState } from "react";
import { Alert, Pressable, TouchableOpacity, View } from "react-native";
import { EyeIcon, EyeSlashIcon } from "react-native-heroicons/outline";
import { useLogin } from "../auth.hooks";
import { Icon } from "@/components/Icon";
import { AppText } from "@/components/AppText";
import { colors } from "@/utils/colors";

const LoginForm = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const { mutateAsync: login, isPending, isError, error } = useLogin();
  const themeColorAccentForeground = useThemeColor("accent-foreground");

  const handleLogin = async () => {
    try {
      await login({ email, password });
    } catch (error: any) {
      Alert.alert("Error", error.message);
    }
  };

  return (
    <View className="p-2.5 md:p-5 gap-3">
      {/* Changed gap-4 to gap-3 */}
      <TextField>
        <TextField.Label>Email</TextField.Label>
        <TextField.Input
          keyboardType="email-address"
          autoCapitalize="none"
          placeholder="juandelacruz@hccci.edu.ph"
          value={email}
          onChangeText={setEmail}
        />

        {isError && (
          <TextField.ErrorMessage>
            {error?.message || "Please enter a valid email"}
          </TextField.ErrorMessage>
        )}
      </TextField>
      <View className="gap-1">
        <TextField>
          <TextField.Label>Password</TextField.Label>
          <View className="w-full flex-row items-center">
            <TextField.Input
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
                as={showPassword ? EyeIcon : EyeSlashIcon}
                size={20}
                color="gray"
              />
            </Pressable>
          </View>
        </TextField>
        <TouchableOpacity className="self-end py-1">
          <AppText style={{ fontSize: 12, color: colors.primary[600] }}>
            Forgot Password
          </AppText>
        </TouchableOpacity>
      </View>
      <Button
        isDisabled={isPending}
        size="lg"
        className="mt-2" // Reduced mt-4 to mt-2
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
