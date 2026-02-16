import { ScrollView, View } from "react-native";
import { useUserDetails } from "../profile.hooks";
import { AppText } from "@/components/AppText";
import { Card } from "heroui-native";

const ProfileInformation = () => {
  const { data, isLoading, isError, error, refetch, isRefetching } =
    useUserDetails();

  if (isLoading) return <AppText>loading...</AppText>;

  if (isError) return <AppText>{error.message}</AppText>;

  if (!data) return <AppText>No data found</AppText>;

  return (
    <ScrollView className="px-5">
      <InFormationComponent
        label="Full Name"
        value={data?.firstName + " " + data?.lastName}
      />
      <InFormationComponent label="Phone Number" value={data?.phoneNumber} />
      <InFormationComponent label="Date of Birth" value={data?.dateOfBirth} />
      <InFormationComponent label="Gender" value={data?.gender} />
      <InFormationComponent label="Nationality" value={data?.nationality} />
      <InFormationComponent label="Address" value={data?.address} />
      <InFormationComponent label="Id number" value={data?.idNumber} />
    </ScrollView>
  );
};

const InFormationComponent = ({
  label,
  value,
}: {
  label: string;
  value: string | null;
}) => {
  return (
    <Card className="mb-2.5 shadow-none  mx-auto w-full">
      <View className="flex-row justify-between items-center">
        <View>
          <AppText weight="regular" className="text-muted-foreground text-xs">
            {label}
          </AppText>
          <AppText weight="semibold" className="text-lg text-justify">
            {value}
          </AppText>
        </View>
      </View>
    </Card>
  );
};

export default ProfileInformation;
