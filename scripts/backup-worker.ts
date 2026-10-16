// Optional standalone worker for deployments without the realtime service.
import { tickBackupSchedule } from "../src/lib/v2/backup-service";
const tick = () =>
  void tickBackupSchedule().catch(() =>
    console.error("Backup worker: check Admin > System > Backup."),
  );
tick();
setInterval(tick, 60_000);
