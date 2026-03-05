import { db } from "@/powersync/system";

export const getAnnouncementsWithEvents = () => {
  return db.query.announcementsTable.findMany({
    with: {
      createdById: {
        columns: {
          firstName: true,
          lastName: true,
          studentPhoto: true,
        },
      },
      events: {
        with: {
          event: true,
        },
      },
    },
  });
};
