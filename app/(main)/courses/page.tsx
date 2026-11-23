import type { Metadata } from "next";
import { CourseCatalog } from "@/components/CourseCatalog";
import { listCatalogLectures, listCourses } from "@/lib/data";

export const metadata: Metadata = { title: "과목 찾기 | 선배클래스" };

export default async function CoursesPage() {
  const [courses, lectures] = await Promise.all([listCourses(), listCatalogLectures()]);

  return (
    <div className="mx-auto max-w-6xl px-6 pt-10">
      <CourseCatalog courses={courses} lectures={lectures} />
    </div>
  );
}
