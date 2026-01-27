import { AppText } from "@/components/AppText";
import Image from "@/components/Image";
import LoginForm from "@/features/auth/components/LoginForm";
import MSAuthButton from "@/features/auth/components/MSAuthButton";
import { colors } from "@/utils/colors";
import React from "react";
import { useWindowDimensions, View } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const LoginScreen = () => {
	const { height } = useWindowDimensions();
	const insets = useSafeAreaInsets();

	// 1. Smaller thresholds for small screens (e.g. iPhone SE is ~667px)
	const isSmallScreen = height < 700;

	// 2. Reduce the empty space at the very top
	const dynamicTopPadding = isSmallScreen
		? insets.top + 10
		: Math.max(insets.top + 20, height * 0.05);

	// 3. Significantly reduce the inner vertical padding on small devices
	const innerVerticalPadding = isSmallScreen ? 10 : 40;

	return (
		<KeyboardAwareScrollView
			style={{ flex: 1, backgroundColor: colors.backgroundColor }}
			contentContainerStyle={{
				flexGrow: 1,
				paddingTop: dynamicTopPadding,
				paddingBottom: insets.bottom + 20,
			}}
		>
			<View
				className="flex-1 items-center justify-start"
				style={{
					paddingTop: innerVerticalPadding, // Reduced this
					backgroundColor: colors.backgroundColor,
				}}
			>
				<View className="w-full max-w-md px-2">
					{/* Reduced mb-5 to mb-2/4 for small screens */}
					<View className={`items-center ${isSmallScreen ? "mb-2" : "mb-6"}`}>
						<Image
							source={require("@/assets/logo.png")}
							// Dynamically toggle between w-16 (small) and w-20/24 (large)
							className={
								isSmallScreen ? "w-16 h-16" : "w-20 h-20 sm:w-24 sm:h-24"
							}
							contentFit="contain"
							style={{ marginBottom: isSmallScreen ? 8 : 16 }} // Tighten the gap below logo too
						/>
						<AppText weight="semibold" className="text-xl sm:text-2xl mt-1">
							Welcome to Classedge
						</AppText>
						{/* Optionally hide subtext or make it very small if space is critical */}
						<AppText className="text-xs text-gray-500 text-center px-4">
							Login to manage your classes and learning
						</AppText>
					</View>

					<LoginForm />

					{/* Reduced mt-12 (48px) to mt-6 (24px) */}
					<View
						className={`items-center gap-3 ${isSmallScreen ? "mt-6" : "mt-10"}`}
					>
						<AppText className="text-gray-500 text-xs">
							or continue with
						</AppText>
						<MSAuthButton />
					</View>
				</View>
			</View>
		</KeyboardAwareScrollView>
	);
};

export default LoginScreen;
