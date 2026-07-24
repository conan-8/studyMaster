import { redirect } from "next/navigation";

/**
 * The landing page historically redirects to /exam, but sessions now live at
 * /exam/[sessionId]. Send anyone hitting the bare /exam path to the dashboard
 * where a real session can be started.
 */
export default function ExamIndexPage(): never {
  redirect("/app");
}
