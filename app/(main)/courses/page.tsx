import { CourseCatalog } from "@/components/CourseCatalog";
import { listCatalogCourses } from "@/lib/data";

export default async function CoursesPage() {
  const catalog = await listCatalogCourses();

  return (
    <div className="mx-auto max-w-6xl px-6 pt-14">
      <h1 className="font-serif text-[40px] font-bold">과목 찾기</h1>
      <p className="mt-2 max-w-[56ch] text-lg text-ink-soft">
        듣고 있는 수업이나 준비 중인 시험을 찾아보세요.
      </p>
      <div className="mt-10">
        <CourseCatalog courses={catalog} />
      </div>
    </div>
  );
}
