import DashboardTabs from "./DashboardTabs";
import { requireUser } from "@/lib/dashboard";
import styles from "./dashboard.module.css";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser("/dashboard");
  return (
    <div className={`y-container ${styles.shell}`}>
      <div className={styles.head}>
        <div className={styles.headText}>
          <h1 className="y-title">Dashboard</h1>
          <p className="y-muted">{user.email}</p>
        </div>
        <form action="/auth/signout" method="post">
          <button className={styles.signout} type="submit">Sign out</button>
        </form>
      </div>
      <DashboardTabs />
      {children}
    </div>
  );
}
