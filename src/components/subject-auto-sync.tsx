"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import { autoSyncClassroomAction } from "@/app/subjects/[subjectId]/actions";

export function SubjectAutoSync({ offeringIds }: { offeringIds: number[] }) {
  const router = useRouter();
  const started = useRef(false);
  useEffect(() => {
    if (started.current || offeringIds.length === 0) return;
    started.current = true;
    void Promise.all(offeringIds.map(autoSyncClassroomAction)).then(
      (results) => {
        if (results.some(({ status }) => status === "synced")) router.refresh();
      },
    );
  }, [offeringIds, router]);
  return null;
}
