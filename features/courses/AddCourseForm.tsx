import useStore from "@/lib/store";
import { subjects } from "@/powersync/schema";
import { db } from "@/powersync/system";
import { colors } from "@/utils/colors";
import { BottomSheet, Button, TextField } from "heroui-native";
import { useState } from "react";
import { Alert, View } from "react-native";

const AddCourseForm = () => {
  const { authUser } = useStore();
  const [name, setName] = useState("");
  const [teacher, setTeacher] = useState("");
  const [room, setRoom] = useState("");

  const [isOpen, setIsOpen] = useState(false);
  const handleSubmit = async () => {
    try {
      await db.insert(subjects).values({
        name,
        teacherName: teacher,
        roomNumber: room,
        ownerId: String(authUser?.id!),
      });
      setName("");
    } catch (error) {
      console.log(error);
      Alert.alert("Error", "Failed to insert subject");
    }
    setIsOpen(false);
  };
  return (
    <>
      <View className="absolute bottom-3 md:bottom-6 right-3 md:right-6 z-50 ">
        <Button
          className="h-14 w-14 rounded-full "
          onPress={() => setIsOpen(true)}
        >
          <Button.Label className="text-white text-2xl">+</Button.Label>
        </Button>
      </View>
      <BottomSheet isOpen={isOpen} onOpenChange={setIsOpen}>
        <BottomSheet.Portal>
          <BottomSheet.Overlay />
          <BottomSheet.Content>
            <View className="max-w-3xl mx-auto w-full gap-2.5">
              <TextField>
                <TextField.Input
                  animation={{
                    borderColor: {
                      value: {
                        blur: colors.primary[500],
                      },
                    },
                  }}
                  placeholder="Course Name"
                  value={name}
                  onChangeText={setName}
                />
              </TextField>
              <TextField>
                <TextField.Input
                  animation={{
                    borderColor: {
                      value: {
                        blur: colors.primary[500],
                      },
                    },
                  }}
                  placeholder="Teacher"
                  value={teacher}
                  onChangeText={setTeacher}
                />
              </TextField>
              <TextField>
                <TextField.Input
                  animation={{
                    borderColor: {
                      value: {
                        blur: colors.primary[500],
                      },
                    },
                  }}
                  placeholder="Room"
                  value={room}
                  onChangeText={setRoom}
                />
              </TextField>
              <Button isDisabled={!name} onPress={handleSubmit}>
                <Button.Label>Submit</Button.Label>
              </Button>
            </View>
          </BottomSheet.Content>
        </BottomSheet.Portal>
      </BottomSheet>
    </>
  );
};

export default AddCourseForm;
