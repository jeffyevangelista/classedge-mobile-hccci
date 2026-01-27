import Screen from "@/components/screen";
import AddCourseForm from "@/features/courses/AddCourseForm";
import CourseList from "@/features/courses/CourseList";

const CoursesScreen = () => {
  return (
    <Screen>
      <AddCourseForm />
      <CourseList />
    </Screen>
  );
};

export default CoursesScreen;
