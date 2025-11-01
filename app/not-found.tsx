import ErrorShell from "@/app/components/ErrorShell";

export default function NotFound() {
  return (
    <ErrorShell
      title="הדף לא נמצא (404)"
      message={"העמוד שביקשת לא נמצא. ייתכן שהכתובת שונתה או שהעמוד הוסר."}
      showRetry={false}
      reportSubject={"דווח%20שגיאה%20-404"}
    />
  );
}
