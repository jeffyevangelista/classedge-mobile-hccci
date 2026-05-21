import Screen from "@/components/screen";
import StudentList from "@/features/oversight/components/StudentList";

export default function StudentsTab() {
  return (
    <Screen className="py-2.5">
      <StudentList />
    </Screen>
  );
}
